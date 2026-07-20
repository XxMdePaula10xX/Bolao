import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { getCup, drawCup, qualifyGroups, resolveCupRound } from '@/services/cup';
import { getLeague } from '@/services/league';
import { listEditionMembers } from '@/services/editions';
import { listMatches } from '@/services/matches';
import { splitIntoBlocks } from '@/lib/competition';
import { toast } from '@/lib/toast';
import type { BracketDoc, EditionMember, KOMatch, KORound, Match, FireDate } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

/** Quantos classificados por grupo, respeitando grupos menores. */
function estimateQualified(total: number, groupSize: number, per: number): { groups: number; qualified: number } {
  if (total <= 0 || groupSize <= 0) return { groups: 0, qualified: 0 };
  const groups = Math.ceil(total / groupSize);
  let qualified = 0;
  let remaining = total;
  for (let i = 0; i < groups; i++) {
    const size = Math.min(groupSize, remaining);
    qualified += Math.min(per, size);
    remaining -= size;
  }
  return { groups, qualified };
}

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
}

export function CopaTab({ editionId, currentUserId, isOrganizer }: Props) {
  const [cup, setCup] = useState<BracketDoc | null | undefined>(undefined);
  const [members, setMembers] = useState<EditionMember[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesPerRound, setMatchesPerRound] = useState(4);
  const [error, setError] = useState(false);

  const reloadCup = useCallback(async () => {
    const c = await getCup(editionId);
    setCup(c);
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    setCup(undefined);
    setError(false);
    Promise.all([getCup(editionId), listEditionMembers(editionId), listMatches(editionId), getLeague(editionId)])
      .then(([c, mem, mt, lg]) => {
        if (!alive) return;
        setCup(c);
        setMembers(mem);
        setMatches(mt);
        setMatchesPerRound(lg?.matchesPerRound ?? 4);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setCup(null);
      });
    return () => {
      alive = false;
    };
  }, [editionId]);

  const nicknameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) map[m.userId] = m.nickname;
    return (userId: string) => map[userId] ?? userId.slice(0, 6);
  }, [members]);

  if (error) {
    return <div className="card muted">Não foi possível carregar a Copa.</div>;
  }
  if (cup === undefined) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  // --- Sem Copa sorteada ---
  if (!cup) {
    if (!isOrganizer) {
      return (
        <div className="card">
          <h2 className="sec">Copa</h2>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            A Copa ainda não foi sorteada. Quando o organizador montar o chaveamento, ele aparece aqui.
          </p>
        </div>
      );
    }
    return <CupSetup members={members} onDone={reloadCup} editionId={editionId} />;
  }

  const groupsPending = cup.format === 'groups' && (!cup.rounds || cup.rounds.length === 0);

  return (
    <div className="stack gap">
      <ChampionBanner cup={cup} nicknameOf={nicknameOf} />

      {cup.format === 'groups' && cup.groups && cup.groups.length > 0 && (
        <GroupsView cup={cup} nicknameOf={nicknameOf} currentUserId={currentUserId} />
      )}

      {groupsPending ? (
        isOrganizer ? (
          <QualifySection
            editionId={editionId}
            cup={cup}
            matches={matches}
            matchesPerRound={matchesPerRound}
            onDone={reloadCup}
          />
        ) : (
          <div className="card muted" style={{ fontSize: 14 }}>
            Fase de grupos em andamento. O mata-mata é sorteado quando o organizador encerrar os grupos.
          </div>
        )
      ) : (
        <>
          <Bracket rounds={cup.rounds} nicknameOf={nicknameOf} currentUserId={currentUserId} />
          {isOrganizer && (
            <ResolveRounds
              editionId={editionId}
              cup={cup}
              matches={matches}
              matchesPerRound={matchesPerRound}
              onDone={reloadCup}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuração inicial (organizador)
// ---------------------------------------------------------------------------
function CupSetup({
  members,
  editionId,
  onDone,
}: {
  members: EditionMember[];
  editionId: string;
  onDone: () => void;
}) {
  const [format, setFormat] = useState<'knockout' | 'groups'>('knockout');
  const [groupSize, setGroupSize] = useState(4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [busy, setBusy] = useState(false);

  const total = members.length;
  const preview = estimateQualified(total, groupSize, qualifiersPerGroup);

  async function handleDraw() {
    if (total < 2) {
      toast('São necessários ao menos 2 participantes.', 'err');
      return;
    }
    if (format === 'groups') {
      if (groupSize < 2) return toast('Cada grupo precisa de ao menos 2 participantes.', 'err');
      if (qualifiersPerGroup < 1 || qualifiersPerGroup >= groupSize) {
        return toast('Classificados por grupo deve ser entre 1 e o tamanho do grupo − 1.', 'err');
      }
    }
    setBusy(true);
    try {
      const nicknames: Record<string, string> = {};
      for (const m of members) nicknames[m.userId] = m.nickname;
      const memberIds = members.map((m) => m.userId);
      await drawCup(
        editionId,
        memberIds,
        format === 'groups' ? { format, groupSize, qualifiersPerGroup } : { format: 'knockout' },
        nicknames,
      );
      toast('Copa sorteada! 🏆', 'ok');
      onDone();
    } catch {
      toast('Não foi possível sortear a Copa.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="sec">Montar a Copa</h2>
      <p className="muted" style={{ margin: '8px 0 16px', fontSize: 14, lineHeight: 1.6 }}>
        {total} participante{total === 1 ? '' : 's'}. Escolha o formato e faça o sorteio — depois é só definir
        quais jogos decidem cada fase.
      </p>

      <div className="field">
        <label>Formato</label>
        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <FormatCard
            active={format === 'knockout'}
            title="Só mata-mata"
            desc="Sorteia o chaveamento entre todos direto."
            onClick={() => setFormat('knockout')}
          />
          <FormatCard
            active={format === 'groups'}
            title="Fase de grupos"
            desc="Grupos por sorteio; os melhores avançam ao mata-mata."
            onClick={() => setFormat('groups')}
          />
        </div>
      </div>

      {format === 'groups' && (
        <>
          <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
            <NumField
              label="Participantes por grupo"
              value={groupSize}
              min={2}
              onChange={setGroupSize}
            />
            <NumField
              label="Classificam por grupo"
              value={qualifiersPerGroup}
              min={1}
              onChange={setQualifiersPerGroup}
            />
          </div>
          <div
            className="card"
            style={{ background: 'var(--bg-elev)', padding: 12, marginBottom: 14 }}
          >
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
              Com <b style={{ color: 'var(--txt)' }}>{total}</b> participantes e grupos de{' '}
              <b style={{ color: 'var(--txt)' }}>{groupSize}</b> →{' '}
              <b style={{ color: 'var(--blue)' }}>{preview.groups}</b> grupo
              {preview.groups === 1 ? '' : 's'}. Classificam{' '}
              <b style={{ color: 'var(--txt)' }}>{qualifiersPerGroup}</b> de cada →{' '}
              <b style={{ color: 'var(--gold)' }}>{preview.qualified}</b> no mata-mata.
            </p>
          </div>
        </>
      )}

      <button className="btn btn-gold" disabled={busy} onClick={handleDraw}>
        {busy ? 'Sorteando…' : 'Sortear Copa'}
      </button>
    </div>
  );
}

function FormatCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 160px',
        textAlign: 'left',
        background: active ? 'rgba(244,196,48,.1)' : 'var(--bg-elev)',
        border: `1px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        color: 'var(--txt)',
      }}
    >
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, color: active ? 'var(--gold)' : 'var(--txt)' }}>
        {title}
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
    </button>
  );
}

function NumField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="field" style={{ flex: '1 1 140px', minWidth: 130 }}>
      <span
        style={{ display: 'block', color: 'var(--txt-2)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}
      >
        {label}
      </span>
      <input
        type="number"
        min={min}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Math.trunc(Number(e.target.value));
          onChange(Number.isFinite(n) ? Math.max(min, n) : min);
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Banner de campeão / co-campeões
// ---------------------------------------------------------------------------
function ChampionBanner({ cup, nicknameOf }: { cup: BracketDoc; nicknameOf: (id: string) => string }) {
  if (!cup.championIds || cup.championIds.length === 0) return null;
  const co = cup.championIds.length > 1;
  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(244,196,48,.16), rgba(251,191,36,.06))',
        border: '1px solid var(--gold)',
        textAlign: 'center',
      }}
    >
      <div className="disp" style={{ fontSize: 13, letterSpacing: 2, color: 'var(--gold)' }}>
        {co ? '🏆 Co-campeões da Copa' : '🏆 Campeão da Copa'}
      </div>
      <div className="disp" style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: 'var(--txt)' }}>
        {cup.championIds.map((id) => nicknameOf(id)).join('  &  ')}
      </div>
      {co && (
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Empate na final — dividem o prêmio.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fase de grupos — visão
// ---------------------------------------------------------------------------
function GroupsView({
  cup,
  nicknameOf,
  currentUserId,
}: {
  cup: BracketDoc;
  nicknameOf: (id: string) => string;
  currentUserId: string;
}) {
  if (!cup.groups) return null;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
        <h2 className="sec">Grupos</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Classificam {cup.qualifiersPerGroup ?? 1} de cada grupo.
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          padding: 16,
        }}
      >
        {cup.groups.map((g) => (
          <div
            key={g.name}
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
            }}
          >
            <div className="disp" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{g.name}</div>
            <div className="stack gap-sm">
              {g.memberIds.map((id) => (
                <PlayerRow key={id} name={nicknameOf(id)} me={id === currentUserId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerRow({ name, me }: { name: string; me?: boolean }) {
  return (
    <div className="row gap-sm" style={{ minWidth: 0 }}>
      <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{initials(name)}</div>
      <span
        style={{
          fontWeight: 600,
          fontSize: 13.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
        {me && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chaveamento (bracket)
// ---------------------------------------------------------------------------
function Bracket({
  rounds,
  nicknameOf,
  currentUserId,
}: {
  rounds: KORound[];
  nicknameOf: (id: string) => string;
  currentUserId: string;
}) {
  if (!rounds || rounds.length === 0) {
    return <div className="card muted" style={{ fontSize: 14 }}>Chaveamento ainda não definido.</div>;
  }
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
        <h2 className="sec">Chaveamento</h2>
      </div>
      <div style={{ overflowX: 'auto', padding: 16 }}>
        <div className="row" style={{ gap: 16, alignItems: 'stretch', minWidth: 'min-content' }}>
          {rounds.map((round, ri) => (
            <div key={ri} style={{ flex: '0 0 auto', width: 210 }}>
              <div className="disp muted" style={{ fontSize: 12, letterSpacing: 1.5, marginBottom: 10 }}>
                {round.stage}
              </div>
              <div className="stack" style={{ gap: 12, justifyContent: 'space-around', height: 'calc(100% - 26px)' }}>
                {round.matches.map((m) => (
                  <BracketMatch key={m.id} match={m} nicknameOf={nicknameOf} currentUserId={currentUserId} isFinal={ri === rounds.length - 1} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BracketMatch({
  match,
  nicknameOf,
  currentUserId,
  isFinal,
}: {
  match: KOMatch;
  nicknameOf: (id: string) => string;
  currentUserId: string;
  isFinal: boolean;
}) {
  const co = isFinal && match.coChampions;
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${co ? 'var(--gold)' : 'var(--line)'}`,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      <BracketSlot
        slot={match.slotA}
        bye={match.byeA}
        points={match.pointsA}
        winner={!co && match.winnerId != null && match.slotA?.userId === match.winnerId}
        coWinner={!!co}
        nicknameOf={nicknameOf}
        currentUserId={currentUserId}
      />
      <div style={{ height: 1, background: 'var(--line-soft)' }} />
      <BracketSlot
        slot={match.slotB}
        bye={match.byeB}
        points={match.pointsB}
        winner={!co && match.winnerId != null && match.slotB?.userId === match.winnerId}
        coWinner={!!co}
        nicknameOf={nicknameOf}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function BracketSlot({
  slot,
  bye,
  points,
  winner,
  coWinner,
  nicknameOf,
  currentUserId,
}: {
  slot: KOMatch['slotA'];
  bye?: boolean;
  points?: number | null;
  winner: boolean;
  coWinner: boolean;
  nicknameOf: (id: string) => string;
  currentUserId: string;
}) {
  const name = slot ? nicknameOf(slot.userId) : bye ? 'Folga' : 'A definir';
  const me = slot?.userId === currentUserId;
  const highlight = winner || coWinner;
  return (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 10px',
        background: coWinner ? 'rgba(244,196,48,.12)' : winner ? 'rgba(0,214,143,.1)' : 'transparent',
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: highlight ? 700 : 500,
          color: slot ? (coWinner ? 'var(--gold)' : winner ? 'var(--green)' : 'var(--txt)') : 'var(--txt-mut)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {highlight && '✔ '}
        {name}
        {me && slot && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
      </span>
      {points != null && (
        <span
          className="tnum"
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-2)', flex: '0 0 auto' }}
        >
          {points}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seletor de jogos (multiseleção OU bloco/rodada)
// ---------------------------------------------------------------------------
function MatchPicker({
  matches,
  matchesPerRound,
  actionLabel,
  hint,
  busy,
  onConfirm,
}: {
  matches: Match[];
  matchesPerRound: number;
  actionLabel: string;
  hint: string;
  busy: boolean;
  onConfirm: (matchIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // matches já vem ordenado por startTime (listMatches). Blocos = rodadas da Liga.
  const blocks = useMemo(
    () => splitIntoBlocks(matches.map((m) => m.id), matchesPerRound),
    [matches, matchesPerRound],
  );
  const byId = useMemo(() => {
    const map: Record<string, Match> = {};
    for (const m of matches) map[m.id] = m;
    return map;
  }, [matches]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectBlock(ids: string[]) {
    // seleciona apenas os jogos encerrados do bloco (só eles pontuam)
    const finished = ids.filter((id) => byId[id]?.status === 'finished');
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = finished.length > 0 && finished.every((id) => next.has(id));
      for (const id of finished) {
        if (allIn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const finishedCount = matches.filter((m) => m.status === 'finished').length;

  if (matches.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>Nenhum jogo cadastrado ainda.</p>;
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>{hint}</p>
      <div className="stack gap-sm">
        {blocks.map((ids, bi) => {
          const finishedInBlock = ids.filter((id) => byId[id]?.status === 'finished');
          const allIn = finishedInBlock.length > 0 && finishedInBlock.every((id) => selected.has(id));
          return (
            <div
              key={bi}
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div
                className="row"
                style={{
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--line-soft)',
                }}
              >
                <span className="disp muted" style={{ fontSize: 12, letterSpacing: 1 }}>Rodada {bi + 1}</span>
                <button
                  type="button"
                  onClick={() => selectBlock(ids)}
                  disabled={finishedInBlock.length === 0}
                  className="disp"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${allIn ? 'var(--gold)' : 'var(--line)'}`,
                    color: allIn ? 'var(--gold)' : 'var(--txt-2)',
                    borderRadius: 999,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: finishedInBlock.length === 0 ? 0.4 : 1,
                  }}
                >
                  {allIn ? 'Rodada ✓' : 'Selecionar rodada'}
                </button>
              </div>
              <div className="stack">
                {ids.map((id) => {
                  const m = byId[id];
                  if (!m) return null;
                  const finished = m.status === 'finished';
                  const on = selected.has(id);
                  return (
                    <label
                      key={id}
                      className="row gap-sm"
                      style={{
                        padding: '8px 12px',
                        gap: 10,
                        cursor: finished ? 'pointer' : 'not-allowed',
                        opacity: finished ? 1 : 0.45,
                        borderTop: '1px solid var(--line-soft)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!finished}
                        onChange={() => toggle(id)}
                        style={{ width: 17, height: 17, accentColor: 'var(--gold)', flex: '0 0 auto' }}
                      />
                      <span style={{ fontSize: 18, flex: '0 0 auto' }}>{m.homeTeam.flag ?? '🏳️'}</span>
                      <span style={matchName}>{m.homeTeam.name}</span>
                      <span className="tnum muted" style={{ flex: '0 0 auto', fontSize: 13 }}>
                        {finished ? `${m.homeScore} × ${m.awayScore}` : 'vs'}
                      </span>
                      <span style={{ ...matchName, textAlign: 'right' }}>{m.awayTeam.name}</span>
                      <span style={{ fontSize: 18, flex: '0 0 auto' }}>{m.awayTeam.flag ?? '🏳️'}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {selected.size} jogo{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}
          {finishedCount === 0 && ' · nenhum jogo encerrado ainda'}
        </span>
        <button
          className="btn btn-gold"
          style={{ width: 'auto' }}
          disabled={busy || selected.size === 0}
          onClick={() => onConfirm([...selected])}
        >
          {busy ? '…' : actionLabel}
        </button>
      </div>
    </div>
  );
}

const matchName: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ---------------------------------------------------------------------------
// Classificar grupos (organizador)
// ---------------------------------------------------------------------------
function QualifySection({
  editionId,
  cup,
  matches,
  matchesPerRound,
  onDone,
}: {
  editionId: string;
  cup: BracketDoc;
  matches: Match[];
  matchesPerRound: number;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handle(matchIds: string[]) {
    setBusy(true);
    try {
      await qualifyGroups(editionId, matchIds);
      toast('Grupos classificados! Mata-mata sorteado.', 'ok');
      onDone();
    } catch {
      toast('Não foi possível classificar os grupos.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="sec">Encerrar fase de grupos</h2>
      <MatchPicker
        matches={matches}
        matchesPerRound={matchesPerRound}
        actionLabel="Classificar grupos"
        busy={busy}
        hint={`Escolha os jogos do período que valem para os grupos. Os pontos de cada participante nesses jogos definem quem se classifica (${cup.qualifiersPerGroup ?? 1} por grupo). Depois o mata-mata é sorteado entre os classificados.`}
        onConfirm={handle}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resolver rodadas do mata-mata (organizador)
// ---------------------------------------------------------------------------
function isRoundResolvable(round: KORound): boolean {
  return round.matches.some((m) => m.slotA?.userId && m.slotB?.userId && m.winnerId == null);
}

function ResolveRounds({
  editionId,
  cup,
  matches,
  matchesPerRound,
  onDone,
}: {
  editionId: string;
  cup: BracketDoc;
  matches: Match[];
  matchesPerRound: number;
  onDone: () => void;
}) {
  const [busyRound, setBusyRound] = useState<number | null>(null);

  const resolvable = cup.rounds
    .map((round, index) => ({ round, index }))
    .filter(({ round }) => isRoundResolvable(round));

  if (resolvable.length === 0) return null;

  async function handle(roundIndex: number, matchIds: string[]) {
    setBusyRound(roundIndex);
    try {
      await resolveCupRound(editionId, roundIndex, matchIds);
      toast('Rodada resolvida!', 'ok');
      onDone();
    } catch {
      toast('Não foi possível resolver a rodada.', 'err');
    } finally {
      setBusyRound(null);
    }
  }

  return (
    <div className="stack gap">
      {resolvable.map(({ round, index }) => (
        <div key={index} className="card">
          <h2 className="sec">Resolver — {round.stage}</h2>
          <MatchPicker
            matches={matches}
            matchesPerRound={matchesPerRound}
            actionLabel={`Resolver ${round.stage}`}
            busy={busyRound === index}
            hint="Escolha os jogos que decidem esta fase. Quem somar mais pontos neles avança; empate desempata pela posição na Liga."
            onConfirm={(ids) => handle(index, ids)}
          />
        </div>
      ))}
    </div>
  );
}
