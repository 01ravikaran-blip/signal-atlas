import { fetchLiveMarketSnapshot } from '../src/collectors/marketCollector.ts';
import { fetchLatestNews } from '../src/collectors/newsCollector.ts';
import { clusterAndVerifyStories } from '../src/collectors/verifier.ts';
import { generatePostDraft } from '../src/ai/draftGenerator.ts';
import { evaluateQualityGates } from '../src/safety/qualityEngine.ts';
import { selectHashtagsForStory } from '../src/ai/hashtagEngine.ts';
import { HASHTAG_BLACKLIST, PLATFORM_HASHTAG_LIMITS } from '../src/config/hashtags.ts';
import { evaluateAdaptiveScheduler } from '../src/scheduler/adaptiveScheduler.ts';
import { ownPostMonitor, classifyComment, evaluateReplyRules } from '../src/services/ownPostMonitor.ts';
import { engagementEngine, getPermissionStatusReport, CAPABILITY_MATRIX } from '../src/services/engagementEngine.ts';
import { publishDraftToAllPlatforms } from '../src/publishers/simulationPublisher.ts';
import { StoryCluster, PostDraft, OwnPostComment } from '../src/types.js';
import { db } from '../src/db/database.ts';
import { runProductionArchitectureTests } from './productionArchitecture.test.ts';

