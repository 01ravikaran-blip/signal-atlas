import { llmProvider, GROQ_MODELS } from '../src/ai/llmProvider.ts';
import { generatePostDraft } from '../src/ai/draftGenerator.ts';
import { critiqueAndImproveDraft } from '../src/ai/critiqueAgent.ts';
import { evaluateSafetyPolicy } from '../src/safety/safetyEngine.ts';
import { StoryCluster, AgentRole } from '../src/types.js';

export async function runGroqIntegrationTests() {
  console.log('=================================================');
  console.log('🧪 RUNNING GROQ API INTEGRATION TEST SUITE');
  console.log('=================================================');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // 1. Environment & Provider Configuration Test
  const provider = llmProvider.resolveProviderType();
  const validation = llmProvider.validateEnvironmentConfig();
  assert(provider === 'groq', `1. Provider correctly resolves to 'groq' (Current: ${provider})`);
  assert(validation.valid === true, `2. Groq environment validation succeeds: ${validation.message}`);

  // 2. Groq Reachability & Model Probing Test
  const statusReport = await llmProvider.checkReachability();
  assert(statusReport.reachability === 'reachable', `3. Groq API authentication & reachability probe successful`);
  assert(statusReport.model === GROQ_MODELS.PRIMARY, `4. Active primary model is ${GROQ_MODELS.PRIMARY}`);

  // 3. Multi-tier Model Availability & Fallback Configuration
  assert(statusReport.modelsAvailable?.primary === GROQ_MODELS.PRIMARY, '5a. Primary model configured: llama-3.3-70b-versatile');
  assert(statusReport.modelsAvailable?.fallback === GROQ_MODELS.FALLBACK, '5b. Fallback model configured: mixtral-8x7b-32768');
  assert(statusReport.modelsAvailable?.speedFallback === GROQ_MODELS.SPEED_FALLBACK, '5c. Speed fallback model configured: gemma2-9b-it');

  // 4. Structured JSON Generation & Repair Test
  try {
    const jsonTest = await llmProvider.generateJSON<{ title: string; score: number }>(
      'Return a JSON object with keys "title" (string) and "score" (number: 95).',
      'You are a structured data formatting assistant.'
    );
    assert(typeof jsonTest.title === 'string' && jsonTest.score === 95, '6. Structured JSON generation & repair executes cleanly');
  } catch (err: any) {
    assert(false, `6. Structured JSON generation failed: ${err.message}`);
  }

  // 5. Test Execution across all 11 Agent Roles
  const roles: AgentRole[] = [
    'news_collector',
    'market_analyst',
    'source_verifier',
    'trend_scorer',
    'post_writer',
    'thread_writer',
    'critic_editor',
    'safety_checker',
    'platform_formatter',
    'publication_manager',
    'analytics_summarizer'
  ];

  for (const role of roles) {
    try {
      const output = await llmProvider.generateText(
        `Test query for agent role ${role}`,
        undefined,
        { agentRole: role, maxTokens: 50 }
      );
      assert(output.length > 0, `7. Agent role '${role}' executes successfully`);
    } catch (err: any) {
      assert(false, `7. Agent role '${role}' failed: ${err.message}`);
    }
  }

  // 6. Content Pipeline & Quality Score Consistency Test
  const mockStory: StoryCluster = {
    id: 'groq_test_story_' + Date.now(),
    title: 'Ethereum Layer 2 Protocol Staking Volume Surges 40% Following Upgrade',
    category: 'CRYPTO_DEFI',
    primaryNews: [{
      id: 'n_groq_1',
      title: 'Ethereum Layer 2 Protocol Staking Volume Surges 40% Following Upgrade',
      summary: 'Verified on-chain analytics show TVL reaching new high of $28 Billion across Arbitrum and Optimism.',
      url: 'https://coindesk.com/eth-l2-surge',
      source: 'CoinDesk',
      category: 'CRYPTO_DEFI',
      publishedAt: new Date().toISOString(),
      credibilityScore: 0.92
    }],
    verifiedClaims: [{
      claimId: 'claim_groq_1',
      statement: 'L2 TVL increased to $28B',
      sources: ['CoinDesk', 'DefiLlama'],
      verificationCount: 2,
      confidenceScore: 0.92,
      conflictingSources: false,
      category: 'CRYPTO_DEFI'
    }],
    impactScore: 8.5,
    noveltyScore: 8.0,
    overallScore: 8.4,
    timestamp: new Date().toISOString()
  };

  const draft = await generatePostDraft(mockStory);
  assert(draft.structuredContent.facts.length > 0, '8a. Draft generation creates structured facts');
  assert(Boolean(draft.platformPayloads.BLUESKY), '8b. Draft generates Bluesky payload');

  const critiquedDraft = await critiqueAndImproveDraft(draft);
  assert(critiquedDraft.revisionCount > 0, '9. Critic/Editor agent evaluates and improves draft');

  const safetyCheck = evaluateSafetyPolicy(mockStory, critiquedDraft);
  assert(safetyCheck.passed === true, '10. Safety check passes with high factual confidence score');

  // 7. Cost & Token Usage Statistics Tracking Test
  const stats = llmProvider.getTokenStats();
  assert(stats.totalTokens > 0, `11a. Token usage tracked (Total: ${stats.totalTokens})`);
  assert(stats.dailyRequestCount > 0, `11b. Daily request count tracked (${stats.dailyRequestCount} requests)`);
  assert(stats.estimatedDailyCostUsd >= 0, `11c. Daily cost estimated ($${stats.estimatedDailyCostUsd.toFixed(4)})`);

  console.log('=================================================');
  console.log(`📊 GROQ TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('=================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}
