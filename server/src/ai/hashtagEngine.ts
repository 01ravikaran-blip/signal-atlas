import { ContentCategory, PlatformTarget, HashtagSelection } from '../types.js';
import { CATEGORY_HASHTAGS, HASHTAG_BLACKLIST, PLATFORM_HASHTAG_LIMITS } from '../config/hashtags.ts';

export function selectHashtagsForStory(category: ContentCategory, topicText: string): HashtagSelection {
  const lowerText = topicText.toLowerCase();
  const catConfig = CATEGORY_HASHTAGS[category] || CATEGORY_HASHTAGS.CRYPTO_DEFI;

  // 1. Pick Broad Category Tag
  const categoryTag = catConfig.broad[0] || `#${category.toLowerCase()}`;

  // 2. Select Niche Tag based on keyword match
  let nicheTag = catConfig.broad[1] || '#markets';
  for (const [subtopic, tags] of Object.entries(catConfig.niche)) {
    if (lowerText.includes(subtopic) || tags.some(t => lowerText.includes(t.replace('#', '')))) {
      nicheTag = tags[0];
      break;
    }
  }

  // 3. Optional Event/Region Tag
  let eventTag: string | undefined = undefined;
  if (lowerText.includes('fed') || lowerText.includes('sec') || lowerText.includes('us')) eventTag = '#us';
  else if (lowerText.includes('india') || lowerText.includes('nifty')) eventTag = '#india';
  else if (lowerText.includes('brics')) eventTag = '#brics';
  else if (lowerText.includes('europe') || lowerText.includes('eu')) eventTag = '#europe';

  // Candidate pool
  const candidatePool = [categoryTag, nicheTag, eventTag].filter((t): t is string => Boolean(t));

  // Remove blacklisted or duplicate tags
  const validPool = Array.from(
    new Set(candidatePool.filter(t => !HASHTAG_BLACKLIST.has(t.toLowerCase())))
  );

  // Generate platform-tailored tag sets
  const selectedTags: Record<PlatformTarget, string[]> = {
    BLUESKY: validPool.slice(0, PLATFORM_HASHTAG_LIMITS.BLUESKY.max),
    FARCASTER: validPool.slice(0, PLATFORM_HASHTAG_LIMITS.FARCASTER.max),
    TELEGRAM: validPool.map(t => t.toLowerCase()).slice(0, PLATFORM_HASHTAG_LIMITS.TELEGRAM.max),
    DISCORD: validPool.slice(0, PLATFORM_HASHTAG_LIMITS.DISCORD.max)
  };

  return {
    candidateTags: validPool,
    selectedTags,
    categoryTag,
    nicheTag,
    eventTag
  };
}

export function appendHashtagsToPayload(payload: string, platform: PlatformTarget, hashtags: HashtagSelection): string {
  const tags = hashtags.selectedTags[platform] || [];
  if (tags.length === 0) return payload;

  const tagLine = tags.join(' ');
  // Avoid duplicating if already present
  if (payload.includes(tagLine)) return payload;

  return `${payload.trim()}\n\n${tagLine}`;
}
