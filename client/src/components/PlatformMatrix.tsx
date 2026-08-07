import React from 'react';
import { SystemStatus, PlatformTarget } from '../types';
import { Radio, Bot, MessageSquare, Send, CheckCircle2, AlertCircle, Key } from 'lucide-react';

interface PlatformMatrixProps {
  status: SystemStatus | null;
}

export const PlatformMatrix: React.FC<PlatformMatrixProps> = ({ status }) => {
  if (!status) return null;

  const platforms: { name: string; key: PlatformTarget; icon: any; color: string; desc: string }[] = [
    {
      name: 'Bluesky',
      key: 'BLUESKY',
      icon: Radio,
      color: '#38BDF8',
      desc: 'AT Protocol post/thread distribution (<300 chars)'
    },
    {
      name: 'Farcaster',
      key: 'FARCASTER',
      icon: Bot,
      color: '#C084FC',
      desc: 'Decentralized cast distribution (<320 bytes)'
    },
    {
      name: 'Telegram',
      key: 'TELEGRAM',
      icon: Send,
      color: '#FBBF24',
      desc: 'Bot API HTML formatted channel updates'
    },
    {
      name: 'Discord',
      key: 'DISCORD',
      icon: MessageSquare,
      color: '#34D399',
      desc: 'Channel Webhook rich embed updates'
    }
  ];

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Key size={20} color="var(--primary-cyan)" /> Platform Credentials & Network Matrix
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Live publishing channels operate autonomously when credentials are set in .env or run in simulated DEMO_MODE.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {platforms.map(p => {
          const info = status.platformStatus[p.key];
          const isLive = info?.configured;
          const Icon = p.icon;

          return (
            <div
              key={p.key}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={18} color={p.color} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</span>
                </div>

                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 242, 254, 0.15)',
                  color: isLive ? '#34D399' : '#38BDF8'
                }}>
                  {isLive ? 'LIVE' : 'SIMULATED'}
                </span>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
