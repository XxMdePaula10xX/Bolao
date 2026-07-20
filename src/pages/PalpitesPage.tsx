import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { MatchList } from '@/features/predictions/MatchList';
import { LongTermForm } from '@/features/predictions/LongTermForm';

type Tab = 'jogos' | 'longo';

export function PalpitesPage() {
  const [tab, setTab] = useState<Tab>('jogos');
  const profile = useAuthStore((s) => s.profile);
  const currentEditionId = useEditionStore((s) => s.currentEditionId);

  if (!currentEditionId || !profile) {
    return (
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">Palpites</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="sec">Nenhum bolão selecionado</h2>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            Entre ou crie um bolão primeiro para poder palpitar nos jogos e nos mercados
            de longo prazo.
          </p>
          <Link
            to="/bolao"
            className="btn btn-gold"
            style={{ marginTop: 14, textDecoration: 'none' }}
          >
            Ir para o bolão
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">Palpites</h1>
      </div>

      <div style={{ borderBottom: '1px solid var(--line)', marginTop: 12 }}>
        <div className="wrap" style={{ display: 'flex', gap: 6, paddingBottom: 10 }}>
          {([
            ['jogos', 'Jogos'],
            ['longo', 'Longo Prazo'],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="disp"
              style={{
                flex: '0 0 auto',
                border: '1px solid var(--line)',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                background: tab === k ? 'var(--gold)' : 'var(--panel)',
                color: tab === k ? '#2a2205' : 'var(--txt-2)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 18, paddingBottom: 32 }}>
        {tab === 'jogos' ? (
          <MatchList editionId={currentEditionId} uid={profile.id} />
        ) : (
          <LongTermForm editionId={currentEditionId} user={profile} />
        )}
      </div>
    </div>
  );
}
