import { RightsClassification } from '../types.js';

export interface ImageRightsCheckResult {
  classification: RightsClassification;
  canPublishFile: boolean;
  attributionRequired: boolean;
  attributionText: string;
  reason: string;
}

const KNOWN_PERMITTED_DOMAINS = [
  'federalreserve.gov',
  'sec.gov',
  'treasury.gov',
  'wikimedia.org',
  'commons.wikimedia.org',
  'signalatlas.org'
];

export function classifyImageRights(
  sourceUrl?: string,
  sourceName?: string,
  isGeneratedFromData = true
): ImageRightsCheckResult {
  // 1. If generated from owned market data by Signal Atlas chart engine
  if (isGeneratedFromData) {
    return {
      classification: 'GENERATED_FROM_OWNED_DATA',
      canPublishFile: true,
      attributionRequired: true,
      attributionText: 'Source: Signal Atlas Market Intelligence Engine (SignalAtlas.org)',
      reason: 'Original visual generated programmatically from verified stored market snapshots.'
    };
  }

  // 2. If no source URL provided, rights are unknown
  if (!sourceUrl) {
    return {
      classification: 'UNKNOWN_RIGHTS',
      canPublishFile: false,
      attributionRequired: false,
      attributionText: '',
      reason: 'No source URL or licensing metadata provided; cannot verify reuse permissions.'
    };
  }

  try {
    const parsed = new URL(sourceUrl);
    const hostname = parsed.hostname.toLowerCase();

    // 3. Official Public Domain / US Govt sources
    if (KNOWN_PERMITTED_DOMAINS.some(d => hostname.endsWith(d))) {
      return {
        classification: 'PUBLIC_DOMAIN_OR_CONFIRMED_PERMITTED',
        canPublishFile: true,
        attributionRequired: true,
        attributionText: `Source: ${sourceName || hostname}`,
        reason: 'Confirmed public domain or official government data release with reuse permission.'
      };
    }

    // 4. Default web article images without explicit open license are SOURCE_PREVIEW_ONLY or UNKNOWN_RIGHTS
    return {
      classification: 'SOURCE_PREVIEW_ONLY',
      canPublishFile: false, // Do not copy image file directly; use link card preview instead
      attributionRequired: true,
      attributionText: `Source data & image rights: ${sourceName || hostname}`,
      reason: 'Standard news publisher imagery. File copy restricted to prevent copyright infringement; link preview permitted.'
    };
  } catch (err) {
    return {
      classification: 'UNKNOWN_RIGHTS',
      canPublishFile: false,
      attributionRequired: false,
      attributionText: '',
      reason: 'Invalid source URL format.'
    };
  }
}
