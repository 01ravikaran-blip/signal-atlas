import { PlatformTarget } from '../types.js';
import { db } from '../db/database.ts';

const MAX_REPLIES_PER_24H = 20;
const MAX_REPOSTS_PER_24H = 10;

export interface InteractionSafetyCheck {
  allowed: boolean;
  reason?: string;
}

export function validateAutomatedReply(platform: PlatformTarget, targetAccount: string, mentionText: string): InteractionSafetyCheck {
  const lower = mentionText.toLowerCase();
  
  // Prohibited safety checks
  if (lower.includes('scam') || lower.includes('airdrop') || lower.includes('free tokens') || lower.includes('dm me')) {
    return { allowed: false, reason: 'Rejected potential scam or spam mention.' };
  }
  if (lower.includes('fuck') || lower.includes('hate') || lower.includes('idiot')) {
    return { allowed: false, reason: 'Rejected hostile or offensive mention.' };
  }

  // Rate limit check
  const logs = db.getLogs(500);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const replyLogs = logs.filter(l => l.module === 'INTERACTION_REPLY' && l.data?.platform === platform && (now - new Date(l.timestamp).getTime()) <= dayMs);

  if (replyLogs.length >= MAX_REPLIES_PER_24H) {
    return { allowed: false, reason: `Platform ${platform} reached maximum 24h reply limit (${MAX_REPLIES_PER_24H}).` };
  }

  return { allowed: true };
}

export function validateAutomatedRepost(platform: PlatformTarget, sourceAccount: string, postText: string, isOfficialSource: boolean): InteractionSafetyCheck {
  const lower = postText.toLowerCase();

  if (!isOfficialSource) {
    return { allowed: false, reason: 'Only official or verified reputable sources are eligible for reposting.' };
  }
  if (lower.includes('unconfirmed rumor') || lower.includes('leak') || lower.includes('insider claim')) {
    return { allowed: false, reason: 'Unverified rumor or leak content rejected.' };
  }

  // Rate limit check
  const logs = db.getLogs(500);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const repostLogs = logs.filter(l => l.module === 'INTERACTION_REPOST' && l.data?.platform === platform && (now - new Date(l.timestamp).getTime()) <= dayMs);

  if (repostLogs.length >= MAX_REPOSTS_PER_24H) {
    return { allowed: false, reason: `Platform ${platform} reached maximum 24h repost/quote limit (${MAX_REPOSTS_PER_24H}).` };
  }

  return { allowed: true };
}
