import { db } from '../db/database.ts';
import { BskyAgent } from '@atproto/api';
import axios from 'axios';
import { engagementEngine } from '../services/engagementEngine.ts';
import { ownPostMonitor } from '../services/ownPostMonitor.ts';
import { PlatformTarget } from '../types.js';

const processedNotifications = new Set<string>();

/**
 * Fetch Bluesky notifications (replies, mentions, likes received)
 * and engage with relevant content in our feed
 */
async function runBlueskyEngagement(): Promise<void> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const serviceUrl = process.env.BLUESKY_SERVICE_URL || 'https://bsky.social';

  if (!handle || !password) return;

  try {
    const agent = new BskyAgent({ service: serviceUrl });
    await agent.login({ identifier: handle, password });

    // 1. Fetch notifications (replies to our posts, mentions)
    const notifResponse = await agent.listNotifications({ limit: 25 });
    const notifications = notifResponse.data.notifications || [];

    for (const notif of notifications) {
      const key = `bsky_${notif.uri}_${notif.reason}`;
      if (processedNotifications.has(key)) continue;
      processedNotifications.add(key);

      // Process replies to our posts
      if (notif.reason === 'reply' && notif.record && 'text' in (notif.record as any)) {
        const commentText = (notif.record as any).text || '';
        const parentUri = (notif.record as any).reply?.parent?.uri || '';

        // Only reply to comments on OUR posts
        if (parentUri.includes(agent.session?.did || '___none___')) {
          db.addLog('INFO', 'ENGAGEMENT_DAEMON', `[Bluesky] Reply detected from @${notif.author.handle}: "${commentText.substring(0, 60)}..."`);

          await ownPostMonitor.processComment(
            'BLUESKY',
            notif.uri,
            notif.author.did,
            notif.author.handle,
            commentText
          );
        }
      }

      // Process mentions (someone tagged us)
      if (notif.reason === 'mention' && notif.record && 'text' in (notif.record as any)) {
        const mentionText = (notif.record as any).text || '';
        db.addLog('INFO', 'ENGAGEMENT_DAEMON', `[Bluesky] Mention by @${notif.author.handle}: "${mentionText.substring(0, 60)}..."`);

        await ownPostMonitor.processComment(
          'BLUESKY',
          notif.uri,
          notif.author.did,
          notif.author.handle,
          mentionText
        );
      }
    }

    // 2. Engage with relevant posts in our feed & search (like, repost, and reply to high-quality content)
    const timeline = await agent.getTimeline({ limit: 20 });
    const feed = timeline.data.feed || [];

    // Also search for trending topic posts on Bluesky
    let searchPosts: any[] = [];
    try {
      const searchRes = await agent.app.bsky.feed.searchPosts({ q: 'crypto OR bitcoin OR ethereum OR "artificial intelligence" OR "fed rate"', limit: 15 });
      if (searchRes.data?.posts) {
        searchPosts = searchRes.data.posts;
      }
    } catch (_) { /* search fallback */ }

    const combinedPosts = [
      ...feed.map(item => item.post),
      ...searchPosts
    ];

    for (const post of combinedPosts) {
      const postText = (post.record as any)?.text || '';
      const authorHandle = post.author.handle;

      // Don't engage with our own posts
      if (authorHandle === handle || authorHandle.includes('signalatlas')) continue;

      const feedKey = `bsky_feed_${post.uri}`;
      if (processedNotifications.has(feedKey)) continue;
      processedNotifications.add(feedKey);

      // Check if content is relevant to our topics
      const lower = postText.toLowerCase();
      const isRelevant = lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum') ||
                         lower.includes('defi') || lower.includes('web3') || lower.includes('ai ') ||
                         lower.includes('federal reserve') || lower.includes('market') || lower.includes('sec ') ||
                         lower.includes('solana') || lower.includes('stablecoin');

      if (isRelevant && postText.length > 30) {
        const postUrl = `https://bsky.app/profile/${authorHandle}/post/${post.uri.split('/').pop()}`;

        // 1. Like relevant posts
        await engagementEngine.executeLikeAction(
          'BLUESKY',
          post.uri,
          post.author.did,
          postUrl,
          postText,
          0.9
        );

        // 2. Repost high-engagement / official posts
        const likeCount = post.likeCount || 0;
        const repostCount = post.repostCount || 0;
        if (likeCount >= 5 || repostCount >= 2) {
          await engagementEngine.executeRepostAction(
            'BLUESKY',
            post.uri,
            post.author.did,
            postUrl,
            postText,
            true
          );
        }

        // 3. Proactively comment / reply on interesting external discussions to gain reach
        if (postText.includes('?') || lower.includes('thoughts') || lower.includes('what do you think') || lower.includes('opinion')) {
          await ownPostMonitor.processComment(
            'BLUESKY',
            post.uri,
            post.author.did,
            authorHandle,
            postText
          );
        }
      }
    }

    // Mark notifications as seen
    try {
      await agent.updateSeenNotifications();
    } catch (_) { /* non-critical */ }

    db.addLog('INFO', 'ENGAGEMENT_DAEMON', `[Bluesky] Processed ${notifications.length} notifications, scanned ${combinedPosts.length} feed & search items.`);
  } catch (err: any) {
    db.addLog('WARN', 'ENGAGEMENT_DAEMON', `[Bluesky] Engagement cycle error: ${err.message}`);
  }
}

