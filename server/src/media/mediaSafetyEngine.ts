import { MediaScores, RightsClassification, VisualDecisionType } from '../types.js';

export interface VisualSafetyCheckResult {
  passed: boolean;
  scores: MediaScores;
  rejectionReason?: string;
}

export function evaluateMediaSafety(
  decisionType: VisualDecisionType,
  rights: RightsClassification,
  headline: string,
  isAiGenerated = false,
  confidenceScore = 0.90
): VisualSafetyCheckResult {

  // 1. Calculate the 7 Visual Metric Scores (0 to 10 scale)
  const isOriginalOrOwnedData = rights === 'GENERATED_FROM_OWNED_DATA' || rights === 'OWNED_ORIGINAL';
  const isPermitted = isOriginalOrOwnedData || rights === 'PUBLIC_DOMAIN_OR_CONFIRMED_PERMITTED' || rights === 'OFFICIAL_MEDIA_WITH_REUSE_PERMISSION';

  const visualValueScore = decisionType === 'TEXT_ONLY' || decisionType === 'USE_LINK_CARD_ONLY' || decisionType === 'BLOCK_VISUAL'
    ? 3.0
    : Number((7.0 + (confidenceScore > 0.85 ? 1.5 : 0.5) + (isOriginalOrOwnedData ? 1.0 : 0.0)).toFixed(1));

  const factualVisualRisk = isOriginalOrOwnedData ? 0.5 : (confidenceScore < 0.8 ? 5.0 : 1.5);
  
  const copyrightRisk = isOriginalOrOwnedData ? 0.0 :
                        rights === 'PUBLIC_DOMAIN_OR_CONFIRMED_PERMITTED' ? 0.5 :
                        rights === 'OFFICIAL_MEDIA_WITH_REUSE_PERMISSION' ? 1.5 : 8.5; // UNKNOWN_RIGHTS or RESTRICTED = high copyright risk

  const lowerHeadline = headline.toLowerCase();
  const hasSensationalWords = lowerHeadline.includes('crash') || lowerHeadline.includes('moon') || lowerHeadline.includes('guaranteed') || lowerHeadline.includes('destroy');
  const misleadingContextRisk = hasSensationalWords ? 7.5 : (isAiGenerated ? 4.0 : 1.0);

  const accessibilityScore = 9.0; // High contrast branded templates + descriptive alt text
  const platformFitScore = 9.5;
  const expectedInformationGain = decisionType === 'ATTACH_ORIGINAL_CHART' || decisionType === 'ATTACH_NEWS_CARD' || decisionType === 'ATTACH_TIMELINE' ? 8.5 : 6.0;

  const scores: MediaScores = {
    visualValueScore,
    factualVisualRisk,
    copyrightRisk,
    misleadingContextRisk,
    accessibilityScore,
    platformFitScore,
    expectedInformationGain
  };

  // 2. Enforce Mandatory Safety Rules
  if (!isPermitted) {
    return {
      passed: false,
      scores,
      rejectionReason: `Copyright safety block: Rights classification "${rights}" is not permitted for re-upload.`
    };
  }

  if (copyrightRisk > 3.0) {
    return {
      passed: false,
      scores,
      rejectionReason: `Copyright risk (${copyrightRisk}/10) exceeds safety threshold of 3.0.`
    };
  }

  if (misleadingContextRisk > 5.0) {
    return {
      passed: false,
      scores,
      rejectionReason: `Misleading context risk (${misleadingContextRisk}/10) exceeds safety threshold of 5.0.`
    };
  }

  if (decisionType !== 'TEXT_ONLY' && decisionType !== 'USE_LINK_CARD_ONLY' && visualValueScore < 7.0) {
    return {
      passed: false,
      scores,
      rejectionReason: `Visual value score (${visualValueScore}/10) below required minimum threshold of 7.0/10.`
    };
  }

  return {
    passed: true,
    scores
  };
}
