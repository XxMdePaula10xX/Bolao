import { useState } from 'react';
import { addMatch } from '@/services/matches';
import { toast } from '@/lib/toast';

interface AddMatchProps {
  editionId: string;
  onAdded?: () => void;
}

interface FormState {
  homeName: string;
  homeFlag: string;
  awayName: string;
  awayFlag: string;
  date: string;
  time: string;
  isKnockout: boolean;
  stage: string;
  round: string;
}

const EMPTY: FormState = {
  homeName: '',
  homeFlag: '',
  awayName: '',
  awayFlag: '',
  date: '',
  time: '',
  isKnockout: false,
  stage: '',
  round: '',
};

/** Formulário de entrada manual de um jogo (RF-09: override manual). */
export function AddMatch({ editionId, onAdded }: AddMatchProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    const homeName = form.homeName.trim();
    const awayName = form.awayName.trim();
    if (!homeName || !awayName) {
      toast('Informe os dois times', 'err');
      return;
    }
    if (!form.date || !form.time) {
      toast('Informe data e hora', 'err');
      return;
    }
    const startTime = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(startTime.getTime())) {
      toast('Data/hora inválida', 'err');
      return;
    }

    const roundNum = form.round.trim() === '' ? undefined : Number(form.round);
    if (roundNum !== undefined && Number.isNaN(roundNum)) {
      toast('Rodada inválida', 'err');
      return;
    }

    setSaving(true);
    try {
      await addMatch(editionId, {
        homeName,
        homeFlag: form.homeFlag.trim() || undefined,
        awayName,
        awayFlag: form.awayFlag.trim() || undefined,
        startTime,
        isKnockout: form.isKnockout,
        stage: form.stage.trim() || undefined,
        round: roundNum,
      });
      toast('Jogo adicionado!', 'ok');
      setForm(EMPTY);
      onAdded?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao adicionar jogo', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2 className="sec">Adicionar jogo</h2>
      <p className="muted" style={{ margin: '8px 0 14px', fontSize: 13, lineHeight: 1.6 }}>
        A Copa 2026 ainda não tem tabela oficial em APIs — cadastre os confrontos manualmente.
      </p>

      {/* Mandante */}
      <div className="row gap-sm" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '0 0 84px', marginBottom: 14 }}>
          <label>Bandeira</label>
          <input
            aria-label="Bandeira do mandante"
            placeholder="🇧🇷"
            value={form.homeFlag}
            onChange={(e) => set('homeFlag', e.target.value)}
          />
        </div>
        <div className="field grow" style={{ marginBottom: 14 }}>
          <label>Time mandante</label>
          <input
            aria-label="Nome do mandante"
            placeholder="Brasil"
            value={form.homeName}
            onChange={(e) => set('homeName', e.target.value)}
          />
        </div>
      </div>

      {/* Visitante */}
      <div className="row gap-sm" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '0 0 84px', marginBottom: 14 }}>
          <label>Bandeira</label>
          <input
            aria-label="Bandeira do visitante"
            placeholder="🇦🇷"
            value={form.awayFlag}
            onChange={(e) => set('awayFlag', e.target.value)}
          />
        </div>
        <div className="field grow" style={{ marginBottom: 14 }}>
          <label>Time visitante</label>
          <input
            aria-label="Nome do visitante"
            placeholder="Argentina"
            value={form.awayName}
            onChange={(e) => set('awayName', e.target.value)}
          />
        </div>
      </div>

      {/* Data e hora */}
      <div className="row gap-sm">
        <div className="field grow">
          <label>Data</label>
          <input
            aria-label="Data do jogo"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
        <div className="field grow">
          <label>Hora</label>
          <input
            aria-label="Hora do jogo"
            type="time"
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </div>
      </div>

      {/* Fase e rodada */}
      <div className="row gap-sm">
        <div className="field grow">
          <label>Fase (opcional)</label>
          <input
            aria-label="Fase"
            placeholder="group, round_of_16, quarter..."
            value={form.stage}
            onChange={(e) => set('stage', e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: '0 0 110px' }}>
          <label>Rodada</label>
          <input
            aria-label="Rodada"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="1"
            value={form.round}
            onChange={(e) => set('round', e.target.value)}
          />
        </div>
      </div>

      {/* Mata-mata */}
      <label
        className="row gap-sm"
        style={{ cursor: 'pointer', margin: '4px 0 16px', fontSize: 14, fontWeight: 600 }}
      >
        <input
          type="checkbox"
          checked={form.isKnockout}
          onChange={(e) => set('isKnockout', e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--purple)' }}
        />
        <span>Jogo de mata-mata</span>
        {form.isKnockout && <span className="badge badge-purple">pode ir a pênaltis</span>}
      </label>

      <button className="btn btn-gold" disabled={saving} onClick={handleSubmit}>
        {saving ? 'Adicionando...' : 'Adicionar jogo'}
      </button>
    </div>
  );
}
