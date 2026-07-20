import { useEffect, useMemo, useState } from 'react';
import { listMyEditions, isOrganizer } from '@/services/editions';
import { listMatches } from '@/services/matches';
import { getLeague } from '@/services/league';
import { getCup } from '@/services/cup';
import { getConsolation } from '@/services/consolation';
import { getPayouts } from '@/services/payouts';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { CreateEdition } from '@/features/editions/CreateEdition';
import { JoinEdition } from '@/features/editions/JoinEdition';
import { Participants } from '@/features/editions/Participants';
import { RankingGeral } from '@/features/editions/RankingGeral';
import { LigaTab } from '@/features/league/LigaTab';
import { CopaTab } from '@/features/cup/CopaTab';
import { ConsolacaoTab } from '@/features/consolation/ConsolacaoTab';
import { LongoPrazoTab } from '@/features/longterm/LongoPrazoTab';
import { EstatisticasTab } from '@/features/stats/EstatisticasTab';
import { PremiacaoTab } from '@/features/prizes/PremiacaoTab';
import { FeedTab } from '@/features/feed/FeedTab';
import { toast } from '@/lib/toast';
import type { Edition } from '@/types';

const TABS = [
  'Visão geral', 'Regulamento', 'Ranking Geral', 'Participantes',
  'Liga', 'Copa', 'Consolação', 'Longo Prazo', 'Estatísticas',
  'Premiação', 'Feed',
] as const;

