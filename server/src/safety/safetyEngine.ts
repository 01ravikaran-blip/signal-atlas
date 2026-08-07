import { StoryCluster, PostDraft, SafetyCheckResult, BlockedPost } from '../types.js';
import { BLOCK_CODES, PROHIBITED_KEYWORDS } from '../config/policy.ts';
import { SYSTEM_DEFAULTS } from '../config/constants.ts';
import { db } from '../db/database.ts';
import { calculateJaccardSimilarity } from '../collectors/verifier.ts';
import { evaluateQualityGates } from './qualityEngine.ts';

export function evaluateSafetyPolicy(story: StoryCluster, draft: PostDraft): SafetyCheckResult {
  const settings = db.getSettings();
  const minConfidence = settings.minConfidenceThreshold || SYSTEM_DEFAULTS.minConfidenceThreshold;
  
  const verifiedFactCount = story.verifiedClaims.reduce((acc, c) => acc + c.verificationCount, 0);
  const primaryClaim = story.verifiedClaims[0];
  const confidenceScore = primaryClaim ? primaryClaim.confidenceScore : 0.50;
  const sourceConflicts = story.verifiedClaims.some(c => c.conflictingSources);

  const fullContent = (
    draft.rawTopic + ' ' +
    draft.structuredContent.facts.join(' ') + ' ' +
    draft.structuredContent.analysis + ' ' +
    draft.structuredContent.forecasts
  ).toLowerCase();

  // 1. Keyword rule checks
  const givesInvestmentAdvice = PROHIBITED_KEYWORDS.financialAdvice.some(kw => fullContent.includes(kw));
  const promisesReturns = PROHIBITED_KEYWORDS.guaranteedReturns.some(kw => fullContent.includes(kw));
  const illegalOrFraud = PROHIBITED_KEYWORDS.illegalOrFraud.some(kw => fullContent.includes(kw));
  const panicInducing = PROHIBITED_KEYWORDS.panicTerms.some(kw => fullContent.includes(kw));
  const harmfulContent = fullContent.includes('terrorist') || fullContent.includes('exploit') || fullContent.includes('harass');
  const impersonation = fullContent.includes('official white house statement') || fullContent.includes('sec chairman direct quote private');

  // 2. Duplicate & Similarity Check
  let duplicateDetected = false;
  let maxSimilarity = 0;
  const recentPublications = db.getPublications(100);
  for (const pub of recentPublications) {
    const sim = calculateJaccardSimilarity(draft.rawTopic, pub.payload);
    if (sim > maxSimilarity) maxSimilarity = sim;
    if (sim >= SYSTEM_DEFAULTS.duplicateSimilarityThreshold) {
      duplicateDetected = true;
      break;
    }
  }

  // 3. Evaluate 11 Content Quality Gates
  const qualityScores = evaluateQualityGates(story, draft);

  // Determine Blocking Decision
  let passed = true;
  let blockReason = '';
  let blockCode = '';

  if (verifiedFactCount < 1) {
    passed = false;
    blockCode = BLOCK_CODES.UNVERIFIED_FACTS;
    blockReason = 'Facts cannot be verified against reliable news or market data feeds.';
  } else if (sourceConflicts) {
    passed = false;
    blockCode = BLOCK_CODES.SOURCE_CONFLICT;
    blockReason = 'Primary sources strongly conflict or contradict each other.';
  } else if (confidenceScore < minConfidence) {
    passed = false;
    blockCode = BLOCK_CODES.LOW_CONFIDENCE;
    blockReason = `Source confidence score (${confidenceScore.toFixed(2)}) is below configured threshold (${minConfidence.toFixed(2)}).`;
  } else if (!qualityScores.passed) {
    passed = false;
    blockCode = 'BLOCK_QUALITY_GATE_FAILURE';
    blockReason = qualityScores.failureReasons.join(' | ');
  } else if (givesInvestmentAdvice) {
    passed = false;
    blockCode = BLOCK_CODES.FINANCIAL_ADVICE;
    blockReason = 'Content contains personalized investment advice or explicit purchase recommendations.';
  } else if (promisesReturns) {
    passed = false;
    blockCode = BLOCK_CODES.GUARANTEED_RETURNS;
    blockReason = 'Content promises or guarantees financial returns or risk-free profits.';
  } else if (illegalOrFraud) {
    passed = false;
    blockCode = BLOCK_CODES.ILLEGAL_OR_FRAUD;
    blockReason = 'Content encourages illegal market manipulation, pump & dump, or regulatory evasion.';
  } else if (harmfulContent) {
    passed = false;
    blockCode = BLOCK_CODES.HARMFUL_CONTENT;
    blockReason = 'Content violates safety guidelines regarding harmful or offensive material.';
  } else if (impersonation) {
    passed = false;
    blockCode = BLOCK_CODES.IMPERSONATION;
    blockReason = 'Content falsely impersonates an official entity or government authority.';
  } else if (duplicateDetected) {
    passed = false;
    blockCode = BLOCK_CODES.DUPLICATE_CONTENT;
    blockReason = `Duplicate content detected (Similarity score ${maxSimilarity.toFixed(2)} exceeds threshold ${SYSTEM_DEFAULTS.duplicateSimilarityThreshold}).`;
  } else if (panicInducing) {
    passed = false;
    blockCode = BLOCK_CODES.PANIC_INDUCING;
    blockReason = 'Content contains extreme unsupported panic claims likely to create artificial market disturbance.';
  }

  // Intelligent Disclaimer Logic
  let disclaimerType: 'NONE' | 'NFA' | 'EDUCATIONAL' = 'NONE';
  let disclaimerAdded = false;

  if (passed) {
    if (fullContent.includes('price') || fullContent.includes('target') || fullContent.includes('trading') || fullContent.includes('forecast') || fullContent.includes('return')) {
      disclaimerType = 'NFA';
      disclaimerAdded = true;
    } else if (fullContent.includes('fed') || fullContent.includes('brics') || fullContent.includes('rate') || fullContent.includes('inflation')) {
      disclaimerType = 'EDUCATIONAL';
      disclaimerAdded = true;
    }
  }

  const details = {
    verifiedFactCount,
    sourceConflicts,
    givesInvestmentAdvice,
    promisesReturns,
    illegalOrFraud,
    harmfulContent,
    impersonation,
    duplicateDetected,
    similarityScore: maxSimilarity,
    panicInducing
  };

  // Record to Blocked Vault database if blocked
  if (!passed) {
    const blockedPost: BlockedPost = {
      id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      draftId: draft.id,
      storyTitle: draft.rawTopic,
      category: draft.category,
      blockCode,
      blockReason,
      confidenceScore,
      draftContent: draft.platformPayloads.TELEGRAM || draft.rawTopic,
      safetyDetails: details,
      qualityScores,
      timestamp: new Date().toISOString()
    };
    db.addBlockedPost(blockedPost);
  }

  return {
    passed,
    blockReason,
    blockCode,
    confidenceScore,
    disclaimerType,
    disclaimerAdded,
    qualityScores,
    details
  };
}
