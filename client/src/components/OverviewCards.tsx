import React from 'react';
import { Send, ShieldX, PieChart, CheckCircle2 } from 'lucide-react';
import { SystemStatus } from '../types';

interface OverviewCardsProps {
  status: SystemStatus | null;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ status }) => {
  if (!status) return null;

  const totalPubs = status.totalPublished || 0;
  const totalBlocked = status.totalBlocked || 0;
  const totalProcessed = totalPubs + totalBlocked;
  const passRate = totalProcessed > 0 ? ((totalPubs / totalProcessed) * 100).toFixed(1) : '100.0';

  const cryptoCount = status.categoryDistribution?.CRYPTO_DEFI || 0;
  const aiCount = status.categoryDistribution?.AI_WEB3 || 0;
  const macroCount = status.categoryDistribution?.STOCKS_MACRO || 0;
  const catTotal = cryptoCount + aiCount + macroCount || 1;

  const cryptoPct = Math.round((cryptoCount / catTotal) * 100);
  const aiPct = Math.round((aiCount / catTotal) * 100);
  const macroPct = Math.round((macroCount / catTotal) * 100);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      
      {/* 1. Total Published */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>PUBLISHED POSTS</span>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.1)', color: '#00F2FE' }}>
            <Send size={18} />
          </div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#FFF' }}>{totalPubs}</div>
        <p style={{ fontSize: '0.75rem', color: '#34D399', marginTop: '4px' }}>
          Autonomous multi-platform distribution active
        </p>
      </div>

      {/* 2. Blocked Vault Count */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>BLOCKED VAULT</span>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
            <ShieldX size={18} />
          </div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: totalBlocked > 0 ? '#F87171' : '#FFF' }}>{totalBlocked}</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Strict policy blocks logged with audit trail
        </p>
      </div>

      {/* 3. Target Distribution Mix (50 / 25 / 25) */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONTENT MIX (50/25/25)</span>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(121, 40, 202, 0.1)', color: '#7928CA' }}>
            <PieChart size={18} />
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '10px 0', background: 'rgba(255,255,255,0.1)' }}>
          <div style={{ width: `${cryptoPct}%`, background: '#7928CA' }} title={`Crypto: ${cryptoPct}%`} />
          <div style={{ width: `${aiPct}%`, background: '#00F2FE' }} title={`AI: ${aiPct}%`} />
          <div style={{ width: `${macroPct}%`, background: '#F59E0B' }} title={`Macro: ${macroPct}%`} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          <span style={{ color: '#C084FC' }}>Crypto {cryptoPct}%</span>
          <span style={{ color: '#38BDF8' }}>AI {aiPct}%</span>
          <span style={{ color: '#FBBF24' }}>Macro {macroPct}%</span>
        </div>
      </div>

      {/* 4. Safety Policy Pass Rate */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>SAFETY COMPLIANCE</span>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34D399' }}>{passRate}%</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Multi-source claim verification active
        </p>
      </div>

    </div>
  );
};
