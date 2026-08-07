import fs from 'fs';
import path from 'path';
import {
  StoryCluster,
  PostDraft,
  PublicationResult,
  BlockedPost,
  MarketSnapshot,
  SystemLog,
  ContentCategory,
  EngagementAction,
  OwnPostComment,
  ProtectionSettings,
  ImportantNewsModeState,
  PlatformTarget
} from '../types.js';

interface DatabaseSchema {
  settings: {
    emergencyPause: boolean;
    publishingPause: boolean;
    engagementPause: boolean;
    autonomousReplies: boolean;
    autonomousLikes: boolean;
    autonomousReposts: boolean;
    perPlatformToggles: Record<PlatformTarget, { enabled: boolean; replies: boolean; likes: boolean; reposts: boolean }>;
    demoMode: boolean;
    publishIntervalMinutes: number;
    minConfidenceThreshold: number;
  };
  importantNewsModeState: ImportantNewsModeState;
  protectionSettings: ProtectionSettings;
  stories: StoryCluster[];
  drafts: PostDraft[];
  publications: PublicationResult[];
  blockedPosts: BlockedPost[];
  engagementActions: EngagementAction[];
  ownPostComments: OwnPostComment[];
  marketSnapshots: MarketSnapshot[];
  logs: SystemLog[];
  publishedHashes: string[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
      settings: {
        emergencyPause: process.env.EMERGENCY_PAUSE === 'true',
        publishingPause: false,
        engagementPause: false,
        autonomousReplies: true,
        autonomousLikes: true,
        autonomousReposts: true,
        perPlatformToggles: {
          BLUESKY: { enabled: true, replies: true, likes: true, reposts: true },
          FARCASTER: { enabled: true, replies: true, likes: true, reposts: true },
          TELEGRAM: { enabled: true, replies: true, likes: false, reposts: false },
          DISCORD: { enabled: true, replies: true, likes: false, reposts: false }
        },
        demoMode: process.env.DEMO_MODE !== 'false',
        publishIntervalMinutes: parseInt(process.env.PUBLISH_INTERVAL_MINUTES || '5', 10),
        minConfidenceThreshold: parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || '0.70')
      },
      importantNewsModeState: {
        active: false,
        sourceEvidence: [],
        updateCount: 0
      },
      protectionSettings: {
        minMinutesBetweenEventUpdates: 30,
        maxUpdatesPerEvent: 4,
        maxPlatformApiCallsPerHour: 100,
        maxAutonomousActionsPerHour: 50,
        emergencyModeTimeoutMinutes: 120,
        autoReturnToNormalMode: true
      },
      stories: [],
      drafts: [],
      publications: [],
      blockedPosts: [],
      engagementActions: [],
      ownPostComments: [],
      marketSnapshots: [],
      logs: [],
      publishedHashes: []
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = { 
          ...this.data, 
          ...parsed,
          settings: { ...this.data.settings, ...(parsed.settings || {}) },
          importantNewsModeState: { ...this.data.importantNewsModeState, ...(parsed.importantNewsModeState || {}) },
          protectionSettings: { ...this.data.protectionSettings, ...(parsed.protectionSettings || {}) }
        };
      } catch (err) {
        console.error('[DB] Failed to parse db.json, starting fresh', err);
      }
    } else {
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to write db.json', err);
    }
  }

  // Settings
  public getSettings() {
    return this.data.settings;
  }

  public updateSettings(partial: Partial<DatabaseSchema['settings']>) {
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
    return this.data.settings;
  }

  public isEmergencyPaused(): boolean {
    return this.data.settings.emergencyPause;
  }

  public isPublishingPaused(): boolean {
    return this.data.settings.emergencyPause || this.data.settings.publishingPause;
  }

  public isEngagementPaused(): boolean {
    return this.data.settings.emergencyPause || this.data.settings.engagementPause;
  }

  public setEmergencyPause(paused: boolean) {
    this.data.settings.emergencyPause = paused;
    this.save();
    this.addLog('WARN', 'SYSTEM', `Global Emergency Pause set to ${paused}`);
  }

  public setPublishingPause(paused: boolean) {
    this.data.settings.publishingPause = paused;
    this.save();
    this.addLog('WARN', 'SYSTEM', `Publishing Pause set to ${paused}`);
  }

  public setEngagementPause(paused: boolean) {
    this.data.settings.engagementPause = paused;
    this.save();
    this.addLog('WARN', 'SYSTEM', `Engagement Pause set to ${paused}`);
  }

  // Important News Mode State
  public getImportantNewsModeState(): ImportantNewsModeState {
    return this.data.importantNewsModeState;
  }

  public updateImportantNewsModeState(state: Partial<ImportantNewsModeState>) {
    this.data.importantNewsModeState = { ...this.data.importantNewsModeState, ...state };
    this.save();
    return this.data.importantNewsModeState;
  }

  // Protection Settings
  public getProtectionSettings(): ProtectionSettings {
    return this.data.protectionSettings;
  }

  public updateProtectionSettings(settings: Partial<ProtectionSettings>) {
    this.data.protectionSettings = { ...this.data.protectionSettings, ...settings };
    this.save();
    return this.data.protectionSettings;
  }

  // Engagement Actions
  public addEngagementAction(action: EngagementAction) {
    this.data.engagementActions.unshift(action);
    if (this.data.engagementActions.length > 500) this.data.engagementActions.pop();
    this.save();
    this.addLog('INFO', 'ENGAGEMENT', `Recorded action [${action.actionType}] on ${action.platform}: status=${action.status}, reason="${action.selectedReason}"`);
  }

  public getEngagementActions(limit = 100): EngagementAction[] {
    return this.data.engagementActions.slice(0, limit);
  }

  // Own Post Comments
  public addOwnPostComment(comment: OwnPostComment) {
    this.data.ownPostComments.unshift(comment);
    if (this.data.ownPostComments.length > 500) this.data.ownPostComments.pop();
    this.save();
  }

  public getOwnPostComments(limit = 100): OwnPostComment[] {
    return this.data.ownPostComments.slice(0, limit);
  }

  public updateOwnPostComment(id: string, partial: Partial<OwnPostComment>) {
    const comment = this.data.ownPostComments.find(c => c.id === id);
    if (comment) {
      Object.assign(comment, partial);
      this.save();
    }
  }

  // Stories
  public addStory(story: StoryCluster) {
    this.data.stories.unshift(story);
    if (this.data.stories.length > 200) this.data.stories.pop();
    this.save();
  }

  public getStories(limit = 50): StoryCluster[] {
    return this.data.stories.slice(0, limit);
  }

  // Drafts
  public addDraft(draft: PostDraft) {
    this.data.drafts.unshift(draft);
    if (this.data.drafts.length > 200) this.data.drafts.pop();
    this.save();
  }

  public getDrafts(limit = 50): PostDraft[] {
    return this.data.drafts.slice(0, limit);
  }

  // Blocked Posts
  public addBlockedPost(blocked: BlockedPost) {
    this.data.blockedPosts.unshift(blocked);
    if (this.data.blockedPosts.length > 200) this.data.blockedPosts.pop();
    this.save();
    this.addLog('WARN', 'SAFETY', `Blocked post: ${blocked.blockCode} - ${blocked.blockReason}`);
  }

  public getBlockedPosts(limit = 50): BlockedPost[] {
    return this.data.blockedPosts.slice(0, limit);
  }

  // Publications
  public addPublication(pub: PublicationResult) {
    this.data.publications.unshift(pub);
    if (this.data.publications.length > 300) this.data.publications.pop();
    this.save();
  }

  public getPublications(limit = 50): PublicationResult[] {
    return this.data.publications.slice(0, limit);
  }

  // Market Snapshots
  public addMarketSnapshot(snapshot: MarketSnapshot) {
    this.data.marketSnapshots.unshift(snapshot);
    if (this.data.marketSnapshots.length > 50) this.data.marketSnapshots.pop();
    this.save();
  }

  public getLatestMarketSnapshot(): MarketSnapshot | null {
    return this.data.marketSnapshots[0] || null;
  }

  // Deduplication Hashes
  public addPublishedHash(hash: string) {
    this.data.publishedHashes.push(hash);
    if (this.data.publishedHashes.length > 500) this.data.publishedHashes.shift();
    this.save();
  }

  public hasPublishedHash(hash: string): boolean {
    return this.data.publishedHashes.includes(hash);
  }

  // System Logs
  public addLog(level: SystemLog['level'], module: string, message: string, data?: any) {
    const log: SystemLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data
    };
    this.data.logs.unshift(log);
    if (this.data.logs.length > 500) this.data.logs.pop();
    this.save();
    console.log(`[${log.timestamp}] [${level}] [${module}] ${message}`);
  }

  public getLogs(limit = 100): SystemLog[] {
    return this.data.logs.slice(0, limit);
  }

  // Category statistics calculation
  public getCategoryStats(): Record<ContentCategory, number> {
    const counts: Record<ContentCategory, number> = {
      CRYPTO_DEFI: 0,
      AI_WEB3: 0,
      STOCKS_MACRO: 0
    };
    for (const pub of this.data.publications) {
      const draft = this.data.drafts.find(d => d.id === pub.draftId);
      if (draft && counts[draft.category] !== undefined) {
        counts[draft.category]++;
      }
    }
    return counts;
  }
}

export const db = new Database();

