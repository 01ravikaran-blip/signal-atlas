import { PostDraft, PublicationResult, PlatformTarget } from '../types.js';
import { db } from '../db/database.ts';
import { publishToBluesky } from './blueskyPublisher.ts';
import { publishToFarcaster } from './farcasterPublisher.ts';
import { publishToTelegram } from './telegramPublisher.ts';
import { publishToDiscord } from './discordPublisher.ts';

export async function publishDraftToAllPlatforms(draft: PostDraft): Promise<PublicationResult[]> {
  const results: PublicationResult[] = [];

  const platforms: PlatformTarget[] = ['BLUESKY', 'FARCASTER', 'TELEGRAM', 'DISCORD'];

  for (const platform of platforms) {
    let res: PublicationResult;

    if (platform === 'BLUESKY') {
      res = await publishToBluesky(draft);
    } else if (platform === 'FARCASTER') {
      res = await publishToFarcaster(draft);
    } else if (platform === 'TELEGRAM') {
      res = await publishToTelegram(draft);
    } else {
      res = await publishToDiscord(draft);
    }

    db.addPublication(res);
    results.push(res);
  }

  return results;
}
