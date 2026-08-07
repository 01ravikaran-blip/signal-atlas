import { BskyAgent } from '@atproto/api';
import { PostDraft, PublicationResult, VisualDecision } from '../types.js';
import { db } from '../db/database.ts';

export async function publishToBluesky(draft: PostDraft, visualDecision?: VisualDecision): Promise<PublicationResult> {
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
    const postRecord: any = {
      text: postText,
      createdAt: new Date().toISOString()
    };

    // If visual decision has a valid media asset, upload blob & attach image embed
    if (visualDecision && visualDecision.mediaAsset && visualDecision.mediaAsset.dataUrl) {
      try {
        const base64Data = visualDecision.mediaAsset.dataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = visualDecision.mediaAsset.mimeType || 'image/svg+xml';

        // Check byte limit (< 1,000,000 bytes per Bluesky spec)
        if (buffer.length < 1000000) {
          const uploadRes = await agent.uploadBlob(buffer, { encoding: mimeType });
          if (uploadRes.data && uploadRes.data.blob) {
            postRecord.embed = {
              $type: 'app.bsky.embed.images',
              images: [
                {
                  image: uploadRes.data.blob,
                  alt: visualDecision.altText || 'Signal Atlas market visual update'
                }
              ]
            };
            db.addLog('SUCCESS', 'BLUESKY_PUBLISHER', `Uploaded image blob to AT Protocol (${buffer.length} bytes)`);
          }
        } else {
          db.addLog('WARN', 'BLUESKY_PUBLISHER', `Image size (${buffer.length} bytes) exceeds 1MB limit; falling back to text post.`);
        }
      } catch (uploadErr: any) {
        db.addLog('WARN', 'BLUESKY_PUBLISHER', `Blob upload failed: ${uploadErr.message}; falling back to text post.`);
      }
    }

    const response = await agent.post(postRecord);
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

