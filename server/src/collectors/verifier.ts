import { NewsItem, StoryCluster, VerifiedClaim, ContentCategory } from '../types.js';
import { db } from '../db/database.ts';

// Simple text tokenization helper
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

// Jaccard similarity score between 0.0 and 1.0
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function clusterAndVerifyStories(newsItems: NewsItem[]): StoryCluster[] {
  const clusters: StoryCluster[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < newsItems.length; i++) {
    const primary = newsItems[i];
    if (processed.has(primary.id)) continue;

    const matchedNews: NewsItem[] = [primary];
    processed.add(primary.id);

    // Look for related stories
    for (let j = i + 1; j < newsItems.length; j++) {
      const candidate = newsItems[j];
      if (processed.has(candidate.id)) continue;

      const sim = calculateJaccardSimilarity(primary.title + ' ' + primary.summary, candidate.title + ' ' + candidate.summary);
      if (sim > 0.25 || (primary.category === candidate.category && sim > 0.20)) {
        matchedNews.push(candidate);
        processed.add(candidate.id);
      }
    }

    // Extract claims & verify cross-source count
    const sources = Array.from(new Set(matchedNews.map(m => m.source)));
    const verificationCount = sources.length;

    // Check for conflicting indicators
    const fullText = matchedNews.map(m => m.summary).join(' ').toLowerCase();
    const hasConflict = fullText.includes('denies') && fullText.includes('confirms') ||
                        fullText.includes('contradicts') || fullText.includes('unconfirmed');

    // Calculate base confidence score
    const avgSourceCredibility = matchedNews.reduce((acc, n) => acc + n.credibilityScore, 0) / matchedNews.length;
    const verificationBonus = Math.min(0.20, (verificationCount - 1) * 0.10);
    const conflictPenalty = hasConflict ? 0.35 : 0.0;
    const confidenceScore = Math.max(0.0, Math.min(1.0, avgSourceCredibility + verificationBonus - conflictPenalty));

    const claim: VerifiedClaim = {
      claimId: 'claim_' + Math.random().toString(36).substr(2, 6),
      statement: primary.title,
      sources,
      verificationCount,
      confidenceScore,
      conflictingSources: hasConflict,
      category: primary.category
    };

    // Calculate impact and novelty scores (1-10)
    const impactScore = Math.min(10, Math.max(4, Math.floor(confidenceScore * 7 + verificationCount * 1.5)));
    const noveltyScore = 8;
    const overallScore = Number(((impactScore * 0.6) + (confidenceScore * 4)).toFixed(1));

    const cluster: StoryCluster = {
      id: 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: primary.title,
      category: primary.category,
      primaryNews: matchedNews,
      verifiedClaims: [claim],
      impactScore,
      noveltyScore,
      overallScore,
      timestamp: new Date().toISOString()
    };

    clusters.push(cluster);
    db.addStory(cluster);
  }

  // Sort by overall score descending
  clusters.sort((a, b) => b.overallScore - a.overallScore);

  db.addLog('INFO', 'VERIFIER', `Clustered into ${clusters.length} stories. Top story score: ${clusters[0]?.overallScore || 0}`);
  return clusters;
}
