import { RISK_CATEGORIES, RiskCategory } from '../../shared/types';
import { RuleDefinition } from './types';

/**
 * The risk catalog is the source of truth for severity and definitions.
 * Severity is a deliberate engineering call per category; it is never
 * derived from AI output.
 */

const RULES_BY_CATEGORY: Record<RiskCategory, RuleDefinition> = {
  'unilateral-modification': {
    category: 'unilateral-modification',
    title: 'Unilateral Modification',
    severity: 'critical',
    definition:
      'Clause allowing the company to change the terms at any time, without notice, or effective immediately upon posting.',
    rationale:
      'Destroys user agency and predictability: the agreement you accepted can become materially unfavorable after you accepted it, with no consent required.',
    recommendation:
      'Look for language requiring advance notice (e.g. 30 days) and a chance to reject changes. Absent that, assume any term can change underneath you.',
    patterns: [
      /\b(modif\w*|amend\w*|updat\w*|chang\w*|revis\w*)[^.]{0,80}(terms|agreement|policy|policies)[^.]{0,120}(at any time|without (prior )?notice|effective (immediately|upon posting)|by posting|upon posting)/i,
      /reserve[sd]? the right[^.]{0,60}(modif\w*|amend\w*|updat\w*|chang\w*|revis\w*)[^.]{0,80}(terms|agreement|policy|policies)/i,
    ],
    negations: [
      /\b\d+[^.]{0,30}(day|week|month)[^.]{0,30}(prior to|before|in advance|notice)/i,
      /(will|shall)\s+(provide|give|notify)\s+(you\s+)?(at least\s+)?\d+[^.]{0,20}notice/i,
    ],
    baseConfidence: 85,
  },

  'mandatory-arbitration': {
    category: 'mandatory-arbitration',
    title: 'Mandatory Arbitration',
    severity: 'critical',
    definition:
      'Clause requiring disputes to be resolved by binding arbitration and/or waiving the right to a trial by jury or to sue in court.',
    rationale:
      'Removes access to the courts: no judge, no jury, no appeal on the merits, and proceedings are typically private, which also hides systemic issues from public view.',
    recommendation:
      'Check whether an opt-out window exists (often 30 days) and whether arbitration is genuinely optional. Note that arbitration costs and award limits can make small claims impractical.',
    jurisdictionNote:
      'US: enforceability varies by state and by consumer context. EU: consumer arbitration clauses are generally unenforceable against consumers under unfair-terms regimes.',
    patterns: [
      /binding arbitration/i,
      /(resolve[sd]?|settle[sd]?|submit(ted)?|hear[d]?)\s+(any\s+)?(all\s+)?(disputes?|claims?|controversies?)[^.]{0,80}(by|through|under)\s+(binding\s+)?arbitration/i,
      /(waive[sd]?|give[sd]? up|give up|relinquish)[^.]{0,60}(right|right to)\s+(to\s+)?(sue|a trial|trial by jury|go to court|jury trial)/i,
      /(disputes?|claims?)[^.]{0,60}(shall|will|must)\s+be\s+(finally\s+)?(resolved|determined|settled)[^.]{0,40}arbitration/i,
    ],
    negations: [
      /opt[-\s]?out/i,
      /arbitration\s+(is|remains)?\s*(optional|voluntary|non[-\s]?binding)/i,
      /(may|can)\s+(decline|reject|opt\s?out|revoke)/i,
    ],
    baseConfidence: 85,
  },

  'class-action-waiver': {
    category: 'class-action-waiver',
    title: 'Class-Action Waiver',
    severity: 'high',
    definition:
      'Clause preventing you from joining or bringing a claim as, or on behalf of, a class.',
    rationale:
      'Small individual harms become economically impractical to pursue alone, and companies escape aggregate accountability even when many users are affected identically.',
    recommendation:
      'Assume you would need to fund any dispute alone. Some jurisdictions limit these waivers; document the clause date and amounts if a dispute arises.',
    jurisdictionNote:
      'US: generally enforceable post AT&T Mobility v. Concepcion (2011). EU: collective redress mechanisms typically survive such waivers.',
    patterns: [
      /class[-\s]?action[^.]{0,60}waiv/i,
      /waiv(e|es|ing)[^.]{0,60}class[-\s]?action/i,
      /(may not|cannot|will not|shall not|not)\s+(be\s+)?(brought|brought as|join|joined|participat\w+|maintained)[^.]{0,60}(as\s+)?(a\s+)?(class[-\s]?action|class wide|representative (action|proceeding|capacity))/i,
      /(on|in)\s+a\s+(class|collective|representative)\s+basis/i,
      /class[-\s]?(wide|arbitration|relief|proceeding)/i,
      /individual (capacity|basis)|class member|class or representative proceeding/i,
    ],
    negations: [
      /(may|can|allowed to)\s+(join|participat\w+|bring)\s+[^.]{0,40}class[-\s]?action/i,
      /not\s+(prohibit|bar|prevent|waive)\s+[^.]{0,30}class[-\s]?action/i,
    ],
    baseConfidence: 80,
  },

  'automatic-renewal': {
    category: 'automatic-renewal',
    title: 'Automatic Renewal',
    severity: 'medium',
    definition:
      'Subscription or service renews automatically without an explicit renewal decision from you each term.',
    rationale:
      'Creates passive recurring charges: forgetting one cancellation deadline converts a deliberate purchase into an ongoing cost, and renewal terms may differ from the original offer.',
    recommendation:
      'Diary the renewal date now. Check whether reminders are promised and how renewal price changes are handled.',
    jurisdictionNote:
      'US: ROSCA and state auto-renewal laws require clear disclosure and cancellation mechanisms. EU: Consumer Rights Directive restricts rollover in some contracts.',
    patterns: [
      /(automatic(ally)?|auto)[-]?\s?renew/i,
      /(renew|renewal)[^.]{0,60}(automatically|until (you|terminated|cancelled|canceled))/i,
      /(subscription|membership|plan|service)[^.]{0,60}(will|shall|may)?\s*(be\s+)?(automatically\s+)?(renewed|continued)/i,
      /continue[^.]{0,40}(until|unless)[^.]{0,40}cancel/i,
    ],
    negations: [
      /(will|shall)\s+not\s+(automatically\s+)?renew/i,
      /not\s+automatically\s+renew/i,
      /does\s+not\s+auto[-\s]?renew/i,
    ],
    baseConfidence: 80,
  },

  'difficult-cancellation': {
    category: 'difficult-cancellation',
    title: 'Difficult Cancellation',
    severity: 'high',
    definition:
      'Cancellation requires phone calls, mailed letters, written notice, or other high-friction channels instead of self-service.',
    rationale:
      'Friction is a retention strategy: every added step (hold times, mail delays, "retention" calls) increases the chance you keep paying for something you tried to end.',
    recommendation:
      'Locate the exact cancellation procedure before paying. Prefer services with one-click cancellation; screenshot the stated method in case of disputes.',
    jurisdictionNote:
      'US: FTC click-to-cancel rulemaking targets these mechanics. EU: distance-selling rules generally require cancellation to be as easy as sign-up.',
    patterns: [
      /cancel[^.]{0,80}(by (phone|telephone|mail|letter|email|certified mail)|via (phone|telephone|mail)|calling|written notice|in writing)/i,
      /to cancel[^.]{0,80}(call|write|mail|contact)( us| customer| our)/i,
      /cancellations?[^.]{0,40}(must|will only|can only)\s+be\s+(made|accepted|submitted)[^.]{0,60}(phone|mail|writing|letter|notice)/i,
      /cannot\s+cancel\s+(online|through your account|in the app)/i,
      /(notice of )?non[-\s]?renewal[^.]{0,60}(must be )?(in writing|written|by mail|certified)/i,
    ],
    negations: [
      /(cancel|cancellation)[^.]{0,60}(at any time\s+)?(online|in your account|from your account|with (a|one) click|self[-\s]?service|in the app)/i,
    ],
    baseConfidence: 80,
  },

  'broad-liability-limitation': {
    category: 'broad-liability-limitation',
    title: 'Broad Liability Limitation',
    severity: 'high',
    definition:
      'Company excludes or caps liability across all or nearly all damages — including indirect, consequential, or all damages — with no carve-outs for its own misconduct.',
    rationale:
      'If the service fails and you suffer real loss, recovery may be zero regardless of fault. Broad exclusions transfer essentially all failure risk onto you.',
    recommendation:
      'Check for carve-outs (gross negligence, willful misconduct, data breaches). Note whether any cap is tied to amounts you actually paid.',
    patterns: [
      /(in no event|not\s+be\s+liable|not\s+liable|under no circumstances)[^.]{0,160}((any|all|indirect|consequential|special|incidental|punitive|exemplary)[^.]{0,160}(damages|losses|liability))/i,
      /(be\s+)?liable\s+for\s+(any|all)\s+(damages|losses)/i,
      /disclaims?\s+all\s+(warranties|representations)/i,
      /(total|aggregate|entire)\s+liability[^.]{0,60}(shall\s+not\s+exceed|is\s+limited\s+to|limited\s+to)/i,
    ],
    negations: [
      /(caused by|resulting from)[^.]{0,60}(our|its|their)\s+(own\s+)?(gross\s+)?(negligence|misconduct|willful|wrongdoing)/i,
    ],
    baseConfidence: 75,
  },

  'broad-indemnification': {
    category: 'broad-indemnification',
    title: 'Broad Indemnification',
    severity: 'high',
    definition:
      'You agree to cover the company against claims, damages, and legal costs — often "any and all" — arising from your use of the service.',
    rationale:
      'You can be made to pay the company\'s legal bills for disputes the company itself provoked, and "any and all" wording lets it trigger the duty in unexpected situations.',
    recommendation:
      'Look for scope limits (e.g. "to the extent caused by your breach") and whether the company must notify you and let you control the defense.',
    patterns: [
      /you\s+agree\s+to\s+(indemnify|defend|hold harmless)/i,
      /(indemnify|hold harmless|indemnity)[^.]{0,80}(against|from|for)\s+(any|all)\s+(claims?|damages?|liabilit(y|ies)|losses|costs|expenses)/i,
      /at\s+your\s+(own\s+)?(expense|cost)[^.]{0,80}(indemnify|defend)/i,
      /indemnif(y|ication)[^.]{0,120}(attorneys?['’]? ?fees|legal fees|court costs)/i,
    ],
    baseConfidence: 80,
  },

  'broad-data-sharing': {
    category: 'broad-data-sharing',
    title: 'Broad Data Sharing',
    severity: 'critical',
    definition:
      'Personal data shared with third parties without meaningful limits — affiliates, advertisers, data brokers, or "any purpose" grants.',
    rationale:
      'Once data leaves, you lose control of it: recipients get their own retention and security practices, and downstream sharing compounds exposure far beyond the original service.',
    recommendation:
      'Prefer policies that enumerate recipients and purposes. Watch for "affiliates", "marketing partners", and "business purposes" with no list attached.',
    jurisdictionNote:
      'EU/GDPR: requires a lawful basis and purpose limitation. US states (CCPA/CPA etc.): may grant opt-out and access rights.',
    patterns: [
      /(share|disclose|transfer|provide)[^.]{0,60}(with|to)\s+(any\s+)?third (parties|party)[^.]{0,120}(any purpose|any reason|as we (see fit|deem|determine)|at our discretion|for (marketing|advertising|commercial) purposes)/i,
      /(share|sell|disclose|transfer|provide)[^.]{0,80}(advertisers?|ad (networks|partners)|data brokers?|marketing partners?)/i,
      /(affiliates?|group companies|corporate famil\w+)[^.]{0,80}(for (their|any) (marketing|commercial|business) purposes|any purpose)/i,
      /(share|disclose|transfer)[^.]{0,60}(with|to)\s+(our\s+)?partners[^.]{0,60}(their own purposes|for (marketing|advertising))/i,
    ],
    negations: [
      /do(es)?\s+not\s+(share|sell|disclose|transfer)|never\s+(share|sell|disclose)/i,
      /only\s+(share|disclose|transfer)\s+[^.]{0,60}(with your consent|as you (direct|request))/i,
    ],
    baseConfidence: 80,
  },

  'data-sale-permission': {
    category: 'data-sale-permission',
    title: 'Data Sale Permission',
    severity: 'high',
    definition:
      'Explicit permission for the company to sell, rent, or monetize your personal information.',
    rationale:
      'A sale transfers your data to parties with no direct relationship to you and no obligation you ever accepted; monetization incentives also shape what else the company collects.',
    recommendation:
      'If a "Do Not Sell My Personal Information" right exists (e.g. CCPA), use it. Prefer services whose policy states they do not sell data.',
    jurisdictionNote:
      'CCPA/CPRA: sale/sharing triggers opt-out and opt-in rights for minors. GDPR: requires lawful basis for disclosure.',
    patterns: [
      /(sell|selling|sale of|rent|renting|monetiz\w+)[^.]{0,60}(personal )?(information|data)/i,
      /(your|user|personal)\s+(information|data)[^.]{0,60}(may|might|can)\s+be\s+sold/i,
    ],
    negations: [
      /do(es)?\s+not\s+sell|never\s+sell|don'?t\s+sell|not\s+for\s+sale/i,
    ],
    baseConfidence: 80,
  },

  'data-retention-ambiguity': {
    category: 'data-retention-ambiguity',
    title: 'Data Retention Ambiguity',
    severity: 'low',
    definition:
      'Policy keeps data "as long as necessary" or for an indefinite period instead of stating concrete retention periods.',
    rationale:
      'Vague retention means your data may outlive the relationship indefinitely, and you cannot verify deletion or reason about exposure over time.',
    recommendation:
      'Exercise deletion/account-closure rights and confirm whether backups are also purged. Concrete retention tables are a good sign; their absence is a flag.',
    jurisdictionNote:
      'GDPR Art. 5(1)(e) requires storage limitation with defined periods; vagueness is a compliance signal.',
    patterns: [
      /retain[^.]{0,80}(as long as|as needed|we deem|necessary|permitted)/i,
      /keep[^.]{0,80}(your )?(data|information)[^.]{0,80}(as long as (necessary|needed|permitted)|indefinite)/i,
      /for (an? )?(indefinite|unlimited|unspecified) period/i,
      /no (specific|fixed|defined) retention (period|limit)/i,
    ],
    negations: [
      /retain[^.]{0,80}(for|up to)\s+\d+\s*(day|week|month|year)/i,
      /delet\w+[^.]{0,60}(within|after)\s+\d+\s*(day|week|month|year)/i,
    ],
    baseConfidence: 75,
  },

  'account-termination': {
    category: 'account-termination',
    title: 'Account Termination Rights',
    severity: 'medium',
    definition:
      'Company can terminate, suspend, or delete your account at any time, for any reason, or without notice.',
    rationale:
      'Account loss can mean loss of purchased content, history, and access with no hearing and no appeal — and "any reason" includes no reason at all.',
    recommendation:
      'Back up anything you care about. Check whether a refund or data-export path is promised on termination.',
    patterns: [
      /(terminate|suspend|delete|deactivate|disable)[^.]{0,60}(your|the|a)\s+(?:\w+\s+)?(account|access)[^.]{0,120}(at any time|for any reason|without (prior )?notice|with or without cause)/i,
      /(reserve[sd]? the right)[^.]{0,60}(terminate|suspend|delete|deactivate)[^.]{0,120}(at any time|for any reason|without (prior )?notice)/i,
      /(terminate|suspend|delete)[^.]{0,60}(at any time|for any reason)/i,
    ],
    negations: [
      /for\s+(material\s+)?breach[^.]{0,40}(of|these)/i,
      /for\s+cause/i,
    ],
    baseConfidence: 80,
  },

  'venue-jurisdiction': {
    category: 'venue-jurisdiction',
    title: 'Forced Venue / Jurisdiction',
    severity: 'low',
    definition:
      'Disputes must be brought exclusively in a specific court or location chosen by the company.',
    rationale:
      'Forcing you to litigate in a distant venue raises the cost of any dispute until pursuing your rights is impractical.',
    recommendation:
      'Note the named venue and your local small-claims rights; some jurisdictions protect consumers from being hauled far from home.',
    patterns: [
      /exclusive (jurisdiction|venue)[^.]{0,120}(courts?|of|in)/i,
      /submit to the (personal )?jurisdiction/i,
      /(bring|brought|filed|commenced|litigated)[^.]{0,60}(exclusively\s+)?in the (state|federal|courts)/i,
      /venue[^.]{0,40}(shall be|will be|is|lies)[^.]{0,60}(county|state|city|courts?)/i,
    ],
    negations: [
      /small\s+claims/i,
    ],
    baseConfidence: 75,
  },

  'hidden-fees': {
    category: 'hidden-fees',
    title: 'Hidden Fees / Pricing Changes',
    severity: 'medium',
    definition:
      'Fees, charges, or prices may change at any time, or additional charges may apply without clear disclosure.',
    rationale:
      'Pricing you accepted can silently become pricing you never agreed to, and vaguely reserved "additional fees" can appear on bills after you are locked in.',
    recommendation:
      'Check whether price changes require advance notice and a cancellation window, and what happens to renewal pricing.',
    patterns: [
      /(fees?|charges?|prices?|pricing|rates?)[^.]{0,60}(subject to change|may change|can change|at any time)/i,
      /additional (fees|charges)[^.]{0,60}(may apply|apply|without notice)/i,
      /(price|pricing|fee) changes?[^.]{0,80}(at any time|without (prior )?notice|effective immediately)/i,
      /(charge|bill)[^.]{0,60}(your )?(payment method|credit card|card on file)[^.]{0,80}(without|for renewal)/i,
    ],
    negations: [
      /\b\d+[^.]{0,30}(day|week|month)[^.]{0,30}(prior to|before|in advance|notice)/i,
      /will\s+not\s+(increase|change)/i,
    ],
    baseConfidence: 75,
  },

  'broad-ip-ownership': {
    category: 'broad-ip-ownership',
    title: 'Broad IP / Content Ownership',
    severity: 'high',
    definition:
      'Company claims ownership of, or expansive perpetual/irrevocable rights over, your content — beyond a scoped hosting license.',
    rationale:
      'Content you created can be reused, sublicensed, or commercialized by the company (and its partners) with no revocation right, even after you leave the service.',
    recommendation:
      'Prefer grants limited to "operating and improving the service". Watch for "perpetual", "irrevocable", "sublicensable", "exclusive", and "assign" language.',
    patterns: [
      /(you (hereby )?(grant|assign|transfer|convey))[^.]{0,80}(us|to us|the company)[^.]{0,120}(perpetual|irrevocable|perpetuity|exclusive|sublicensable|ownership|all right,? title,? (and|&) interest)/i,
      /(assign|transfer)[^.]{0,40}(all\s+)?(right|title|interest)[^.]{0,60}(to us|in (your|the) content)/i,
      /(perpetual|irrevocable|sublicensable|exclusive)[^.]{0,40}(license|right)[^.]{0,60}(your content|user content|your (posts|submissions|materials))/i,
      /(your content|user content)[^.]{0,60}(becomes?|shall become|shall be)[^.]{0,40}(our|the company['’]?s)?\s*(sole\s+)?(property|exclusive)/i,
    ],
    negations: [
      /retain(s)?\s+(ownership|all (right|rights|title))/i,
      /(you|we)\s+(do|does)\s+not\s+claim\s+(ownership|any)/i,
    ],
    baseConfidence: 80,
  },

  'contradictory-clauses': {
    category: 'contradictory-clauses',
    title: 'Contradictory Clauses',
    severity: 'medium',
    definition:
      'Document states conflicting positions (e.g. one section promises a right another section removes).',
    rationale:
      'Ambiguity is resolved in drafting by the drafter: where sections conflict, the company controls the interpretation argument, and you cannot rely on the favorable reading.',
    recommendation:
      'Treat both clauses as untrustworthy until clarified in writing. Precedence clauses ("except as otherwise stated") decide these conflicts.',
    patterns: [],
    baseConfidence: 70,
    jurisdictionNote:
      'EU unfair-terms regimes weigh ambiguity against the drafter (contra proferentem); US courts apply it case-by-case.',
  },
};

/** All 15 rules in the canonical category order. */
export const RULES: readonly RuleDefinition[] = RISK_CATEGORIES.map(
  (category) => RULES_BY_CATEGORY[category],
);

export function ruleFor(category: RiskCategory): RuleDefinition {
  return RULES_BY_CATEGORY[category];
}
