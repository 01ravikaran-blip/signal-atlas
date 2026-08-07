import axios from 'axios';
import { PostDraft, PublicationResult, VisualDecision } from '../types.js';
import { db } from '../db/database.ts';
import { SOCIAL_HANDLES } from '../config/constants.ts';

export async function publishToDiscord(draft: PostDraft, visualDecision?: VisualDecision): Promise<PublicationResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const botToken = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!webhookUrl && (!botToken || !channelId)) {
    db.addLog('INFO', 'DISCORD_PUBLISHER', 'Discord credentials incomplete (requires DISCORD_WEBHOOK_URL or DISCORD_TOKEN + DISCORD_CHANNEL_ID); defaulting to simulated publication.');
    return {
      id: 'pub_disc_' + Date.now(),
      draftId: draft.id,
      platform: 'DISCORD',
      status: 'SIMULATED',
      payload: draft.platformPayloads.DISCORD,
      postUrl: 'https://discord.com/channels/12345/67890/10001',
      publishedAt: new Date().toISOString()
    };
  }

  const embedColor = draft.category === 'CRYPTO_DEFI' ? 0x7928CA : draft.category === 'AI_WEB3' ? 0x00F2FE : 0xF59E0B;
  const content = draft.platformPayloads.DISCORD;

  const embedPayload: any = {
    title: `📊 Signal Atlas Market Insight: ${draft.rawTopic.substring(0, 100)}`,
    description: content,
    color: embedColor,
    footer: { text: `Signal Atlas | Bsky: ${SOCIAL_HANDLES.BLUESKY} | FC: ${SOCIAL_HANDLES.FARCASTER}` },
    timestamp: new Date().toISOString()
  };

  if (visualDecision && visualDecision.mediaAsset && visualDecision.mediaAsset.dataUrl) {
    embedPayload.image = { url: visualDecision.mediaAsset.dataUrl };
  }


  // 1. Post via Discord Bot API if TOKEN and CHANNEL_ID are set
  if (botToken && channelId) {
    try {
      const res = await axios.post(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          embeds: [embedPayload]
        },
        {
          headers: {
            'Authorization': `Bot ${botToken.trim()}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const msgId = res.data.id || '10001';
      const postUrl = `https://discord.com/channels/@me/${channelId}/${msgId}`;

      db.addLog('SUCCESS', 'DISCORD_PUBLISHER', `Successfully posted message to Discord Channel (${channelId}) via Bot API.`);

      return {
        id: 'pub_disc_' + Date.now(),
        draftId: draft.id,
        platform: 'DISCORD',
        status: 'SUCCESS',
        postId: msgId,
        postUrl,
        payload: content,
        publishedAt: new Date().toISOString()
      };
    } catch (err: any) {
      db.addLog('WARN', 'DISCORD_PUBLISHER', `Discord Bot API call failed: ${err.message}. Retrying via Webhook if available.`);
    }
  }

  // 2. Post via Discord Webhook URL
  if (webhookUrl) {
    try {
      const webhookPayload = {
        username: 'Signal Atlas Analyst',
        avatar_url: 'https://signalatlas.org/icon.png',
        embeds: [embedPayload]
      };

      await axios.post(webhookUrl, webhookPayload, { timeout: 10000 });

      db.addLog('SUCCESS', 'DISCORD_PUBLISHER', 'Successfully posted Discord Embed to channel webhook.');

      return {
        id: 'pub_disc_' + Date.now(),
        draftId: draft.id,
        platform: 'DISCORD',
        status: 'SUCCESS',
        payload: content,
        postUrl: 'https://discord.com/channels/live_webhook',
        publishedAt: new Date().toISOString()
      };
    } catch (err: any) {
      db.addLog('ERROR', 'DISCORD_PUBLISHER', `Discord publication failed: ${err.message}`);
      return {
        id: 'pub_disc_' + Date.now(),
        draftId: draft.id,
        platform: 'DISCORD',
        status: 'FAILED',
        payload: draft.platformPayloads.DISCORD,
        error: err.message,
        publishedAt: new Date().toISOString()
      };
    }
  }

  return {
    id: 'pub_disc_' + Date.now(),
    draftId: draft.id,
    platform: 'DISCORD',
    status: 'SIMULATED',
    payload: draft.platformPayloads.DISCORD,
    postUrl: 'https://discord.com/channels/12345/67890/10001',
    publishedAt: new Date().toISOString()
  };
}

export async function replyOnDiscord(messageId: string, text: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const botToken = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (botToken && channelId) {
    try {
      const res = await axios.post(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          content: text,
          message_reference: { message_id: messageId }
        },
        {
          headers: {
            'Authorization': `Bot ${botToken.trim()}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      return { success: true, response: res.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  if (webhookUrl) {
    try {
      const res = await axios.post(webhookUrl, { content: text }, { timeout: 10000 });
      return { success: true, response: res.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Missing Discord credentials' };
}

