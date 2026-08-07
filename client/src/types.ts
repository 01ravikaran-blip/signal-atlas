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
}

export interface VerifiedClaim {
  claimId: string;
  statement: string;
  sources: string[];
  verificationCount: number;
  confidenceScore: number;
  conflictingSources: boolean;
  category: ContentCategory;
}

export interface StoryCluster {
  id: string;
  title: string;
  category: ContentCategory;
  primaryNews: NewsItem[];
  verifiedClaims: VerifiedClaim[];
  impactScore: number;
  noveltyScore: number;
  overallScore: number;
  timestamp: string;
}

export interface SafetyDetails {
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
  safetyDetails: SafetyDetails;
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
  categoryDistribution: Record<ContentCategory, number>;
  totalPublished: number;
  totalBlocked: number;
  totalStories: number;
  lastRunTimestamp: string | null;
  platformStatus: Record<PlatformTarget, { configured: boolean; mode: string }>;
}
