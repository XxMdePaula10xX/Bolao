import { useState } from 'react';
import { createEdition } from '@/services/editions';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { toast } from '@/lib/toast';
import type { Edition, EditionPrizes, EditionSettings } from '@/types';

/** Premiação padrão do PRD (o organizador pode ajustar). */
const DEFAULT_PRIZES: EditionPrizes = {
  ranking: { first: 100, second: 50, third: 20 },
  league: { first: 60, second: 25, third: 15 },
  cup: { total: 50 },
  longTerm: { perMarket: 40 },
};

/** Configurações padrão das competições internas (o organizador pode ajustar). */
const DEFAULT_SETTINGS: EditionSettings = {
  league: { matchesPerRound: 4, winPoints: 3, drawPoints: 1 },
  cup: { format: 'knockout', groupSize: 4, qualifiersPerGroup: 2 },
  consolation: { lastN: 4 },
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
  const [settings, setSettings] = useState<EditionSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);

  function num(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function intMin(v: string, min: number): number {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(min, n) : min;
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
        settings,
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

      <h2 className="sec" style={{ marginTop: 6 }}>Competições internas</h2>
      <p className="muted" style={{ margin: '4px 0 12px', fontSize: 13, lineHeight: 1.6 }}>
        Padrões da Liga, Copa e Consolação. Você pode ajustar depois no sorteio de cada disputa.
      </p>

      <div className="row gap-sm" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <SettingField
          label="Jogos por rodada (Liga)"
          value={settings.league.matchesPerRound}
          min={1}
          onChange={(v) =>
            setSettings((s) => ({
              ...s,
              league: { ...s.league, matchesPerRound: intMin(v, 1) },
            }))
          }
        />
        <SettingField
          label="Últimos na Consolação"
          value={settings.consolation.lastN}
          min={2}
          onChange={(v) =>
            setSettings((s) => ({ ...s, consolation: { lastN: intMin(v, 2) } }))
          }
        />
      </div>

      <div className="field">
        <label htmlFor="ed-cup-format">Formato padrão da Copa</label>
        <select
          id="ed-cup-format"
          value={settings.cup.format}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              cup: { ...s.cup, format: e.target.value as 'knockout' | 'groups' },
            }))
          }
        >
          <option value="knockout">Só mata-mata</option>
          <option value="groups">Fase de grupos</option>
        </select>
      </div>

      {settings.cup.format === 'groups' && (
        <div className="row gap-sm" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          <SettingField
            label="Participantes por grupo"
            value={settings.cup.groupSize ?? 4}
            min={2}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                cup: { ...s.cup, groupSize: intMin(v, 2) },
              }))
            }
          />
          <SettingField
            label="Classificam por grupo"
            value={settings.cup.qualifiersPerGroup ?? 2}
            min={1}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                cup: { ...s.cup, qualifiersPerGroup: intMin(v, 1) },
              }))
            }
          />
        </div>
      )}

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

function SettingField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="stack" style={{ flex: '1 1 160px', minWidth: 150 }}>
      <span className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</span>
      <input
        type="number"
        min={min}
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
