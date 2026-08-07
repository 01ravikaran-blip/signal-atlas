export const BLOCK_CODES = {
  UNVERIFIED_FACTS: 'BLOCK_UNVERIFIED_FACTS',
  SOURCE_CONFLICT: 'BLOCK_SOURCE_CONFLICT',
  LOW_CONFIDENCE: 'BLOCK_LOW_CONFIDENCE',
  FINANCIAL_ADVICE: 'BLOCK_FINANCIAL_ADVICE',
  GUARANTEED_RETURNS: 'BLOCK_GUARANTEED_RETURNS',
  ILLEGAL_OR_FRAUD: 'BLOCK_ILLEGAL_OR_FRAUD',
  HARMFUL_CONTENT: 'BLOCK_HARMFUL_CONTENT',
  IMPERSONATION: 'BLOCK_IMPERSONATION',
  DUPLICATE_CONTENT: 'BLOCK_DUPLICATE_CONTENT',
  PANIC_INDUCING: 'BLOCK_PANIC_INDUCING',
  POLICY_OR_RATE_LIMIT: 'BLOCK_POLICY_OR_RATE_LIMIT'
} as const;

export const PROHIBITED_KEYWORDS = {
  financialAdvice: [
    'buy now', 'sell immediately', 'guaranteed profit', 'insider tip',
    'you should invest', 'put your money', '100% gain', 'moon shot guaranteed',
    'target price guarantee', 'financial advice'
  ],
  guaranteedReturns: [
    'guaranteed return', 'risk-free return', '100x return', 'zero risk',
    'cannot lose', 'double your money'
  ],
  illegalOrFraud: [
    'pump and dump', 'insider trading tips', 'evade taxes', 'wash trading scheme',
    'front-run market', 'exit scam instructions'
  ],
  panicTerms: [
    'total collapse inevitable', 'imminent global bankruptcy today',
    'banks shutting down worldwide right now', 'apocalypse market wipeout'
  ]
};
