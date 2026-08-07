export type ContentCategory = 'CRYPTO_DEFI' | 'AI_WEB3' | 'STOCKS_MACRO';

export type PlatformTarget = 'BLUESKY' | 'FARCASTER' | 'TELEGRAM' | 'DISCORD';

export interface MarketTicker {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  category: ContentCategory;
  lastUpdated: string;
}

export interface MarketSnapshot {
  timestamp: string;
  crypto: MarketTicker[];
  stocks: MarketTicker[];
  macro: {
    dxy?: number;
    goldUsd?: number;
    brentOilUsd?: number;
    us10yYield?: number;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: ContentCategory;
  publishedAt: string;
  credibilityScore: number;
  rawContent?: string;
  isBreaking?: boolean;
}

export interface VerifiedClaim {
  claimId: string;
  statement: string;
  sources: string[];
  verificationCount: number;
  confidenceScore: number; // 0.0 - 1.0
  conflictingSources: boolean;
  category: ContentCategory;
}

export interface StoryCluster {
  id: string;
  title: string;
  category: ContentCategory;
  primaryNews: NewsItem[];
  verifiedClaims: VerifiedClaim[];
  impactScore: number; // 1-10
  noveltyScore: number; // 1-10
  overallScore: number; // 1-10
  timestamp: string;
  isImportantNews?: boolean;
  overrideReason?: string;
}

export interface StructuredContent {
  facts: string[];
  analysis: string;
  uncertainties: string[];
  forecasts: string;
  disclaimerRequired: 'NONE' | 'NFA' | 'EDUCATIONAL';
  disclaimerText?: string;
}

export interface QualityScores {
  factualAccuracy: number;      // 0-10
  sourceQuality: number;        // 0-10
  novelty: number;              // 0-10
  usefulness: number;           // 0-10
  clarity: number;              // 0-10
  hookStrength: number;         // 0-10
  audienceRelevance: number;    // 0-10
  platformFit: number;          // 0-10
  originality: number;          // 0-10
  riskOfMisleading: number;     // 0-10 (lower is better)
  spamRisk: number;             // 0-10 (lower is better)
  weightedTotalScore: number;   // 0-10
  factualConfidence: number;    // 0.0-1.0
  sourceConfidence: number;     // 0.0-1.0
  hookPassed: boolean;
  passed: boolean;
  failureReasons: string[];
}

export interface HashtagSelection {
  candidateTags: string[];
  selectedTags: Record<PlatformTarget, string[]>;
  categoryTag: string;
  nicheTag: string;
  eventTag?: string;
}

export interface PostDraft {
  id: string;
  storyId: string;
  category: ContentCategory;
  rawTopic: string;
  structuredContent: StructuredContent;
  platformPayloads: Record<PlatformTarget, string>;
  threadPayloads?: Record<PlatformTarget, string[]>;
  isThread?: boolean;
  qualityScores?: QualityScores;
  hashtags?: HashtagSelection;
  critiqueNotes?: string[];
  revisionCount: number;
  createdAt: string;
}

export interface ImportantNewsOverrideLog {
  id: string;
  storyId: string;
  title: string;
  conditionMatched: string;
  impactScore: number;
  sourcesCount: number;
  rolling24hCount: number;
  timestamp: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  blockReason?: string;
  blockCode?: string;
  confidenceScore: number;
  disclaimerType: 'NONE' | 'NFA' | 'EDUCATIONAL';
  disclaimerAdded: boolean;
  qualityScores?: QualityScores;
  details: {
    verifiedFactCount: number;
    sourceConflicts: boolean;
    givesInvestmentAdvice: boolean;
    promisesReturns: boolean;
    illegalOrFraud: boolean;
    harmfulContent: boolean;
    impersonation: boolean;
    duplicateDetected: boolean;
    similarityScore: number;
    panicInducing: boolean;
  };
}

export interface BlockedPost {
  id: string;
  draftId: string;
  storyTitle: string;
  category: ContentCategory;
  blockCode: string;
  blockReason: string;
  confidenceScore: number;
  draftContent: string;
  safetyDetails: SafetyCheckResult['details'];
  qualityScores?: QualityScores;
  timestamp: string;
}

export interface PublicationResult {
  id: string;
  draftId: string;
  platform: PlatformTarget;
  status: 'SUCCESS' | 'SIMULATED' | 'FAILED';
  postId?: string;
  postUrl?: string;
  payload: string;
  error?: string;
  publishedAt: string;
}

export interface SystemStatus {
  emergencyPause: boolean;
  demoMode: boolean;
  aiProvider: string;
  publishIntervalMinutes: number;
  rolling24hPostCount: number;
  rolling24hLimit: number;
  emergencyLimit: number;
  categoryDistribution: Record<ContentCategory, number>;
  totalPublished: number;
  totalBlocked: number;
  totalStories: number;
  lastRunTimestamp: string | null;
  platformStatus: Record<PlatformTarget, { configured: boolean; mode: string }>;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  module: string;
  message: string;
  data?: any;
}

export type EngagementActionType = 'LIKE' | 'REPOST' | 'QUOTE' | 'REPLY' | 'MENTION' | 'FOLLOW' | 'BOOKMARK';

export type ActionStatus = 'SIMULATED' | 'QUEUED' | 'ATTEMPTED' | 'SUCCESS' | 'FAILED' | 'BLOCKED';

export type CommentCategory = 
  | 'GENUINE_QUESTION'
  | 'REQUEST_CLARIFICATION'
  | 'CONSTRUCTIVE_DISAGREEMENT'
  | 'RELEVANT_INFO'
  | 'SPAM'
  | 'SCAM'
  | 'PHISHING'
  | 'HARASSMENT'
  | 'EXPLICIT_UNSAFE'
  | 'FINANCIAL_ADVICE_REQUEST'
  | 'IRRELEVANT';

export interface EngagementScores {
  relevanceScore: number;            // 0-10
  sourceCredibilityScore: number;    // 0-10
  conversationUsefulnessScore: number;// 0-10
  audienceAlignmentScore: number;   // 0-10
  spamRisk: number;                  // 0-10 (lower is better)
  misinterpretationRisk: number;   // 0-10 (lower is better)
  policyRisk: number;                // 0-10 (lower is better)
  repetitionScore: number;           // 0-10 (lower is better)
  confidenceScore: number;          // 0.0-1.0
  weightedValueScore: number;        // 0-10
}

export interface EngagementAction {
  id: string;
  platform: PlatformTarget;
  actionType: EngagementActionType;
  targetPostId: string;
  targetAccountId: string;
  targetUrl: string;
  selectedReason: string;
  generatedText?: string;
  scores: EngagementScores;
  policyDecision: string;
  providerResponse?: any;
  providerId?: string;
  timestamp: string;
  status: ActionStatus;
  errorDetails?: string;
}

export interface OwnPostComment {
  id: string;
  platform: PlatformTarget;
  originalPostId: string;
  commenterId: string;
  commenterHandle: string;
  commentText: string;
  category: CommentCategory;
  timestamp: string;
  processed: boolean;
  replyActionId?: string;
  correctionMarker?: boolean;
}

export interface ProtectionSettings {
  minMinutesBetweenEventUpdates: number;
  maxUpdatesPerEvent: number;
  maxPlatformApiCallsPerHour: number;
  maxAutonomousActionsPerHour: number;
  emergencyModeTimeoutMinutes: number;
  autoReturnToNormalMode: boolean;
}

export interface ImportantNewsModeState {
  active: boolean;
  currentEventId?: string;
  eventTitle?: string;
  overrideReason?: string;
  sourceEvidence: string[];
  activatedAt?: string;
  lastUpdateAt?: string;
  updateCount: number;
}

export type PlatformCapabilityMatrix = Record<PlatformTarget, Record<EngagementActionType, boolean>>;

export type PermissionStatus = Record<PlatformTarget, {
  configured: boolean;
  readPermissions: boolean;
  writePermissions: boolean;
  scopes: string[];
  missingScopes: string[];
  mode: 'LIVE' | 'DEMO' | 'UNAVAILABLE';
  reason?: string;
}>;

