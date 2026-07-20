import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  getConsolation,
  drawConsolation,
  resolveConsolationRound,
} from '@/services/consolation';
import { computeLeagueTable } from '@/services/league';
import { listEditionMembers } from '@/services/editions';
import { listMatches } from '@/services/matches';
import { toast } from '@/lib/toast';
import type { BracketDoc, KOMatch, KORound, Match, FireDate } from '@/types';

const LAST_N_OPTIONS = [4, 6, 8];

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

function toMillis(value: FireDate): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toMillis();
}

function formatDate(value: FireDate): string {
  const ms = toMillis(value);
  if (!ms) return 'A definir';
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
}

export function ConsolacaoTab({ editionId, currentUserId, isOrganizer }: Props) {
  const [bracket, setBracket] = useState<BracketDoc | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [tableSize, setTableSize] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [lastN, setLastN] = useState<number>(4);
  const [drawing, setDrawing] = useState(false);

  const [openRound, setOpenRound] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [bra, members, ms, league] = await Promise.all([
        getConsolation(editionId),
        listEditionMembers(editionId),
        listMatches(editionId),
        computeLeagueTable(editionId),
      ]);
      const nameMap: Record<string, string> = {};
      for (const m of members) nameMap[m.userId] = m.nickname;
      setNames(nameMap);
      setBracket(bra);
      setMatches(ms);
      setTableSize(league.table.length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    setBracket(null);
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  function nameOf(userId: string): string {
    return names[userId] ?? 'Participante';
  }

  async function handleDraw() {
    const ok = window.confirm(
      `Montar a Consolação com os ${lastN} últimos colocados da Liga? ` +
        'O chaveamento é sorteado a partir da tabela atual.',
    );
    if (!ok) return;

    setDrawing(true);
    try {
      await drawConsolation(editionId, lastN, names);
      toast('Consolação montada! Segunda chance chegando.', 'ok');
      await load();
    } catch {
      toast('Não foi possível montar a Consolação.', 'err');
    } finally {
      setDrawing(false);
    }
  }

  function toggleMatch(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openResolver(roundIndex: number) {
    if (openRound === roundIndex) {
      setOpenRound(null);
      return;
    }
    // Pré-seleciona os jogos já usados na rodada, se houver.
    const round = bracket?.rounds[roundIndex];
    const used = round?.matches.find((m) => m.matchIds?.length)?.matchIds ?? [];
    setPicked(new Set(used));
    setOpenRound(roundIndex);
  }

  async function handleResolve(roundIndex: number) {
    const matchIds = [...picked];
    if (matchIds.length === 0) {
      toast('Escolha ao menos um jogo para decidir a rodada.', 'err');
      return;
    }
    setResolving(true);
    try {
      await resolveConsolationRound(editionId, roundIndex, matchIds);
      toast('Rodada da Consolação resolvida!', 'ok');
      setOpenRound(null);
      setPicked(new Set());
      await load();
    } catch {
      toast('Não foi possível resolver a rodada.', 'err');
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card muted">
        Não foi possível carregar a Consolação.{' '}
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

  // --- Ainda sem Consolação montada ---
  if (!bracket) {
    if (isOrganizer) {
      const leaguePronta = tableSize >= 2;
      return (
        <div className="card">
          <div className="row gap" style={{ justifyContent: 'space-between' }}>
            <h2 className="sec">Consolação</h2>
            <span className="badge badge-purple">segunda chance</span>
          </div>
          <p className="muted" style={intro}>
            A Consolação é a repescagem do bolão: os últimos colocados da Liga
            ganham um mata-mata só deles, com nova chance de brilhar. Ela começa
            depois que a Liga estiver rolando.
          </p>

          {leaguePronta ? (
            <>
              <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
                <label>Quantos últimos da Liga entram?</label>
                <select value={lastN} onChange={(e) => setLastN(Number(e.target.value))}>
                  {LAST_N_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      Últimos {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-gold"
                onClick={handleDraw}
                disabled={drawing}
                style={{ marginTop: 14 }}
              >
                {drawing ? 'Montando…' : 'Montar Consolação'}
              </button>
            </>
          ) : (
            <p className="muted" style={{ ...intro, marginTop: 12 }}>
              Assim que a tabela da Liga tiver classificação, você poderá montar a
              Consolação aqui.
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="card">
        <div className="row gap" style={{ justifyContent: 'space-between' }}>
          <h2 className="sec">Consolação</h2>
          <span className="badge badge-gray">em breve</span>
        </div>
        <p className="muted" style={intro}>
          A Consolação é a repescagem do bolão: os últimos colocados da Liga
          ganham um mata-mata só deles, com nova chance de brilhar. Assim que o
          organizador montar a chave, ela aparece aqui.
        </p>
      </div>
    );
  }

  const rounds = bracket.rounds ?? [];
  const champions = bracket.championIds ?? [];

  return (
    <div className="stack gap">
      {/* Cabeçalho / explicação */}
      <div className="card">
        <div className="row gap" style={{ justifyContent: 'space-between' }}>
          <h2 className="sec">Consolação</h2>
          <span className="badge badge-purple">segunda chance</span>
        </div>
        <p className="muted" style={intro}>
          Mata-mata dos últimos colocados da Liga — uma nova chance de fechar a
          campanha em alta.
        </p>
      </div>

      {/* Campeão(ões) */}
      {champions.length > 0 && (
        <div className="card" style={champCardStyle}>
          <span className="disp" style={{ fontSize: 12, letterSpacing: 2, color: 'var(--gold)' }}>
            {champions.length > 1 ? 'Campeões da Consolação' : 'Campeão da Consolação'}
          </span>
          <div className="stack gap-sm" style={{ marginTop: 10 }}>
            {champions.map((id) => (
              <div key={id} className="row gap-sm">
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {initials(nameOf(id))}
                </div>
                <span className="disp" style={{ fontSize: 18, fontWeight: 700 }}>
                  🏆 {nameOf(id)}
                  {id === currentUserId && (
                    <span className="muted" style={{ fontWeight: 400 }}> (você)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chaveamento */}
      <div className="stack gap-sm">
        <h2 className="sec">Chaveamento</h2>
        {rounds.length === 0 && (
          <div className="card muted" style={{ fontSize: 14 }}>
            Chave ainda não definida.
          </div>
        )}

        {rounds.map((round, roundIndex) => {
          const resolvable = round.matches.some((m) => m.slotA && m.slotB);
          const isOpen = openRound === roundIndex;
          return (
            <div key={roundIndex} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={roundHeadStyle}>
                <span className="disp" style={{ fontSize: 15, fontWeight: 700 }}>
                  {round.stage}
                </span>
                {roundIndex === rounds.length - 1 && (
                  <span className="badge badge-gold">decisão</span>
                )}
              </div>

              <div className="stack">
                {round.matches.map((m) => (
                  <MatchRow
                    key={m.id}
                    m={m}
                    nameOf={nameOf}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>

              {isOrganizer && resolvable && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  <button
                    onClick={() => openResolver(roundIndex)}
                    className="btn btn-ghost"
                    style={{ width: 'auto', margin: 12 }}
                  >
                    {isOpen ? 'Cancelar' : 'Resolver rodada'}
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                        Escolha os jogos que decidem esta fase. Os pontos de cada
                        participante nesses jogos definem quem avança.
                      </p>
                      <div className="stack gap-sm">
                        {matches.length === 0 && (
                          <span className="muted" style={{ fontSize: 13 }}>
                            Nenhum jogo cadastrado ainda.
                          </span>
                        )}
                        {matches.map((match) => {
                          const checked = picked.has(match.id);
                          const finished = match.status === 'finished';
                          return (
                            <label
                              key={match.id}
                              className="row gap-sm"
                              style={matchPickStyle(checked)}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMatch(match.id)}
                                style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
                              />
                              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {match.homeTeam.flag ?? '🏳️'} {match.homeTeam.name}
                                  {finished && match.homeScore != null
                                    ? ` ${match.homeScore}×${match.awayScore} `
                                    : ' × '}
                                  {match.awayTeam.name} {match.awayTeam.flag ?? '🏳️'}
                                </span>
                                <span className="muted" style={{ fontSize: 11.5 }}>
                                  {formatDate(match.startTime)}
                                </span>
                              </div>
                              <span
                                className={`badge ${finished ? 'badge-green' : 'badge-gray'}`}
                              >
                                {finished ? 'encerrado' : 'aguardando'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <button
                        className="btn btn-gold"
                        onClick={() => handleResolve(roundIndex)}
                        disabled={resolving}
                        style={{ marginTop: 12 }}
                      >
                        {resolving
                          ? 'Resolvendo…'
                          : `Resolver ${round.stage} (${picked.size} jogo${picked.size === 1 ? '' : 's'})`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchRow({
  m,
  nameOf,
  currentUserId,
}: {
  m: KOMatch;
  nameOf: (id: string) => string;
  currentUserId: string;
}) {
  const aId = m.slotA?.userId;
  const bId = m.slotB?.userId;

  // Bye: um lado vazio, o outro avança direto.
  if ((aId && !bId) || (bId && !aId)) {
    const soloId = (aId ?? bId) as string;
    const isMe = soloId === currentUserId;
    const soloName = m.slotA?.nickname ?? m.slotB?.nickname ?? nameOf(soloId);
    return (
      <div className="row gap" style={rowStyle(isMe)}>
        <Side name={soloName} isMe={isMe} align="left" winner />
        <span className="badge badge-purple">avança</span>
        <div style={{ flex: '1 1 0', minWidth: 0 }} />
      </div>
    );
  }

  if (!aId || !bId) {
    // Ambos indefinidos ainda.
    return (
      <div className="row gap" style={rowStyle(false)}>
        <span className="muted disp" style={{ fontSize: 13, flex: 1 }}>
          A definir
        </span>
        <span className="muted disp" style={{ fontSize: 13 }}>×</span>
        <span className="muted disp" style={{ fontSize: 13, flex: 1, textAlign: 'right' }}>
          A definir
        </span>
      </div>
    );
  }

  const resolved = m.winnerId != null && m.pointsA != null && m.pointsB != null;
  const aWon = resolved && m.winnerId === aId;
  const bWon = resolved && m.winnerId === bId;
  const meA = aId === currentUserId;
  const meB = bId === currentUserId;
  const aName = m.slotA?.nickname ?? nameOf(aId);
  const bName = m.slotB?.nickname ?? nameOf(bId);

  return (
    <div className="row gap" style={rowStyle(meA || meB)}>
      <Side name={aName} isMe={meA} align="left" winner={aWon} />
      <div className="center" style={{ flex: '0 0 auto', minWidth: 64 }}>
        {resolved ? (
          <span className="disp tnum" style={{ fontSize: 16, fontWeight: 700 }}>
            <b style={{ color: aWon ? 'var(--gold)' : 'var(--txt)' }}>{m.pointsA}</b>
            <span className="muted"> × </span>
            <b style={{ color: bWon ? 'var(--gold)' : 'var(--txt)' }}>{m.pointsB}</b>
          </span>
        ) : (
          <span className="muted disp" style={{ fontSize: 12 }}>a definir</span>
        )}
        {m.pointsEqual && (
          <div className="badge badge-blue" style={{ marginTop: 4 }} title="Desempate pela posição na Liga">
            desempate
          </div>
        )}
      </div>
      <Side name={bName} isMe={meB} align="right" winner={bWon} />
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

const intro: CSSProperties = { marginTop: 8, fontSize: 14, lineHeight: 1.7 };

const roundHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '14px 16px',
  borderBottom: '1px solid var(--line)',
};

const champCardStyle: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(244,196,48,.12), rgba(124,58,237,.12))',
  borderColor: 'rgba(244,196,48,.4)',
};

function rowStyle(isMe: boolean): CSSProperties {
  return {
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--line-soft)',
    background: isMe ? 'rgba(244,196,48,.07)' : 'transparent',
  };
}

function matchPickStyle(checked: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${checked ? 'var(--gold)' : 'var(--line)'}`,
    background: checked ? 'rgba(244,196,48,.07)' : 'var(--bg-elev)',
  };
}
