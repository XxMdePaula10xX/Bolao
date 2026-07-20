import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  getConsolation,
  drawConsolation,
  computeConsolationLive,
} from '@/services/consolation';
import { getLeague } from '@/services/league';
import { listEditionMembers } from '@/services/editions';
import { listMatches } from '@/services/matches';
import { knockoutRounds, consolationBlockInfo } from '@/lib/competition';
import { toast } from '@/lib/toast';
import { initials } from '@/lib/format';
import type { BracketDoc, KOMatch, KORound } from '@/types';

const LAST_N_OPTIONS = [4, 6, 8];

type Live = Awaited<ReturnType<typeof computeConsolationLive>>;

interface Props {
  editionId: string;
  currentUserId: string;
  isOrganizer: boolean;
}

export function ConsolacaoTab({ editionId, currentUserId, isOrganizer }: Props) {
  const [bracket, setBracket] = useState<BracketDoc | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [leagueReady, setLeagueReady] = useState(false);
  const [ligaGamesUsed, setLigaGamesUsed] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [lastN, setLastN] = useState<number>(4);
  const [block, setBlock] = useState<number>(2);
  const [drawing, setDrawing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [bra, members, ms, league] = await Promise.all([
        getConsolation(editionId),
        listEditionMembers(editionId),
        listMatches(editionId),
        getLeague(editionId),
      ]);
      const nameMap: Record<string, string> = {};
      for (const m of members) nameMap[m.userId] = m.nickname;
      setNames(nameMap);
      setBracket(bra);
      setTotalGames(ms.length);
      setLeagueReady(!!league);
      setLigaGamesUsed(league ? league.rounds.length * league.matchesPerRound : 0);

      if (bra) {
        const result = await computeConsolationLive(editionId);
        setLive(result);
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
    setBracket(null);
    setLive(null);
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // Nº de confrontos e bloco máximo para o lastN escolhido (setup).
  const setupInfo = useMemo(() => {
    const rounds = knockoutRounds(lastN);
    const info = consolationBlockInfo(rounds, totalGames, ligaGamesUsed);
    return { rounds, ...info };
  }, [lastN, totalGames, ligaGamesUsed]);

  // Ao trocar lastN (ou quando os dados carregam), reajusta o bloco para um
  // padrão pequeno, respeitando o máximo viável.
  useEffect(() => {
    const max = setupInfo.maxBlock;
    setBlock(Math.max(1, Math.min(2, max || 1)));
  }, [lastN, setupInfo.maxBlock]);

  function nameOf(userId: string): string {
    return names[userId] ?? 'Participante';
  }

  async function handleDraw() {
    if (setupInfo.maxBlock <= 0) {
      toast('Ainda não há jogos suficientes para montar a Consolação.', 'err');
      return;
    }
    const ok = window.confirm(
      `Montar a Consolação com os ${lastN} últimos da Liga, ` +
        `${block} jogo${block === 1 ? '' : 's'} por confronto? ` +
        'O chaveamento é sorteado a partir da tabela atual.',
    );
    if (!ok) return;

    setDrawing(true);
    try {
      await drawConsolation(editionId, lastN, block, names);
      toast('Consolação montada! Segunda chance chegando.', 'ok');
      await load();
    } catch {
      toast('Não foi possível montar a Consolação.', 'err');
    } finally {
      setDrawing(false);
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
      const { rounds, maxBlock, overlaps } = setupInfo;
      const podeMontar = leagueReady && maxBlock > 0;
      return (
        <div className="card">
          <div className="row gap" style={{ justifyContent: 'space-between' }}>
            <h2 className="sec">Consolação</h2>
            <span className="badge badge-purple">segunda chance</span>
          </div>
          <p className="muted" style={intro}>
            A Consolação é a repescagem do bolão: os últimos colocados da Liga
            ganham um mata-mata só deles, com nova chance de brilhar. Ela começa
            depois que a Liga termina — cada confronto é decidido por um bloco de
            jogos, automaticamente.
          </p>

          {!leagueReady ? (
            <p className="muted" style={{ ...intro, marginTop: 12 }}>
              Sorteie a Liga primeiro. Assim que ela estiver montada, você poderá
              montar a Consolação aqui.
            </p>
          ) : (
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

              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label>Jogos por confronto</label>
                <select
                  value={block}
                  onChange={(e) => setBlock(Number(e.target.value))}
                  disabled={maxBlock <= 0}
                >
                  {Array.from({ length: Math.max(1, maxBlock) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} jogo{n === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="card"
                style={{ background: 'var(--bg-elev)', padding: 12, marginTop: 14 }}
              >
                {maxBlock > 0 ? (
                  <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                    Serão <b style={{ color: 'var(--txt)' }}>{rounds}</b> confronto
                    {rounds === 1 ? '' : 's'} até o título, com até{' '}
                    <b style={{ color: 'var(--blue)' }}>{maxBlock}</b> jogo
                    {maxBlock === 1 ? '' : 's'} por confronto.{' '}
                    {overlaps ? (
                      <>
                        Como a Liga usa quase todos os jogos, a Consolação vai{' '}
                        <b style={{ color: 'var(--gold)' }}>rodar junto com o fim da Liga</b>.
                      </>
                    ) : (
                      <>Ela começa assim que a Liga terminar.</>
                    )}
                  </p>
                ) : (
                  <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                    Ainda não há jogos suficientes para {rounds} confronto
                    {rounds === 1 ? '' : 's'}. Cadastre mais jogos ou reduza quantos
                    últimos entram.
                  </p>
                )}
              </div>

              <button
                className="btn btn-gold"
                onClick={handleDraw}
                disabled={drawing || !podeMontar}
                style={{ marginTop: 14 }}
              >
                {drawing ? 'Montando…' : 'Montar Consolação'}
              </button>
            </>
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

  // --- Consolação montada: chaveamento ao vivo (automático) ---
  const rounds: KORound[] = live?.koRounds ?? bracket.rounds ?? [];
  const champions = live?.championIds ?? bracket.championIds ?? [];
  const overlapsLiga = live?.overlapsLiga ?? bracket.overlapsLiga ?? false;

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
          campanha em alta. Cada confronto é decidido pelos pontos de um bloco de
          jogos; os vencedores avançam sozinhos, conforme os jogos terminam.
        </p>
        {overlapsLiga && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            Roda junto com a reta final da Liga.
          </p>
        )}
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

      {/* Chaveamento ao vivo */}
      <div className="stack gap-sm">
        <h2 className="sec">Chaveamento</h2>
        {rounds.length === 0 && (
          <div className="card muted" style={{ fontSize: 14 }}>
            Chave ainda não definida.
          </div>
        )}

        {rounds.map((round, roundIndex) => (
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
          </div>
        ))}
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
  const co = !!m.coChampions;
  const aWon = (resolved && m.winnerId === aId) || co;
  const bWon = (resolved && m.winnerId === bId) || co;
  const meA = aId === currentUserId;
  const meB = bId === currentUserId;
  const aName = m.slotA?.nickname ?? nameOf(aId);
  const bName = m.slotB?.nickname ?? nameOf(bId);
  const scored = m.pointsA != null && m.pointsB != null;

  return (
    <div className="row gap" style={rowStyle(meA || meB)}>
      <Side name={aName} isMe={meA} align="left" winner={aWon} />
      <div className="center" style={{ flex: '0 0 auto', minWidth: 64 }}>
        {scored ? (
          <span className="disp tnum" style={{ fontSize: 16, fontWeight: 700 }}>
            <b style={{ color: aWon ? 'var(--gold)' : 'var(--txt)' }}>{m.pointsA}</b>
            <span className="muted"> × </span>
            <b style={{ color: bWon ? 'var(--gold)' : 'var(--txt)' }}>{m.pointsB}</b>
          </span>
        ) : (
          <span className="muted disp" style={{ fontSize: 12 }}>a definir</span>
        )}
        {co ? (
          <div className="badge badge-gold" style={{ marginTop: 4 }} title="Empate na final: co-campeões">
            co-campeões
          </div>
        ) : (
          m.pointsEqual && (
            <div
              className="badge badge-blue"
              style={{ marginTop: 4 }}
              title="Desempate pela posição na Liga"
            >
              desempate
            </div>
          )
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
