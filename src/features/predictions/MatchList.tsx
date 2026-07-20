import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { subscribeMatches } from '@/services/matches';
import { listUserPredictions, submitPredictions } from '@/services/predictions';
import type { Match, Prediction } from '@/types';
import { toast } from '@/lib/toast';
import { fireToMillis, formatDateTime } from '@/lib/date';

/** Um jogo aceita palpite enquanto está 'scheduled' e ainda não começou. */
function isLocked(match: Match, now: number): boolean {
  if (match.status !== 'scheduled') return true;
  return fireToMillis(match.startTime) <= now;
}

interface Draft {
  home: string;
  away: string;
  pen: string | null;
}

interface MatchListProps {
  editionId: string;
  uid: string;
}

export function MatchList({ editionId, uid }: MatchListProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Assina os jogos em tempo real.
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeMatches(
      editionId,
      (m) => {
        setMatches(m);
        setLoading(false);
      },
      (err) => {
        toast(err.message || 'Erro ao carregar jogos', 'err');
        setLoading(false);
      },
    );
    return unsub;
  }, [editionId]);

  // Pré-preenche os rascunhos a partir dos palpites já salvos.
  useEffect(() => {
    let alive = true;
    listUserPredictions(editionId, uid)
      .then((preds: Prediction[]) => {
        if (!alive) return;
        const next: Record<string, Draft> = {};
        for (const p of preds) {
          next[p.matchId] = {
            home: String(p.predictedHome),
            away: String(p.predictedAway),
            pen: p.predictedPenaltyWinner ?? null,
          };
        }
        setDrafts((prev) => ({ ...next, ...prev }));
      })
      .catch((e: unknown) => {
        toast(e instanceof Error ? e.message : 'Erro ao carregar palpites', 'err');
      });
    return () => {
      alive = false;
    };
  }, [editionId, uid]);

  const now = Date.now();

  function getDraft(matchId: string): Draft {
    return drafts[matchId] ?? { home: '', away: '', pen: null };
  }

  function setField(matchId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [matchId]: { ...getDraft(matchId), ...patch },
    }));
  }

  // Quantos jogos abertos ainda estão sem palpite completo.
  const missing = useMemo(() => {
    let count = 0;
    for (const m of matches) {
      if (isLocked(m, now)) continue;
      const d = drafts[m.id];
      const filled = d && d.home !== '' && d.away !== '';
      if (!filled) count++;
    }
    return count;
  }, [matches, drafts, now]);

  const openCount = useMemo(
    () => matches.filter((m) => !isLocked(m, now)).length,
    [matches, now],
  );

  async function handleSave() {
    const matchesById: Record<string, Match> = {};
    for (const m of matches) matchesById[m.id] = m;

    const payload = matches
      .filter((m) => !isLocked(m, now))
      .map((m) => {
        const d = getDraft(m.id);
        return { match: m, d };
      })
      .filter(({ d }) => d.home !== '' && d.away !== '')
      .map(({ match, d }) => ({
        matchId: match.id,
        predictedHome: Math.max(0, Math.trunc(Number(d.home))),
        predictedAway: Math.max(0, Math.trunc(Number(d.away))),
        predictedPenaltyWinner: match.isKnockout ? d.pen ?? null : null,
      }));

    if (payload.length === 0) {
      toast('Nenhum palpite para salvar', 'err');
      return;
    }

    setSaving(true);
    try {
      const { saved, skipped } = await submitPredictions(editionId, uid, payload, matchesById);
      if (saved > 0) {
        toast(
          skipped > 0
            ? `${saved} palpite(s) salvo(s), ${skipped} ignorado(s)`
            : `${saved} palpite(s) salvo(s)`,
          'ok',
        );
      } else {
        toast('Nenhum palpite salvo (jogos fechados)', 'err');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar palpites', 'err');
    } finally {
      setSaving(false);
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
          O organizador ainda não cadastrou os jogos desta Copa. Assim que os confrontos
          entrarem, eles aparecem aqui para você palpitar.
        </p>
      </div>
    );
  }

  return (
    <div className="stack gap">
      {/* Indicador de palpites faltando */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'linear-gradient(135deg, var(--panel), var(--bg-elev))',
        }}
      >
        <div>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>
            {missing > 0 ? `${missing} palpite(s) faltando` : 'Tudo palpitado!'}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {openCount} jogo(s) aberto(s) para palpite
          </div>
        </div>
        <span className={`badge ${missing > 0 ? 'badge-red' : 'badge-green'}`}>
          {missing > 0 ? 'pendente' : 'em dia'}
        </span>
      </div>

      {matches.map((m) => {
        const locked = isLocked(m, now);
        const d = getDraft(m.id);
        const hasResult = m.homeScore != null && m.awayScore != null;
        return (
          <div key={m.id} className="card">
            <div
              className="row"
              style={{ justifyContent: 'space-between', gap: 8, marginBottom: 12 }}
            >
              <span className="muted" style={{ fontSize: 12 }}>
                {formatDateTime(m.startTime)}
                {m.stage ? ` · ${m.stage}` : ''}
              </span>
              <div className="row gap-sm">
                {m.isKnockout && <span className="badge badge-purple">mata-mata</span>}
                {locked && <span className="badge badge-gray">Fechado</span>}
              </div>
            </div>

            {/* Linha do confronto + inputs de placar */}
            <div
              className="row"
              style={{ justifyContent: 'space-between', gap: 10 }}
            >
              <div className="row gap-sm" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 22 }}>{m.homeTeam.flag ?? '🏳️'}</span>
                <span
                  style={{
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.homeTeam.name}
                </span>
              </div>

              <div className="row gap-sm" style={{ flex: '0 0 auto' }}>
                <input
                  aria-label={`Gols ${m.homeTeam.name}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  disabled={locked}
                  value={d.home}
                  onChange={(e) => setField(m.id, { home: e.target.value })}
                  className="tnum"
                  style={scoreInputStyle}
                />
                <span className="muted" style={{ fontWeight: 700 }}>
                  ×
                </span>
                <input
                  aria-label={`Gols ${m.awayTeam.name}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  disabled={locked}
                  value={d.away}
                  onChange={(e) => setField(m.id, { away: e.target.value })}
                  className="tnum"
                  style={scoreInputStyle}
                />
              </div>

              <div
                className="row gap-sm"
                style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                >
                  {m.awayTeam.name}
                </span>
                <span style={{ fontSize: 22 }}>{m.awayTeam.flag ?? '🏳️'}</span>
              </div>
            </div>

            {/* Placar real, se já houver */}
            {hasResult && (
              <div
                className="row gap-sm"
                style={{ marginTop: 10, justifyContent: 'center' }}
              >
                <span className="badge badge-green">
                  Placar real: {m.homeScore} × {m.awayScore}
                </span>
                {m.decidedByPenalties && (
                  <span className="badge badge-purple">nos pênaltis</span>
                )}
              </div>
            )}

            {/* Seletor de quem passa nos pênaltis (mata-mata) */}
            {m.isKnockout && (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>Quem passa nos pênaltis?</label>
                <select
                  disabled={locked}
                  value={d.pen ?? ''}
                  onChange={(e) =>
                    setField(m.id, { pen: e.target.value === '' ? null : e.target.value })
                  }
                >
                  <option value="">Sem palpite</option>
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
        );
      })}

      <button className="btn btn-gold" disabled={saving} onClick={handleSave}>
        {saving ? 'Salvando...' : 'Salvar palpites'}
      </button>
    </div>
  );
}

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