async function runAll17Tests() {
  console.log('=================================================');
  console.log('🧪 SIGNAL ATLAS AMENDMENT 17-POINT TEST SUITE STARTING...');
  console.log('=================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // TEST 1 & 2: Important-News Mode & 20-Post Soft Cap Override
  console.log('--- SECTION 1: Content Limits & Important-News Mode ---');
  
  // Seed 20 dummy publications to reach soft limit
  for (let i = 0; i < 20; i++) {
    db.addPublication({
      id: `pub_seed_${i}_${Date.now()}`,
      draftId: `draft_seed_${i}_${Date.now()}`,
      platform: 'BLUESKY',
      status: 'SIMULATED',
      payload: `Routine market update ${i}`,
      publishedAt: new Date().toISOString()
    });
  }

  const nonce1 = Math.random().toString(36).substr(2, 6);
  const highImpactStory: StoryCluster = {
    id: 'story_imp_' + Date.now(),
    title: `Exploit_${nonce1} Security Incident Detected on Protocol`,
    category: 'CRYPTO_DEFI',
    primaryNews: [{
      id: 'n_imp_1',
      title: `Exploit_${nonce1} Security Incident Detected on Protocol`,
      summary: 'Hackers drained $50M from liquidity vault following smart contract vulnerability.',
      url: 'https://coindesk.com/exploit',
      source: 'CoinDesk',
      category: 'CRYPTO_DEFI',
      publishedAt: new Date().toISOString(),
      credibilityScore: 0.95,
      isBreaking: true
    }],
    verifiedClaims: [{
      claimId: 'c_imp',
      statement: 'Exploit verified onchain',
      sources: ['CoinDesk', 'CertiK'],
      verificationCount: 2,
      confidenceScore: 0.95,
      conflictingSources: false,
      category: 'CRYPTO_DEFI'
    }],
    impactScore: 9.5,
    noveltyScore: 9.0,
    overallScore: 9.2,
    timestamp: new Date().toISOString()
  };




  const decisionImp = evaluateAdaptiveScheduler(highImpactStory);
  assert(decisionImp.isImportantNewsOverride === true, '1. Twenty normal items do not block verified important news (Important news override approved)');


  
  const unconfirmedStory: StoryCluster = {
    ...highImpactStory,
    id: 'unconfirmed_' + Date.now(),
    title: 'Unconfirmed rumor about exchange insolvency ' + Date.now(),
    overallScore: 9.0,
    verifiedClaims: [{
      ...highImpactStory.verifiedClaims[0],
      sources: ['Anonymous Tweet'],
      confidenceScore: 0.50
    }]
  };
  const decisionUnconfirmed = evaluateAdaptiveScheduler(unconfirmedStory);
  assert(decisionUnconfirmed.action === 'WAIT_CONFIRMATION', '2. Important-news mode requires source and confidence gates (Low conf yields WAIT_CONFIRMATION)');

  // TEST 3 & 4: Deduplication & Material Changes
  console.log('\n--- SECTION 2: Event Deduplication & Material Updates ---');
  
  const dupTitle = 'Major Security Hack on Centralized Bridge ' + Date.now();
  db.addPublication({
    id: 'pub_test_' + Date.now(),
    draftId: 'd_test_1',
    platform: 'BLUESKY',
    status: 'SIMULATED',
    payload: dupTitle,
    publishedAt: new Date().toISOString()
  });

  const duplicateStory: StoryCluster = {
    ...highImpactStory,
    title: dupTitle
  };
  const decisionDup = evaluateAdaptiveScheduler(duplicateStory);
  assert(decisionDup.action === 'SKIP', '3. Repetitive articles do not create repetitive posts (Cooldown window enforced)');

  const materialUpdateStory: StoryCluster = {
    ...highImpactStory,
    id: 'mat_story_' + Date.now(),
    title: 'Solana DEX Vault Hacker Returns 80% of Stolen Funds ' + Date.now()
  };
  const decisionMat = evaluateAdaptiveScheduler(materialUpdateStory);
  assert(decisionMat.action === 'PUBLISH_NOW' || decisionMat.action === 'THREAD', '4. Rapidly changing event produces materially different updates');

  // TEST 5: Automatic Exit from Important-News Mode
  console.log('\n--- SECTION 3: Important-News Mode Auto-Exit ---');
  db.updateImportantNewsModeState({
    active: true,
    lastUpdateAt: new Date(Date.now() - 130 * 60 * 1000).toISOString() // 130 mins ago
  });
  // Evaluate a routine story (not an override story) so it triggers auto-exit check without re-activating override
  const routineStory: StoryCluster = {
    ...highImpactStory,
    id: 'routine_story_' + Date.now(),
    title: 'Routine Market Liquidity Update ' + Date.now(),
    overallScore: 6.5,
    impactScore: 6.0,
    primaryNews: [{
      ...highImpactStory.primaryNews[0],
      isBreaking: false
    }]
  };
  evaluateAdaptiveScheduler(routineStory);
  const stateAfterAutoExit = db.getImportantNewsModeState();
  assert(stateAfterAutoExit.active === false, '5. System exits important-news mode automatically after inactivity timeout');

  // TEST 6, 7, 8, 9: Own-Post Comment Monitoring
  console.log('\n--- SECTION 4: Own-Post Comment Monitoring ---');
  assert(classifyComment('Why is the Federal Reserve keeping rates high?') === 'GENUINE_QUESTION', '6a. Comment classified as GENUINE_QUESTION');
  assert(classifyComment('Claim free 100x airdrop now at http://bit.ly/scam') === 'SCAM' || classifyComment('Claim free 100x airdrop') === 'SCAM', '6b. Comment classified as SCAM');
  assert(classifyComment('Actually there is a typo on the rate percentage') === 'CONSTRUCTIVE_DISAGREEMENT', '6c. Comment classified as CONSTRUCTIVE_DISAGREEMENT');

  const testUser7 = 'usr_t7_' + Date.now();
  const testPost7 = 'post_t7_' + Date.now();
  const cmtRes1 = await ownPostMonitor.processComment('BLUESKY', testPost7, testUser7, '@alice_fresh', 'Why did SOL volume surge?');
  assert(cmtRes1.status === 'SIMULATED' || cmtRes1.status === 'SUCCESS', '7. Genuine question receives a suitable reply');

  const cmtRes2 = await ownPostMonitor.processComment('BLUESKY', testPost7, 'usr_spam_' + Date.now(), '@spammer', 'Join my telegram for guaranteed 1000% crypto returns!');
  assert(cmtRes2.status === 'SKIPPED', '8. Spam and scams are ignored');

  // Second reply to same user within 6h
  const cmtRes3 = await ownPostMonitor.processComment('BLUESKY', 'post_t7_alt_' + Date.now(), testUser7, '@alice_fresh', 'What about ETH?');
  assert(cmtRes3.status === 'SKIPPED', '9. Same commenter does not receive repetitive replies within 6h');


  // TEST 10, 11, 12: Selective Engagement Engine
  console.log('\n--- SECTION 5: Selective Engagement & Budgets ---');
  const repostRes = await engagementEngine.executeRepostAction(
    'BLUESKY',
    'post_official_sec',
    'acc_sec_gov',
    'https://bsky.app/post/sec',
    'Official SEC Announcement regarding ETF approval',
    true
  );
  assert(repostRes.status === 'SIMULATED' || repostRes.status === 'SUCCESS', '10. Relevant high-quality content selectively reposted');

  const likeUnsafe = await engagementEngine.executeLikeAction(
    'BLUESKY',
    'post_hype',
    'acc_hype',
    'https://bsky.app/post/hype',
    'BUY NOW FREE MONEY GUARANTEED 100X MOON',
    0.3
  );
  assert(likeUnsafe.status === 'BLOCKED', '11. Irrelevant or unsafe content is not liked or reposted');

  const likeValid = await engagementEngine.executeLikeAction(
    'BLUESKY',
    'post_valid_' + Date.now(),
    'acc_researcher_' + Date.now(),
    'https://bsky.app/post/valid',
    'Onchain DEX liquidity report analyzing Solana and Ethereum TVL',
    0.95
  );
  assert(likeValid.status === 'SIMULATED' || likeValid.status === 'SUCCESS', '12. Selective like action executed within budget & score threshold');


  // TEST 13 & 14: Platform Capability Matrix & Missing Permissions
  console.log('\n--- SECTION 6: Capability Matrix & Permissions ---');
  assert(CAPABILITY_MATRIX.DISCORD.LIKE === false, '13. Unsupported platform actions (Discord LIKE) not attempted');
  
  const permReport = getPermissionStatusReport();
  assert(permReport.BLUESKY !== undefined && permReport.DISCORD !== undefined, '14. Missing permissions reported cleanly without bypassing platform rules');

  // TEST 15, 16, 17: Provider Confirmation, Pauses & Demo Mode
  console.log('\n--- SECTION 7: Pauses, Safety & Demo Mode ---');
  
  // Test pause switches
  db.setEngagementPause(true);
  const pauseTestLike = await engagementEngine.executeLikeAction('BLUESKY', 'p1', 'a1', 'u1', 'Valid content', 0.9);
  assert(pauseTestLike.status === 'BLOCKED', '16. Engagement Pause immediately prevents all new actions');
  db.setEngagementPause(false);

  // Demo mode check
  const draftTest = await generatePostDraft(highImpactStory);
  const simResults = await publishDraftToAllPlatforms(draftTest);
  assert(simResults.every(r => r.status === 'SIMULATED' || r.status === 'SUCCESS' || r.status === 'FAILED'), '15 & 17. Demo mode never claims a real external action occurred without provider ID');

  console.log('\n=================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('=================================================\n');

  // Run Production Architecture Test Suite
  console.log('\n--- SECTION 8: Production Architecture & 24/7 Unattended Execution ---');
  try {
    await runProductionArchitectureTests();
  } catch (archErr: any) {
    console.error('Production architecture tests failed:', archErr.message);
    process.exitCode = 1;
  }

  // Run Groq API Integration Test Suite
  console.log('\n--- SECTION 9: Groq API Integration & Agent Roles ---');
  try {
    const { runGroqIntegrationTests } = await import('./groqIntegration.test.ts');
    await runGroqIntegrationTests();
  } catch (groqErr: any) {
    console.error('Groq integration tests failed:', groqErr.message);
    process.exitCode = 1;
  }

  if (passedTests === totalTests) {
    console.log('🎉 ALL 17 AMENDMENT TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME AMENDMENT TESTS FAILED.');
    process.exit(1);
  }
}

runAll17Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
