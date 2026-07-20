import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  getPayouts,
  saveContributions,
  saveGabarito,
  computePayoutsLive,
} from '@/services/payouts';
import { drawPayoutArt } from '@/lib/artes';
import { ShareImageButton } from '@/components/ShareImageButton';
import { toast } from '@/lib/toast';
import type { Edition, EditionMember, LongTermGabarito, UserPayout } from '@/types';

type LiveResult = Awaited<ReturnType<typeof computePayoutsLive>>;

/** Formata um valor em reais com 2 casas (pt-BR). */
function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
  edition: Edition;
}

interface GabaritoForm {
  championTeam: string;
  topScorer: string;
  assistLeader: string;
  bestPlayer: string;
}

const EMPTY_GABARITO: GabaritoForm = {
  championTeam: '',
  topScorer: '',
  assistLeader: '',
  bestPlayer: '',
};

const GABARITO_FIELDS: { key: keyof GabaritoForm; label: string; placeholder: string }[] = [
  { key: 'championTeam', label: 'Campeão da Copa', placeholder: 'Ex: Brasil' },
  { key: 'topScorer', label: 'Artilheiro', placeholder: 'Nome do jogador' },
  { key: 'assistLeader', label: 'Garçom (assistências)', placeholder: 'Nome do jogador' },
  { key: 'bestPlayer', label: 'Melhor Jogador', placeholder: 'Nome do jogador' },
];

