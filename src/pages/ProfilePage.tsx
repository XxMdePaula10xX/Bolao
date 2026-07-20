import { useAuthStore } from '@/store/authStore';
import { logout } from '@/services/auth';
import { initials } from '@/lib/format';

export function ProfilePage() {
  const { profile } = useAuthStore();
  if (!profile) return null;

  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <h1 className="page">Perfil</h1>

      <div className="card center" style={{ marginTop: 16 }}>
        <div className="avatar" style={{ width: 76, height: 76, fontSize: 26, margin: '0 auto' }}>
          {initials(profile.nickname)}
        </div>
        <div className="disp" style={{ fontSize: 24, marginTop: 12 }}>{profile.nickname}</div>
        <div className="muted" style={{ fontSize: 13 }}>{profile.email}</div>
        {profile.isSystemAdmin && <div className="badge badge-gold" style={{ marginTop: 8 }}>⭐ organizador</div>}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="sec">Conta</h2>
        <p className="muted" style={{ margin: '8px 0 14px', fontSize: 14 }}>
          Em breve: editar apelido e avatar (a camisa/escudo do bolão).
        </p>
        <button className="btn btn-danger" onClick={() => logout()}>Sair da conta</button>
      </div>
    </div>
  );
}
