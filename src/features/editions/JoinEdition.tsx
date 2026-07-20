import { useState } from 'react';
import { findEditionByInvite, joinEdition } from '@/services/editions';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { toast } from '@/lib/toast';
import type { Edition } from '@/types';

interface Props {
  onJoined?: (edition: Edition) => void;
}

export function JoinEdition({ onJoined }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const setCurrentEdition = useEditionStore((s) => s.setCurrentEdition);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const clean = code.trim().toUpperCase();
    if (clean.length < 6) {
      toast('Digite o código de 6 caracteres.', 'err');
      return;
    }
    setBusy(true);
    try {
      const edition = await findEditionByInvite(clean);
      if (!edition) {
        toast('Código não encontrado.', 'err');
        return;
      }
      await joinEdition(edition, profile);
      setCurrentEdition(edition.id);
      toast(`Você entrou em ${edition.name}! 🎉`, 'ok');
      onJoined?.(edition);
    } catch {
      toast('Não foi possível entrar na edição.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="sec">Entrar por código</h2>
      <p className="muted" style={{ margin: '8px 0 14px', fontSize: 14, lineHeight: 1.6 }}>
        Recebeu um convite? Cole o código de 6 caracteres.
      </p>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="join-code">Código de convite</label>
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex: 7KDP2M"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          style={{ letterSpacing: 4, fontWeight: 700, textAlign: 'center' }}
        />
      </div>
      <button className="btn btn-ghost" type="submit" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar na edição'}
      </button>
    </form>
  );
}
