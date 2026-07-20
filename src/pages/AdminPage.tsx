import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEdition, isOrganizer } from '@/services/editions';
import { useAuthStore } from '@/store/authStore';
import { useEditionStore } from '@/store/editionStore';
import { AddMatch } from '@/features/admin/AddMatch';
import { MatchResults } from '@/features/admin/MatchResults';
import type { Edition } from '@/types';

export function AdminPage() {
  const profile = useAuthStore((s) => s.profile);
  const currentEditionId = useEditionStore((s) => s.currentEditionId);

  const [edition, setEdition] = useState<Edition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!currentEditionId) {
      setEdition(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    getEdition(currentEditionId)
      .then((e) => {
        if (!alive) return;
        setEdition(e);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [currentEditionId]);

  // Sem bolão selecionado.
  if (!currentEditionId || !profile) {
    return (
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">Organização</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="sec">Nenhum bolão selecionado</h2>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            Selecione ou crie um bolão para acessar a área de organização.
          </p>
          <Link to="/bolao" className="btn btn-gold" style={{ marginTop: 14 }}>
            Ir para o bolão
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !edition) {
    return (
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">Organização</h1>
        <div className="card muted" style={{ marginTop: 16 }}>
          Não foi possível carregar esta edição. Tente novamente.
        </div>
      </div>
    );
  }

  // Área restrita: só o organizador da edição.
  if (!isOrganizer(edition, profile.id)) {
    return (
      <div className="wrap" style={{ paddingTop: 24 }}>
        <h1 className="page">Área restrita</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row gap" style={{ justifyContent: 'space-between' }}>
            <h2 className="sec">Somente o organizador</h2>
            <span className="badge badge-red">restrito</span>
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
            Apenas o organizador de <b style={{ color: 'var(--txt)' }}>{edition.name}</b> pode
            cadastrar jogos e lançar resultados.
          </p>
          <Link to="/bolao" className="btn btn-ghost" style={{ marginTop: 14 }}>
            Voltar ao bolão
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="row gap" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page">Organização</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>{edition.name}</p>
        </div>
        <span className="badge badge-gold">⭐ organizador</span>
      </div>

      <div className="stack gap" style={{ marginTop: 18 }}>
        <AddMatch editionId={edition.id} />

        <div>
          <h2 className="sec" style={{ margin: '4px 0 12px' }}>Resultados dos jogos</h2>
          <MatchResults editionId={edition.id} />
        </div>
      </div>
    </div>
  );
}
