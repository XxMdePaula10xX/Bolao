import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { register, authErrorMessage } from '@/services/auth';

export function RegisterPage() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nickname.trim().length < 2) return setError('Digite seu apelido.');
    if (!email.trim()) return setError('Digite seu e-mail.');
    if (password.length < 6) return setError('A senha precisa ter ao menos 6 caracteres.');
    setLoading(true);
    try {
      await register(nickname.trim(), email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 40, paddingBottom: 40 }}>
      <div className="center stack" style={{ alignItems: 'center', gap: 8, marginBottom: 22 }}>
        <Logo size={60} />
        <h1 className="disp" style={{ fontSize: 26, marginTop: 6 }}>Criar conta</h1>
        <p className="muted" style={{ fontSize: 14 }}>Seu apelido é como a galera te conhece no bolão.</p>
      </div>

      <form onSubmit={handleRegister}>
        <div className="field">
          <label>Apelido</label>
          <input placeholder="Ex: Gustagol" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" autoComplete="email" placeholder="voce@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="err">{error}</div>}
        </div>
        <button className="btn btn-gold" disabled={loading}>{loading ? '...' : 'Cadastrar'}</button>
      </form>

      <p className="center muted" style={{ marginTop: 20 }}>
        Já tem conta?{' '}
        <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 700 }}>Entrar</Link>
      </p>
    </div>
  );
}
