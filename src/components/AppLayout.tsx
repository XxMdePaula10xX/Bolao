import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/palpites', label: 'Palpites', icon: '🎯', end: false },
  { to: '/bolao', label: 'Bolão', icon: '🏆', end: false },
  { to: '/perfil', label: 'Perfil', icon: '👤', end: false },
];

/** Casca do app: conteúdo + barra de navegação inferior fixa. */
export function AppLayout() {
  return (
    <div style={{ minHeight: '100%', paddingBottom: 76 }}>
      <Outlet />
      <nav style={navBar}>
        <div className="wrap row" style={{ justifyContent: 'space-around' }}>
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} style={({ isActive }) => tab(isActive)}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

const navBar: React.CSSProperties = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
  background: 'var(--bg-elev)', borderTop: '1px solid var(--line)',
  paddingTop: 8, paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
};
const tab = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
  padding: '6px 14px', borderRadius: 10,
  color: active ? 'var(--gold)' : 'var(--txt-2)',
  filter: active ? 'none' : 'grayscale(.4) opacity(.8)',
});
