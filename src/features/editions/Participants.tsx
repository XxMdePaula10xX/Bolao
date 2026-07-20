import { useEffect, useState } from 'react';
import { listEditionMembers } from '@/services/editions';
import type { EditionMember } from '@/types';

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

interface Props {
  editionId: string;
  currentUserId?: string;
}

export function Participants({ editionId, currentUserId }: Props) {
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
    return <div className="card muted">Não foi possível carregar os participantes.</div>;
  }
  if (!members) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div className="card">
      <h2 className="sec">Participantes ({members.length})</h2>
      <div className="stack gap-sm" style={{ marginTop: 12 }}>
        {members.map((m) => {
          const isMe = m.userId === currentUserId;
          return (
            <div
              key={m.id}
              className="row gap"
              style={{
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: isMe ? 'rgba(244,196,48,.08)' : 'transparent',
                border: isMe ? '1px solid rgba(244,196,48,.3)' : '1px solid transparent',
              }}
            >
              <div className="row gap">
                <div className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
                  {initials(m.nickname)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {m.nickname}{isMe && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{m.totalPoints} pts</div>
                </div>
              </div>
              <span className={`badge ${m.role === 'organizer' ? 'badge-gold' : 'badge-gray'}`}>
                {m.role === 'organizer' ? '⭐ organizador' : 'participante'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
