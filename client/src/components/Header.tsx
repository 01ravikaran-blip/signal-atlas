import React from 'react';
import { ShieldAlert, Play, Pause, RefreshCw, Radio, Zap } from 'lucide-react';

interface HeaderProps {
  emergencyPause: boolean;
  demoMode: boolean;
  onTogglePause: () => void;
  onTriggerCycle: () => void;
  isTriggering: boolean;
  lastRun: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  emergencyPause,
  demoMode,
  onTogglePause,
  onTriggerCycle,
  isTriggering,
  lastRun
}) => {
  return (
    <header className="glass-card style-header" style={{ padding: '16px 28px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00F2FE 0%, #7928CA 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
          }}>
            <Radio size={24} color="#FFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>SIGNAL ATLAS</h1>
              {demoMode && <span className="badge badge-ai">DEMO MODE</span>}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Neutral Evidence-First Global Crypto, AI & Macro Analyst
            </p>
          </div>
        </div>

        {/* Status Indicator & Emergency Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          
          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
            <span className={emergencyPause ? 'pulse-red' : 'pulse-green'}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: emergencyPause ? '#F87171' : '#34D399' }}>
              {emergencyPause ? 'SYSTEM PAUSED' : 'AUTONOMOUS ACTIVE'}
            </span>
          </div>

          {/* Emergency Pause Switch */}
          <div className="emergency-switch-container">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: emergencyPause ? '#F87171' : 'var(--text-muted)' }}>
              EMERGENCY PAUSE
            </span>
            <button
              className={`switch-btn ${emergencyPause ? 'paused' : ''}`}
              onClick={onTogglePause}
              title={emergencyPause ? 'Resume Autonomous Execution' : 'Emergency Pause System'}
            >
              <div className="switch-circle"></div>
            </button>
          </div>

          {/* Trigger Cycle Button */}
          <button
            onClick={onTriggerCycle}
            disabled={isTriggering || emergencyPause}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '30px',
              background: emergencyPause ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00F2FE 0%, #00C6FF 100%)',
              color: emergencyPause ? '#64748B' : '#07090E',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: emergencyPause || isTriggering ? 'not-allowed' : 'pointer',
              boxShadow: emergencyPause ? 'none' : '0 0 15px rgba(0, 242, 254, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={16} className={isTriggering ? 'spin-anim' : ''} style={{ animation: isTriggering ? 'spin 1s linear infinite' : 'none' }} />
            {isTriggering ? 'RUNNING CYCLE...' : 'TRIGGER CYCLE'}
          </button>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
