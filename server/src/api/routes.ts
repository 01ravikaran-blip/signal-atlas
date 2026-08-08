import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';
import { runAutonomousPublishingCycle } from '../scheduler/daemon.ts';
import { PlatformTarget } from '../types.js';
import { getPermissionStatusReport, engagementEngine, CAPABILITY_MATRIX } from '../services/engagementEngine.ts';
import { ownPostMonitor } from '../services/ownPostMonitor.ts';

export const router = Router();

// System status and emergency pause state
router.get('/status', (req: Request, res: Response) => {
  const settings = db.getSettings();
  const publications = db.getPublications(500);
  const blocked = db.getBlockedPosts(500);
  const stories = db.getStories(500);
  const categoryStats = db.getCategoryStats();
  const permissions = getPermissionStatusReport();
  const importantNewsState = db.getImportantNewsModeState();

  const heartbeat = db.getLatestWorkerHeartbeat();
  const workerOnline = heartbeat ? (Date.now() - new Date(heartbeat.lastHeartbeat).getTime()) < 15 * 60 * 1000 : false;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

  const status = {
    emergencyPause: settings.emergencyPause,
    publishingPause: settings.publishingPause,
    engagementPause: settings.engagementPause,
    autonomousReplies: settings.autonomousReplies,
    autonomousLikes: settings.autonomousLikes,
    autonomousReposts: settings.autonomousReposts,
    perPlatformToggles: settings.perPlatformToggles,
    demoMode: settings.demoMode,
    aiProvider: process.env.AI_PROVIDER || (isProduction ? 'cloud' : 'local'),
    publishIntervalMinutes: settings.publishIntervalMinutes,
    categoryDistribution: categoryStats,
    totalPublished: publications.length,
    totalBlocked: blocked.length,
    totalStories: stories.length,
    lastRunTimestamp: publications[0]?.publishedAt || blocked[0]?.timestamp || null,
    importantNewsMode: importantNewsState,
    permissions,
    workerStatus: {
      online: workerOnline,
      lastHeartbeat: heartbeat?.lastHeartbeat || undefined,
      lastIngestion: heartbeat?.lastSuccessfulIngestion || undefined,
      lastAiGeneration: heartbeat?.lastSuccessfulAiGeneration || undefined,
      lastPublication: heartbeat?.lastSuccessfulPublication || undefined,
      status: heartbeat?.status || 'OFFLINE'
    },
    databaseInfo: {
      urlPresent: Boolean(process.env.DATABASE_URL),
      type: process.env.DATABASE_URL ? 'postgres' : 'sqlite_json',
      persistent: Boolean(process.env.DATABASE_URL)
    }
  };

  res.json(status);
});

// Granular Pause & Settings Toggles
router.post('/settings/toggles', (req: Request, res: Response) => {
  const { emergencyPause, publishingPause, engagementPause, autonomousReplies, autonomousLikes, autonomousReposts, perPlatformToggles } = req.body;

  const update: any = {};
  if (typeof emergencyPause === 'boolean') {
    db.setEmergencyPause(emergencyPause);
    update.emergencyPause = emergencyPause;
  }
  if (typeof publishingPause === 'boolean') {
    db.setPublishingPause(publishingPause);
    update.publishingPause = publishingPause;
  }
  if (typeof engagementPause === 'boolean') {
    db.setEngagementPause(engagementPause);
    update.engagementPause = engagementPause;
  }
  if (typeof autonomousReplies === 'boolean') update.autonomousReplies = autonomousReplies;
  if (typeof autonomousLikes === 'boolean') update.autonomousLikes = autonomousLikes;
  if (typeof autonomousReposts === 'boolean') update.autonomousReposts = autonomousReposts;
  if (perPlatformToggles) update.perPlatformToggles = perPlatformToggles;

  const newSettings = db.updateSettings(update);
  res.json({ success: true, settings: newSettings });
});

// Emergency Pause Toggle (Legacy Endpoint compatibility)
router.post('/pause', (req: Request, res: Response) => {
  const { paused } = req.body;
  if (typeof paused !== 'boolean') {
    return res.status(400).json({ error: 'Field "paused" must be a boolean.' });
  }
  db.setEmergencyPause(paused);
  res.json({ success: true, emergencyPause: db.isEmergencyPaused() });
});

