import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCup, drawCup, drawCupKnockout, computeCupLive } from '@/services/cup';
import type { CupLive } from '@/services/cup';
import { listEditionMembers } from '@/services/editions';
import { listMatches } from '@/services/matches';
import { cupRoundCount, maxCupBlock } from '@/lib/competition';
import { toast } from '@/lib/toast';
import type { EditionMember, KOMatch, KORound } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

/** Nº de grupos e classificados (regra da fase de grupos: ceil(N/grupo) grupos). */
function groupsPreview(total: number, groupSize: number, per: number): { groups: number; qualified: number } {
  if (total <= 0 || groupSize <= 0) return { groups: 0, qualified: 0 };
  const groups = Math.ceil(total / groupSize);
  return { groups, qualified: groups * Math.max(1, per) };
}

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
}

export function CopaTab({ editionId, currentUserId, isOrganizer }: Props) {
  const [cupExists, setCupExists] = useState<boolean | null>(null); // null = carregando
  const [live, setLive] = useState<CupLive | null>(null);
  const [members, setMembers] = useState<EditionMember[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawingKO, setDrawingKO] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [cup, mem, mt] = await Promise.all([
        getCup(editionId),
        listEditionMembers(editionId),
        listMatches(editionId),
      ]);
      setMembers(mem);
      setTotalGames(mt.length);
      setCupExists(!!cup);
      if (cup) {
        setLive(await computeCupLive(editionId));
      } else {
        setLive(null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const nicknameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) map[m.userId] = m.nickname;
    return (userId: string) => map[userId] ?? 'Participante';
  }, [members]);

  async function handleDrawKnockout() {
    setDrawingKO(true);
    try {
      await drawCupKnockout(editionId);
      toast('Mata-mata sorteado! 🏆', 'ok');
      await load();
    } catch {
      toast('Não foi possível sortear o mata-mata. A fase de grupos já terminou?', 'err');
    } finally {
      setDrawingKO(false);
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
        Não foi possível carregar a Copa.{' '}
        <button className="btn btn-ghost" onClick={load} style={{ width: 'auto', marginTop: 10 }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  // --- Sem Copa sorteada ---
  if (!cupExists) {
    if (!isOrganizer) {
      return (
        <div className="card">
          <div className="row gap" style={{ justifyContent: 'space-between' }}>
            <h2 className="sec">Copa</h2>
            <span className="badge badge-gray">aguardando sorteio</span>
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            A Copa ainda não foi sorteada. Ela corre junto com a Liga, usando os mesmos jogos.
            Quando o organizador montar o chaveamento, ele aparece aqui.
          </p>
        </div>
      );
    }
    return (
      <CupSetup members={members} totalGames={totalGames} editionId={editionId} onDone={load} />
    );
  }

  // --- Com Copa: estado ao vivo ---
  if (!live) {
    return <div className="card muted">Copa indisponível.</div>;
  }

  const champions = live.championIds ?? [];

  return (
    <div className="stack gap">
      {champions.length > 0 && (
        <ChampionBanner championIds={champions} nicknameOf={nicknameOf} currentUserId={currentUserId} />
      )}

      {live.format === 'groups' && live.groups && live.groups.length > 0 && (
        <GroupsView live={live} currentUserId={currentUserId} />
      )}

      {live.format === 'groups' && !live.koDrawn && (
        <div className="card">
          {live.groupPhaseComplete ? (
            isOrganizer ? (
              <>
                <h2 className="sec">Fase de grupos encerrada</h2>
                <p className="muted" style={{ margin: '8px 0 14px', fontSize: 14, lineHeight: 1.6 }}>
                  Todos os jogos da fase de grupos terminaram. Sorteie o mata-mata entre os
                  classificados para começar as eliminatórias.
                </p>
                <button
                  className="btn btn-gold"
                  onClick={handleDrawKnockout}
                  disabled={drawingKO}
                  style={{ width: 'auto' }}
                >
                  {drawingKO ? 'Sorteando…' : 'Sortear mata-mata dos classificados'}
                </button>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                Fase de grupos encerrada. O mata-mata começa quando o organizador sortear os
                classificados.
              </p>
            )
          ) : (
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Fase de grupos em andamento. A classificação é atualizada automaticamente conforme
              os jogos terminam. Quando todos os jogos da fase de grupos acabarem, o mata-mata é
              sorteado entre os classificados.
            </p>
          )}
        </div>
      )}

      {(live.format === 'knockout' || live.koDrawn) && (
        <Bracket rounds={live.koRounds} nicknameOf={nicknameOf} currentUserId={currentUserId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuração inicial (organizador)
// ---------------------------------------------------------------------------
function CupSetup({
  members,
  totalGames,
  editionId,
  onDone,
}: {
  members: EditionMember[];
  totalGames: number;
  editionId: string;
  onDone: () => void;
}) {
  const [format, setFormat] = useState<'knockout' | 'groups'>('knockout');
  const [groupSize, setGroupSize] = useState(4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [blockChoice, setBlockChoice] = useState(2);
  const [busy, setBusy] = useState(false);

  const total = members.length;

  const rounds = useMemo(
    () =>
      cupRoundCount(
        format,
        total,
        format === 'groups' ? groupSize : undefined,
        format === 'groups' ? qualifiersPerGroup : undefined,
      ),
    [format, total, groupSize, qualifiersPerGroup],
  );
  const maxBlock = maxCupBlock(rounds, totalGames);
  const preview = groupsPreview(total, groupSize, qualifiersPerGroup);

  const enoughMembers = total >= 2;
  const groupsValid =
    format !== 'groups' || (groupSize >= 2 && qualifiersPerGroup >= 1 && qualifiersPerGroup < groupSize);
  const enoughGames = maxBlock >= 1;
  const feasible = enoughMembers && groupsValid && enoughGames;

  // Bloco efetivo (travado em [1, maxBlock]).
  const block = Math.max(1, Math.min(blockChoice, maxBlock || 1));
  const used = rounds * block;

  async function handleDraw() {
    if (!enoughMembers) {
      toast('São necessários ao menos 2 participantes.', 'err');
      return;
    }
    if (format === 'groups') {
      if (groupSize < 2) return toast('Cada grupo precisa de ao menos 2 participantes.', 'err');
      if (qualifiersPerGroup < 1 || qualifiersPerGroup >= groupSize) {
        return toast('Classificados por grupo deve ser entre 1 e o tamanho do grupo − 1.', 'err');
      }
    }
    if (!enoughGames) {
      toast('Jogos insuficientes para montar a Copa.', 'err');
      return;
    }
    if (!window.confirm('Sortear a Copa fixa o chaveamento e não deve ser refeito. Continuar?')) {
      return;
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
        block,
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
        A Copa corre <b style={{ color: 'var(--txt)' }}>junto com a Liga</b>, usando os mesmos
        jogos (em ordem). Cada confronto soma os pontos de um{' '}
        <b style={{ color: 'var(--txt)' }}>bloco de jogos</b> consecutivos: quem fizer mais pontos
        avança. {total} participante{total === 1 ? '' : 's'}.
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
            <NumField label="Participantes por grupo" value={groupSize} min={2} onChange={setGroupSize} />
            <NumField
              label="Classificam por grupo"
              value={qualifiersPerGroup}
              min={1}
              onChange={setQualifiersPerGroup}
            />
          </div>
          <div className="card" style={{ background: 'var(--bg-elev)', padding: 12, marginBottom: 14 }}>
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

      {/* Resumo de blocos */}
      <div className="card" style={{ background: 'var(--bg-elev)', marginTop: 4 }}>
        <div className="stack gap-sm" style={{ fontSize: 14 }}>
          <Info label="Confrontos (rodadas)" value={rounds ? `${rounds}` : '—'} />
          <Info label="Jogos cadastrados" value={`${totalGames}`} />
          <Info label="Bloco máximo por confronto" value={enoughGames ? `${maxBlock} jogos` : '—'} highlight />
        </div>
      </div>

      {!enoughMembers && (
        <p className="muted" style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          São necessários ao menos 2 participantes.
        </p>
      )}
      {enoughMembers && groupsValid && !enoughGames && (
        <p className="muted" style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          Jogos insuficientes: a Copa tem {rounds} confronto{rounds === 1 ? '' : 's'}, então é
          preciso cadastrar ao menos {rounds} jogo{rounds === 1 ? '' : 's'} (1 por confronto). Há{' '}
          {totalGames}. Cadastre mais jogos na aba Admin.
        </p>
      )}

      {feasible && (
        <>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Jogos por confronto (bloco)</label>
            <input
              type="number"
              min={1}
              max={maxBlock}
              value={block}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value) || 1);
                setBlockChoice(Math.max(1, Math.min(v, maxBlock)));
              }}
            />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
              Entre 1 e {maxBlock}. Serão usados {rounds} × {block} ={' '}
              <b style={{ color: 'var(--txt)' }}>{used}</b> jogos nos confrontos
              {totalGames - used > 0 && ` (os ${totalGames - used} últimos ficam fora da Copa)`}.
            </p>
          </div>
          <button className="btn btn-gold" disabled={busy} onClick={handleDraw} style={{ marginTop: 4 }}>
            {busy ? 'Sorteando…' : 'Sortear Copa'}
          </button>
        </>
      )}
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
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
        {desc}
      </div>
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
      <span style={{ display: 'block', color: 'var(--txt-2)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
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

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="row gap" style={{ justifyContent: 'space-between' }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 700, color: highlight ? 'var(--gold)' : 'var(--txt)' }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner de campeão / co-campeões
// ---------------------------------------------------------------------------
function ChampionBanner({
  championIds,
  nicknameOf,
  currentUserId,
}: {
  championIds: string[];
  nicknameOf: (id: string) => string;
  currentUserId: string;
}) {
  const co = championIds.length > 1;
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
        {championIds.map((id) => nicknameOf(id)).join('  &  ')}
        {championIds.includes(currentUserId) && (
          <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> (você)</span>
        )}
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
// Fase de grupos — classificação ao vivo
// ---------------------------------------------------------------------------
function GroupsView({ live, currentUserId }: { live: CupLive; currentUserId: string }) {
  if (!live.groups) return null;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
        <div className="row gap" style={{ justifyContent: 'space-between' }}>
          <h2 className="sec">Fase de grupos</h2>
          <span className={`badge ${live.groupPhaseComplete ? 'badge-green' : 'badge-blue'}`}>
            {live.groupPhaseComplete ? 'encerrada' : 'ao vivo'}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Classificação pela soma dos pontos na fase de grupos. Empate desempata pela posição na
          Liga.
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          padding: 16,
        }}
      >
        {live.groups.map((g) => (
          <div
            key={g.name}
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <div className="disp" style={{ fontSize: 14, fontWeight: 700, padding: '10px 12px', borderBottom: '1px solid var(--line-soft)' }}>
              {g.name}
            </div>
            <div className="stack">
              {g.standings.map((s) => {
                const me = s.userId === currentUserId;
                return (
                  <div
                    key={s.userId}
                    className="row gap-sm"
                    style={{
                      padding: '8px 12px',
                      gap: 8,
                      borderTop: '1px solid var(--line-soft)',
                      background: me ? 'rgba(244,196,48,.08)' : s.qualified ? 'rgba(0,214,143,.06)' : 'transparent',
                    }}
                  >
                    <span
                      className="tnum muted"
                      style={{ flex: '0 0 18px', fontSize: 12, textAlign: 'center', fontWeight: 700 }}
                    >
                      {s.position}
                    </span>
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: 9, flex: '0 0 auto' }}>
                      {initials(s.nickname)}
                    </div>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        fontWeight: s.qualified ? 700 : 600,
                        color: s.qualified ? 'var(--green)' : 'var(--txt)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.qualified && '✔ '}
                      {s.nickname}
                      {me && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
                    </span>
                    <span className="tnum" style={{ flex: '0 0 auto', fontSize: 13, fontWeight: 700, color: 'var(--txt-2)' }}>
                      {s.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chaveamento (bracket) — colunas roláveis
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
    return (
      <div className="card muted" style={{ fontSize: 14 }}>
        Chaveamento ainda não definido.
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
        <h2 className="sec">Chaveamento</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Atualizado automaticamente conforme os jogos de cada bloco terminam.
        </p>
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
                  <BracketMatch
                    key={m.id}
                    match={m}
                    nicknameOf={nicknameOf}
                    currentUserId={currentUserId}
                    isFinal={ri === rounds.length - 1}
                  />
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
      {match.pointsEqual && !co && (
        <div
          className="badge badge-blue"
          style={{ margin: '6px 8px', fontSize: 10 }}
          title="Desempate pela posição na Liga"
        >
          desempate
        </div>
      )}
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
  const name = slot ? slot.nickname ?? nicknameOf(slot.userId) : bye ? 'Folga' : 'A definir';
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
        <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-2)', flex: '0 0 auto' }}>
          {points}
        </span>
      )}
    </div>
  );
}
