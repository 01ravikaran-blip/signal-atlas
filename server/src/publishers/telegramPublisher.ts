import axios from 'axios';
import { PostDraft, PublicationResult } from '../types.js';
import { db } from '../db/database.ts';

export async function publishToTelegram(draft: PostDraft): Promise<PublicationResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    db.addLog('INFO', 'TELEGRAM_PUBLISHER', 'Telegram bot credentials not configured; defaulting to simulated publication.');
    return {
      id: 'pub_tg_' + Date.now(),
      draftId: draft.id,
      platform: 'TELEGRAM',
      status: 'SIMULATED',
      payload: draft.platformPayloads.TELEGRAM,
      postUrl: 'https://t.me/signal_atlas/101',
      publishedAt: new Date().toISOString()
    };
  }

  try {
    const message = draft.platformPayloads.TELEGRAM;
    const res = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      },
      { timeout: 10000 }
    );

    const messageId = res.data.result?.message_id || '101';
    const postUrl = `https://t.me/signal_atlas/${messageId}`;

    db.addLog('SUCCESS', 'TELEGRAM_PUBLISHER', `Successfully published to Telegram channel (Message ID: ${messageId})`);

    return {
      id: 'pub_tg_' + Date.now(),
      draftId: draft.id,
      platform: 'TELEGRAM',
      status: 'SUCCESS',
      postId: String(messageId),
      postUrl,
      payload: message,
      publishedAt: new Date().toISOString()
    };
  } catch (err: any) {
    db.addLog('ERROR', 'TELEGRAM_PUBLISHER', `Telegram publication failed: ${err.message}`);
    return {
      id: 'pub_tg_' + Date.now(),
      draftId: draft.id,
      platform: 'TELEGRAM',
      status: 'FAILED',
      payload: draft.platformPayloads.TELEGRAM,
      error: err.message,
      publishedAt: new Date().toISOString()
    };
  }
}
