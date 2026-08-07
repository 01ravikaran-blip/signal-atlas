import {
  StoryCluster,
  PostDraft,
  VisualDecision,
  VisualDecisionType,
  ContentSeriesType,
  MediaAsset
} from '../types.js';
import { db } from '../db/database.ts';
import { classifyImageRights } from './rightsEngine.ts';
import { processImageBuffer } from './imageProcessor.ts';
import { evaluateMediaSafety } from './mediaSafetyEngine.ts';
import { generateBrandedGraphicBuffer, ChartGeneratorOptions } from './chartGenerator.ts';

export async function evaluateVisualDecision(
  story: StoryCluster,
  draft: PostDraft
): Promise<VisualDecision> {
  const primaryNews = story.primaryNews[0];
  const headline = primaryNews ? primaryNews.title : story.title;
  const sourceName = primaryNews ? primaryNews.source : 'Signal Atlas Feeds';
  const sourceUrl = primaryNews ? primaryNews.url : 'https://signalatlas.org';
  const category = story.category;
  const timestamp = new Date().toISOString();

  // 1. Determine Content Series Type
  let seriesType: ContentSeriesType = 'GLOBAL_MARKET_MAP';
  if (category === 'CRYPTO_DEFI') seriesType = 'DEFI_RISK_RADAR';
  else if (category === 'AI_WEB3') seriesType = 'AI_WEB3_RADAR';
  else if (category === 'STOCKS_MACRO') seriesType = 'MACRO_TRANSMISSION';

  if (story.isImportantNews) seriesType = 'DEVELOPING_TIMELINE';

  // 2. Decide Attachment Type (Selective 35%–50% target)
  let decisionType: VisualDecisionType = 'TEXT_ONLY';

  // If high impact or important breaking news -> Attach chart/card
  const marketSnapshot = db.getLatestMarketSnapshot();
  const hasTickerData = marketSnapshot && marketSnapshot.crypto && marketSnapshot.crypto.length > 0;

  const lowerTopic = draft.rawTopic.toLowerCase();

  if (lowerTopic.includes('correction') || lowerTopic.includes('update notice')) {
    decisionType = 'ATTACH_CORRECTION_CARD';
  } else if (story.isImportantNews || story.impactScore >= 8.5) {
    decisionType = 'ATTACH_TIMELINE';
  } else if (hasTickerData && (category === 'CRYPTO_DEFI' || lowerTopic.includes('bitcoin') || lowerTopic.includes('ethereum') || lowerTopic.includes('price'))) {
    decisionType = 'ATTACH_ORIGINAL_CHART';
  } else if (story.overallScore >= 7.5) {
    decisionType = 'ATTACH_NEWS_CARD';
  } else if (story.overallScore >= 7.0) {
    decisionType = 'USE_LINK_CARD_ONLY';
  } else {
    decisionType = 'TEXT_ONLY';
  }

  // If TEXT_ONLY or USE_LINK_CARD_ONLY, return decision directly
  if (decisionType === 'TEXT_ONLY' || decisionType === 'USE_LINK_CARD_ONLY') {
    const rights = classifyImageRights(sourceUrl, sourceName, true);
    const safety = evaluateMediaSafety(decisionType, rights.classification, headline, false, story.verifiedClaims[0]?.confidenceScore || 0.9);

    return {
      decision: decisionType,
      seriesType,
      reason: decisionType === 'TEXT_ONLY' ? 'Story clear as text; visual unnecessary to prevent audience fatigue.' : 'Using native link preview card with source metadata.',
      scores: safety.scores,
      rightsClassification: rights.classification,
      altText: '',
      attributionText: rights.attributionText
    };
  }

  // 3. Generate Original Branded Graphic Buffer
  const rights = classifyImageRights(sourceUrl, sourceName, true);
  const tickers = (marketSnapshot && marketSnapshot.crypto)
    ? marketSnapshot.crypto.map(t => ({ symbol: t.symbol, price: t.priceUsd, change24h: t.change24h }))
    : [{ symbol: 'BTC', price: 95420, change24h: 3.45 }];

  const timelineMilestones = story.primaryNews.slice(0, 3).map(n => ({
    time: new Date(n.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: n.title,
    source: n.source
  }));

  const chartOptions: ChartGeneratorOptions = {
    assetType: decisionType,
    seriesType,
    title: headline,
    category,
    timestamp,
    sourceName,
    sourceUrl,
    keyDataPoints: draft.structuredContent.facts,
    tickers,
    timelineMilestones
  };

  const buffer = generateBrandedGraphicBuffer(chartOptions);
  const processed = processImageBuffer(
    buffer,
    decisionType,
    headline,
    draft.structuredContent.facts,
    timestamp,
    'image/svg+xml',
    1200,
    675
  );

  // 4. Run Safety Evaluation
  const safety = evaluateMediaSafety(
    decisionType,
    rights.classification,
    headline,
    false,
    story.verifiedClaims[0]?.confidenceScore || 0.9
  );

  if (!safety.passed) {
    db.addLog('WARN', 'MEDIA_DECISION', `Visual generation rejected for draft ${draft.id}: ${safety.rejectionReason}`);
    return {
      decision: 'BLOCK_VISUAL',
      seriesType,
      reason: safety.rejectionReason || 'Visual safety check failed',
      scores: safety.scores,
      rightsClassification: rights.classification,
      altText: processed.altText,
      attributionText: rights.attributionText
    };
  }

  // 5. Construct & Record MediaAsset
  const mediaAsset: MediaAsset = {
    id: 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    contentItemId: draft.id,
    assetType: decisionType,
    seriesType,
    sourceUrl,
    rightsClassification: rights.classification,
    attributionText: rights.attributionText,
    mimeType: processed.mimeType,
    width: processed.width,
    height: processed.height,
    fileSize: processed.fileSize,
    sha256: processed.sha256,
    altText: processed.altText,
    generatedBy: 'SIGNAL_ATLAS_CHART_ENGINE',
    isAiGenerated: false,
    processingStatus: 'PROCESSED',
    dataUrl: processed.dataUrl,
    scores: safety.scores,
    createdAt: timestamp
  };

  db.addMediaAsset(mediaAsset);
  db.addLog('SUCCESS', 'MEDIA_DECISION', `Generated ${decisionType} graphic for draft ${draft.id} (${processed.fileSize} bytes, SHA256: ${processed.sha256.substring(0, 8)})`);

  return {
    decision: decisionType,
    seriesType,
    reason: `Original visual attached (${decisionType}). Information gain: ${safety.scores.expectedInformationGain}/10.`,
    scores: safety.scores,
    rightsClassification: rights.classification,
    altText: processed.altText,
    attributionText: rights.attributionText,
    mediaAsset
  };
}
