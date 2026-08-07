import { BskyAgent } from '@atproto/api';
import { PostDraft, PublicationResult } from '../types.js';
import { db } from '../db/database.ts';

export async function publishToBluesky(draft: PostDraft): Promise<PublicationResult> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const serviceUrl = process.env.BLUESKY_SERVICE_URL || 'https://bsky.social';

  if (!handle || !password) {
    db.addLog('INFO', 'BLUESKY_PUBLISHER', 'Bluesky credentials not configured; defaulting to simulated publication.');
    return {
      id: 'pub_bsky_' + Date.now(),
      draftId: draft.id,
      platform: 'BLUESKY',
      status: 'SIMULATED',
      payload: draft.platformPayloads.BLUESKY,
      postUrl: 'https://bsky.app/profile/simulated.bsky.social/post/sim123',
      publishedAt: new Date().toISOString()
    };
  }

  try {
    const agent = new BskyAgent({ service: serviceUrl });
    await agent.login({ identifier: handle, password });

    const postText = draft.platformPayloads.BLUESKY;
    const response = await agent.post({
      text: postText,
      createdAt: new Date().toISOString()
    });

    const postUrl = `https://bsky.app/profile/${handle}/post/${response.uri.split('/').pop()}`;

    db.addLog('SUCCESS', 'BLUESKY_PUBLISHER', `Successfully published to Bluesky: ${response.uri}`);

    return {
      id: 'pub_bsky_' + Date.now(),
      draftId: draft.id,
      platform: 'BLUESKY',
      status: 'SUCCESS',
      postId: response.cid,
      postUrl,
      payload: postText,
      publishedAt: new Date().toISOString()
    };
  } catch (err: any) {
    db.addLog('ERROR', 'BLUESKY_PUBLISHER', `Bluesky publication failed: ${err.message}`);
    return {
      id: 'pub_bsky_' + Date.now(),
      draftId: draft.id,
      platform: 'BLUESKY',
      status: 'FAILED',
      payload: draft.platformPayloads.BLUESKY,
      error: err.message,
      publishedAt: new Date().toISOString()
    };
  }
}

export async function likeOnBluesky(uri: string, cid: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const serviceUrl = process.env.BLUESKY_SERVICE_URL || 'https://bsky.social';

  if (!handle || !password) return { success: false, error: 'Missing Bluesky credentials' };

  try {
    const agent = new BskyAgent({ service: serviceUrl });
    await agent.login({ identifier: handle, password });
    const res = await agent.like(uri, cid);
    return { success: true, response: res };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function repostOnBluesky(uri: string, cid: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const serviceUrl = process.env.BLUESKY_SERVICE_URL || 'https://bsky.social';

  if (!handle || !password) return { success: false, error: 'Missing Bluesky credentials' };

  try {
    const agent = new BskyAgent({ service: serviceUrl });
    await agent.login({ identifier: handle, password });
    const res = await agent.repost(uri, cid);
    return { success: true, response: res };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function replyOnBluesky(parentUri: string, parentCid: string, text: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const serviceUrl = process.env.BLUESKY_SERVICE_URL || 'https://bsky.social';

  if (!handle || !password) return { success: false, error: 'Missing Bluesky credentials' };

  try {
    const agent = new BskyAgent({ service: serviceUrl });
    await agent.login({ identifier: handle, password });
    const res = await agent.post({
      text,
      reply: {
        root: { uri: parentUri, cid: parentCid },
        parent: { uri: parentUri, cid: parentCid }
      },
      createdAt: new Date().toISOString()
    });
    return { success: true, response: res };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

