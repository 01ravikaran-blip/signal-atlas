import { db } from '../db/database.ts';
import {
  PlatformTarget,
  EngagementActionType,
  EngagementAction,
  EngagementScores,
  PlatformCapabilityMatrix,
  PermissionStatus
} from '../types.js';
import { likeOnBluesky, repostOnBluesky } from '../publishers/blueskyPublisher.ts';
import { likeOnFarcaster, recastOnFarcaster } from '../publishers/farcasterPublisher.ts';

export const CAPABILITY_MATRIX: PlatformCapabilityMatrix = {
  BLUESKY: {
    LIKE: true,
    REPOST: true,
    QUOTE: true,
    REPLY: true,
    MENTION: true,
    FOLLOW: false, // Only if explicitly enabled later
    BOOKMARK: true
  },
  FARCASTER: {
    LIKE: true,
    REPOST: true,
    QUOTE: true,
    REPLY: true,
    MENTION: true,
    FOLLOW: false,
    BOOKMARK: false
  },
  TELEGRAM: {
    LIKE: false,
    REPOST: false,
    QUOTE: false,
    REPLY: true,
    MENTION: true,
    FOLLOW: false,
    BOOKMARK: false
  },
  DISCORD: {
    LIKE: false,
    REPOST: false,
    QUOTE: false,
    REPLY: true,
    MENTION: true,
    FOLLOW: false,
    BOOKMARK: false
  }
};

export function getPermissionStatusReport(): PermissionStatus {
  const bskyConfigured = Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
  const fcConfigured = Boolean(process.env.FARCASTER_WARPCAST_SECRET || (process.env.FARCASTER_NEYNAR_API_KEY && process.env.FARCASTER_SIGNER_UUID));
  const tgConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const discConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL || (process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL_ID));

  const isDemo = db.getSettings().demoMode;

  return {
    BLUESKY: {
      configured: bskyConfigured,
      readPermissions: bskyConfigured,
      writePermissions: bskyConfigured,
      scopes: ['atproto', 'com.atproto.repo.createRecord', 'com.atproto.identity.resolveHandle'],
      missingScopes: bskyConfigured ? [] : ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
      mode: bskyConfigured ? (isDemo ? 'DEMO' : 'LIVE') : 'DEMO',
      reason: bskyConfigured ? undefined : 'Missing AT Protocol app password credentials; operating in DEMO_MODE.'
    },
    FARCASTER: {
      configured: fcConfigured,
      readPermissions: fcConfigured,
      writePermissions: fcConfigured,
      scopes: ['farcaster:cast', 'farcaster:reaction', 'neynar:write'],
      missingScopes: fcConfigured ? [] : ['FARCASTER_SIGNER_UUID', 'FARCASTER_NEYNAR_API_KEY'],
      mode: fcConfigured ? (isDemo ? 'DEMO' : 'LIVE') : 'DEMO',
      reason: fcConfigured ? undefined : 'Missing Neynar signer UUID or Warpcast secret; operating in DEMO_MODE.'
    },
    TELEGRAM: {
      configured: tgConfigured,
      readPermissions: false, // Telegram Bots cannot read channel comments without Webhook/GetUpdates permission
      writePermissions: tgConfigured,
      scopes: ['bot:send_message'],
      missingScopes: tgConfigured ? [] : ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
      mode: tgConfigured ? (isDemo ? 'DEMO' : 'LIVE') : 'UNAVAILABLE',
      reason: tgConfigured ? 'Comment monitoring requires bot channel admin permissions.' : 'Missing Bot Token.'
    },
    DISCORD: {
      configured: discConfigured,
      readPermissions: false, // Discord Webhooks are write-only
      writePermissions: discConfigured,
      scopes: ['bot:send_messages', 'webhook:execute'],
      missingScopes: discConfigured ? [] : ['DISCORD_WEBHOOK_URL'],
      mode: discConfigured ? (isDemo ? 'DEMO' : 'LIVE') : 'UNAVAILABLE',
      reason: discConfigured ? 'Webhooks cannot read channel mentions without Discord Bot Gateway.' : 'Missing Webhook URL.'
    }
  };
}

