/**
 * Botão que gera uma arte (canvas) e a compartilha/baixa como PNG.
 * Autossuficiente: recebe uma factory `makeCanvas` que produz o
 * HTMLCanvasElement no momento do clique.
 *
 * Uso:
 *   <ShareImageButton
 *     makeCanvas={() => drawRankingArt(rows, 'Ranking Geral')}
 *     filename="ranking.png"
 *     label="Compartilhar ranking"
 *   />
 */
import { useState } from 'react';
import { shareOrDownload } from '@/lib/artes';
import { toast } from '@/lib/toast';

type Props = {
  /** Cria o canvas a desenhar (chamada no clique). */
  makeCanvas: () => HTMLCanvasElement;
  /** Nome do arquivo PNG (com ou sem extensão). */
  filename: string;
  /** Texto do botão. Padrão: "Compartilhar imagem". */
  label?: string;
};

export function ShareImageButton({ makeCanvas, filename, label = 'Compartilhar imagem' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const canvas = makeCanvas();
      await shareOrDownload(canvas, filename);
    } catch (err) {
      console.error('[ShareImageButton]', err);
      toast('Não foi possível gerar a imagem.', 'err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <span
          className="spinner"
          style={{ width: 18, height: 18, borderWidth: 2 }}
          aria-hidden
        />
      ) : (
        <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>
          ↗
        </span>
      )}
      {loading ? 'Gerando…' : label}
    </button>
  );
}

export default ShareImageButton;
