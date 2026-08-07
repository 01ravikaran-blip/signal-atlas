import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { LiveFeed } from './components/LiveFeed';
import { StoryRadar } from './components/StoryRadar';
import { BlockedVault } from './components/BlockedVault';
import { PlatformMatrix } from './components/PlatformMatrix';
import { MediaCenter } from './components/MediaCenter';
import { SystemStatus, PublicationResult, BlockedPost, MarketSnapshot, StoryCluster, MediaAsset, MediaAnalyticsRecord } from './types';

export default function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [publications, setPublications] = useState<PublicationResult[]>([]);
  const [blockedPosts, setBlockedPosts] = useState<BlockedPost[]>([]);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [stories, setStories] = useState<StoryCluster[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaAnalytics, setMediaAnalytics] = useState<MediaAnalyticsRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'FEED' | 'RADAR' | 'MEDIA' | 'BLOCKED'>('FEED');
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [resStatus, resPosts, resBlocked, resMarket, resStories, resMedia, resAnalytics] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/posts').then(r => r.json()),
        fetch('/api/blocked').then(r => r.json()),
        fetch('/api/market').then(r => r.json()),
        fetch('/api/stories').then(r => r.json()),
        fetch('/api/media').then(r => r.json()).catch(() => []),
        fetch('/api/media/analytics').then(r => r.json()).catch(() => [])
      ]);

      setStatus(resStatus);
      if (Array.isArray(resPosts)) setPublications(resPosts);
      if (Array.isArray(resBlocked)) setBlockedPosts(resBlocked);
      if (resMarket && resMarket.crypto) setMarket(resMarket);
      if (Array.isArray(resStories)) setStories(resStories);
      if (Array.isArray(resMedia)) setMediaAssets(resMedia);
      if (Array.isArray(resAnalytics)) setMediaAnalytics(resAnalytics);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePause = async () => {
    if (!status) return;
    const newPauseState = !status.emergencyPause;
    try {
      const res = await fetch('/api/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: newPauseState })
      });
      const data = await res.json();
      if (data.success) {
        setStatus((prev: SystemStatus | null) => prev ? { ...prev, emergencyPause: newPauseState } : null);
      }
    } catch (err) {
      console.error('Failed to toggle emergency pause', err);
    }
  };

  const handleTriggerCycle = async () => {
    setIsTriggering(true);
    try {
      await fetch('/api/trigger', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Failed to trigger autonomous cycle', err);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Header */}
      <Header
        emergencyPause={status?.emergencyPause || false}
        demoMode={status?.demoMode || true}
        onTogglePause={handleTogglePause}
        onTriggerCycle={handleTriggerCycle}
        isTriggering={isTriggering}
        lastRun={status?.lastRunTimestamp || null}
      />

      {/* System Overview Metric Cards */}
      <OverviewCards status={status} />

      {/* Platform Connection Status Matrix */}
      <PlatformMatrix status={status} />

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('FEED')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'FEED' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
            color: activeTab === 'FEED' ? 'var(--primary-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'FEED' ? '2px solid var(--primary-cyan)' : 'none'
          }}
        >
          🌐 Autonomous Live Feed ({publications.length})
        </button>

        <button
          onClick={() => setActiveTab('RADAR')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'RADAR' ? 'rgba(121, 40, 202, 0.15)' : 'transparent',
            color: activeTab === 'RADAR' ? '#C084FC' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'RADAR' ? '2px solid #7928CA' : 'none'
          }}
        >
          📈 Market Radar & Verified Stories
        </button>

        <button
          onClick={() => setActiveTab('MEDIA')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'MEDIA' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: activeTab === 'MEDIA' ? '#10B981' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'MEDIA' ? '2px solid #10B981' : 'none'
          }}
        >
          🖼️ Media Center ({mediaAssets.length})
        </button>

        <button
          onClick={() => setActiveTab('BLOCKED')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'BLOCKED' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            color: activeTab === 'BLOCKED' ? '#F87171' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'BLOCKED' ? '2px solid #EF4444' : 'none'
          }}
        >
          🛡️ Blocked Vault ({blockedPosts.length})
        </button>
      </div>

      {/* Tab Content Views */}
      {activeTab === 'FEED' && <LiveFeed publications={publications} />}
      {activeTab === 'RADAR' && <StoryRadar market={market} stories={stories} />}
      {activeTab === 'MEDIA' && <MediaCenter mediaAssets={mediaAssets} mediaAnalytics={mediaAnalytics} />}
      {activeTab === 'BLOCKED' && <BlockedVault blockedPosts={blockedPosts} />}

    </div>
  );
}
