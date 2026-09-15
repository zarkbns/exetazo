import { createServer } from './server';
import { configFromEnv, OpenAiSemanticAnalyzer } from '../llm/openai';

const port = Number(process.env.PORT ?? 8787);
const config = configFromEnv();
const ai = config ? new OpenAiSemanticAnalyzer(config) : null;

createServer({ ai }).listen(port, () => {
  if (config) {
    console.log(`Exetazo API listening on :${port} (semantic analysis enabled: ${config.model})`);
  } else {
    console.log(`Exetazo API listening on :${port} (rules-only — set OPENAI_API_KEY to enable semantic analysis)`);
  }
});
