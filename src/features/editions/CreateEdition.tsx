import { useState } from 'react';
import { createEdition } from '@/services/editions';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { toast } from '@/lib/toast';
import type { Edition, EditionPrizes } from '@/types';

/** Premiação padrão do PRD (o organizador pode ajustar). */
const DEFAULT_PRIZES: EditionPrizes = {
  ranking: { first: 100, second: 50, third: 20 },
  league: { first: 60, second: 25, third: 15 },
  cup: { total: 50 },
  longTerm: { perMarket: 40 },
};

interface Props {
  onCreated?: (edition: Edition) => void;
}

export function CreateEdition({ onCreated }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const setCurrentEdition = useEditionStore((s) => s.setCurrentEdition);

  const [name, setName] = useState('');
  const [competitionName, setCompetitionName] = useState('');
  const [prizes, setPrizes] = useState<EditionPrizes>(DEFAULT_PRIZES);
  const [busy, setBusy] = useState(false);

  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const cleanName = name.trim();
    if (!cleanName) {
      toast('Dê um nome para a edição.', 'err');
      return;
    }
    setBusy(true);
    try {
      const edition = await createEdition(profile, {
        name: cleanName,
        competitionName: competitionName.trim() || undefined,
        prizes,
      });
      setCurrentEdition(edition.id);
      toast('Edição criada! 🏆', 'ok');
      onCreated?.(edition);
    } catch {
      toast('Não foi possível criar a edição.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="sec">Criar edição</h2>
      <p className="muted" style={{ margin: '8px 0 14px', fontSize: 14, lineHeight: 1.6 }}>
        Você será o organizador. Depois convide a galera pelo código gerado.
      </p>

      <div className="field">
        <label htmlFor="ed-name">Nome da edição</label>
        <input
          id="ed-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Copa 2026"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="ed-comp">Competição</label>
        <input
          id="ed-comp"
          value={competitionName}
          onChange={(e) => setCompetitionName(e.target.value)}
          placeholder="Ex: Copa do Mundo FIFA"
          autoComplete="off"
        />
      </div>

      <h2 className="sec" style={{ marginTop: 6 }}>Premiação (R$)</h2>

      <PrizeRow label="Ranking Geral">
        <PrizeInput label="1º" value={prizes.ranking.first}
          onChange={(v) => setPrizes((p) => ({ ...p, ranking: { ...p.ranking, first: num(v) } }))} />
        <PrizeInput label="2º" value={prizes.ranking.second}
          onChange={(v) => setPrizes((p) => ({ ...p, ranking: { ...p.ranking, second: num(v) } }))} />
        <PrizeInput label="3º" value={prizes.ranking.third}
          onChange={(v) => setPrizes((p) => ({ ...p, ranking: { ...p.ranking, third: num(v) } }))} />
      </PrizeRow>

      <PrizeRow label="Liga">
        <PrizeInput label="1º" value={prizes.league.first}
          onChange={(v) => setPrizes((p) => ({ ...p, league: { ...p.league, first: num(v) } }))} />
        <PrizeInput label="2º" value={prizes.league.second}
          onChange={(v) => setPrizes((p) => ({ ...p, league: { ...p.league, second: num(v) } }))} />
        <PrizeInput label="3º" value={prizes.league.third}
          onChange={(v) => setPrizes((p) => ({ ...p, league: { ...p.league, third: num(v) } }))} />
      </PrizeRow>

      <PrizeRow label="Copa (total)">
        <PrizeInput label="total" value={prizes.cup.total}
          onChange={(v) => setPrizes((p) => ({ ...p, cup: { total: num(v) } }))} />
      </PrizeRow>

      <PrizeRow label="Longo Prazo (por mercado)">
        <PrizeInput label="por mercado" value={prizes.longTerm.perMarket}
          onChange={(v) => setPrizes((p) => ({ ...p, longTerm: { perMarket: num(v) } }))} />
      </PrizeRow>

      <button className="btn btn-gold" type="submit" disabled={busy} style={{ marginTop: 8 }}>
        {busy ? 'Criando…' : 'Criar edição'}
      </button>
    </form>
  );
}

function PrizeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function PrizeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="stack" style={{ flex: '1 1 80px', minWidth: 80 }}>
      <span className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--txt)', fontSize: 15,
        }}
      />
    </label>
  );
}
