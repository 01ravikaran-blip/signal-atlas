import React, { useState } from 'react';
import { PublicationResult, PlatformTarget } from '../types';
import { Globe, ExternalLink, CheckCircle, Smartphone, MessageSquare, Send as SendIcon } from 'lucide-react';

interface LiveFeedProps {
  publications: PublicationResult[];
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ publications }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');

  const filtered = selectedPlatform === 'ALL'
    ? publications
    : publications.filter(p => p.platform === selectedPlatform);

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Autonomous Live Feed</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time feed of published posts across Bluesky, Farcaster, Telegram, and Discord
          </p>
        </div>

        {/* Platform Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          {['ALL', 'BLUESKY', 'FARCASTER', 'TELEGRAM', 'DISCORD'].map(plat => (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: selectedPlatform === plat ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: selectedPlatform === plat ? 'var(--primary-cyan)' : 'var(--text-muted)',
                fontWeight: selectedPlatform === plat ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {plat}
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      {filtered.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Globe size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p style={{ fontSize: '0.9rem' }}>No published posts in this category yet.</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Click "TRIGGER CYCLE" above to start an immediate autonomous publish run.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map(pub => (
            <div
              key={pub.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                transition: 'border-color 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${
                    pub.platform === 'BLUESKY' ? 'badge-ai' :
                    pub.platform === 'FARCASTER' ? 'badge-crypto' :
                    pub.platform === 'TELEGRAM' ? 'badge-macro' : 'badge-success'
                  }`}>
                    {pub.platform}
                  </span>

                  <span style={{ fontSize: '0.7rem', color: pub.status === 'SUCCESS' ? '#34D399' : '#38BDF8', fontWeight: 600 }}>
                    {pub.status === 'SUCCESS' ? '● LIVE POSTED' : '● SIMULATED FEED'}
                  </span>
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(pub.publishedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Payload content */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '14px',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-main)',
                  borderLeft: '3px solid var(--primary-cyan)'
                }}
              >
                {pub.payload}
              </div>

              {/* Footer Links */}
              {pub.postUrl && (
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={pub.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--primary-cyan)',
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    View Post <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
