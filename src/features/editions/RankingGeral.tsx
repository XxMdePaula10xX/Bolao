import { useEffect, useState } from 'react';
import { listEditionMembers } from '@/services/editions';
import type { EditionMember } from '@/types';

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

/** Medalha para o pódio, número para o resto. */
function positionLabel(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return String(pos);
}

interface Props {
  editionId: string;
  currentUserId?: string;
}

export function RankingGeral({ editionId, currentUserId }: Props) {
  const [members, setMembers] = useState<EditionMember[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setMembers(null);
    setError(false);
    listEditionMembers(editionId)
      .then((m) => alive && setMembers(m))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [editionId]);

  if (error) {
    return <div className="card muted">Não foi possível carregar o ranking.</div>;
  }
  if (!members) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
        <h2 className="sec">Ranking Geral</h2>
      </div>

      <div className="row" style={rowStyle(false)}>
        <div style={colPos} className="muted">#</div>
        <div style={colName} className="muted">Palpiteiro</div>
        <div style={colNum} className="muted">Cravadas</div>
        <div style={colNum} className="muted">Pontos</div>
      </div>

      {members.map((m, i) => {
        const pos = i + 1;
        const isMe = m.userId === currentUserId;
        return (
          <div key={m.id} className="row" style={rowStyle(isMe)}>
            <div style={colPos} className="disp tnum">{positionLabel(pos)}</div>
            <div style={{ ...colName }} className="row gap">
              <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                {initials(m.nickname)}
              </div>
              <span style={{ fontWeight: 700 }}>
                {m.nickname}{isMe && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
              </span>
            </div>
            <div style={colNum} className="tnum">{m.exactHits}</div>
            <div style={{ ...colNum, fontWeight: 700, color: 'var(--gold)' }} className="tnum">{m.totalPoints}</div>
          </div>
        );
      })}

      {members.length === 0 && (
        <div className="muted" style={{ padding: 16 }}>Ainda não há participantes.</div>
      )}
    </div>
  );
}

const colPos: React.CSSProperties = { flex: '0 0 44px', textAlign: 'center', fontSize: 14 };
const colName: React.CSSProperties = { flex: '1 1 auto', minWidth: 0, alignItems: 'center' };
const colNum: React.CSSProperties = { flex: '0 0 72px', textAlign: 'right', fontSize: 14 };

function rowStyle(isMe: boolean): React.CSSProperties {
  return {
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 16px',
    borderBottom: '1px solid var(--line-soft)',
    background: isMe ? 'rgba(244,196,48,.1)' : 'transparent',
  };
}