export function evaluateEngagementScores(
  actionType: EngagementActionType,
  content: string,
  sourceCredibility = 0.9,
  isOfficialSource = false
): EngagementScores {
  const lower = content.toLowerCase();

  const isSpam = lower.includes('moon') || lower.includes('100x') || lower.includes('airdrop') || lower.includes('giveaway') || lower.includes('dm me');
  const spamRisk = isSpam ? 9.0 : 0.5;

  const isHype = lower.includes('guaranteed') || lower.includes('buy now') || lower.includes('free money');
  const policyRisk = isHype ? 8.5 : 0.5;

  const relevanceScore = (lower.includes('crypto') || lower.includes('defi') || lower.includes('ai') || lower.includes('market') || lower.includes('sec') || lower.includes('fed') || lower.includes('solana') || lower.includes('ethereum')) ? 9.5 : 4.0;
  const sourceCredibilityScore = sourceCredibility * 10;
  const conversationUsefulnessScore = isOfficialSource ? 9.5 : 9.0;
  const audienceAlignmentScore = 9.0;
  const misinterpretationRisk = 1.0;
  const repetitionScore = 1.0;
  const confidenceScore = sourceCredibility;

  // Weighted Value Calculation (scale to 10)
  const weightedValueScore = (
    relevanceScore * 0.25 +
    sourceCredibilityScore * 0.25 +
    conversationUsefulnessScore * 0.25 +
    audienceAlignmentScore * 0.25 -
    spamRisk * 0.05
  );

  return {
    relevanceScore,
    sourceCredibilityScore,
    conversationUsefulnessScore,
    audienceAlignmentScore,
    spamRisk,
    misinterpretationRisk,
    policyRisk,
    repetitionScore,
    confidenceScore,
    weightedValueScore: Math.max(0, Math.min(10, weightedValueScore))
  };
}

export class EngagementEngine {
  public async executeLikeAction(
    platform: PlatformTarget,
    targetPostId: string,
    targetAccountId: string,
    targetUrl: string,
    content: string,
    sourceCredibility = 0.9
  ): Promise<{ status: string; actionId?: string; reason?: string }> {
    // 1. Check Global & Granular Pauses
    if (db.isEngagementPaused()) {
      return { status: 'BLOCKED', reason: 'Engagement engine is paused.' };
    }
    const settings = db.getSettings();
    if (!settings.autonomousLikes) {
      return { status: 'BLOCKED', reason: 'Autonomous likes globally disabled in settings.' };
    }
    const platformToggle = settings.perPlatformToggles[platform];
    if (platformToggle && (!platformToggle.enabled || !platformToggle.likes)) {
      return { status: 'BLOCKED', reason: `Likes disabled for platform ${platform}.` };
    }

    // 2. Capability Matrix Check
    if (!CAPABILITY_MATRIX[platform]?.LIKE) {
      db.addLog('WARN', 'ENGAGEMENT', `Platform ${platform} does not officially support autonomous LIKE actions.`);
      return { status: 'BLOCKED', reason: `Platform ${platform} does not support LIKE capability.` };
    }

    // 3. Rate Limits & Budgets Check (Max 30 likes/platform/24h, Max 5/account/24h)
    const now = new Date().getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const pastActions = db.getEngagementActions(500);

    const platformLikes24h = pastActions.filter(a =>
      a.platform === platform &&
      a.actionType === 'LIKE' &&
      (a.status === 'SUCCESS' || a.status === 'SIMULATED') &&
      (now - new Date(a.timestamp).getTime()) <= twentyFourHoursMs
    );

    if (platformLikes24h.length >= 30) {
      return { status: 'BLOCKED', reason: `Max 30 likes per 24h budget reached for ${platform}.` };
    }

    const accountLikes24h = platformLikes24h.filter(a => a.targetAccountId === targetAccountId);
    if (accountLikes24h.length >= 5) {
      return { status: 'BLOCKED', reason: `Max 5 likes per account per 24h reached for account ${targetAccountId}.` };
    }

    // 4. Score Evaluation
    const scores = evaluateEngagementScores('LIKE', content, sourceCredibility);
    if (scores.weightedValueScore < 8.0 || scores.spamRisk > 3.0 || scores.policyRisk > 3.0) {
      return { status: 'BLOCKED', reason: `Engagement score (${scores.weightedValueScore.toFixed(1)}/10) below minimum 8.0 threshold or high risk.` };
    }

    // 5. Execution (Simulated vs Real)
    const isDemo = settings.demoMode;
    let providerResponse: any = { simulated: true };
    let providerId: string | undefined = undefined;
    let finalStatus: 'SIMULATED' | 'SUCCESS' | 'FAILED' = isDemo ? 'SIMULATED' : 'SUCCESS';

    if (!isDemo) {
      if (platform === 'BLUESKY') {
        const res = await likeOnBluesky(targetPostId, targetPostId);
        if (!res.success) return { status: 'FAILED', reason: res.error };
        providerResponse = res.response;
        providerId = res.response?.uri || 'bsky_like_' + Date.now();
      } else if (platform === 'FARCASTER') {
        const res = await likeOnFarcaster(targetPostId);
        if (!res.success) return { status: 'FAILED', reason: res.error };
        providerResponse = res.response;
        providerId = res.response?.hash || 'fc_like_' + Date.now();
      }
    }

    const action: EngagementAction = {
      id: 'act_like_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      platform,
      actionType: 'LIKE',
      targetPostId,
      targetAccountId,
      targetUrl,
      selectedReason: 'Selective like of high-credibility, evidence-first content',
      scores,
      policyDecision: 'APPROVED_AUTONOMOUS_LIKE',
      providerResponse,
      providerId,
      timestamp: new Date().toISOString(),
      status: finalStatus
    };

    db.addEngagementAction(action);
    return { status: finalStatus, actionId: action.id };
  }

