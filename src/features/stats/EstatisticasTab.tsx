import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getStats } from '@/services/stats';
import { getTitleChances } from '@/services/montecarlo';
import { drawGenericList } from '@/lib/artes';
import { ShareImageButton } from '@/components/ShareImageButton';
import type { StatRow } from '@/types';

type StatsResult = Awaited<ReturnType<typeof getStats>>;
type Chance = Awaited<ReturnType<typeof getTitleChances>>[number];

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

function medal(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return String(pos);
}

/** Definição visual de cada estatística. */
interface StatDef {
  key: keyof StatsResult;
  title: string;
  emoji: string;
  desc: string;
  /** Formata o valor bruto para exibição (ex.: "12" ou "83%"). */
  fmt: (v: number) => string;
}

const STAT_DEFS: StatDef[] = [
  {
    key: 'reiCravada',
    title: 'Rei da Cravada',
    emoji: '🎯',
    desc: 'Mais placares exatos na temporada.',
    fmt: (v) => `${v}`,
  },
  {
    key: 'bomPalpite',
    title: 'Bom de Palpite',
    emoji: '🧠',
    desc: 'Mais acertos de vencedor sem cravar o placar.',
    fmt: (v) => `${v}`,
  },
  {
    key: 'regularidade',
    title: 'Regularidade',
    emoji: '📈',
    desc: '% dos jogos palpitados em que pontuou.',
    fmt: (v) => `${v}%`,
  },
  {
    key: 'melhorBloco',
    title: 'Melhor Bloco',
    emoji: '🔥',
    desc: 'Maior pontuação somada num bloco de jogos.',
    fmt: (v) => `${v}`,
  },
  {
    key: 'sacoDePontos',
    title: 'Saco de Pontos',
    emoji: '💰',
    desc: 'Mais pontos-pró somados nos confrontos da Liga.',
    fmt: (v) => `${v}`,
  },
];

interface Props {
  editionId: string;
  currentUserId?: string;
}

