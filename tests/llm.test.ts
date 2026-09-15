import { configFromEnv, OpenAiSemanticAnalyzer, parseAiCandidates } from '../server/llm/openai';

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as unknown as Response;
}

function chatResponse(content: string): Response {
  return jsonResponse({ choices: [{ message: { content } }] });
}

describe('LLM config from environment', () => {
  it('returns null when no API key is configured (AI optional)', () => {
    expect(configFromEnv({})).toBeNull();
  });

  it('applies defaults with only a key configured', () => {
    const config = configFromEnv({ OPENAI_API_KEY: 'test-key' });
    expect(config).toEqual({
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      timeoutMs: 5000,
    });
  });

  it('honors base URL and model overrides', () => {
    const config = configFromEnv({
      OPENAI_API_KEY: 'k',
      OPENAI_BASE_URL: 'https://agentrouter.org/v1',
      OPENAI_MODEL: 'test-model',
    });
    expect(config?.baseUrl).toBe('https://agentrouter.org/v1');
    expect(config?.model).toBe('test-model');
  });
});

describe('AI candidate validation', () => {
  const count = 5;

  it('accepts valid candidates', () => {
    expect(
      parseAiCandidates(
        { candidates: [{ paragraph: 1, category: 'mandatory-arbitration' }, { paragraph: 4, category: 'hidden-fees' }] },
        count,
      ),
    ).toEqual([
      { paragraphIndex: 1, category: 'mandatory-arbitration' },
      { paragraphIndex: 4, category: 'hidden-fees' },
    ]);
  });

  it('drops out-of-range, non-integer, unknown-category, and malformed entries', () => {
    expect(
      parseAiCandidates(
        {
          candidates: [
            { paragraph: -1, category: 'hidden-fees' },
            { paragraph: 99, category: 'hidden-fees' },
            { paragraph: 1.5, category: 'hidden-fees' },
            { paragraph: 2, category: 'not-a-category' },
            { paragraph: '3', category: 'hidden-fees' },
            { category: 'hidden-fees' },
            'garbage',
            null,
          ],
        },
        count,
      ),
    ).toEqual([]);
  });

  it('deduplicates repeated category/paragraph pairs', () => {
    expect(
      parseAiCandidates(
        {
          candidates: [
            { paragraph: 2, category: 'hidden-fees' },
            { paragraph: 2, category: 'hidden-fees' },
          ],
        },
        count,
      ),
    ).toEqual([{ paragraphIndex: 2, category: 'hidden-fees' }]);
  });

  it('returns empty for completely malformed payloads', () => {
    expect(parseAiCandidates(null, count)).toEqual([]);
    expect(parseAiCandidates('nope', count)).toEqual([]);
    expect(parseAiCandidates({}, count)).toEqual([]);
    expect(parseAiCandidates({ candidates: 'nope' }, count)).toEqual([]);
  });
});

describe('OpenAI semantic analyzer', () => {
  const config = {
    apiKey: 'test-key',
    baseUrl: 'https://llm.test/v1',
    model: 'test-model',
    timeoutMs: 5000,
  };
  const paragraphs = [
    { text: 'We may modify these terms at any time.', index: 0 },
    { text: 'The service is provided as is.', index: 1 },
  ];

  async function captureCall(responder: () => Response) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return responder();
    };
    const analyzer = new OpenAiSemanticAnalyzer(config, fetchImpl);
    const candidates = await analyzer.detectParagraphs(paragraphs);
    return { candidates, calls };
  }

  it('sends a scoped request and parses plain JSON responses', async () => {
    const { candidates, calls } = await captureCall(() =>
      chatResponse('{"candidates":[{"paragraph":0,"category":"unilateral-modification"}]}'),
    );
    expect(candidates).toEqual([{ paragraphIndex: 0, category: 'unilateral-modification' }]);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://llm.test/v1/chat/completions');
    expect(call.init.method).toBe('POST');
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(String(call.init.body));
    expect(body.model).toBe('test-model');
    expect(body.messages[1].content).toContain('[0] We may modify these terms at any time.');
    expect(body.messages[1].content).toContain('unilateral-modification');
  });

  it('parses code-fenced JSON responses', async () => {
    const { candidates } = await captureCall(() =>
      chatResponse('```json\n{"candidates":[{"paragraph":1,"category":"account-termination"}]}\n```'),
    );
    expect(candidates).toEqual([{ paragraphIndex: 1, category: 'account-termination' }]);
  });

  it('returns no candidates from malformed model output (never crashes)', async () => {
    const { candidates } = await captureCall(() => chatResponse('I cannot answer that.'));
    expect(candidates).toEqual([]);
  });

  it('throws on HTTP failures so the analyzer can degrade', async () => {
    const analyzer = new OpenAiSemanticAnalyzer(config, async () => ({ ok: false, status: 503 }) as unknown as Response);
    await expect(analyzer.detectParagraphs(paragraphs)).rejects.toThrow('HTTP 503');
  });

  it('caps the data sent to the model (80 paragraphs, 500 chars each)', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      text: `Paragraph ${i} ${'x'.repeat(600)}`,
      index: i,
    }));
    const calls: Array<{ init: RequestInit }> = [];
    const analyzer = new OpenAiSemanticAnalyzer(config, async (_url, init) => {
      calls.push({ init });
      return chatResponse('{"candidates":[]}');
    });
    await analyzer.detectParagraphs(many);

    const body = JSON.parse(String(calls[0]!.init.body));
    const content: string = body.messages[1].content;
    expect(content).toContain('[79]');
    expect(content).not.toContain('[80]');
    expect(content.split('\n').filter((l: string) => l.startsWith('['))).toHaveLength(80);
    expect(calls[0]!.init.body as string).not.toContain('x'.repeat(501));
  });
});
