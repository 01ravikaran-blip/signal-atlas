import { StoryCluster, ImportantNewsOverrideLog } from '../types.js';
import { db } from '../db/database.ts';

const NORMAL_ROLLING_24H_SOFT_LIMIT = 20;

export interface SchedulerDecision {
  action: 'PUBLISH_NOW' | 'QUEUE' | 'THREAD' | 'WAIT_CONFIRMATION' | 'SKIP';
  isImportantNewsOverride: boolean;
  overrideReason?: string;
  reason: string;
  rolling24hCount: number;
}

export function evaluateAdaptiveScheduler(story: StoryCluster): SchedulerDecision {
  const publications = db.getPublications(500);
  const now = new Date().getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const protectionSettings = db.getProtectionSettings();
  const currentState = db.getImportantNewsModeState();

  // Check auto-exit from Important News Mode if inactive
  if (currentState.active && currentState.lastUpdateAt) {
    const inactiveMinutes = (now - new Date(currentState.lastUpdateAt).getTime()) / (60 * 1000);
    if (inactiveMinutes >= protectionSettings.emergencyModeTimeoutMinutes && protectionSettings.autoReturnToNormalMode) {
      db.updateImportantNewsModeState({
        active: false,
        currentEventId: undefined,
        eventTitle: undefined,
        overrideReason: undefined
      });
      db.addLog('INFO', 'IMPORTANT_NEWS_MODE', `Automatically exited IMPORTANT_NEWS_MODE after ${Math.round(inactiveMinutes)} minutes of inactivity.`);
    }
  }

  // Count unique original content items in rolling 24 hours
  const rolling24hPubs = publications.filter(p => (now - new Date(p.publishedAt).getTime()) <= twentyFourHoursMs);
  const uniqueDraftIds = new Set(rolling24hPubs.map(p => p.draftId));
  const rolling24hCount = uniqueDraftIds.size;

  // 1. Per-event cooldown check (e.g. minMinutesBetweenEventUpdates = 30)
  const minMinutesMs = protectionSettings.minMinutesBetweenEventUpdates * 60 * 1000;
  const recentPubsSameTopic = publications.filter(p => {
    const pubTime = new Date(p.publishedAt).getTime();
    return (now - pubTime) <= minMinutesMs && p.payload.toLowerCase().includes(story.title.toLowerCase().substring(0, 15));
  });

  if (recentPubsSameTopic.length > 0) {
    return {
      action: 'SKIP',
      isImportantNewsOverride: false,
      reason: `Event update cooldown active (${protectionSettings.minMinutesBetweenEventUpdates} min window).`,
      rolling24hCount
    };
  }

  // 2. Normal Limit Check (< 20 items)
  if (rolling24hCount < NORMAL_ROLLING_24H_SOFT_LIMIT) {
    const action = story.impactScore >= 9.0 && story.verifiedClaims.length >= 3 ? 'THREAD' : 'PUBLISH_NOW';
    return {
      action,
      isImportantNewsOverride: false,
      reason: `Normal publication slot available (${rolling24hCount}/${NORMAL_ROLLING_24H_SOFT_LIMIT}).`,
      rolling24hCount
    };
  }

  // 3. Important-News Mode Override Evaluation (Soft Limit 20 Reached)
  // The system MUST NEVER reject genuinely important, rapidly developing news solely because 20-post soft cap was reached.
  const primaryNews = story.primaryNews[0];
  const confidenceScore = story.verifiedClaims[0]?.confidenceScore || primaryNews?.credibilityScore || 0.8;
  const sourceCount = story.verifiedClaims[0]?.sources.length || 1;
  const isHighImpact = story.overallScore >= 8.5 || story.impactScore >= 8.5;
  const isEmergencyClassified = primaryNews?.isBreaking || story.overallScore >= 8.5;

  const lowerTitle = (story.title + ' ' + (primaryNews?.summary || '')).toLowerCase();
  const isExploit = lowerTitle.includes('exploit') || lowerTitle.includes('hack') || lowerTitle.includes('security incident');
  const isRegulatory = lowerTitle.includes('sec') || lowerTitle.includes('regulatory') || lowerTitle.includes('court ruling');
  const isCentralBank = lowerTitle.includes('federal reserve') || lowerTitle.includes('interest rate') || lowerTitle.includes('cpi inflation');
  const isFailure = lowerTitle.includes('bankruptcy') || lowerTitle.includes('exchange collapse') || lowerTitle.includes('halted withdrawals');

  const isMaterialOverride = isExploit || isRegulatory || isCentralBank || isFailure || isEmergencyClassified;

  // Unconfirmed Emergency Handling
  if (isMaterialOverride && (confidenceScore < 0.85 || sourceCount < 1)) {
    db.addLog('WARN', 'IMPORTANT_NEWS_MODE', `Unconfirmed emergency reports circulating: "${story.title}". Confidence: ${confidenceScore}. Awaiting confirmation.`);
    return {
      action: 'WAIT_CONFIRMATION',
      isImportantNewsOverride: false,
      reason: 'Unconfirmed emergency reports circulating; awaiting higher confidence verification.',
      rolling24hCount
    };
  }

  // Important-News Mode Criteria Pass
  if (isMaterialOverride && isHighImpact && confidenceScore >= 0.85 && sourceCount >= 1) {
    const overrideReason = isExploit ? 'Major security incident or exploit' :
                           isRegulatory ? 'Major regulatory or legal decision' :
                           isCentralBank ? 'Central-bank rate decision' :
                           isFailure ? 'Protocol or exchange failure' : 'High-impact verified breaking news update';

    // Activate IMPORTANT_NEWS_MODE in DB
    const sourcesEvidence = story.primaryNews.map(n => n.source);
    db.updateImportantNewsModeState({
      active: true,
      currentEventId: story.id,
      eventTitle: story.title,
      overrideReason,
      sourceEvidence: sourcesEvidence,
      activatedAt: new Date().toISOString(),
      lastUpdateAt: new Date().toISOString(),
      updateCount: (currentState.updateCount || 0) + 1
    });

    const logItem: ImportantNewsOverrideLog = {
      id: 'override_' + Date.now(),
      storyId: story.id,
      title: story.title,
      conditionMatched: overrideReason,
      impactScore: story.overallScore,
      sourcesCount: sourceCount,
      rolling24hCount,
      timestamp: new Date().toISOString()
    };

    db.addLog('WARN', 'IMPORTANT_NEWS_OVERRIDE', `IMPORTANT_NEWS_MODE override triggered: ${overrideReason}. Impact: ${story.overallScore}/10, Conf: ${confidenceScore}`, logItem);

    // If update is minor, combine into thread instead of separate post
    const action = story.verifiedClaims.length >= 3 ? 'THREAD' : 'PUBLISH_NOW';

    return {
      action,
      isImportantNewsOverride: true,
      overrideReason,
      reason: `IMPORTANT_NEWS_MODE active: ${overrideReason}`,
      rolling24hCount
    };
  }

  // Normal non-emergency story queued after soft limit
  return {
    action: 'QUEUE',
    isImportantNewsOverride: false,
    reason: `Normal soft limit of ${NORMAL_ROLLING_24H_SOFT_LIMIT} reached. Non-emergency story queued until window resets.`,
    rolling24hCount
  };
}

