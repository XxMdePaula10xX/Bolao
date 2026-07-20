import { useCallback, useEffect, useState } from 'react';
import { getLeague, drawLeague, computeLeagueTable } from '@/services/league';
import { listEditionMembers, getEdition } from '@/services/editions';
import { listMatches } from '@/services/matches';
import { toast } from '@/lib/toast';
import type { LeagueDoc, LeagueTableRow } from '@/types';

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

function positionLabel(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return String(pos);
}

interface RoundConfrontoResult {
  aUserId: string;
  bUserId: string | null;
  pointsA: number;
  pointsB: number;
  resolved: boolean;
}

interface LeagueView {
  table: LeagueTableRow[];
  rounds: { round: number; confrontos: RoundConfrontoResult[] }[];
}

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
}

export function LigaTab({ editionId, currentUserId, isOrganizer }: Props) {
  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [view, setView] = useState<LeagueView | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [openRound, setOpenRound] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const lg = await getLeague(editionId);
      const members = await listEditionMembers(editionId);
      const nameMap: Record<string, string> = {};
      for (const m of members) nameMap[m.userId] = m.nickname;
      setNames(nameMap);
      setLeague(lg);
      if (lg) {
        setView(await computeLeagueTable(editionId));
      } else {
        setView(null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    setLeague(null);
    setView(null);
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function handleDraw() {
    const ok = window.confirm(
      'Sortear os confrontos da Liga? Isso fixa o chaveamento de rodadas e não deve ser refeito depois.',
    );
    if (!ok) return;

    setDrawing(true);
    try {
      const [members, matches, edition] = await Promise.all([
        listEditionMembers(editionId),
        listMatches(editionId),
        getEdition(editionId),
      ]);
      if (members.length < 2) {
        toast('São necessários ao menos 2 participantes.', 'err');
        setDrawing(false);
        return;
      }
      const matchesPerRound = edition?.settings?.league.matchesPerRound ?? 4;
      const rounds = Math.max(1, Math.ceil(matches.length / matchesPerRound));
      await drawLeague(
        editionId,
        members.map((m) => m.userId),
        rounds,
        matchesPerRound,
      );
      toast('Confrontos da Liga sorteados!', 'ok');
      await load();
    } catch {
      toast('Não foi possível sortear a Liga.', 'err');
    } finally {
      setDrawing(false);
    }
  }

  function nameOf(userId: string): string {
    return names[userId] ?? 'Participante';
  }

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (error) {
    return (
      <div className="card muted">
        Não foi possível carregar a Liga.{' '}
        <button
          className="btn btn-ghost"
          onClick={load}
          style={{ width: 'auto', marginTop: 10 }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // --- Sem Liga ainda ---
  if (!league) {
    if (isOrganizer) {
      return (
        <div className="card">
          <h2 className="sec">Liga</h2>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            A Liga é disputada em confrontos por rodada, sorteados no início. Cada rodada é
            um bloco de jogos consecutivos: quem fizer mais pontos no bloco vence o confronto.
          </p>
          <button
            className="btn btn-gold"
            onClick={handleDraw}
            disabled={drawing}
            style={{ marginTop: 14 }}
          >
            {drawing ? 'Sorteando…' : 'Sortear confrontos da Liga'}
          </button>
        </div>
      );
    }
    return (
      <div className="card">
        <div className="row gap" style={{ justifyContent: 'space-between' }}>
          <h2 className="sec">Liga</h2>
          <span className="badge badge-gray">aguardando sorteio</span>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          O organizador ainda não sorteou os confrontos da Liga. Assim que o sorteio for feito,
          a tabela e as rodadas aparecem aqui.
        </p>
      </div>
    );
  }

  const table = view?.table ?? [];
  const rounds = view?.rounds ?? [];

  return (
    <div className="stack gap">
      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
          <div className="row gap" style={{ justifyContent: 'space-between' }}>
            <h2 className="sec">Tabela da Liga</h2>
            <span className="badge badge-blue">Liga</span>
          </div>
        </div>

        <div className="row" style={headRowStyle}>
          <div style={colPos} className="muted">#</div>
          <div style={colName} className="muted">Palpiteiro</div>
          <div style={colStat} className="muted" title="Jogos">PJ</div>
          <div style={colStat} className="muted" title="Vitórias">V</div>
          <div style={colStat} className="muted" title="Empates">E</div>
          <div style={colStat} className="muted" title="Derrotas">D</div>
          <div style={colPts} className="muted" title="Pontos de Liga">Pts</div>
        </div>

        {table.map((row) => {
          const isMe = row.userId === currentUserId;
          return (
            <div key={row.userId} className="row" style={bodyRowStyle(isMe)}>
              <div style={colPos} className="disp tnum">{positionLabel(row.position)}</div>
              <div style={colName} className="row gap-sm">
                <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                  {initials(row.nickname ?? nameOf(row.userId))}
                </div>
                <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.nickname ?? nameOf(row.userId)}
                  {isMe && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
                </span>
              </div>
              <div style={colStat} className="tnum">{row.played}</div>
              <div style={colStat} className="tnum" title="Vitórias">{row.wins}</div>
              <div style={colStat} className="tnum">{row.draws}</div>
              <div style={colStat} className="tnum">{row.losses}</div>
              <div style={{ ...colPts, fontWeight: 700, color: 'var(--gold)' }} className="tnum">
                {row.leaguePoints}
              </div>
            </div>
          );
        })}

        {table.length === 0 && (
          <div className="muted" style={{ padding: 16, fontSize: 14, lineHeight: 1.6 }}>
            Os confrontos já foram sorteados. A classificação começa a valer quando as rodadas
            forem concluídas (todos os jogos do bloco finalizados).
          </div>
        )}
      </div>

      {/* Confrontos por rodada */}
      <div className="stack gap-sm">
        <h2 className="sec">Confrontos por rodada</h2>
        {rounds.map((r) => {
          const allResolved = r.confrontos.length > 0 && r.confrontos.every((c) => c.resolved);
          const isOpen = openRound === r.round;
          return (
            <div key={r.round} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenRound(isOpen ? null : r.round)}
                className="row gap"
                style={{
                  width: '100%', justifyContent: 'space-between', padding: '14px 16px',
                  background: 'transparent', border: 'none', color: 'var(--txt)', textAlign: 'left',
                }}
              >
                <span className="disp" style={{ fontSize: 15, fontWeight: 700 }}>
                  Rodada {r.round}
                </span>
                <span className="row gap-sm">
                  <span className={`badge ${allResolved ? 'badge-green' : 'badge-gray'}`}>
                    {allResolved ? 'encerrada' : 'a definir'}
                  </span>
                  <span className="muted" style={{ fontSize: 18, lineHeight: 1 }}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="stack" style={{ borderTop: '1px solid var(--line)' }}>
                  {r.confrontos.map((c, idx) => (
                    <Confronto
                      key={idx}
                      c={c}
                      nameOf={nameOf}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {rounds.length === 0 && (
          <div className="card muted" style={{ fontSize: 14 }}>
            Nenhuma rodada configurada.
          </div>
        )}
      </div>
    </div>
  );
}

function Confronto({
  c,
  nameOf,
  currentUserId,
}: {
  c: RoundConfrontoResult;
  nameOf: (id: string) => string;
  currentUserId: string;
}) {
  // Folga (bye)
  if (c.bUserId == null) {
    const isMe = c.aUserId === currentUserId;
    return (
      <div className="row gap" style={confrontoRowStyle(isMe)}>
        <Side name={nameOf(c.aUserId)} isMe={isMe} align="left" />
        <span className="badge badge-purple">folga</span>
        <div style={{ flex: '1 1 0', minWidth: 0 }} />
      </div>
    );
  }

  const meA = c.aUserId === currentUserId;
  const meB = c.bUserId === currentUserId;
  const aWon = c.resolved && c.pointsA > c.pointsB;
  const bWon = c.resolved && c.pointsB > c.pointsA;
  const drew = c.resolved && c.pointsA === c.pointsB;

  return (
    <div className="row gap" style={confrontoRowStyle(meA || meB)}>
      <Side name={nameOf(c.aUserId)} isMe={meA} align="left" winner={aWon} />
      <div className="center" style={{ flex: '0 0 auto', minWidth: 64 }}>
        {c.resolved ? (
          <span className="disp tnum" style={{ fontSize: 16, fontWeight: 700 }}>
            <b style={{ color: aWon ? 'var(--gold)' : 'var(--txt)' }}>{c.pointsA}</b>
            <span className="muted"> × </span>
            <b style={{ color: bWon ? 'var(--gold)' : 'var(--txt)' }}>{c.pointsB}</b>
          </span>
        ) : (
          <span className="muted disp" style={{ fontSize: 12 }}>a definir</span>
        )}
        {drew && (
          <div className="badge badge-gray" style={{ marginTop: 4 }}>empate</div>
        )}
      </div>
      <Side name={nameOf(c.bUserId)} isMe={meB} align="right" winner={bWon} />
    </div>
  );
}

function Side({
  name,
  isMe,
  align,
  winner,
}: {
  name: string;
  isMe: boolean;
  align: 'left' | 'right';
  winner?: boolean;
}) {
  return (
    <div
      className="row gap-sm"
      style={{
        flex: '1 1 0',
        minWidth: 0,
        justifyContent: align === 'left' ? 'flex-start' : 'flex-end',
        flexDirection: align === 'left' ? 'row' : 'row-reverse',
      }}
    >
      <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
        {initials(name)}
      </div>
      <span
        style={{
          fontWeight: winner ? 700 : 600,
          color: winner ? 'var(--gold)' : 'var(--txt)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: align,
        }}
      >
        {name}
        {isMe && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
      </span>
    </div>
  );
}

const headRowStyle: React.CSSProperties = {
  justifyContent: 'space-between',
  gap: 6,
  padding: '10px 16px',
  fontSize: 12,
  borderBottom: '1px solid var(--line-soft)',
};

function bodyRowStyle(isMe: boolean): React.CSSProperties {
  return {
    justifyContent: 'space-between',
    gap: 6,
    padding: '10px 16px',
    fontSize: 14,
    borderBottom: '1px solid var(--line-soft)',
    background: isMe ? 'rgba(244,196,48,.1)' : 'transparent',
  };
}

function confrontoRowStyle(isMe: boolean): React.CSSProperties {
  return {
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--line-soft)',
    background: isMe ? 'rgba(244,196,48,.07)' : 'transparent',
  };
}

const colPos: React.CSSProperties = { flex: '0 0 34px', textAlign: 'center' };
const colName: React.CSSProperties = { flex: '1 1 auto', minWidth: 0, alignItems: 'center' };
const colStat: React.CSSProperties = { flex: '0 0 30px', textAlign: 'center' };
const colPts: React.CSSProperties = { flex: '0 0 44px', textAlign: 'right' };
