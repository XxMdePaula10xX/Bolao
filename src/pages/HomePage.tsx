import { useAuthStore } from '@/store/authStore';

const DISPUTAS = [
  { k: 'Ranking Geral', d: 'Soma de todos os pontos', badge: 'badge-green' },
  { k: 'Liga', d: 'Confrontos rodada a rodada', badge: 'badge-blue' },
  { k: 'Copa', d: 'Mata-mata entre os 22', badge: 'badge-gold' },
  { k: 'Consolação', d: 'Segunda chance dos eliminados', badge: 'badge-purple' },
  { k: 'Longo Prazo', d: 'Campeão, artilheiro, garçom, craque', badge: 'badge-gray' },
];

export function HomePage() {
  const { profile } = useAuthStore();
  const first = profile?.nickname?.split(' ')[0] ?? 'Palpiteiro';

  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <p className="muted" style={{ fontSize: 15 }}>E aí,</p>
      <h1 className="page">{first} 👋</h1>

      <div className="card" style={{ marginTop: 18, background: 'linear-gradient(135deg, var(--panel), var(--bg-elev))' }}>
        <h2 className="sec">As 5 disputas do bolão</h2>
        <div className="stack gap-sm" style={{ marginTop: 12 }}>
          {DISPUTAS.map((x) => (
            <div key={x.k} className="row gap" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{x.k}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{x.d}</div>
              </div>
              <span className={`badge ${x.badge}`}>ativo</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="sec">Próximo passo</h2>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          A base do app está no ar (login, tema, navegação e o motor de pontuação já testado).
          A seguir entram: criar a edição da Copa, puxar os jogos, palpitar e o Ranking Geral.
        </p>
      </div>
    </div>
  );
}
