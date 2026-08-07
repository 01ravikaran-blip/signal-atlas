import { StoryCluster, PostDraft, StructuredContent, PlatformTarget } from '../types.js';
import { llmProvider } from './llmProvider.ts';
import { BRAND_CONFIG, DISCLAIMERS, SOCIAL_HANDLES } from '../config/constants.ts';
import { selectHashtagsForStory, appendHashtagsToPayload } from './hashtagEngine.ts';

export async function generatePostDraft(story: StoryCluster): Promise<PostDraft> {
  const primaryNews = story.primaryNews[0];
  const title = primaryNews ? primaryNews.title : story.title;
  const summary = primaryNews ? primaryNews.summary : story.title;
  const source = primaryNews ? primaryNews.source : 'Public Feeds';

  const systemPrompt = `You are ${BRAND_CONFIG.name}. ${BRAND_CONFIG.identity}
Rules:
- ${BRAND_CONFIG.toneRules.join('\n- ')}
- Strictly output four sections: [FACTS], [ANALYSIS], [UNCERTAINTY], [FORECAST].`;

  const userPrompt = `Generate a neutral market update for story: "${title}".
Summary: ${summary}
Source: ${source}`;

  const rawAiOutput = await llmProvider.generateText(userPrompt, systemPrompt);

  // Parse structured sections
  const structuredContent: StructuredContent = parseStructuredOutput(rawAiOutput, title, summary, source);

  // Hashtag Intelligence selection
  const hashtags = selectHashtagsForStory(story.category, title + ' ' + summary);

  // Format tailored payloads for each target platform
  const rawPayloads = generatePlatformPayloads(title, structuredContent, story.category, primaryNews?.url);

  // Append controlled hashtags per platform limits
  const platformPayloads: Record<PlatformTarget, string> = {
    BLUESKY: appendHashtagsToPayload(rawPayloads.BLUESKY, 'BLUESKY', hashtags),
    FARCASTER: appendHashtagsToPayload(rawPayloads.FARCASTER, 'FARCASTER', hashtags),
    TELEGRAM: appendHashtagsToPayload(rawPayloads.TELEGRAM, 'TELEGRAM', hashtags),
    DISCORD: appendHashtagsToPayload(rawPayloads.DISCORD, 'DISCORD', hashtags)
  };

  const draft: PostDraft = {
    id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    storyId: story.id,
    category: story.category,
    rawTopic: title,
    structuredContent,
    platformPayloads,
    hashtags,
    revisionCount: 0,
    createdAt: new Date().toISOString()
  };

  return draft;
}

function parseStructuredOutput(raw: string, title: string, summary: string, source: string): StructuredContent {
  const facts: string[] = [];
  let analysis = '';
  const uncertainties: string[] = [];
  let forecasts = '';

  if (raw.includes('[FACTS]')) {
    const factsMatch = raw.match(/\[FACTS\]([\s\S]*?)(?=\[ANALYSIS\]|$)/i);
    if (factsMatch) {
      facts.push(...factsMatch[1].split('\n').map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean));
    }
  }

  if (raw.includes('[ANALYSIS]')) {
    const analysisMatch = raw.match(/\[ANALYSIS\]([\s\S]*?)(?=\[UNCERTAINTY\]|$)/i);
    if (analysisMatch) analysis = analysisMatch[1].trim();
  }

  if (raw.includes('[UNCERTAINTY]')) {
    const uncMatch = raw.match(/\[UNCERTAINTY\]([\s\S]*?)(?=\[FORECAST\]|$)/i);
    if (uncMatch) {
      uncertainties.push(...uncMatch[1].split('\n').map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean));
    }
  }

  if (raw.includes('[FORECAST]')) {
    const fcMatch = raw.match(/\[FORECAST\]([\s\S]*?)$/i);
    if (fcMatch) forecasts = fcMatch[1].trim();
  }

  // Fallbacks if section parsing was partial
  if (facts.length === 0) {
    facts.push(`${title}`);
    facts.push(`Reported by ${source}: ${summary.substring(0, 140)}...`);
  }
  if (!analysis) {
    analysis = `Data indicates notable positioning shifts across market participants following recent announcements.`;
  }
  if (uncertainties.length === 0) {
    uncertainties.push(`Regulatory developments and liquidity shifts remain key variable factors.`);
  }
  if (!forecasts) {
    forecasts = `Markets likely to monitor follow-up volume levels and official central bank/protocol metrics.`;
  }

  // Determine disclaimer requirements
  const fullText = (title + ' ' + summary + ' ' + analysis).toLowerCase();
  let disclaimerRequired: 'NONE' | 'NFA' | 'EDUCATIONAL' = 'NONE';
  let disclaimerText: string | undefined = undefined;

  if (fullText.includes('price') || fullText.includes('target') || fullText.includes('inflow') || fullText.includes('trading') || fullText.includes('return')) {
    disclaimerRequired = 'NFA';
    disclaimerText = DISCLAIMERS.NFA;
  } else if (fullText.includes('fed') || fullText.includes('inflation') || fullText.includes('rate') || fullText.includes('brics')) {
    disclaimerRequired = 'EDUCATIONAL';
    disclaimerText = DISCLAIMERS.EDUCATIONAL;
  }

  return {
    facts,
    analysis,
    uncertainties,
    forecasts,
    disclaimerRequired,
    disclaimerText
  };
}

