import { db } from '../db/database.ts';
import { fetchLiveMarketSnapshot } from '../collectors/marketCollector.ts';
import { fetchLatestNews } from '../collectors/newsCollector.ts';
import { clusterAndVerifyStories } from '../collectors/verifier.ts';
import { generatePostDraft } from '../ai/draftGenerator.ts';
import { critiqueAndImproveDraft } from '../ai/critiqueAgent.ts';
import { evaluateSafetyPolicy } from '../safety/safetyEngine.ts';
import { publishDraftToAllPlatforms } from '../publishers/simulationPublisher.ts';
import { evaluateAdaptiveScheduler } from './adaptiveScheduler.ts';
import { ContentCategory, StoryCluster } from '../types.js';
import { runEngagementCycle } from './engagementDaemon.ts';
import { evaluateVisualDecision } from '../media/mediaDecisionEngine.ts';
import { BskyAgent } from '@atproto/api';
import axios from 'axios';

let isCycleRunning = false;

/**
 * Normalize a story title into a dedup key — lowercase, strip non-alpha, take first 60 chars
 */
function normalizeHash(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().substring(0, 60);
}

/**
 * Live account timeline verification:
 * Checks recent posts directly on Bluesky & Farcaster profiles before publishing to ensure
 * no story is ever duplicated across server restarts, redeploys, or concurrent instances.
 */
