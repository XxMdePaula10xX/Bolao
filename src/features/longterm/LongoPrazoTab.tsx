import { useCallback, useEffect, useState } from 'react';
import { setEditionStatus, listEditionMembers } from '@/services/editions';
import { listLongTerm } from '@/services/longterm';
import { getPayouts, saveGabarito } from '@/services/payouts';
import { toast } from '@/lib/toast';
import { initials } from '@/lib/format';
import type {
  Edition,
  EditionMember,
  EditionStatus,
  LongTermGabarito,
  LongTermPrediction,
} from '@/types';

// Os 4 mercados de longo prazo (chaves alinhadas com LongTermPrediction/Gabarito).
type MarketKey = 'championTeam' | 'topScorer' | 'assistLeader' | 'bestPlayer';
const MARKETS: { key: MarketKey; label: string; icon: string; placeholder: string }[] = [
  { key: 'championTeam', label: 'Campeão', icon: '🏆', placeholder: 'Ex: Brasil' },
  { key: 'topScorer', label: 'Artilheiro', icon: '⚽', placeholder: 'Nome do jogador' },
  { key: 'assistLeader', label: 'Garçom', icon: '🅰️', placeholder: 'Nome do jogador' },
  { key: 'bestPlayer', label: 'Melhor Jogador', icon: '⭐', placeholder: 'Nome do jogador' },
];

const STATUS_META: Record<EditionStatus, { label: string; badge: string; desc: string }> = {
  draft: {
    label: 'Rascunho',
    badge: 'badge-gray',
    desc: 'A edição ainda está sendo preparada. Abra a janela de Longo Prazo para os participantes registrarem seus palpites.',
  },
  longterm_open: {
    label: 'Longo Prazo aberto',
    badge: 'badge-purple',
    desc: 'Janela de Longo Prazo aberta: os participantes podem registrar e alterar seus 4 mercados. Ao iniciar a Copa, os palpites travam.',
  },
  running: {
    label: 'Copa em andamento',
    badge: 'badge-green',
    desc: 'A Copa começou e os palpites de Longo Prazo estão travados. Ao fim, cadastre o gabarito para apurar quem acertou.',
  },
  finished: {
    label: 'Encerrada',
    badge: 'badge-blue',
    desc: 'A edição foi encerrada. O gabarito abaixo define quem bateu cada mercado.',
  },
};

/** Compara palpite com o gabarito (mesma regra exata usada na premiação). */
type Mark = 'hit' | 'miss' | 'pending';
function markOf(guess: string | null | undefined, answer: string | null | undefined): Mark {
  if (answer == null || answer === '') return 'pending';
  return guess && guess === answer ? 'hit' : 'miss';
}

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
  edition: Edition;
}

