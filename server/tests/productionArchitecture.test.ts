import { llmProvider } from '../src/ai/llmProvider.ts';
import { validateDatabaseConnection } from '../src/db/dbAdapter.ts';
import { persistentScheduler } from '../src/scheduler/persistentScheduler.ts';
import { db } from '../src/db/database.ts';
import { runProductionSmokeTest } from '../src/scripts/smokeTest.ts';

export async function runProductionArchitectureTests() {
  console.log('=================================================');
  console.log('🧪 RUNNING PRODUCTION ARCHITECTURE TEST SUITE');
  console.log('=================================================');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  // Test 1: DB Connectivity & Adapter
  const dbStatus = await validateDatabaseConnection();
  assert(dbStatus.connected === true, 'Database adapter connects successfully');

  // Test 2: AI Provider Selection & Ollama Rejection in Production
  const currentEnv = process.env.NODE_ENV;
  const currentLlmProvider = process.env.LLM_PROVIDER;
  process.env.NODE_ENV = 'production';
  process.env.IS_PROD_TEST = 'true';
  process.env.AI_PROVIDER = 'ollama';
  process.env.LLM_PROVIDER = 'ollama';
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

  const aiStatus = await llmProvider.checkReachability();
  assert(aiStatus.reachability === 'unreachable', 'Production mode rejects localhost Ollama');

  let rejectionCaught = false;
  try {
    await llmProvider.generateText('test prompt');
  } catch (err: any) {
    console.log('DEBUG: Caught exception in Test 2:', err.message);
    rejectionCaught = err.message.includes('Production rejected localhost Ollama URL');
  }
  assert(rejectionCaught === true, 'Rejection error message correctly formatted on generateText call');

  // Reset Env
  process.env.NODE_ENV = currentEnv;
  delete process.env.IS_PROD_TEST;
  process.env.AI_PROVIDER = 'groq';
  process.env.LLM_PROVIDER = 'groq';

  // Test 3: Persistent Scheduler Locking & Idempotency
  const idempotencyKey = `test_key_${Date.now()}`;
  const job1 = persistentScheduler.createJob('AUTONOMOUS_PUBLISH', idempotencyKey);
  const lock1 = persistentScheduler.acquireLock(job1.jobId, 'worker_unit_test_1');
  assert(lock1.acquired === true, 'Worker 1 acquires lock on pending job');

  const lock2 = persistentScheduler.acquireLock(job1.jobId, 'worker_unit_test_2');
  assert(lock2.acquired === false, 'Worker 2 is blocked from acquiring active lock on same job');

  persistentScheduler.releaseLockSuccess(job1.jobId);
  const completedJob = db.getSchedulerJob(job1.jobId);
  assert(completedJob?.status === 'COMPLETED', 'Job releases lock and saves COMPLETED status');

  // Test 4: Worker Heartbeat Persistence
  const testHeartbeat = {
    id: 'hb_test',
    workerId: 'worker_test_1',
    status: 'ONLINE' as const,
    lastHeartbeat: new Date().toISOString(),
    pendingJobsCount: 0,
    failedJobsCount: 0,
    mode: 'cloud' as const
  };
  db.updateWorkerHeartbeat(testHeartbeat);
  const savedHeartbeat = db.getLatestWorkerHeartbeat();
  assert(savedHeartbeat?.workerId === 'worker_test_1', 'Worker heartbeat persists to database');

  // Test 5: Smoke Test Diagnostic Evaluation
  const smokeResults = await runProductionSmokeTest();
  assert(smokeResults.length >= 12, 'Smoke test evaluates required system components');

  console.log(`=================================================`);
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`=================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionArchitectureTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
