import { BskyAgent } from '@atproto/api';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function deleteBlueskyDuplicates() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const serviceUrl = process.env.BLUESKY_SERVICE_URL || 'https://bsky.social';

  if (!handle || !password) {
    console.log('❌ Bluesky credentials missing in .env');
    return;
  }

  console.log('\n🔍 Scanning Bluesky posts for duplicates...');
  const agent = new BskyAgent({ service: serviceUrl });
  await agent.login({ identifier: handle, password });

  const feedRes = await agent.getAuthorFeed({ actor: handle, limit: 100 });
  const feed = feedRes.data.feed || [];

  const seenTextMap = new Map<string, string[]>();

  for (const item of feed) {
    const uri = item.post.uri;
    const text = ((item.post.record as any)?.text || '').trim();
    if (!text) continue;

    if (!seenTextMap.has(text)) {
      seenTextMap.set(text, [uri]);
    } else {
      seenTextMap.get(text)!.push(uri);
    }
  }

  let deletedCount = 0;
  for (const [text, uris] of seenTextMap.entries()) {
    if (uris.length > 1) {
      console.log(`\nFound ${uris.length} identical posts for: "${text.substring(0, 60)}..."`);
      // Keep the first (oldest or newest), delete the remaining duplicates
      const [keepUri, ...duplicatesToDelete] = uris;
      console.log(`  ✅ Keeping: ${keepUri}`);

      for (const dupUri of duplicatesToDelete) {
        try {
          console.log(`  🗑️ Deleting duplicate: ${dupUri}`);
          await agent.deletePost(dupUri);
          deletedCount++;
        } catch (err: any) {
          console.error(`  ❌ Failed to delete ${dupUri}:`, err.message);
        }
      }
    }
  }

  console.log(`✨ Bluesky cleanup complete! Deleted ${deletedCount} duplicate post(s).`);
}

async function deleteFarcasterDuplicates() {
  const apiKey = process.env.FARCASTER_NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;

  if (!apiKey || !signerUuid) {
    console.log('❌ Farcaster credentials missing in .env');
    return;
  }

  console.log('\n🔍 Scanning Farcaster casts for duplicates...');

  try {
    const userRes = await axios.get('https://api.neynar.com/v2/farcaster/user/by_username?username=signalatlas', {
      headers: { api_key: apiKey },
      timeout: 10000
    });
    const fid = userRes.data?.user?.fid;
    if (!fid) {
      console.log('❌ Could not resolve Farcaster FID for signalatlas');
      return;
    }

    const castsRes = await axios.get(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=100`, {
      headers: { api_key: apiKey },
      timeout: 10000
    });
    const casts = castsRes.data?.casts || [];

    const seenTextMap = new Map<string, string[]>();

    for (const cast of casts) {
      const hash = cast.hash;
      const text = (cast.text || '').trim();
      if (!text || !hash) continue;

      if (!seenTextMap.has(text)) {
        seenTextMap.set(text, [hash]);
      } else {
        seenTextMap.get(text)!.push(hash);
      }
    }

    let deletedCount = 0;
    for (const [text, hashes] of seenTextMap.entries()) {
      if (hashes.length > 1) {
        console.log(`\nFound ${hashes.length} identical casts for: "${text.substring(0, 60)}..."`);
        const [keepHash, ...duplicatesToDelete] = hashes;
        console.log(`  ✅ Keeping: ${keepHash}`);

        for (const dupHash of duplicatesToDelete) {
          try {
            console.log(`  🗑️ Deleting duplicate cast: ${dupHash}`);
            await axios.delete('https://api.neynar.com/v2/farcaster/cast', {
              headers: { api_key: apiKey, 'Content-Type': 'application/json' },
              data: { target_hash: dupHash, signer_uuid: signerUuid }
            });
            deletedCount++;
          } catch (err: any) {
            console.error(`  ❌ Failed to delete cast ${dupHash}:`, err.response?.data?.message || err.message);
          }
        }
      }
    }

    console.log(`✨ Farcaster cleanup complete! Deleted ${deletedCount} duplicate cast(s).`);
  } catch (err: any) {
    console.error('❌ Farcaster cleanup error:', err.message);
  }
}

async function runCleanup() {
  console.log('=================================================');
  console.log('🧹 SIGNAL ATLAS SOCIAL DUPLICATE CLEANUP UTILITY');
  console.log('=================================================');
  await deleteBlueskyDuplicates();
  await deleteFarcasterDuplicates();
  console.log('\n🎉 ALL DUPLICATE CLEANUP FINISHED!');
}

runCleanup().catch(err => console.error('Unhandled error in cleanup:', err));
