import crypto from 'crypto';
import { MediaAsset, VisualDecisionType, ContentSeriesType, RightsClassification, MediaScores } from '../types.js';

export interface ProcessedImageResult {
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  sha256: string;
  altText: string;
  dataUrl: string;
  buffer: Buffer;
}

export function generateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function generateAccessibleAltText(
  assetType: VisualDecisionType,
  headline: string,
  keyDataPoints: string[],
  timestamp: string
): string {
  const cleanHeadline = headline.replace(/"/g, "'").trim();
  const dateStr = new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  switch (assetType) {
    case 'ATTACH_ORIGINAL_CHART':
      return `Line chart showing market price movements for ${cleanHeadline}. Key metrics: ${keyDataPoints.join('; ')}. Data timestamped ${dateStr} by Signal Atlas.`;

    case 'ATTACH_NEWS_CARD':
      return `Signal Atlas news context card: ${cleanHeadline}. Key takeaway: ${keyDataPoints[0] || 'Verified market intelligence'}. Timestamped ${dateStr}.`;

    case 'ATTACH_TIMELINE':
      return `Signal Atlas chronological event timeline for ${cleanHeadline}. Verified milestones: ${keyDataPoints.join(' | ')}.`;

    case 'ATTACH_RISK_MAP':
      return `Signal Atlas risk scenario map for ${cleanHeadline}. Outlines base case, upside potential, and downside risk assumptions.`;

    case 'ATTACH_CORRECTION_CARD':
      return `Signal Atlas correction update card: Official correction notice for ${cleanHeadline}. Details: ${keyDataPoints.join('; ')}.`;

    case 'ATTACH_BRIEFING_CAROUSEL':
      return `Signal Atlas daily market briefing summary card detailing top verified developments: ${cleanHeadline}.`;

    default:
      return `Signal Atlas visual data card for ${cleanHeadline}. Timestamped ${dateStr}.`;
  }
}

export function processImageBuffer(
  buffer: Buffer,
  assetType: VisualDecisionType,
  headline: string,
  keyDataPoints: string[],
  timestamp: string,
  mimeType = 'image/png',
  width = 1200,
  height = 675
): ProcessedImageResult {
  const sha256 = generateSha256(buffer);
  const fileSize = buffer.length;
  const altText = generateAccessibleAltText(assetType, headline, keyDataPoints, timestamp);
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return {
    mimeType,
    width,
    height,
    fileSize,
    sha256,
    altText,
    dataUrl,
    buffer
  };
}
