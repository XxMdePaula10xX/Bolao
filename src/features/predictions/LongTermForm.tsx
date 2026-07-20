import { useEffect, useState } from 'react';
import { getLongTerm, saveLongTerm } from '@/services/longterm';
import type { UserProfile } from '@/types';
import { toast } from '@/lib/toast';

interface LongTermFormProps {
  editionId: string;
  user: UserProfile;
}

interface FormState {
  championTeam: string;
  topScorer: string;
  assistLeader: string;
  bestPlayer: string;
}

const EMPTY: FormState = {
  championTeam: '',
  topScorer: '',
  assistLeader: '',
  bestPlayer: '',
};

const FIELDS: { key: keyof FormState; label: string; placeholder: string }[] = [
  { key: 'championTeam', label: 'Campeão da Copa', placeholder: 'Ex: Brasil' },
  { key: 'topScorer', label: 'Artilheiro', placeholder: 'Nome do jogador' },
  { key: 'assistLeader', label: 'Garçom (líder de assistências)', placeholder: 'Nome do jogador' },
  { key: 'bestPlayer', label: 'Melhor Jogador', placeholder: 'Nome do jogador' },
];

export function LongTermForm({ editionId, user }: LongTermFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getLongTerm(editionId, user.id)
      .then((lt) => {
        if (!alive) return;
        if (lt) {
          setForm({
            championTeam: lt.championTeam ?? '',
            topScorer: lt.topScorer ?? '',
            assistLeader: lt.assistLeader ?? '',
            bestPlayer: lt.bestPlayer ?? '',
          });
        }
      })
      .catch((e: unknown) => {
        toast(e instanceof Error ? e.message : 'Erro ao carregar palpites', 'err');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [editionId, user.id]);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveLongTerm(editionId, user, {
        championTeam: form.championTeam.trim() || null,
        topScorer: form.topScorer.trim() || null,
        assistLeader: form.assistLeader.trim() || null,
        bestPlayer: form.bestPlayer.trim() || null,
      });
      toast('Palpites de longo prazo salvos', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="stack gap">
      <div className="card" style={{ borderColor: 'var(--purple)' }}>
        <h2 className="sec" style={{ color: 'var(--purple-2)' }}>
          Longo Prazo
        </h2>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          Palpites para os mercados que só fecham no fim da Copa. Você pode alterar
          enquanto quiser: eles <b style={{ color: 'var(--purple-2)' }}>travam no início da Copa</b>{' '}
          (primeiro jogo). Por enquanto o preenchimento é em texto livre.
        </p>
      </div>

      <div className="card">
        {FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label>{f.label}</label>
            <input
              type="text"
              value={form[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <button className="btn btn-gold" disabled={saving} onClick={handleSave}>
        {saving ? 'Salvando...' : 'Salvar longo prazo'}
      </button>
    </div>
  );
}
