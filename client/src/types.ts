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
  publishingPause?: boolean;
  engagementPause?: boolean;
  autonomousReplies?: boolean;
  autonomousLikes?: boolean;
  autonomousReposts?: boolean;
  demoMode: boolean;
  aiProvider: string;
  publishIntervalMinutes: number;
  categoryDistribution: Record<ContentCategory, number>;
  totalPublished: number;
  totalBlocked: number;
  totalStories: number;
  lastRunTimestamp: string | null;
  importantNewsMode?: {
    active: boolean;
    eventTitle?: string;
    overrideReason?: string;
    updateCount: number;
  };
  workerStatus?: {
    online: boolean;
    lastHeartbeat?: string;
    lastIngestion?: string;
    lastAiGeneration?: string;
    lastPublication?: string;
    status?: string;
  };
  databaseInfo?: {
    urlPresent: boolean;
    type: string;
    persistent: boolean;
  };
  platformStatus?: Record<PlatformTarget, { configured: boolean; mode: string }>;
  permissions?: Record<PlatformTarget, { configured: boolean; mode: string; reason?: string }>;
}

export interface MediaScores {
  visualValueScore: number;
  factualVisualRisk: number;
  copyrightRisk: number;
  misleadingContextRisk: number;
  accessibilityScore: number;
  platformFitScore: number;
  expectedInformationGain: number;
}

export interface MediaAsset {
  id: string;
  contentItemId?: string;
  assetType: string;
  seriesType?: string;
  sourceUrl?: string;
  rightsClassification: string;
  attributionText: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  sha256: string;
  altText: string;
  generatedBy: string;
  isAiGenerated: boolean;
  processingStatus: string;
  rejectionReason?: string;
  dataUrl?: string;
  scores: MediaScores;
  createdAt: string;
}

export interface MediaAnalyticsRecord {
  id: string;
  mediaAssetId?: string;
  draftId: string;
  hasVisual: boolean;
  visualType: string;
  seriesType?: string;
  platform: PlatformTarget;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  saves: number;
  shares: number;
  profileVisits: number;
  follows: number;
  linkClicks: number;
  timestamp: string;
}
