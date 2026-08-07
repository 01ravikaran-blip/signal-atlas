import { ContentCategory, PlatformTarget } from '../types.js';

export const BRAND_CONFIG = {
  name: 'Signal Atlas',
  identity: 'Neutral, evidence-first global markets analyst.',
  toneRules: [
    'Never sensational, manipulative, or clickbait-driven.',
    'Never pretend to be a human expert with private access.',
    'Always distinguish facts, analysis, uncertainty, and forecasts.',
    'Clear enough for beginners, useful for experienced crypto and finance audiences.',
    'English language only.'
  ]
};

export const DISTRIBUTION_MIX: Record<ContentCategory, number> = {
  CRYPTO_DEFI: 0.50,
  AI_WEB3: 0.25,
  STOCKS_MACRO: 0.25
};

export const SYSTEM_DEFAULTS = {
  minConfidenceThreshold: 0.70,
  duplicateSimilarityThreshold: 0.82, // Block if similarity > 82%
  publishIntervalMinutes: 5,
};

export const PLATFORM_LIMITS: Record<PlatformTarget, { maxChars: number; maxBytes?: number; supportsThreading: boolean }> = {
  BLUESKY: { maxChars: 300, supportsThreading: true },
  FARCASTER: { maxChars: 320, maxBytes: 320, supportsThreading: true },
  TELEGRAM: { maxChars: 4096, supportsThreading: false },
  DISCORD: { maxChars: 2000, supportsThreading: false }
};

export const DISCLAIMERS = {
  NFA: '\n\nDisclaimer: Not financial advice. Information is for educational and analytical purposes only.',
  EDUCATIONAL: '\n\nNote: Analysis based on public market data and verifiable news feeds. Educational purposes only.'
};

export const SOCIAL_HANDLES = {
  DISCORD: process.env.DISCORD_HANDLE || '@signalatlas',
  DISCORD_INVITE: process.env.DISCORD_INVITE_URL || 'https://discord.gg/signalatlas',
  BLUESKY: process.env.BLUESKY_HANDLE || '@signalatlas.bsky.social',
  FARCASTER: process.env.FARCASTER_HANDLE || '@signal-atlas'
};

