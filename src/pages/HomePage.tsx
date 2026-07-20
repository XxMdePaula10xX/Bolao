import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { listMyEditions, listEditionMembers } from '@/services/editions';
import type { Edition, EditionMember } from '@/types';

const DISPUTAS = [
  { k: 'Ranking Geral', d: 'Soma de todos os pontos', badge: 'badge-green' },
  { k: 'Liga', d: 'Confrontos rodada a rodada', badge: 'badge-blue' },
  { k: 'Copa', d: 'Mata-mata entre os participantes', badge: 'badge-gold' },
  { k: 'Consolação', d: 'Segunda chance dos eliminados', badge: 'badge-purple' },
  { k: 'Longo Prazo', d: 'Campeão, artilheiro, garçom, craque', badge: 'badge-gray' },
];

interface Standing {
  edition: Edition;
  position: number;
  total: number;
  me: EditionMember;
}

export function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const currentEditionId = useEditionStore((s) => s.currentEditionId);
  const setCurrentEdition = useEditionStore((s) => s.setCurrentEdition);

  const first = profile?.nickname?.split(' ')[0] ?? 'Palpiteiro';
  const [standing, setStanding] = useState<Standing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!profile) return;
    (async () => {
      try {
        const editions = await listMyEditions(profile.id);
        if (!alive) return;
        if (editions.length === 0) {
          setStanding(null);
          setLoaded(true);
          return;
        }
        const chosen =
          editions.find((e) => e.id === currentEditionId) ?? editions[0];
        if (chosen.id !== currentEditionId) setCurrentEdition(chosen.id);

        const members = await listEditionMembers(chosen.id);
        if (!alive) return;
        const idx = members.findIndex((m) => m.userId === profile.id);
        if (idx >= 0) {
          setStanding({ edition: chosen, position: idx + 1, total: members.length, me: members[idx] });
        } else {
          setStanding(null);
        }
      } catch {
        if (alive) setStanding(null);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <p className="muted" style={{ fontSize: 15 }}>E aí,</p>
      <h1 className="page">{first} 👋</h1>

      {loaded && standing && <PositionCard s={standing} />}

      {loaded && !standing && (
        <Link to="/bolao" className="card" style={{ display: 'block', marginTop: 18 }}>
          <h2 className="sec">Comece por aqui</h2>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            Você ainda não está em uma edição. Toque para criar a sua Copa ou entrar por um código de convite.
          </p>
          <span className="badge badge-gold" style={{ marginTop: 10 }}>Ir para o Bolão →</span>
        </Link>
      )}

      <div className="card" style={{ marginTop: 14, background: 'linear-gradient(135deg, var(--panel), var(--bg-elev))' }}>
        <h2 className="sec">As 5 disputas do bolão</h2>
        <div className="stack gap-sm" style={{ marginTop: 12 }}>
          {DISPUTAS.map((x) => (
            <div key={x.k} className="row gap" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{x.k}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{x.d}</div>
              </div>
              <span className={`badge ${x.badge}`}>ativo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function positionLabel(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `${pos}º`;
}

function PositionCard({ s }: { s: Standing }) {
  return (
    <Link
      to="/bolao"
      className="card"
      style={{
        display: 'block', marginTop: 18,
        background: 'linear-gradient(135deg, rgba(244,196,48,.12), var(--bg-elev))',
        border: '1px solid rgba(244,196,48,.35)',
      }}
    >
      <h2 className="sec">Sua posição no Ranking Geral</h2>
      <div className="row gap" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <div className="row gap">
          <div className="disp" style={{ fontSize: 40, color: 'var(--gold)', lineHeight: 1 }}>
            {positionLabel(s.position)}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{s.edition.name}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {s.position}º de {s.total} · {s.me.exactHits} cravadas
            </div>
          </div>
        </div>
        <div className="center">
          <div className="disp tnum" style={{ fontSize: 28, color: 'var(--gold)' }}>{s.me.totalPoints}</div>
          <div className="muted" style={{ fontSize: 11 }}>pontos</div>
        </div>
      </div>
    </Link>
  );
}