  public async executeRepostAction(
    platform: PlatformTarget,
    targetPostId: string,
    targetAccountId: string,
    targetUrl: string,
    content: string,
    isOfficialSource = true
  ): Promise<{ status: string; actionId?: string; reason?: string }> {
    if (db.isEngagementPaused()) {
      return { status: 'BLOCKED', reason: 'Engagement engine is paused.' };
    }
    const settings = db.getSettings();
    if (!settings.autonomousReposts) {
      return { status: 'BLOCKED', reason: 'Autonomous reposts globally disabled.' };
    }
    const platformToggle = settings.perPlatformToggles[platform];
    if (platformToggle && (!platformToggle.enabled || !platformToggle.reposts)) {
      return { status: 'BLOCKED', reason: `Reposts disabled for platform ${platform}.` };
    }

    if (!CAPABILITY_MATRIX[platform]?.REPOST) {
      db.addLog('WARN', 'ENGAGEMENT', `Platform ${platform} does not support autonomous REPOST capability.`);
      return { status: 'BLOCKED', reason: `Platform ${platform} does not support REPOST capability.` };
    }

    const scores = evaluateEngagementScores('REPOST', content, 0.95, isOfficialSource);
    if (!isOfficialSource || scores.weightedValueScore < 8.0 || scores.spamRisk > 2.0) {
      return { status: 'BLOCKED', reason: 'Repost rejected: Requires official/reputable source and weighted score >= 8.0.' };
    }

    const isDemo = settings.demoMode;
    let providerResponse: any = { simulated: true };
    let providerId: string | undefined = undefined;
    let finalStatus: 'SIMULATED' | 'SUCCESS' | 'FAILED' = isDemo ? 'SIMULATED' : 'SUCCESS';

    if (!isDemo) {
      if (platform === 'BLUESKY') {
        const res = await repostOnBluesky(targetPostId, targetPostId);
        if (!res.success) return { status: 'FAILED', reason: res.error };
        providerResponse = res.response;
        providerId = res.response?.uri || 'bsky_repost_' + Date.now();
      } else if (platform === 'FARCASTER') {
        const res = await recastOnFarcaster(targetPostId);
        if (!res.success) return { status: 'FAILED', reason: res.error };
        providerResponse = res.response;
        providerId = res.response?.hash || 'fc_recast_' + Date.now();
      }
    }

    const action: EngagementAction = {
      id: 'act_repost_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      platform,
      actionType: 'REPOST',
      targetPostId,
      targetAccountId,
      targetUrl,
      selectedReason: 'Selective repost of official announcement/research',
      scores,
      policyDecision: 'APPROVED_AUTONOMOUS_REPOST',
      providerResponse,
      providerId,
      timestamp: new Date().toISOString(),
      status: finalStatus
    };

    db.addEngagementAction(action);
    return { status: finalStatus, actionId: action.id };
  }
}

export const engagementEngine = new EngagementEngine();