export function LongoPrazoTab({ editionId, currentUserId, isOrganizer, edition }: Props) {
  const [status, setStatus] = useState<EditionStatus>(edition.status);
  const [members, setMembers] = useState<EditionMember[]>([]);
  const [predictions, setPredictions] = useState<LongTermPrediction[]>([]);
  const [gabarito, setGabarito] = useState<LongTermGabarito>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [changing, setChanging] = useState(false);
  const [savingGab, setSavingGab] = useState(false);

  // Rascunho do gabarito no formulário do organizador.
  const [gabForm, setGabForm] = useState<Record<MarketKey, string>>({
    championTeam: '',
    topScorer: '',
    assistLeader: '',
    bestPlayer: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [mem, preds, payouts] = await Promise.all([
        listEditionMembers(editionId),
        listLongTerm(editionId),
        getPayouts(editionId),
      ]);
      setMembers(mem);
      setPredictions(preds);
      const gab = payouts?.gabarito ?? {};
      setGabarito(gab);
      setGabForm({
        championTeam: gab.championTeam ?? '',
        topScorer: gab.topScorer ?? '',
        assistLeader: gab.assistLeader ?? '',
        bestPlayer: gab.bestPlayer ?? '',
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    setStatus(edition.status);
  }, [edition.status]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(next: EditionStatus) {
    if (next === 'running') {
      const ok = window.confirm(
        'Iniciar a Copa agora? Isso TRAVA definitivamente os palpites de Longo Prazo de todos os participantes.',
      );
      if (!ok) return;
    }
    setChanging(true);
    try {
      await setEditionStatus(editionId, next);
      setStatus(next);
      // Toast conforme a transição de status.
      const msg =
        next === 'longterm_open'
          ? 'Janela de Longo Prazo aberta!'
          : next === 'running'
            ? 'Copa iniciada — palpites travados.'
            : next === 'finished'
              ? 'Edição encerrada.'
              : 'Status atualizado.';
      toast(msg, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível atualizar o status.', 'err');
    } finally {
      setChanging(false);
    }
  }

  async function handleSaveGabarito() {
    setSavingGab(true);
    try {
      const payload: LongTermGabarito = {
        championTeam: gabForm.championTeam.trim() || null,
        topScorer: gabForm.topScorer.trim() || null,
        assistLeader: gabForm.assistLeader.trim() || null,
        bestPlayer: gabForm.bestPlayer.trim() || null,
      };
      await saveGabarito(editionId, payload);
      setGabarito(payload);
      toast('Gabarito salvo!', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível salvar o gabarito.', 'err');
    } finally {
      setSavingGab(false);
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (error) {
    return (
      <div className="card muted">
        Não foi possível carregar o Longo Prazo.{' '}
        <button className="btn btn-ghost" onClick={load} style={{ width: 'auto', marginTop: 10 }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const meta = STATUS_META[status];
  const predByUser = new Map(predictions.map((p) => [p.userId, p]));
  const gabaritoSet = MARKETS.some((m) => {
    const v = gabarito[m.key];
    return v != null && v !== '';
  });

  return (
    <div className="stack gap">
      {/* Ciclo da edição / status */}
      <div className="card" style={{ borderColor: 'var(--purple)' }}>
        <div className="row gap" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 className="sec" style={{ color: 'var(--purple-2)' }}>Longo Prazo</h2>
          <span className={`badge ${meta.badge}`}>{meta.label}</span>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          {meta.desc}
        </p>

        {isOrganizer && (
          <div className="row gap-sm" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              onClick={() => changeStatus('longterm_open')}
              disabled={changing || status !== 'draft'}
              style={{ width: 'auto' }}
            >
              Abrir janela de Longo Prazo
            </button>
            <button
              className="btn btn-gold"
              onClick={() => changeStatus('running')}
              disabled={changing || (status !== 'draft' && status !== 'longterm_open')}
              style={{ width: 'auto' }}
            >
              Iniciar a Copa
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                // Confirma só aqui; changeStatus apenas executa a transição.
                const ok = window.confirm(
                  'Encerrar a edição? Isso marca a Copa como finalizada. O gabarito e a premiação continuam editáveis.',
                );
                if (ok) changeStatus('finished');
              }}
              disabled={changing || status !== 'running'}
              style={{ width: 'auto' }}
            >
              Encerrar edição
            </button>
          </div>
        )}
      </div>

      {/* Gabarito (organizador) */}
      {isOrganizer && (
        <div className="card" style={{ borderColor: 'var(--gold)' }}>
          <h2 className="sec" style={{ color: 'var(--gold)' }}>Gabarito (respostas certas)</h2>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            Cadastre as respostas certas de cada mercado — geralmente ao fim da Copa. Quem bater o
            gabarito acerta o mercado. Campos em branco ficam pendentes.
          </p>
          <div style={{ marginTop: 12 }}>
            {MARKETS.map((m) => (
              <div key={m.key} className="field">
                <label>{m.icon} {m.label}</label>
                <input
                  type="text"
                  value={gabForm[m.key]}
                  placeholder={m.placeholder}
                  onChange={(e) => setGabForm((prev) => ({ ...prev, [m.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button
            className="btn btn-gold"
            onClick={handleSaveGabarito}
            disabled={savingGab}
            style={{ marginTop: 4 }}
          >
            {savingGab ? 'Salvando…' : 'Salvar gabarito'}
          </button>
        </div>
      )}

      {/* Palpites dos participantes */}
      <div className="stack gap-sm">
        <div className="row gap" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 className="sec">Palpites dos participantes</h2>
          <span className="badge badge-gray">{members.length} participante(s)</span>
        </div>

        {members.length === 0 && (
          <div className="card muted" style={{ fontSize: 14 }}>
            Ainda não há participantes nesta edição.
          </div>
        )}

        {members.map((mem) => {
          const isMe = mem.userId === currentUserId;
          const p = predByUser.get(mem.userId);
          return (
            <div
              key={mem.id}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                background: isMe ? 'rgba(244,196,48,.06)' : undefined,
                borderColor: isMe ? 'rgba(244,196,48,.3)' : undefined,
              }}
            >
              <div
                className="row gap"
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}
              >
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {initials(mem.nickname)}
                </div>
                <span style={{ fontWeight: 700 }}>
                  {mem.nickname}
                  {isMe && <span className="muted" style={{ fontWeight: 400 }}> (você)</span>}
                </span>
              </div>

              <div className="stack">
                {MARKETS.map((m) => {
                  const guess = p ? (p[m.key] ?? null) : null;
                  const mark = markOf(guess, gabarito[m.key]);
                  return (
                    <div
                      key={m.key}
                      className="row gap"
                      style={{
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--line-soft)',
                        gap: 10,
                      }}
                    >
                      <span className="muted" style={{ fontSize: 13, flex: '0 0 auto' }}>
                        {m.icon} {m.label}
                      </span>
                      <span
                        className="row gap-sm"
                        style={{ minWidth: 0, justifyContent: 'flex-end', flex: '1 1 auto' }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: guess ? 'var(--txt)' : 'var(--txt-2)',
                          }}
                        >
                          {guess || '—'}
                        </span>
                        <MarkIcon mark={mark} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!gabaritoSet && members.length > 0 && (
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            O gabarito ainda não foi cadastrado — por isso os mercados aparecem como pendentes (—).
          </p>
        )}
      </div>
    </div>
  );
}

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === 'hit') {
    return <span title="Acertou" style={{ color: 'var(--green)', flex: '0 0 auto' }}>✅</span>;
  }
  if (mark === 'miss') {
    return <span title="Errou" style={{ color: 'var(--red)', flex: '0 0 auto' }}>❌</span>;
  }
  return <span title="Gabarito pendente" className="muted" style={{ flex: '0 0 auto' }}>—</span>;
}
