import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { login, resetPassword, authErrorMessage } from '@/services/auth';
import { toast } from '@/lib/toast';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return setError('Preencha e-mail e senha.');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // redirecionamento automático pelo guard de rotas
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) return toast('Digite seu e-mail primeiro', 'err');
    try {
      await resetPassword(email.trim());
      toast('Enviamos um link de recuperação', 'ok');
    } catch (err) {
      toast(authErrorMessage(err), 'err');
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 48, paddingBottom: 40 }}>
      <div className="center stack" style={{ alignItems: 'center', gap: 10, marginBottom: 26 }}>
        <Logo size={72} />
        <h1 className="disp" style={{ fontSize: 30, marginTop: 6 }}>Bolão da Copa</h1>
        <p className="muted" style={{ fontSize: 14 }}>Sem planilha. Sem print no zap. Tudo aqui.</p>
      </div>

      <form onSubmit={handleLogin}>
        <div className="field">
          <label>E-mail</label>
          <input type="email" autoComplete="email" placeholder="voce@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" autoComplete="current-password" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="err">{error}</div>}
        </div>
        <div style={{ textAlign: 'right', margin: '-4px 0 14px' }}>
          <button type="button" onClick={handleForgot}
            style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>
            Esqueci minha senha
          </button>
        </div>
        <button className="btn btn-gold" disabled={loading}>{loading ? '...' : 'Entrar'}</button>
      </form>

      <p className="center muted" style={{ marginTop: 20 }}>
        Ainda não tem conta?{' '}
        <Link to="/register" style={{ color: 'var(--gold)', fontWeight: 700 }}>Criar conta</Link>
      </p>
    </div>
  );
}
