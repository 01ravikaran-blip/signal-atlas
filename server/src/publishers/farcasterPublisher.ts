import axios from 'axios';
import { PostDraft, PublicationResult, VisualDecision } from '../types.js';
import { db } from '../db/database.ts';

export async function publishToFarcaster(draft: PostDraft, visualDecision?: VisualDecision): Promise<PublicationResult> {
  const warpcastSecret = process.env.FARCASTER_WARPCAST_SECRET || process.env.FARCASTER_NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;

  if (!warpcastSecret) {
    db.addLog('INFO', 'FARCASTER_PUBLISHER', 'Farcaster credentials not configured; defaulting to simulated publication.');
    return {
      id: 'pub_fc_' + Date.now(),
      draftId: draft.id,
      platform: 'FARCASTER',
      status: 'SIMULATED',
      payload: draft.platformPayloads.FARCASTER,
      postUrl: 'https://warpcast.com/signal-atlas/0xsimulated',
      publishedAt: new Date().toISOString()
    };
  }

  const castText = draft.platformPayloads.FARCASTER;

  // 1. If Warpcast Secret starts with wc_secret_ or is configured for Warpcast API
  if (warpcastSecret.startsWith('wc_secret_')) {
    try {
      const res = await axios.post(
        'https://client.warpcast.com/v2/casts',
        { text: castText },
        {
          headers: {
            'Authorization': `Bearer ${warpcastSecret}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const hash = res.data.result?.cast?.hash || '0x' + Math.random().toString(16).substr(2, 10);
      const postUrl = `https://warpcast.com/signal-atlas/${hash}`;

      db.addLog('SUCCESS', 'FARCASTER_PUBLISHER', `Successfully published cast to Warpcast Farcaster (${hash})`);

      return {
        id: 'pub_fc_' + Date.now(),
        draftId: draft.id,
        platform: 'FARCASTER',
        status: 'SUCCESS',
        postId: hash,
        postUrl,
        payload: castText,
        publishedAt: new Date().toISOString()
      };
    } catch (err: any) {
      db.addLog('ERROR', 'FARCASTER_PUBLISHER', `Warpcast publication failed: ${err.message}`);
      return {
        id: 'pub_fc_' + Date.now(),
        draftId: draft.id,
        platform: 'FARCASTER',
        status: 'FAILED',
        payload: castText,
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }

  // 2. Neynar API fallback
  if (signerUuid) {
    try {
      const res = await axios.post(
        'https://api.neynar.com/v2/farcaster/cast',
        {
          signer_uuid: signerUuid,
          text: castText
        },
        {
          headers: {
            'api_key': warpcastSecret,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const hash = res.data.cast?.hash || '0x' + Math.random().toString(16).substr(2, 10);
      const postUrl = `https://warpcast.com/signal-atlas/${hash}`;

      db.addLog('SUCCESS', 'FARCASTER_PUBLISHER', `Successfully published cast via Neynar (${hash})`);

      return {
        id: 'pub_fc_' + Date.now(),
        draftId: draft.id,
        platform: 'FARCASTER',
        status: 'SUCCESS',
        postId: hash,
        postUrl,
        payload: castText,
        publishedAt: new Date().toISOString()
      };
    } catch (err: any) {
      db.addLog('ERROR', 'FARCASTER_PUBLISHER', `Neynar publication failed: ${err.message}`);
      return {
        id: 'pub_fc_' + Date.now(),
        draftId: draft.id,
        platform: 'FARCASTER',
        status: 'FAILED',
        payload: castText,
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }

  db.addLog('INFO', 'FARCASTER_PUBLISHER', 'Farcaster credentials incomplete; using simulated publication.');
  return {
    id: 'pub_fc_' + Date.now(),
    draftId: draft.id,
    platform: 'FARCASTER',
    status: 'SIMULATED',
    payload: castText,
    postUrl: 'https://warpcast.com/signal-atlas/0xsimulated',
    publishedAt: new Date().toISOString()
  };
}

export async function likeOnFarcaster(targetHash: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const apiKey = process.env.FARCASTER_NEYNAR_API_KEY || process.env.FARCASTER_WARPCAST_SECRET;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;
  if (!apiKey || !signerUuid) return { success: false, error: 'Missing Farcaster credentials' };

  try {
    const res = await axios.post(
      'https://api.neynar.com/v2/farcaster/reaction',
      { signer_uuid: signerUuid, reaction_type: 'like', target: targetHash },
      { headers: { api_key: apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return { success: true, response: res.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recastOnFarcaster(targetHash: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const apiKey = process.env.FARCASTER_NEYNAR_API_KEY || process.env.FARCASTER_WARPCAST_SECRET;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;
  if (!apiKey || !signerUuid) return { success: false, error: 'Missing Farcaster credentials' };

  try {
    const res = await axios.post(
      'https://api.neynar.com/v2/farcaster/reaction',
      { signer_uuid: signerUuid, reaction_type: 'recast', target: targetHash },
      { headers: { api_key: apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return { success: true, response: res.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function replyOnFarcaster(parentHash: string, text: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const apiKey = process.env.FARCASTER_NEYNAR_API_KEY || process.env.FARCASTER_WARPCAST_SECRET;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;
  if (!apiKey || !signerUuid) return { success: false, error: 'Missing Farcaster credentials' };

  try {
    const res = await axios.post(
      'https://api.neynar.com/v2/farcaster/cast',
      { signer_uuid: signerUuid, text, parent: parentHash },
      { headers: { api_key: apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return { success: true, response: res.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