export function EditionPage() {
  const profile = useAuthStore((s) => s.profile);
  const currentEditionId = useEditionStore((s) => s.currentEditionId);
  const setCurrentEdition = useEditionStore((s) => s.setCurrentEdition);

  const [editions, setEditions] = useState<Edition[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState(0);

  async function reload() {
    if (!profile) return;
    setError(false);
    try {
      const list = await listMyEditions(profile.id);
      setEditions(list);
      if (list.length > 0) {
        const keep = currentEditionId && list.some((e) => e.id === currentEditionId)
          ? currentEditionId
          : list[0].id;
        if (keep !== currentEditionId) setCurrentEdition(keep);
      } else {
        setCurrentEdition(null);
      }
    } catch {
      setError(true);
      setEditions([]);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const edition = useMemo(() => {
    if (!editions) return null;
    return editions.find((e) => e.id === currentEditionId) ?? editions[0] ?? null;
  }, [editions, currentEditionId]);

  if (!profile) return null;

  if (!editions) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  // --- Sem edição: onboarding (criar / entrar) ---
  if (!edition) {
    return (
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">O Bolão</h1>
        <p className="muted" style={{ margin: '8px 0 18px', fontSize: 15, lineHeight: 1.6 }}>
          Você ainda não está em nenhuma edição. Crie a sua ou entre com um código de convite.
        </p>
        {error && (
          <div className="card muted" style={{ marginBottom: 14 }}>
            Não foi possível carregar suas edições. Tente novamente.
          </div>
        )}
        <div className="stack gap">
          <CreateEdition onCreated={() => reload()} />
          <JoinEdition onJoined={() => reload()} />
        </div>
      </div>
    );
  }

  // --- Com edição: HUB ---
  return (
    <div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="row gap" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <h1 className="page">{edition.name}</h1>
            {edition.competitionName && (
              <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>{edition.competitionName}</p>
            )}
          </div>
          {/* Seletor de edição: só quando há mais de uma */}
          {editions.length > 1 && (
            <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 13 }}>Edição</span>
              <select
                value={edition.id}
                onChange={(e) => { setCurrentEdition(e.target.value); setTab(0); }}
                style={{
                  background: 'var(--bg-elev)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--txt)',
                  padding: '8px 12px', fontWeight: 600,
                }}
              >
                {editions.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Faixa de abas roláveis, com gradiente de "há mais à direita" */}
      <div style={{ borderBottom: '1px solid var(--line)', marginTop: 12, position: 'relative' }}>
        <div
          className="wrap"
          role="tablist"
          style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}
        >
          {TABS.map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === i}
              onClick={(e) => {
                setTab(i);
                // rola a aba ativa para o centro da vista
                e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
              }}
              className="disp"
              style={{
                flex: '0 0 auto', border: '1px solid var(--line)', borderRadius: 999,
                padding: '8px 14px', fontSize: 14, fontWeight: 600,
                background: tab === i ? 'var(--gold)' : 'var(--panel)',
                color: tab === i ? '#2a2205' : 'var(--txt-2)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {/* overlay decorativo à direita: sinaliza que há mais abas */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 36,
            pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--bg))',
          }}
        />
      </div>

      <div className="wrap" style={{ paddingTop: 18 }}>
        {TABS[tab] === 'Visão geral' && (
          <Overview edition={edition} isOrganizer={isOrganizer(edition, profile.id)} setTab={setTab} />
        )}
        {TABS[tab] === 'Regulamento' && <Regulamento />}
        {TABS[tab] === 'Ranking Geral' && (
          <RankingGeral editionId={edition.id} currentUserId={profile.id} />
        )}
        {TABS[tab] === 'Participantes' && (
          <Participants editionId={edition.id} currentUserId={profile.id} />
        )}
        {TABS[tab] === 'Liga' && (
          <LigaTab
            editionId={edition.id}
            currentUserId={profile.id}
            isOrganizer={isOrganizer(edition, profile.id)}
          />
        )}
        {TABS[tab] === 'Copa' && (
          <CopaTab
            editionId={edition.id}
            currentUserId={profile.id}
            isOrganizer={isOrganizer(edition, profile.id)}
          />
        )}
        {TABS[tab] === 'Consolação' && (
          <ConsolacaoTab
            editionId={edition.id}
            currentUserId={profile.id}
            isOrganizer={isOrganizer(edition, profile.id)}
          />
        )}
        {TABS[tab] === 'Longo Prazo' && (
          <LongoPrazoTab
            editionId={edition.id}
            currentUserId={profile.id}
            isOrganizer={isOrganizer(edition, profile.id)}
            edition={edition}
          />
        )}
        {TABS[tab] === 'Estatísticas' && (
          <EstatisticasTab editionId={edition.id} currentUserId={profile.id} />
        )}
        {TABS[tab] === 'Premiação' && (
          <PremiacaoTab
            editionId={edition.id}
            currentUserId={profile.id}
            isOrganizer={isOrganizer(edition, profile.id)}
            edition={edition}
          />
        )}
        {TABS[tab] === 'Feed' && (
          <FeedTab
            editionId={edition.id}
            currentUserId={profile.id}
            isOrganizer={isOrganizer(edition, profile.id)}
            user={profile}
          />
        )}
      </div>
    </div>
  );
}

/** Sinais carregados do backend para o roteiro do organizador. */
interface ChecklistSignals {
  hasMatches: boolean;
  hasLeague: boolean;
  hasCup: boolean;
  hasConsolation: boolean;
  payoutsReady: boolean;
}

/** Um passo do roteiro: concluído (✓) ou pendente (○), com destino opcional. */
interface RoteiroStep {
  label: string;
  done: boolean;
  tab?: number;   // aba de destino ao clicar
  hint?: string;  // dica curta quando não há navegação
}