function generatePlatformPayloads(
  title: string,
  content: StructuredContent,
  category: string,
  sourceUrl?: string
): Record<PlatformTarget, string> {

  // 1. Bluesky (<300 chars per post, mentions Discord & Farcaster)
  const bskyText = `📊 SIGNAL ATLAS\n\n[FACT] ${title.substring(0, 85)}\n\n[ANALYSIS] ${content.analysis.substring(0, 75)}\n\n💬 Discord: ${SOCIAL_HANDLES.DISCORD_INVITE}\n💬 FC: ${SOCIAL_HANDLES.FARCASTER}`;

  // 2. Farcaster (<320 bytes, mentions Discord & Bluesky)
  const farcasterText = `🌐 Signal Atlas Update\n\n📌 ${title.substring(0, 110)}\n\n💡 ${content.analysis.substring(0, 75)}\n\n💬 Discord: ${SOCIAL_HANDLES.DISCORD_INVITE}\n💬 Bsky: ${SOCIAL_HANDLES.BLUESKY}`;

  // 3. Telegram (HTML formatted, mentions Discord, Bluesky, Farcaster)
  const telegramText = `<b>SIGNAL ATLAS: GLOBAL MARKETS INSIGHT</b>\n\n<b>FACTS:</b>\n• ${content.facts.join('\n• ')}\n\n<b>ANALYSIS:</b>\n${content.analysis}\n\n<b>UNCERTAINTY:</b>\n• ${content.uncertainties.join('\n• ')}\n\n<b>FORECAST:</b>\n${content.forecasts}${content.disclaimerText || ''}\n\n<a href="${sourceUrl || 'https://signalatlas.org'}">🔗 Read Source Data</a>\n\n📱 <b>Connect:</b> <a href="${SOCIAL_HANDLES.DISCORD_INVITE}">Discord</a> | <b>Bsky:</b> ${SOCIAL_HANDLES.BLUESKY} | <b>FC:</b> ${SOCIAL_HANDLES.FARCASTER}`;

  // 4. Discord (Markdown / Rich Embed, mentions Bluesky & Farcaster)
  const discordText = `**[SIGNAL ATLAS MARKET REPORT]**\nCategory: \`${category}\`\n\n> **${title}**\n\n**📌 FACTS:**\n- ${content.facts.join('\n- ')}\n\n**💡 ANALYSIS:**\n${content.analysis}\n\n**⚠️ UNCERTAINTIES:**\n- ${content.uncertainties.join('\n- ')}\n\n**🔮 FORECAST:**\n${content.forecasts}${content.disclaimerText || ''}\n\n**🌐 FIND US ON OTHER PLATFORMS:**\n- Bluesky: \`${SOCIAL_HANDLES.BLUESKY}\`\n- Farcaster: \`${SOCIAL_HANDLES.FARCASTER}\``;

  return {
    BLUESKY: bskyText,
    FARCASTER: farcasterText,
    TELEGRAM: telegramText,
    DISCORD: discordText
  };
}