async function isAlreadyPublishedOnLiveSocials(storyTitle: string): Promise<boolean> {
  const cleanKey = storyTitle.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
  if (cleanKey.length < 5) return false;

  // 1. Check Bluesky recent posts on profile
  const bskyHandle = process.env.BLUESKY_HANDLE;
  const bskyPassword = process.env.BLUESKY_APP_PASSWORD;
  if (bskyHandle && bskyPassword) {
    try {
      const agent = new BskyAgent({ service: process.env.BLUESKY_SERVICE_URL || 'https://bsky.social' });
      await agent.login({ identifier: bskyHandle, password: bskyPassword });
      const feedRes = await agent.getAuthorFeed({ actor: bskyHandle, limit: 15 });
      const posts = feedRes.data.feed || [];
      for (const item of posts) {
        const text = (item.post.record as any)?.text || '';
        const cleanPostText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanPostText.includes(cleanKey)) {
          db.addLog('INFO', 'LIVE_DEDUP', `Story "${storyTitle.substring(0, 40)}..." detected on live Bluesky profile; skipping duplicate.`);
          return true;
        }
      }
    } catch (_) { /* non-critical API check fallback */ }
  }

  // 2. Check Farcaster recent casts on profile
  const neynarKey = process.env.FARCASTER_NEYNAR_API_KEY;
  if (neynarKey) {
    try {
      const userRes = await axios.get('https://api.neynar.com/v2/farcaster/user/by_username?username=signalatlas', {
        headers: { api_key: neynarKey },
        timeout: 5000
      });
      const fid = userRes.data?.user?.fid;
      if (fid) {
        const castsRes = await axios.get(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=15`, {
          headers: { api_key: neynarKey },
          timeout: 5000
        });
        const casts = castsRes.data?.casts || [];
        for (const cast of casts) {
          const text = cast.text || '';
          const cleanCastText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanCastText.includes(cleanKey)) {
            db.addLog('INFO', 'LIVE_DEDUP', `Story "${storyTitle.substring(0, 40)}..." detected on live Farcaster profile; skipping duplicate.`);
            return true;
          }
        }
      }
    } catch (_) { /* non-critical API check fallback */ }
  }

  return false;
}

export async function runAutonomousPublishingCycle(force = false): Promise<{ status: string; storyProcessed?: string; blockedReason?: string }> {
  if (isCycleRunning && !force) {
    db.addLog('WARN', 'SCHEDULER', 'Autonomous cycle already in progress; skipping duplicate run.');
    return { status: 'SKIPPED_ALREADY_RUNNING' };
  }

  if (db.isEmergencyPaused()) {
    db.addLog('WARN', 'SCHEDULER', 'Emergency Pause active. Autonomous publishing cycle halted.');
    return { status: 'PAUSED_BY_EMERGENCY_SWITCH' };
  }

  isCycleRunning = true;
  db.addLog('INFO', 'SCHEDULER', 'Starting autonomous market intelligence & publishing cycle...');

  try {
    // 1. Ingest Market Snapshots & News
    await fetchLiveMarketSnapshot();
    const rawNews = await fetchLatestNews();

    // 2. Cluster stories and verify claims
    const storyClusters = clusterAndVerifyStories(rawNews);
    if (storyClusters.length === 0) {
      db.addLog('WARN', 'SCHEDULER', 'No story clusters formed from ingested news.');
      isCycleRunning = false;
      return { status: 'NO_STORIES_FOUND' };
    }

    // 3. Select story respecting 50/25/25 distribution mix balance
    const categoryStats = db.getCategoryStats();
    const totalPubs = categoryStats.CRYPTO_DEFI + categoryStats.AI_WEB3 + categoryStats.STOCKS_MACRO;
    
    let targetCategory: ContentCategory = 'CRYPTO_DEFI';
    if (totalPubs > 0) {
      const cryptoRatio = categoryStats.CRYPTO_DEFI / totalPubs;
      const aiRatio = categoryStats.AI_WEB3 / totalPubs;
      const macroRatio = categoryStats.STOCKS_MACRO / totalPubs;

      if (cryptoRatio < 0.50) targetCategory = 'CRYPTO_DEFI';
      else if (aiRatio < 0.25) targetCategory = 'AI_WEB3';
      else if (macroRatio < 0.25) targetCategory = 'STOCKS_MACRO';
      else targetCategory = 'CRYPTO_DEFI';
    }

    // Pick best story matching category or top overall story
    // DEDUP: skip stories already published in DB or live on social feeds
    let selectedStory: StoryCluster | undefined = undefined;
    
    // First try category-matched stories
    for (const s of storyClusters) {
      const hash = normalizeHash(s.title);
      if (s.category === targetCategory && !db.hasPublishedHash(hash)) {
        const alreadyLive = await isAlreadyPublishedOnLiveSocials(s.title);
        if (!alreadyLive) {
          selectedStory = s;
          break;
        } else {
          db.addPublishedHash(hash); // Cache locally so we don't query API repeatedly
        }
      }
    }
    
    // Fallback: any un-published story
    if (!selectedStory) {
      for (const s of storyClusters) {
        const hash = normalizeHash(s.title);
        if (!db.hasPublishedHash(hash)) {
          const alreadyLive = await isAlreadyPublishedOnLiveSocials(s.title);
          if (!alreadyLive) {
            selectedStory = s;
            break;
          } else {
            db.addPublishedHash(hash);
          }
        }
      }
    }

    if (!selectedStory) {
      db.addLog('INFO', 'SCHEDULER', 'All available stories have already been published on live accounts. Awaiting fresh news.');
      isCycleRunning = false;
      return { status: 'ALL_STORIES_ALREADY_PUBLISHED' };
    }

    // 4. Adaptive Scheduler Decision (Rolling 24h limit, fatigue cooldown, breaking news override)
    const scheduleDecision = evaluateAdaptiveScheduler(selectedStory);

    if (scheduleDecision.action === 'SKIP' || scheduleDecision.action === 'QUEUE') {
      db.addLog('INFO', 'ADAPTIVE_SCHEDULER', `Story "${selectedStory.title}" action: ${scheduleDecision.action}. Reason: ${scheduleDecision.reason}`);
      isCycleRunning = false;
      return {
        status: scheduleDecision.action,
        storyProcessed: selectedStory.title,
        blockedReason: scheduleDecision.reason
      };
    }

    db.addLog('INFO', 'SCHEDULER', `Selected story: "${selectedStory.title}" (${selectedStory.category}) - Score: ${selectedStory.overallScore}. Action: ${scheduleDecision.action}`);

    // 5. Generate Structured Draft with Hashtags
    let draft = await generatePostDraft(selectedStory);

    // 6. Run Self-Critique Agent
    draft = await critiqueAndImproveDraft(draft);
    db.addDraft(draft);

    // 7. Evaluate Approved Autonomy Safety Policy & 11 Quality Gates
    const safetyResult = evaluateSafetyPolicy(selectedStory, draft);

    if (!safetyResult.passed) {
      db.addLog('WARN', 'SCHEDULER', `Draft ${draft.id} BLOCKED by Safety/Quality Engine. Code: ${safetyResult.blockCode}. Reason: ${safetyResult.blockReason}`);
      isCycleRunning = false;
      return {
        status: 'BLOCKED',
        storyProcessed: selectedStory.title,
        blockedReason: safetyResult.blockReason
      };
    }

    // 8. Media & Visual Attachment Engine
    const visualDecision = await evaluateVisualDecision(selectedStory, draft);

    // 9. Record hash BEFORE publishing to prevent race conditions
    const storyHash = normalizeHash(selectedStory.title);
    db.addPublishedHash(storyHash);

    // 10. Publish to Bluesky, Farcaster, Telegram, Discord
    const pubResults = await publishDraftToAllPlatforms(draft, visualDecision);

    db.addLog('SUCCESS', 'SCHEDULER', `Successfully published story across all 4 target platforms! Total: ${pubResults.length}`);

    isCycleRunning = false;
    return {
      status: 'PUBLISHED_SUCCESS',
      storyProcessed: selectedStory.title
    };
  } catch (err: any) {
    db.addLog('ERROR', 'SCHEDULER', `Autonomous cycle encountered unhandled error: ${err.message}`, err.stack);
    isCycleRunning = false;
    return { status: 'ERROR', blockedReason: err.message };
  }
}

export function startAutonomousDaemon() {
  const intervalMinutes = db.getSettings().publishIntervalMinutes || 5;
  const ms = intervalMinutes * 60 * 1000;
  
  db.addLog('INFO', 'DAEMON', `Autonomous scheduler daemon initialized. Interval: ${intervalMinutes} minute(s).`);

  // Run initial publishing cycle after 3 seconds
  setTimeout(() => {
    runAutonomousPublishingCycle().catch(err => console.error('Initial cycle error:', err));
  }, 3000);

  // Set recurring publishing timer
  setInterval(() => {
    runAutonomousPublishingCycle().catch(err => console.error('Daemon cycle error:', err));
  }, ms);

  // --- ENGAGEMENT DAEMON ---
  // Run engagement cycle (fetch notifications, reply, like, repost) every 3 minutes
  const engagementIntervalMs = 3 * 60 * 1000;
  
  db.addLog('INFO', 'DAEMON', 'Engagement daemon initialized. Interval: 3 minute(s).');

  // First engagement cycle after 30 seconds (let publishing go first)
  setTimeout(() => {
    runEngagementCycle().catch(err => console.error('Initial engagement cycle error:', err));
  }, 30000);

  // Recurring engagement timer
  setInterval(() => {
    runEngagementCycle().catch(err => console.error('Engagement cycle error:', err));
  }, engagementIntervalMs);
}