/**
 * Fetch Farcaster notifications via Neynar API
 * and engage with relevant content
 */
async function runFarcasterEngagement(): Promise<void> {
  const apiKey = process.env.FARCASTER_NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;

  if (!apiKey || !signerUuid) return;

  try {
    // 1. Get our FID first
    const userResponse = await axios.get(
      'https://api.neynar.com/v2/farcaster/user/by_username?username=signalatlas',
      { headers: { api_key: apiKey }, timeout: 10000 }
    );
    const fid = userResponse.data?.user?.fid;
    if (!fid) {
      db.addLog('WARN', 'ENGAGEMENT_DAEMON', '[Farcaster] Could not resolve FID for signalatlas');
      return;
    }

    // 2. Fetch notifications/mentions
    const notifResponse = await axios.get(
      `https://api.neynar.com/v2/farcaster/notifications?fid=${fid}&type=replies,mentions`,
      { headers: { api_key: apiKey }, timeout: 10000 }
    );
    const notifications = notifResponse.data?.notifications || [];

    for (const notif of notifications) {
      const key = `fc_${notif.cast?.hash || notif.hash || Date.now()}`;
      if (processedNotifications.has(key)) continue;
      processedNotifications.add(key);

      const cast = notif.cast || notif;
      const text = cast.text || '';
      const authorFid = cast.author?.fid?.toString() || 'unknown';
      const authorUsername = cast.author?.username || 'unknown';
      const castHash = cast.hash || '';

      if (text && castHash) {
        db.addLog('INFO', 'ENGAGEMENT_DAEMON', `[Farcaster] ${notif.type || 'notification'} from @${authorUsername}: "${text.substring(0, 60)}..."`);

        await ownPostMonitor.processComment(
          'FARCASTER',
          castHash,
          authorFid,
          authorUsername,
          text
        );
      }
    }

    // 3. Browse trending/relevant casts and like/recast/reply to them for maximum reach
    try {
      const trendingResponse = await axios.get(
        'https://api.neynar.com/v2/farcaster/feed/trending?limit=15',
        { headers: { api_key: apiKey }, timeout: 10000 }
      );
      const trendingCasts = trendingResponse.data?.casts || [];

      for (const cast of trendingCasts.slice(0, 10)) {
        const text = cast.text || '';
        const hash = cast.hash || '';
        const authorFid = cast.author?.fid?.toString() || 'unknown';
        const authorUsername = cast.author?.username || 'unknown';

        if (authorUsername === 'signalatlas' || authorUsername === 'signal-atlas') continue;

        const feedKey = `fc_feed_${hash}`;
        if (processedNotifications.has(feedKey)) continue;
        processedNotifications.add(feedKey);

        const lower = text.toLowerCase();
        const isRelevant = lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum') ||
                           lower.includes('defi') || lower.includes('web3') || lower.includes('ai ') ||
                           lower.includes('market') || lower.includes('solana');

        if (isRelevant && text.length > 30) {
          const castUrl = `https://warpcast.com/${authorUsername}/${hash.substring(0, 10)}`;

          // 1. Proactively Like
          await engagementEngine.executeLikeAction(
            'FARCASTER',
            hash,
            authorFid,
            castUrl,
            text,
            0.9
          );

          // 2. Proactively Recost (Repost) high-performing casts
          const reactions = cast.reactions || {};
          const likesCount = reactions.likes_count || cast.likes_count || 0;
          if (likesCount >= 5) {
            await engagementEngine.executeRepostAction(
              'FARCASTER',
              hash,
              authorFid,
              castUrl,
              text,
              true
            );
          }

          // 3. Proactively Comment/Reply to join popular market discussions
          if (text.includes('?') || lower.includes('thoughts') || lower.includes('opinion')) {
            await ownPostMonitor.processComment(
              'FARCASTER',
              hash,
              authorFid,
              authorUsername,
              text
            );
          }
        }
      }
    } catch (_) { /* trending feed non-critical */ }

    db.addLog('INFO', 'ENGAGEMENT_DAEMON', `[Farcaster] Processed ${notifications.length} notifications.`);
  } catch (err: any) {
    db.addLog('WARN', 'ENGAGEMENT_DAEMON', `[Farcaster] Engagement cycle error: ${err.message}`);
  }
}

/**
 * Main engagement cycle — runs on a 3-minute interval
 * Fetches notifications from all platforms, replies to comments,
 * likes relevant content, and reposts high-value posts
 */
export async function runEngagementCycle(): Promise<void> {
  if (db.isEngagementPaused()) {
    db.addLog('INFO', 'ENGAGEMENT_DAEMON', 'Engagement is paused; skipping cycle.');
    return;
  }

  db.addLog('INFO', 'ENGAGEMENT_DAEMON', 'Starting engagement cycle (notifications, replies, likes)...');

  // Run platform engagement in parallel
  await Promise.allSettled([
    runBlueskyEngagement(),
    runFarcasterEngagement()
  ]);

  // Trim processed notifications cache (keep last 500)
  if (processedNotifications.size > 500) {
    const entries = Array.from(processedNotifications);
    const toRemove = entries.slice(0, entries.length - 500);
    for (const key of toRemove) {
      processedNotifications.delete(key);
    }
  }

  db.addLog('INFO', 'ENGAGEMENT_DAEMON', 'Engagement cycle complete.');
}
