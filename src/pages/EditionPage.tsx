import { useState } from 'react';

const TABS = [
  'Visão geral', 'Regulamento', 'Jogos', 'Ranking Geral', 'Liga',
  'Copa', 'Consolação', 'Longo Prazo', 'Estatísticas', 'Participantes', 'Feed',
];

export function EditionPage() {
  const [tab, setTab] = useState(0);
  return (
    <div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">O Bolão</h1>
      </div>
      <div style={{ borderBottom: '1px solid var(--line)', marginTop: 12 }}>
        <div className="wrap" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className="disp"
              style={{
                flex: '0 0 auto', border: '1px solid var(--line)', borderRadius: 999,
                padding: '8px 14px', fontSize: 14, fontWeight: 600,
                background: tab === i ? 'var(--gold)' : 'var(--panel)',
                color: tab === i ? '#2a2205' : 'var(--txt-2)',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 18 }}>
        {tab === 1 ? <Regulamento /> : (
          <div className="card">
            <h2 className="sec">{TABS[tab]}</h2>
            <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
              Esta aba entra nos próximos passos. A estrutura das 5 disputas já está modelada
              no schema — vamos preenchendo uma de cada vez, começando por Ranking Geral e Liga.
            </p>
          </div>
        )}
      </div>
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
          <li>• Longo Prazo: prêmio de mercado sem acertador é <b>redistribuído</b> nos outros.</li>
        </ul>
      </div>
    </div>
  );
}
