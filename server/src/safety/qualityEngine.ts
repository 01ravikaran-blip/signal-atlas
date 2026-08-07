import { StoryCluster, PostDraft, QualityScores } from '../types.js';

const PROHIBITED_HOOK_PATTERNS = [
  /^urgent[:!]/i,
  /buy this (now|before)/i,
  /guaranteed to explode/i,
  /you will regret/i,
  /insane gains/i,
  /don't miss out/i,
  /secret tip/i
];

const ALLOWED_HOOK_STARTERS = [
  "bitcoin's latest move is less about hype and more about liquidity",
  "three things changed in defi this week",
  "the rate decision matters for crypto through this specific channel",
  "market indicators show",
  "institutional data reflects",
  "recent macroeconomic reports indicate"
];

export function evaluateQualityGates(story: StoryCluster, draft: PostDraft): QualityScores {
  const primaryClaim = story.verifiedClaims[0];
  const sourceCount = primaryClaim ? primaryClaim.sources.length : 1;
  const rawTitle = draft.rawTopic.toLowerCase();
  const fullText = (draft.rawTopic + ' ' + draft.structuredContent.analysis).toLowerCase();

  // 1. Hook Validation
  const hasProhibitedHook = PROHIBITED_HOOK_PATTERNS.some(pattern => pattern.test(draft.rawTopic));
  const hookPassed = !hasProhibitedHook;
  const hookStrength = hasProhibitedHook ? 2.0 : 8.5;

  // 2. Metric Calculations (0 to 10)
  const factualAccuracy = Number((primaryClaim ? primaryClaim.confidenceScore * 10 : 7.0).toFixed(1));
  const sourceQuality = Number(Math.min(10, 6.0 + sourceCount * 2.0).toFixed(1));
  const novelty = Number((story.noveltyScore || 8.0).toFixed(1));
  const usefulness = Number(Math.min(10, 7.5 + (story.impactScore > 7 ? 1.5 : 0.5)).toFixed(1));
  const clarity = draft.structuredContent.facts.length > 0 && draft.structuredContent.analysis ? 9.0 : 6.0;
  const audienceRelevance = story.overallScore >= 7.0 ? 9.0 : 7.0;
  const platformFit = Object.keys(draft.platformPayloads).length === 4 ? 9.5 : 7.0;
  const originality = draft.revisionCount > 0 ? 8.5 : 7.5;
  const riskOfMisleading = hasProhibitedHook ? 8.5 : 1.5; // lower is better
  const spamRisk = (fullText.includes('http') && fullText.split('http').length > 3) ? 7.0 : 1.0; // lower is better

  // 3. Factual & Source Confidence
  const factualConfidence = primaryClaim ? primaryClaim.confidenceScore : 0.70;
  const sourceConfidence = Math.min(1.0, 0.70 + (sourceCount - 1) * 0.15);

  // 4. Weighted Total Score Formula
  const positiveSum = (
    factualAccuracy * 0.20 +
    sourceQuality * 0.15 +
    usefulness * 0.15 +
    clarity * 0.10 +
    audienceRelevance * 0.10 +
    hookStrength * 0.10 +
    novelty * 0.10 +
    originality * 0.05 +
    platformFit * 0.05
  );

  const penalties = (riskOfMisleading * 0.15) + (spamRisk * 0.10);
  const weightedTotalScore = Number(Math.max(0, Math.min(10, positiveSum - penalties)).toFixed(1));

  // 5. Threshold Checks
  const failureReasons: string[] = [];

  if (weightedTotalScore < 5.5) {
    failureReasons.push(`Weighted quality score (${weightedTotalScore}/10) is below minimum threshold (5.5/10).`);
  }
  if (factualConfidence < 0.65) {
    failureReasons.push(`Factual confidence (${factualConfidence.toFixed(2)}) is below minimum threshold (0.65).`);
  }
  if (sourceConfidence < 0.60) {
    failureReasons.push(`Source confidence (${sourceConfidence.toFixed(2)}) is below minimum threshold (0.60).`);
  }
  if (!hookPassed) {
    failureReasons.push(`Hook failed informative validation rules (contains clickbait or artificial urgency).`);
  }
  if (riskOfMisleading > 5.0) {
    failureReasons.push(`Risk of misleading readers (${riskOfMisleading}/10) exceeds maximum threshold (5.0).`);
  }
  if (spamRisk > 5.0) {
    failureReasons.push(`Spam risk score (${spamRisk}/10) exceeds maximum threshold (5.0).`);
  }

  const passed = failureReasons.length === 0;

  return {
    factualAccuracy,
    sourceQuality,
    novelty,
    usefulness,
    clarity,
    hookStrength,
    audienceRelevance,
    platformFit,
    originality,
    riskOfMisleading,
    spamRisk,
    weightedTotalScore,
    factualConfidence,
    sourceConfidence,
    hookPassed,
    passed,
    failureReasons
  };
}
