import { PostDraft, PublicationResult, PlatformTarget, VisualDecision, MediaDerivative, MediaAnalyticsRecord } from '../types.js';
import { db } from '../db/database.ts';
import { publishToBluesky } from './blueskyPublisher.ts';
import { publishToFarcaster } from './farcasterPublisher.ts';
import { publishToTelegram } from './telegramPublisher.ts';
import { publishToDiscord } from './discordPublisher.ts';

export async function publishDraftToAllPlatforms(draft: PostDraft, visualDecision?: VisualDecision): Promise<PublicationResult[]> {
  const results: PublicationResult[] = [];
  const platforms: PlatformTarget[] = ['BLUESKY', 'FARCASTER', 'TELEGRAM', 'DISCORD'];

  for (const platform of platforms) {
    let res: PublicationResult;

    if (platform === 'BLUESKY') {
      res = await publishToBluesky(draft, visualDecision);
    } else if (platform === 'FARCASTER') {
      res = await publishToFarcaster(draft, visualDecision);
    } else if (platform === 'TELEGRAM') {
      res = await publishToTelegram(draft, visualDecision);
    } else {
      res = await publishToDiscord(draft, visualDecision);
    }

    db.addPublication(res);
    results.push(res);

    // Store MediaDerivative if a visual was attached
    if (visualDecision && visualDecision.mediaAsset) {
      const derivative: MediaDerivative = {
        id: 'deriv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        mediaAssetId: visualDecision.mediaAsset.id,
        platform,
        fileUrlOrBlobReference: res.postUrl || visualDecision.mediaAsset.dataUrl || '',
        width: visualDecision.mediaAsset.width,
        height: visualDecision.mediaAsset.height,
        fileSize: visualDecision.mediaAsset.fileSize,
        createdAt: new Date().toISOString()
      };
      db.addMediaDerivative(derivative);

      // Store initial Media Analytics Record
      const analytics: MediaAnalyticsRecord = {
        id: 'analytics_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        mediaAssetId: visualDecision.mediaAsset.id,
        draftId: draft.id,
        hasVisual: visualDecision.decision !== 'TEXT_ONLY' && visualDecision.decision !== 'USE_LINK_CARD_ONLY',
        visualType: visualDecision.decision,
        seriesType: visualDecision.seriesType,
        platform,
        impressions: 1,
        likes: 0,
        reposts: 0,
        replies: 0,
        saves: 0,
        shares: 0,
        profileVisits: 0,
        follows: 0,
        linkClicks: 0,
        timestamp: new Date().toISOString()
      };
      db.addMediaAnalytics(analytics);
    }
  }

  return results;
}