function Overview({
  edition,
  isOrganizer: organizer,
  setTab,
}: {
  edition: Edition;
  isOrganizer: boolean;
  setTab: (i: number) => void;
}) {
  const [signals, setSignals] = useState<ChecklistSignals | null>(null);

  // Carrega os sinais do roteiro UMA vez por edição/status (tolerante a falhas).
  useEffect(() => {
    if (!organizer) return;
    let alive = true;
    (async () => {
      try {
        const [matches, league, cup, consolation, payouts] = await Promise.all([
          listMatches(edition.id).catch(() => []),
          getLeague(edition.id).catch(() => null),
          getCup(edition.id).catch(() => null),
          getConsolation(edition.id).catch(() => null),
          getPayouts(edition.id).catch(() => null),
        ]);
        if (!alive) return;
        const gab = payouts?.gabarito;
        const gabaritoFilled = !!gab && (
          !!gab.championTeam || !!gab.topScorer || !!gab.assistLeader || !!gab.bestPlayer
        );
        const hasContribution = !!payouts
          && Object.values(payouts.contributions ?? {}).some((v) => v > 0);
        setSignals({
          hasMatches: matches.length > 0,
          hasLeague: league != null,
          hasCup: cup != null,
          hasConsolation: consolation != null,
          payoutsReady: payouts != null && (gabaritoFilled || hasContribution),
        });
      } catch {
        // Qualquer falha => trata tudo como pendente, sem quebrar a tela.
        if (alive) {
          setSignals({ hasMatches: false, hasLeague: false, hasCup: false, hasConsolation: false, payoutsReady: false });
        }
      }
    })();
    return () => { alive = false; };
  }, [edition.id, edition.status, organizer]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(edition.inviteCode);
      toast('Código copiado!', 'ok');
    } catch {
      toast('Copie manualmente: ' + edition.inviteCode);
    }
  }

  async function share() {
    const text = `Entra no meu bolão "${edition.name}"! Código: ${edition.inviteCode}`;
    const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: edition.name, text });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Convite copiado!', 'ok');
    } catch {
      toast(text);
    }
  }

  // Índices reais das abas (evita números frágeis se a ordem mudar).
  const idxLongterm = TABS.indexOf('Longo Prazo');
  const idxLiga = TABS.indexOf('Liga');
  const idxCopa = TABS.indexOf('Copa');
  const idxConsolacao = TABS.indexOf('Consolação');
  const idxPremiacao = TABS.indexOf('Premiação');

  const s = signals; // pode ser null enquanto carrega
  const longtermOpen = ['longterm_open', 'running', 'finished'].includes(edition.status);
  const running = ['running', 'finished'].includes(edition.status);
  const finished = edition.status === 'finished';

  // Passos na ordem do ciclo da edição.
  const steps: RoteiroStep[] = [
    { label: 'Edição criada', done: true },
    { label: 'Abrir janela de Longo Prazo', done: longtermOpen, tab: idxLongterm },
    { label: 'Cadastrar os jogos', done: s?.hasMatches ?? false, hint: 'cadastre em Admin' },
    { label: 'Sortear a Liga', done: s?.hasLeague ?? false, tab: idxLiga },
    { label: 'Sortear a Copa', done: s?.hasCup ?? false, tab: idxCopa },
    { label: 'Iniciar a Copa', done: running, tab: idxLongterm },
    { label: 'Sortear a Consolação', done: s?.hasConsolation ?? false, tab: idxConsolacao },
    { label: 'Cadastrar gabarito e contribuições', done: s?.payoutsReady ?? false, tab: idxPremiacao },
    { label: 'Encerrar a edição', done: finished, tab: idxLongterm },
  ];
  const allDone = steps.every((st) => st.done);
  const nextIdx = steps.findIndex((st) => !st.done); // primeiro pendente destacado

  return (
    <div className="stack gap">
      {organizer && (
        <div className="card">
          <h2 className="sec">Roteiro do organizador</h2>
          {allDone ? (
            <p style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>
              Tudo pronto! 🎉 Edição no ar.
            </p>
          ) : (
            <div className="stack" style={{ marginTop: 10 }}>
              {steps.map((st, i) => {
                const tabIndex = st.tab; // const local: mantém o narrowing no onClick
                const isNext = i === nextIdx;
                const icon = st.done ? '✓' : '○';
                const iconColor = st.done ? 'var(--green)' : (isNext ? 'var(--gold)' : 'var(--txt-2)');
                const labelColor = st.done ? 'var(--txt-2)' : (isNext ? 'var(--gold)' : 'var(--txt)');

                const body = (
                  <div className="row gap-sm" style={{ width: '100%', textAlign: 'left' }}>
                    <span style={{ color: iconColor, fontWeight: 700, width: 16, flex: '0 0 auto' }}>{icon}</span>
                    <span style={{ color: labelColor, fontWeight: st.done ? 500 : 600, fontSize: 14, opacity: st.done ? 0.85 : 1 }}>
                      {st.label}
                    </span>
                    {isNext && !st.done && (
                      <span className="disp" style={{ marginLeft: 'auto', color: 'var(--gold)', fontSize: 12, fontWeight: 700 }}>
                        Próximo passo →
                      </span>
                    )}
                    {st.hint && !st.done && (
                      <span className="muted" style={{ marginLeft: isNext ? 8 : 'auto', fontSize: 12 }}>
                        {st.hint}
                      </span>
                    )}
                  </div>
                );

                // Clicável só quando há aba de destino; senão texto simples.
                return tabIndex != null ? (
                  <button
                    key={st.label}
                    onClick={() => setTab(tabIndex)}
                    style={{
                      background: 'transparent', border: 'none', padding: '8px 4px',
                      cursor: 'pointer', display: 'flex', width: '100%',
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={st.label} style={{ padding: '8px 4px' }}>{body}</div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="sec">Código de convite</h2>
        <div className="row gap" style={{ marginTop: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div
            className="disp"
            style={{
              fontSize: 30, letterSpacing: 6, color: 'var(--gold)',
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)', padding: '10px 18px',
            }}
          >
            {edition.inviteCode}
          </div>
          <div className="row gap-sm" style={{ flex: '1 1 180px' }}>
            <button className="btn btn-ghost" onClick={copyCode} style={{ width: 'auto', flex: 1 }}>📋 Copiar</button>
            <button className="btn btn-gold" onClick={share} style={{ width: 'auto', flex: 1 }}>🔗 Compartilhar</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="sec">Resumo</h2>
        <div className="stack gap-sm" style={{ marginTop: 12 }}>
          <InfoRow label="Edição" value={edition.name} />
          {edition.competitionName && <InfoRow label="Competição" value={edition.competitionName} />}
          <InfoRow label="Participantes" value={`${edition.memberCount}`} />
          <div className="row gap" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 14 }}>Seu papel</span>
            <span className={`badge ${organizer ? 'badge-gold' : 'badge-gray'}`}>
              {organizer ? '⭐ organizador' : 'participante'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row gap" style={{ justifyContent: 'space-between' }}>
      <span className="muted" style={{ fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Regulamento() {
  return (
    <div className="stack gap">
      <div className="card">
        <h2 className="sec">Pontuação (fixa)</h2>
        <ul className="muted" style={{ marginTop: 8, lineHeight: 2, listStyle: 'none', fontSize: 14 }}>
          <li>• Placar exato: <b style={{ color: 'var(--txt)' }}>3 pontos</b></li>
          <li>• Acertou o vencedor/empate: <b style={{ color: 'var(--txt)' }}>1 ponto</b></li>
          <li>• Errou: <b style={{ color: 'var(--txt)' }}>0 ponto</b></li>
          <li>• Mata-mata nos pênaltis: <b style={{ color: 'var(--purple-2)' }}>+1</b> se acertar quem passa</li>
          <li>• Escala real: <b style={{ color: 'var(--gold)' }}>0, 1, 2, 3, 4</b></li>
        </ul>
      </div>
      <div className="card">
        <h2 className="sec">Desempates e prêmios</h2>
        <ul className="muted" style={{ marginTop: 8, lineHeight: 2, listStyle: 'none', fontSize: 14 }}>
          <li>• Empate em confronto interno: desempata pela posição na <b style={{ color: 'var(--blue)' }}>Liga</b>.</li>
          <li>• Final da Copa empatada: <b style={{ color: 'var(--gold)' }}>co-campeões</b> dividem o prêmio.</li>
          <li>• Longo Prazo: prêmio de mercado sem acertador é <b>redistribuído</b> nos demais.</li>
        </ul>
      </div>
    </div>
  );
}
