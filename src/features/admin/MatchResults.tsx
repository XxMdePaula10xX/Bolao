import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { subscribeMatches, setMatchResult } from '@/services/matches';
import { toast } from '@/lib/toast';
import type { Match, MatchStatus, FireDate } from '@/types';

/** Converte um FireDate (Timestamp | number | null) em milissegundos. */
function toMillis(value: FireDate): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toMillis();
}

/** Formata data/hora em pt-BR (ex.: "18/06, 16:00"). */
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

const STATUS_META: Record<MatchStatus, { label: string; badge: string }> = {
  scheduled: { label: 'Agendado', badge: 'badge-gray' },
  live: { label: 'Ao vivo', badge: 'badge-blue' },
  finished: { label: 'Encerrado', badge: 'badge-green' },
  postponed: { label: 'Adiado', badge: 'badge-red' },
  canceled: { label: 'Cancelado', badge: 'badge-red' },
};

interface Draft {
  home: string;
  away: string;
  pens: boolean;
  penWinner: string;
}

function draftFromMatch(m: Match): Draft {
  return {
    home: m.homeScore == null ? '' : String(m.homeScore),
    away: m.awayScore == null ? '' : String(m.awayScore),
    pens: m.decidedByPenalties ?? false,
    penWinner: m.penaltyWinnerTeamId ?? '',
  };
}

interface MatchResultsProps {
  editionId: string;
}

/** Lançamento de placares e encerramento de jogos (dispara pontuação). */
export function MatchResults({ editionId }: MatchResultsProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeMatches(
      editionId,
      (m) => {
        setMatches(m);
        // Semeia rascunhos apenas para jogos ainda não editados neste cliente.
        setDrafts((prev) => {
          const next = { ...prev };
          for (const match of m) {
            if (!(match.id in next)) next[match.id] = draftFromMatch(match);
          }
          return next;
        });
        setLoading(false);
      },
      (err) => {
        toast(err.message || 'Erro ao carregar jogos', 'err');
        setLoading(false);
      },
    );
    return unsub;
  }, [editionId]);

  function getDraft(m: Match): Draft {
    return drafts[m.id] ?? draftFromMatch(m);
  }

  function setField(matchId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? { home: '', away: '', pens: false, penWinner: '' }), ...patch },
    }));
  }

  function buildResult(m: Match): { homeScore: number; awayScore: number; decidedByPenalties: boolean; penaltyWinnerTeamId: string | null } | null {
    const d = getDraft(m);
    if (d.home === '' || d.away === '') {
      toast('Preencha o placar dos dois times', 'err');
      return null;
    }
    const homeScore = Math.max(0, Math.trunc(Number(d.home)));
    const awayScore = Math.max(0, Math.trunc(Number(d.away)));
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      toast('Placar inválido', 'err');
      return null;
    }
    const decidedByPenalties = m.isKnockout && d.pens;
    if (decidedByPenalties && !d.penWinner) {
      toast('Selecione quem passou nos pênaltis', 'err');
      return null;
    }
    return {
      homeScore,
      awayScore,
      decidedByPenalties,
      penaltyWinnerTeamId: decidedByPenalties ? d.penWinner : null,
    };
  }

  async function handleSave(m: Match, finished: boolean) {
    const r = buildResult(m);
    if (!r) return;
    setBusyId(m.id);
    try {
      await setMatchResult(m.id, r, finished);
      toast(finished ? 'Jogo encerrado! Pontuação em cálculo.' : 'Placar salvo', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar placar', 'err');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="card">
        <h2 className="sec">Sem jogos ainda</h2>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          Adicione jogos acima para poder lançar os placares.
        </p>
      </div>
    );
  }

  return (
    <div className="stack gap">
      {matches.map((m) => {
        const d = getDraft(m);
        const meta = STATUS_META[m.status];
        const busy = busyId === m.id;
        const finished = m.status === 'finished';
        return (
          <div key={m.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {formatDate(m.startTime)}
                {m.stage ? ` · ${m.stage}` : ''}
                {m.round != null ? ` · rod. ${m.round}` : ''}
              </span>
              <div className="row gap-sm">
                {m.isKnockout && <span className="badge badge-purple">mata-mata</span>}
                <span className={`badge ${meta.badge}`}>{meta.label}</span>
              </div>
            </div>

            {/* Confronto + inputs de placar */}
            <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
              <div className="row gap-sm" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 22 }}>{m.homeTeam.flag ?? '🏳️'}</span>
                <span style={ellipsis}>{m.homeTeam.name}</span>
              </div>

              <div className="row gap-sm" style={{ flex: '0 0 auto' }}>
                <input
                  aria-label={`Gols ${m.homeTeam.name}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={d.home}
                  onChange={(e) => setField(m.id, { home: e.target.value })}
                  className="tnum"
                  style={scoreInputStyle}
                />
                <span className="muted" style={{ fontWeight: 700 }}>×</span>
                <input
                  aria-label={`Gols ${m.awayTeam.name}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={d.away}
                  onChange={(e) => setField(m.id, { away: e.target.value })}
                  className="tnum"
                  style={scoreInputStyle}
                />
              </div>

              <div className="row gap-sm" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                <span style={{ ...ellipsis, textAlign: 'right' }}>{m.awayTeam.name}</span>
                <span style={{ fontSize: 22 }}>{m.awayTeam.flag ?? '🏳️'}</span>
              </div>
            </div>

            {/* Pênaltis (só mata-mata) */}
            {m.isKnockout && (
              <div style={{ marginTop: 12 }}>
                <label
                  className="row gap-sm"
                  style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  <input
                    type="checkbox"
                    checked={d.pens}
                    onChange={(e) => setField(m.id, { pens: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: 'var(--purple)' }}
                  />
                  <span>Foi para os pênaltis</span>
                </label>

                {d.pens && (
                  <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label>Quem passou nos pênaltis?</label>
                    <select
                      value={d.penWinner}
                      onChange={(e) => setField(m.id, { penWinner: e.target.value })}
                    >
                      <option value="">Selecione a seleção</option>
                      <option value={m.homeTeam.id}>
                        {m.homeTeam.flag ?? ''} {m.homeTeam.name}
                      </option>
                      <option value={m.awayTeam.id}>
                        {m.awayTeam.flag ?? ''} {m.awayTeam.name}
                      </option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="row gap-sm" style={{ marginTop: 14 }}>
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => handleSave(m, false)}
                style={{ flex: 1 }}
              >
                Salvar placar
              </button>
              <button
                className="btn btn-green"
                disabled={busy}
                onClick={() => handleSave(m, true)}
                style={{ flex: 1 }}
              >
                {busy ? '...' : finished ? 'Reencerrar' : 'Encerrar'}
              </button>
            </div>

            {finished && (
              <p className="muted center" style={{ fontSize: 12, marginTop: 8 }}>
                Encerrado — pontuação calculada na nuvem.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ellipsis: CSSProperties = {
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const scoreInputStyle: CSSProperties = {
  width: 56,
  textAlign: 'center',
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 6px',
  color: 'var(--txt)',
  fontSize: 18,
  fontWeight: 700,
};
