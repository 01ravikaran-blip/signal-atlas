import React from 'react';
import { BlockedPost } from '../types';
import { ShieldX, AlertTriangle, Lock, Info } from 'lucide-react';

interface BlockedVaultProps {
  blockedPosts: BlockedPost[];
}

export const BlockedVault: React.FC<BlockedVaultProps> = ({ blockedPosts }) => {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#F87171' }}>
            <ShieldX size={22} /> Blocked Content Vault & Audit Log
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Posts automatically blocked by the Approved Autonomy Safety Engine with exact policy triggers
          </p>
        </div>

        <div className="badge badge-danger" style={{ padding: '6px 12px' }}>
          <Lock size={12} /> STRICT AUTONOMY GUARD ACTIVE
        </div>
      </div>

      <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.8rem', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Info size={16} /> Note: Blocked posts are saved for audit compliance. The autonomous engine will never bypass a policy block automatically.
      </div>

      {blockedPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <ShieldX size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
          <p style={{ fontSize: '0.9rem' }}>No blocked posts recorded.</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>All generated drafts met safety & verification thresholds.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {blockedPosts.map(blocked => (
            <div
              key={blocked.id}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-danger" style={{ fontFamily: 'var(--font-mono)' }}>
                    {blocked.blockCode}
                  </span>
                  <span className={`badge ${
                    blocked.category === 'CRYPTO_DEFI' ? 'badge-crypto' :
                    blocked.category === 'AI_WEB3' ? 'badge-ai' : 'badge-macro'
                  }`}>
                    {blocked.category}
                  </span>
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(blocked.timestamp).toLocaleString()}
                </span>
              </div>

              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFF', marginBottom: '6px' }}>
                Story: {blocked.storyTitle}
              </div>

              <div style={{ fontSize: '0.8rem', color: '#FCA5A5', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> Reason: {blocked.blockReason}
              </div>

              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Draft Sample: "{blocked.draftContent.substring(0, 160)}..."
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
