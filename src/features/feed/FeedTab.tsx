import { useCallback, useEffect, useState } from 'react';
import { listFeed, postFeed } from '@/services/feed';
import { toast } from '@/lib/toast';
import type { FeedPost, FireDate, UserProfile } from '@/types';

function toMillis(value: FireDate): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toMillis();
}

function formatDate(value: FireDate): string {
  const ms = toMillis(value);
  if (!ms) return 'Agora mesmo';
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}

interface Props {
  editionId: string;
  currentUserId?: string;
  isOrganizer: boolean;
  user: UserProfile;
}

export function FeedTab({ editionId, isOrganizer, user }: Props) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const list = await listFeed(editionId);
      setPosts(list);
    } catch {
      setError(true);
    }
  }, [editionId]);

  useEffect(() => {
    let alive = true;
    setPosts(null);
    (async () => {
      try {
        const list = await listFeed(editionId);
        if (alive) setPosts(list);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editionId]);

  const publish = async () => {
    const value = text.trim();
    if (!value) {
      toast('Escreva um aviso antes de publicar.', 'err');
      return;
    }
    setSaving(true);
    try {
      await postFeed(editionId, user, value);
      setText('');
      toast('Aviso publicado!', 'ok');
      await load();
    } catch {
      toast('Não foi possível publicar o aviso.', 'err');
    } finally {
      setSaving(false);
    }
  };

  if (posts === null && !error) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card muted">
        Não foi possível carregar o mural.{' '}
        <button
          className="btn btn-ghost"
          onClick={load}
          style={{ width: 'auto', marginTop: 10 }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const list = posts ?? [];

  return (
    <div className="stack gap-lg">
      {isOrganizer && (
        <div className="card stack gap">
          <h2 className="sec">Novo aviso</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um aviso para os participantes…"
            rows={3}
            disabled={saving}
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: 72,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--bg-2, rgba(255,255,255,.03))',
              color: 'var(--txt)',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          />
          <button
            className="btn btn-gold"
            onClick={publish}
            disabled={saving || !text.trim()}
            style={{ width: 'auto', alignSelf: 'flex-start' }}
          >
            {saving ? 'Publicando…' : 'Publicar aviso'}
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card stack gap-sm" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <span aria-hidden style={{ fontSize: 40, lineHeight: 1 }}>
            📣
          </span>
          <span className="disp" style={{ fontSize: 16, fontWeight: 700 }}>
            Nenhum aviso ainda
          </span>
          <span className="muted" style={{ fontSize: 14 }}>
            {isOrganizer
              ? 'Publique o primeiro aviso para os participantes acompanharem as novidades.'
              : 'O organizador ainda não publicou nenhum aviso. Fique de olho aqui!'}
          </span>
        </div>
      ) : (
        <div className="stack gap">
          {list.map((post) => (
            <article key={post.id} className="card stack gap-sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  className="avatar"
                  aria-hidden
                  style={{ width: 36, height: 36, fontSize: 13 }}
                >
                  {initials(post.authorName)}
                </span>
                <div className="stack" style={{ minWidth: 0 }}>
                  <span className="disp" style={{ fontSize: 14, fontWeight: 700 }}>
                    {post.authorName}
                  </span>
                  <span className="muted tnum" style={{ fontSize: 12 }}>
                    {formatDate(post.createdAt)}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 }}>
                {post.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