// Important-News Mode Status
router.get('/important-news/status', (req: Request, res: Response) => {
  const state = db.getImportantNewsModeState();
  const protectionSettings = db.getProtectionSettings();
  res.json({ state, protectionSettings });
});

// Permission Capabilities Status
router.get('/permissions/status', (req: Request, res: Response) => {
  const permissions = getPermissionStatusReport();
  res.json({ permissions, capabilityMatrix: CAPABILITY_MATRIX });
});

// Engagement Actions Feed & Budgets
router.get('/engagement/actions', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '100', 10);
  const actions = db.getEngagementActions(limit);
  const now = new Date().getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  const rolling24hActions = actions.filter(a => (now - new Date(a.timestamp).getTime()) <= twentyFourHoursMs);

  const counts = {
    total: actions.length,
    likes24h: rolling24hActions.filter(a => a.actionType === 'LIKE').length,
    reposts24h: rolling24hActions.filter(a => a.actionType === 'REPOST').length,
    replies24h: rolling24hActions.filter(a => a.actionType === 'REPLY').length
  };

  res.json({ counts, actions });
});

// Manual Like Trigger
router.post('/engagement/like', async (req: Request, res: Response) => {
  const { platform, targetPostId, targetAccountId, targetUrl, content, sourceCredibility } = req.body;
  const result = await engagementEngine.executeLikeAction(
    platform || 'BLUESKY',
    targetPostId || 'post_' + Date.now(),
    targetAccountId || 'acc_123',
    targetUrl || 'https://bsky.app/post/123',
    content || 'Market liquidity update on Solana DeFi',
    sourceCredibility || 0.9
  );
  res.json(result);
});

// Manual Repost Trigger
router.post('/engagement/repost', async (req: Request, res: Response) => {
  const { platform, targetPostId, targetAccountId, targetUrl, content, isOfficialSource } = req.body;
  const result = await engagementEngine.executeRepostAction(
    platform || 'BLUESKY',
    targetPostId || 'post_' + Date.now(),
    targetAccountId || 'acc_sec',
    targetUrl || 'https://bsky.app/post/456',
    content || 'SEC official market filing release',
    isOfficialSource !== false
  );
  res.json(result);
});

// Own-Post Comments Monitor Feed
router.get('/comments/monitor', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '100', 10);
  res.json(db.getOwnPostComments(limit));
});

// Process Comment Trigger
router.post('/comments/process', async (req: Request, res: Response) => {
  const { platform, originalPostId, commenterId, commenterHandle, commentText } = req.body;
  const result = await ownPostMonitor.processComment(
    platform || 'BLUESKY',
    originalPostId || 'post_100',
    commenterId || 'user_55',
    commenterHandle || '@trader_bob',
    commentText || 'Can you clarify the source of this liquidity data?'
  );
  res.json(result);
});

// Publications Feed
router.get('/posts', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '50', 10);
  res.json(db.getPublications(limit));
});

// Blocked Posts Audit Log
router.get('/blocked', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '50', 10);
  res.json(db.getBlockedPosts(limit));
});

// Market Radar Snapshot
router.get('/market', (req: Request, res: Response) => {
  res.json(db.getLatestMarketSnapshot() || { message: 'No market snapshot available yet' });
});

// Story Clusters
router.get('/stories', (req: Request, res: Response) => {
  res.json(db.getStories(50));
});

// System Logs
router.get('/logs', (req: Request, res: Response) => {
  res.json(db.getLogs(100));
});

// Manual Autonomous Cycle Trigger
router.post('/trigger', async (req: Request, res: Response) => {
  db.addLog('INFO', 'API', 'Manual autonomous cycle triggered via dashboard UI.');
  const result = await runAutonomousPublishingCycle(true);
  res.json(result);
});

// Media Assets Library
router.get('/media', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '50', 10);
  res.json(db.getMediaAssets(limit));
});

// Media Analytics & Performance Reports
router.get('/media/analytics', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '100', 10);
  res.json(db.getMediaAnalytics(limit));
});

// Settings Update
router.post('/settings', (req: Request, res: Response) => {
  const { minConfidenceThreshold, publishIntervalMinutes } = req.body;
  const updated = db.updateSettings({
    minConfidenceThreshold: typeof minConfidenceThreshold === 'number' ? minConfidenceThreshold : undefined,
    publishIntervalMinutes: typeof publishIntervalMinutes === 'number' ? publishIntervalMinutes : undefined
  });
  res.json({ success: true, settings: updated });
});

