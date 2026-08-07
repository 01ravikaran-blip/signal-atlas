import React from 'react';
import { MarketSnapshot, StoryCluster, MarketTicker } from '../types';
import { TrendingUp, Layers, ShieldCheck } from 'lucide-react';

interface StoryRadarProps {
  market: MarketSnapshot | null;
  stories: StoryCluster[];
}

export const StoryRadar: React.FC<StoryRadarProps> = ({ market, stories }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
      
      {/* 1. Live Market Radar Tickers */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} color="var(--primary-cyan)" /> Live Market Radar
        </h3>

        {market ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {market.crypto.slice(0, 4).map((t: MarketTicker) => (
              <div key={t.symbol} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.symbol}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0' }}>${t.priceUsd.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: t.change24h >= 0 ? '#34D399' : '#F87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                </div>
              </div>
            ))}

            {market.stocks.slice(0, 2).map((t: MarketTicker) => (
              <div key={t.symbol} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0' }}>{t.priceUsd.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: t.change24h >= 0 ? '#34D399' : '#F87171', fontWeight: 600 }}>
                  {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                </div>
              </div>
            ))}

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>GOLD / DXY</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0' }}>${market.macro.goldUsd}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DXY {market.macro.dxy}</div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fetching live market prices...</p>
        )}
      </div>

      {/* 2. Ingested & Verified Story Clusters */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="#7928CA" /> Verified Story Clusters & Credibility Scores
        </h3>

        {stories.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No story clusters ingested yet. Trigger autonomous cycle to fetch feeds.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stories.slice(0, 6).map(story => (
              <div
                key={story.id}
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`badge ${
                      story.category === 'CRYPTO_DEFI' ? 'badge-crypto' :
                      story.category === 'AI_WEB3' ? 'badge-ai' : 'badge-macro'
                    }`}>
                      {story.category}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Score: {story.overallScore}/10
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{story.title}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verified Sources</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} /> {story.verifiedClaims[0]?.sources.length || 1} Sources
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