export function PremiacaoTab({ editionId, currentUserId, isOrganizer, edition }: Props) {
  const [members, setMembers] = useState<EditionMember[]>([]);
  const [result, setResult] = useState<LiveResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Estado editável do organizador (contribuições em texto e gabarito).
  const [contribDraft, setContribDraft] = useState<Record<string, string>>({});
  const [gabaritoDraft, setGabaritoDraft] = useState<GabaritoForm>(EMPTY_GABARITO);
  const [savingContrib, setSavingContrib] = useState(false);
  const [savingGabarito, setSavingGabarito] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [payouts, live] = await Promise.all([
        getPayouts(editionId),
        computePayoutsLive(editionId),
      ]);
      setResult(live);
      setMembers(live.members);

      const contribs = payouts?.contributions ?? {};
      const draft: Record<string, string> = {};
      for (const m of live.members) {
        const v = contribs[m.userId];
        draft[m.userId] = v != null ? String(v) : '';
      }
      setContribDraft(draft);

      const g = payouts?.gabarito;
      setGabaritoDraft({
        championTeam: g?.championTeam ?? '',
        topScorer: g?.topScorer ?? '',
        assistLeader: g?.assistLeader ?? '',
        bestPlayer: g?.bestPlayer ?? '',
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    setResult(null);
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function handleSaveContributions() {
    setSavingContrib(true);
    try {
      const contributions: Record<string, number> = {};
      for (const m of members) {
        const raw = (contribDraft[m.userId] ?? '').replace(',', '.').trim();
        const n = raw === '' ? 0 : Number(raw);
        contributions[m.userId] = Number.isFinite(n) && n > 0 ? n : 0;
      }
      await saveContributions(editionId, contributions);
      toast('Contribuições salvas.', 'ok');
      await load();
    } catch {
      toast('Não foi possível salvar as contribuições.', 'err');
    } finally {
      setSavingContrib(false);
    }
  }

  async function handleSaveGabarito() {
    setSavingGabarito(true);
    try {
      const gabarito: LongTermGabarito = {
        championTeam: gabaritoDraft.championTeam.trim() || null,
        topScorer: gabaritoDraft.topScorer.trim() || null,
        assistLeader: gabaritoDraft.assistLeader.trim() || null,
        bestPlayer: gabaritoDraft.bestPlayer.trim() || null,
      };
      await saveGabarito(editionId, gabarito);
      toast('Gabarito salvo. Prêmios recalculados.', 'ok');
      await load();
    } catch {
      toast('Não foi possível salvar o gabarito.', 'err');
    } finally {
      setSavingGabarito(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="card muted">
        Não foi possível carregar a premiação.{' '}
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

  // Linhas: TODOS os membros (inclui quem recebe R$0), ordenados por valor desc.
  const rows: { member: EditionMember; payout: UserPayout | undefined }[] = members
    .map((member) => ({ member, payout: result.byUser[member.userId] }))
    .sort(
      (a, b) =>
        (b.payout?.total ?? 0) - (a.payout?.total ?? 0) ||
        a.member.nickname.localeCompare(b.member.nickname),
    );

  const winners = rows.filter((r) => (r.payout?.total ?? 0) > 0);

  const makePayoutCanvas = () =>
    drawPayoutArt(
      winners.map((r) => ({
        nickname: r.member.nickname,
        total: r.payout?.total ?? 0,
      })),
      `Premiação — ${edition.name}`,
    );

  return (
    <div className="stack gap-lg">
      {/* Cabeçalho / explicação */}
      <div className="card">
        <div className="row gap" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 className="sec">Premiação</h2>
          <span className="badge badge-gold">rateio</span>
        </div>
        <p className="muted" style={intro}>
          Aqui você vê <b style={{ color: 'var(--gold)' }}>quanto cada participante recebe</b> e
          de onde vem cada valor (Ranking, Liga, Copa e Longo Prazo). O app apenas calcula o
          rateio — <b>não movimenta dinheiro</b>. Mercados de Longo Prazo sem acertador têm o
          valor redividido entre os que tiveram acertador.
        </p>
        <p className="muted" style={{ ...intro, marginTop: 10 }}>
          A <b style={{ color: 'var(--purple-2)' }}>Consolação</b> é simbólica: vale a honra,
          mas fica <b>fora do dinheiro</b>.
        </p>
      </div>

      {/* Totais */}
      <div className="row gap" style={{ flexWrap: 'wrap' }}>
        <div className="card" style={totalCard}>
          <span className="muted" style={totalLabel}>
            Total arrecadado
          </span>
          <span className="disp tnum" style={{ ...totalValue, color: 'var(--gold)' }}>
            {brl(result.pool)}
          </span>
        </div>
        <div className="card" style={totalCard}>
          <span className="muted" style={totalLabel}>
            Total distribuído
          </span>
          <span className="disp tnum" style={{ ...totalValue, color: 'var(--green)' }}>
            {brl(result.distributed)}
          </span>
        </div>
      </div>

      {/* Organizador: contribuições + gabarito */}
      {isOrganizer && (
        <>
          <div className="card">
            <h2 className="sec">Contribuições</h2>
            <p className="muted" style={intro}>
              Registre quanto cada participante colocou no bolão (R$). A soma vira o total
              arrecadado que é rateado entre os prêmios.
            </p>
            <div className="stack" style={{ marginTop: 14 }}>
              {members.map((m, i) => (
                <div
                  key={m.userId}
                  className="row gap"
                  style={{
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
                  }}
                >
                  <div className="row gap-sm" style={{ minWidth: 0, flex: 1 }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                      {initials(m.nickname)}
                    </div>
                    <span
                      style={{
                        fontWeight: 600,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.nickname}
                      {m.userId === currentUserId && (
                        <span className="muted" style={{ fontWeight: 400 }}> (você)</span>
                      )}
                    </span>
                  </div>
                  <div className="row gap-sm" style={{ flex: '0 0 auto' }}>
                    <span className="muted disp" style={{ fontSize: 13 }}>
                      R$
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={contribDraft[m.userId] ?? ''}
                      placeholder="0,00"
                      onChange={(e) =>
                        setContribDraft((prev) => ({ ...prev, [m.userId]: e.target.value }))
                      }
                      style={contribInput}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-gold"
              onClick={handleSaveContributions}
              disabled={savingContrib}
              style={{ marginTop: 14 }}
            >
              {savingContrib ? 'Salvando…' : 'Salvar contribuições'}
            </button>
          </div>

          <div className="card" style={{ borderColor: 'var(--purple)' }}>
            <h2 className="sec" style={{ color: 'var(--purple-2)' }}>
              Gabarito do Longo Prazo
            </h2>
            <p className="muted" style={intro}>
              Cadastre as respostas certas dos 4 mercados (geralmente ao fim da Copa). Quem
              bateu o gabarito acertou e entra no rateio do Longo Prazo.
            </p>
            <div style={{ marginTop: 14 }}>
              {GABARITO_FIELDS.map((f) => (
                <div key={f.key} className="field">
                  <label>{f.label}</label>
                  <input
                    type="text"
                    value={gabaritoDraft[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setGabaritoDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-gold"
              onClick={handleSaveGabarito}
              disabled={savingGabarito}
            >
              {savingGabarito ? 'Salvando…' : 'Salvar gabarito'}
            </button>
          </div>
        </>
      )}

      {/* Tabela: quem recebe quanto */}
      <div className="stack gap-sm">
        <div className="row gap" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 className="sec">Quem recebe quanto</h2>
          {winners.length > 0 && (
            <ShareImageButton
              makeCanvas={makePayoutCanvas}
              filename="premiacao.png"
              label="Compartilhar premiação"
            />
          )}
        </div>

        {rows.length === 0 ? (
          <div className="card muted" style={{ fontSize: 14 }}>
            Ainda não há participantes para ratear.
          </div>
        ) : (
          <div className="stack gap-sm">
            {rows.map(({ member, payout }) => {
              const total = payout?.total ?? 0;
              const breakdown = payout?.breakdown ?? [];
              const isMe = member.userId === currentUserId;
              return (
                <div
                  key={member.userId}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    borderColor: isMe ? 'var(--gold)' : undefined,
                  }}
                >
                  <div
                    className="row gap"
                    style={{
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: isMe ? 'rgba(244,196,48,.08)' : 'transparent',
                      borderBottom: breakdown.length > 0 ? '1px solid var(--line-soft)' : 'none',
                    }}
                  >
                    <div className="row gap-sm" style={{ minWidth: 0, flex: 1 }}>
                      <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                        {initials(member.nickname)}
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
                        {member.nickname}
                        {isMe && (
                          <span className="muted" style={{ fontWeight: 400 }}> (você)</span>
                        )}
                      </span>
                    </div>
                    <span
                      className="disp tnum"
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: total > 0 ? 'var(--green)' : 'var(--txt-2)',
                        flex: '0 0 auto',
                      }}
                    >
                      {brl(total)}
                    </span>
                  </div>

                  {breakdown.length > 0 && (
                    <div className="stack gap-sm" style={{ padding: '10px 16px' }}>
                      {breakdown.map((item, i) => (
                        <div
                          key={`${item.source}-${i}`}
                          className="row gap"
                          style={{ justifyContent: 'space-between' }}
                        >
                          <span className="muted" style={{ fontSize: 13 }}>
                            {item.source}
                          </span>
                          <span
                            className="tnum"
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}
                          >
                            {brl(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const intro: CSSProperties = { marginTop: 8, fontSize: 14, lineHeight: 1.7 };

const totalCard: CSSProperties = {
  flex: '1 1 160px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const totalLabel: CSSProperties = { fontSize: 12, fontWeight: 600 };

const totalValue: CSSProperties = { fontSize: 24, fontWeight: 700 };

const contribInput: CSSProperties = {
  width: 110,
  padding: '8px 10px',
  fontSize: 14,
  textAlign: 'right',
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--txt)',
};

export default PremiacaoTab;
