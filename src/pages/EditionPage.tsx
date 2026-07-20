import { useEffect, useMemo, useState } from 'react';
import { listMyEditions, isOrganizer } from '@/services/editions';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { CreateEdition } from '@/features/editions/CreateEdition';
import { JoinEdition } from '@/features/editions/JoinEdition';
import { Participants } from '@/features/editions/Participants';
import { RankingGeral } from '@/features/editions/RankingGeral';
import { LigaTab } from '@/features/league/LigaTab';
import { CopaTab } from '@/features/cup/CopaTab';
import { ConsolacaoTab } from '@/features/consolation/ConsolacaoTab';
import { toast } from '@/lib/toast';
import type { Edition } from '@/types';

const TABS = [
  'Visão geral', 'Regulamento', 'Ranking Geral', 'Participantes',
  'Liga', 'Copa', 'Consolação', 'Longo Prazo', 'Estatísticas',
] as const;

const COMING_SOON_TABS = new Set(['Longo Prazo', 'Estatísticas']);

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
        <h1 className="page">{edition.name}</h1>
        {edition.competitionName && (
          <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>{edition.competitionName}</p>
        )}
      </div>

      <div style={{ borderBottom: '1px solid var(--line)', marginTop: 12 }}>
        <div className="wrap" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
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
      </div>

      <div className="wrap" style={{ paddingTop: 18 }}>
        {TABS[tab] === 'Visão geral' && (
          <Overview edition={edition} isOrganizer={isOrganizer(edition, profile.id)} />
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
        {COMING_SOON_TABS.has(TABS[tab]) && <ComingSoon name={TABS[tab]} />}
      </div>
    </div>
  );
}

function Overview({ edition, isOrganizer: organizer }: { edition: Edition; isOrganizer: boolean }) {
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

  return (
    <div className="stack gap">
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

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="card">
      <div className="row gap" style={{ justifyContent: 'space-between' }}>
        <h2 className="sec">{name}</h2>
        <span className="badge badge-gray">em breve</span>
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
        Esta disputa já está modelada no schema e entra nos próximos passos.
      </p>
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