export function EstatisticasTab({ editionId, currentUserId }: Props) {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [chances, setChances] = useState<Chance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [s, c] = await Promise.all([getStats(editionId), getTitleChances(editionId)]);
      setStats(s);
      setChances(c);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setChances(null);
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !stats || !chances) {
    return (
      <div className="card muted">
        Não foi possível carregar as estatísticas.{' '}
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

  // Arte compartilhável do Rei da Cravada (top 10, só quem cravou algo).
  const reiTop = stats.reiCravada.filter((r) => r.value > 0).slice(0, 10);
  const makeReiCanvas = () =>
    drawGenericList(
      'Rei da Cravada',
      reiTop.map((r, i) => ({
        label: `${medal(i + 1)}  ${r.nickname ?? 'Participante'}`,
        value: `${r.value} exatos`,
      })),
    );

  return (
    <div className="stack gap-lg">
      {/* Estatísticas */}
      <div className="stack gap">
        {STAT_DEFS.map((def) => (
          <StatCard
            key={def.key}
            def={def}
            rows={stats[def.key]}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {/* Compartilhar Rei da Cravada */}
      {reiTop.length > 0 && (
        <div>
          <ShareImageButton
            makeCanvas={makeReiCanvas}
            filename="rei-da-cravada.png"
            label="Compartilhar Rei da Cravada"
          />
        </div>
      )}

      {/* Chances de título */}
      <ChancesSection chances={chances} currentUserId={currentUserId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de uma estatística: pódio (top 3) + destaque do usuário atual.
// ---------------------------------------------------------------------------
function StatCard({
  def,
  rows,
  currentUserId,
}: {
  def: StatDef;
  rows: StatRow[];
  currentUserId?: string;
}) {
  const ranked = rows.filter((r) => r.value > 0);
  const podium = ranked.slice(0, 3);

  const myIndex = rows.findIndex((r) => r.userId === currentUserId);
  const inPodium = podium.some((r) => r.userId === currentUserId);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;
  const showMine = !!currentUserId && myRow != null && !inPodium;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={headStyle}>
        <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
          {def.emoji}
        </span>
        <div className="stack" style={{ minWidth: 0 }}>
          <span className="disp" style={{ fontSize: 15, fontWeight: 700 }}>
            {def.title}
          </span>
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
            {def.desc}
          </span>
        </div>
      </div>

      {podium.length === 0 ? (
        <div className="muted" style={{ padding: '14px 16px', fontSize: 14 }}>
          Ainda sem dados suficientes.
        </div>
      ) : (
        <div className="stack">
          {podium.map((r, i) => (
            <PodiumRow
              key={r.userId}
              pos={i + 1}
              row={r}
              value={def.fmt(r.value)}
              isMe={r.userId === currentUserId}
            />
          ))}
        </div>
      )}

      {showMine && myRow && (
        <PodiumRow
          pos={myIndex + 1}
          row={myRow}
          value={def.fmt(myRow.value)}
          isMe
          divider
        />
      )}
    </div>
  );
}

function PodiumRow({
  pos,
  row,
  value,
  isMe,
  divider,
}: {
  pos: number;
  row: StatRow;
  value: string;
  isMe: boolean;
  divider?: boolean;
}) {
  const name = row.nickname ?? 'Participante';
  return (
    <div
      className="row gap"
      style={{
        justifyContent: 'space-between',
        padding: '11px 16px',
        borderTop: divider ? '2px solid var(--line)' : '1px solid var(--line-soft)',
        background: isMe ? 'rgba(244,196,48,.1)' : 'transparent',
      }}
    >
      <div className="row gap-sm" style={{ minWidth: 0, flex: 1 }}>
        <span
          className="disp tnum center"
          style={{ flex: '0 0 30px', fontSize: pos <= 3 ? 18 : 14 }}
        >
          {medal(pos)}
        </span>
        <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
          {initials(name)}
        </div>
        <span
          style={{
            fontWeight: 700,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
          {isMe && (
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}
              (você)
            </span>
          )}
        </span>
      </div>
      <span
        className="disp tnum"
        style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', flex: '0 0 auto' }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chances de título (Monte Carlo).
// ---------------------------------------------------------------------------
function ChancesSection({
  chances,
  currentUserId,
}: {
  chances: Chance[];
  currentUserId?: string;
}) {
  const withChance = chances.filter((c) => c.prob > 0);
  const top = (withChance.length > 0 ? withChance : chances).slice(0, 8);
  const max = top.reduce((m, c) => Math.max(m, c.prob), 0);

  return (
    <div className="card">
      <div className="row gap" style={{ justifyContent: 'space-between' }}>
        <h2 className="sec">Chances de título</h2>
        <span className="badge badge-purple">simulação</span>
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
        Estimativa por Monte Carlo: sorteamos os jogos que faltam a partir do
        histórico de pontos de cada um e medimos com que frequência terminam em
        1º no Ranking Geral. É uma projeção, não uma garantia.
      </p>

      {top.length === 0 || max === 0 ? (
        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          Sem jogos suficientes para simular as chances.
        </p>
      ) : (
        <div className="stack gap-sm" style={{ marginTop: 14 }}>
          {top.map((c) => {
            const pct = c.prob * 100;
            const width = max > 0 ? (c.prob / max) * 100 : 0;
            const isMe = c.userId === currentUserId;
            const label = pct >= 1 ? Math.round(pct) : pct.toFixed(1);
            return (
              <div key={c.userId} className="stack" style={{ gap: 5 }}>
                <div className="row gap" style={{ justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.nickname || 'Participante'}
                    {isMe && (
                      <span className="muted" style={{ fontWeight: 400 }}>
                        {' '}
                        (você)
                      </span>
                    )}
                  </span>
                  <span
                    className="disp tnum"
                    style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}
                  >
                    {label}%
                  </span>
                </div>
                <div style={barTrack}>
                  <div
                    style={{
                      ...barFill,
                      width: `${Math.max(width, 2)}%`,
                      background: isMe
                        ? 'linear-gradient(90deg, var(--gold), var(--gold-2))'
                        : 'linear-gradient(90deg, var(--purple), var(--purple-2))',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderBottom: '1px solid var(--line)',
};

const barTrack: CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  overflow: 'hidden',
};

const barFill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  transition: 'width .3s ease',
};

export default EstatisticasTab;
