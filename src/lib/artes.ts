/**
 * Artes do Bolão da Copa — desenha imagens compartilháveis num <canvas>
 * e exporta PNG. Tema dark premium (fundo #0a0c14, dourado #f4c430,
 * verde #00d68f). Sem serviço externo — tudo no navegador.
 *
 * Uso:
 *   const canvas = drawRankingArt(rows, 'Ranking Geral');
 *   await shareOrDownload(canvas, 'ranking.png');
 */

// ------------------------------------------------------------------
// Tokens de tema (espelham o index.css, mas fixos para o canvas)
// ------------------------------------------------------------------
const BG = '#0a0c14';
const PANEL = '#12151f';
const ZEBRA = '#171b28';
const LINE = '#232838';
const GOLD = '#f4c430';
const GREEN = '#00d68f';
const TXT = '#e8ecf5';
const TXT_2 = '#8a91a8';
const TXT_MUT = '#626a80';

// Medalhas para as 3 primeiras posições
const MEDALS: Record<number, string> = { 1: '#f4c430', 2: '#c6ccdb', 3: '#cd7f32' };

const FONT_DISP =
  "700 'Oswald', 'Arial Narrow', system-ui, sans-serif";
const FONT_BODY =
  "'Inter', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif";

const WIDTH = 1080;
const PAD = 56; // margem lateral
const HEADER_H = 220; // altura do cabeçalho (título + faixa dourada)
const ROW_H = 88; // altura de cada linha
const FOOTER_H = 120; // altura do rodapé

/** Cria o canvas com a altura correta para `rowCount` linhas. */
function makeCanvas(rowCount: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const height = HEADER_H + Math.max(rowCount, 1) * ROW_H + FOOTER_H;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D não suportado neste navegador.');
  return { canvas, ctx };
}

/** Fundo, título e faixa dourada. */
function drawHeader(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, title: string) {
  // Fundo
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Escudo "2×1" no topo esquerdo
  const shieldX = PAD;
  const shieldY = 44;
  const shieldW = 70;
  const shieldH = 80;
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, shieldX, shieldY, shieldW, shieldH, [16, 16, 34, 34]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = FONT_DISP.replace('700', '700 26px');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2×1', shieldX + shieldW / 2, shieldY + shieldH / 2 + 4);

  // Marca
  ctx.fillStyle = TXT_2;
  ctx.font = `600 20px ${FONT_BODY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('BOLÃO DA COPA', shieldX + shieldW + 20, shieldY + 34);
  ctx.fillStyle = TXT_MUT;
  ctx.font = `400 15px ${FONT_BODY}`;
  ctx.fillText('Palpite. Torça. Ganhe.', shieldX + shieldW + 20, shieldY + 62);

  // Título grande
  ctx.fillStyle = TXT;
  ctx.font = FONT_DISP.replace('700', '700 52px');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title.toUpperCase(), PAD, HEADER_H - 46);

  // Faixa dourada sob o título
  ctx.fillStyle = GOLD;
  ctx.fillRect(PAD, HEADER_H - 26, 120, 5);
}

/** Rodapé com a marca. */
function drawFooter(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const y = canvas.height - FOOTER_H;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 24);
  ctx.lineTo(canvas.width - PAD, y + 24);
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = FONT_DISP.replace('700', '700 24px');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BOLÃO DA COPA', PAD, y + 64);

  ctx.fillStyle = TXT_MUT;
  ctx.font = `400 18px ${FONT_BODY}`;
  ctx.textAlign = 'right';
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  ctx.fillText(`${dd}/${mm}/${d.getFullYear()}`, canvas.width - PAD, y + 64);
}

/** Retângulo do fundo de uma linha (zebrado). */
function drawRowBg(ctx: CanvasRenderingContext2D, y: number, index: number) {
  ctx.fillStyle = index % 2 === 0 ? PANEL : ZEBRA;
  roundRect(ctx, PAD, y + 6, WIDTH - PAD * 2, ROW_H - 12, 12);
  ctx.fill();
}

/** Retângulo arredondado (raio único ou por canto [tl,tr,br,bl]). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[],
) {
  const rr = Array.isArray(r) ? r : [r, r, r, r];
  const [tl, tr, br, bl] = rr;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

/** Trunca um texto para caber em `maxW` px, adicionando reticências. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// ------------------------------------------------------------------
// Artes públicas
// ------------------------------------------------------------------

/**
 * Ranking: posição (com medalha nas 3 primeiras), apelido, placares exatos
 * e pontuação (destaque dourado).
 */
export function drawRankingArt(
  rows: { pos: number; nickname: string; points: number; exact: number }[],
  title: string,
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(rows.length);
  drawHeader(ctx, canvas, title);

  const startY = HEADER_H;
  rows.forEach((r, i) => {
    const y = startY + i * ROW_H;
    drawRowBg(ctx, y, i);
    const cy = y + ROW_H / 2;

    // Posição / medalha
    const medal = MEDALS[r.pos];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (medal) {
      ctx.beginPath();
      ctx.arc(PAD + 42, cy, 26, 0, Math.PI * 2);
      ctx.fillStyle = medal;
      ctx.fill();
      ctx.fillStyle = '#1a1400';
      ctx.font = FONT_DISP.replace('700', '700 26px');
      ctx.fillText(String(r.pos), PAD + 42, cy + 1);
    } else {
      ctx.fillStyle = TXT_2;
      ctx.font = FONT_DISP.replace('700', '700 28px');
      ctx.fillText(String(r.pos), PAD + 42, cy + 1);
    }

    // Apelido
    ctx.textAlign = 'left';
    ctx.fillStyle = TXT;
    ctx.font = `600 32px ${FONT_BODY}`;
    const nameX = PAD + 90;
    const nameMaxW = WIDTH - PAD - 320 - nameX;
    ctx.fillText(ellipsize(ctx, r.nickname, nameMaxW), nameX, cy + 1);

    // Placares exatos (verde)
    ctx.textAlign = 'right';
    ctx.fillStyle = GREEN;
    ctx.font = `600 22px ${FONT_BODY}`;
    ctx.fillText(`${r.exact} exatos`, WIDTH - PAD - 160, cy + 1);

    // Pontos (dourado, destaque)
    ctx.fillStyle = GOLD;
    ctx.font = FONT_DISP.replace('700', '700 40px');
    ctx.fillText(String(r.points), WIDTH - PAD - 16, cy + 2);
    ctx.fillStyle = TXT_MUT;
    ctx.font = `500 14px ${FONT_BODY}`;
    ctx.fillText('PTS', WIDTH - PAD - 16, cy + 26);
  });

  drawFooter(ctx, canvas);
  return canvas;
}

/**
 * Premiação: apelido e valor total a receber em R$ (destaque verde).
 */
export function drawPayoutArt(
  rows: { nickname: string; total: number }[],
  title: string,
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(rows.length);
  drawHeader(ctx, canvas, title);

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const startY = HEADER_H;
  rows.forEach((r, i) => {
    const y = startY + i * ROW_H;
    drawRowBg(ctx, y, i);
    const cy = y + ROW_H / 2;

    // Marcador
    ctx.beginPath();
    ctx.arc(PAD + 30, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = GREEN;
    ctx.fill();

    // Apelido
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TXT;
    ctx.font = `600 32px ${FONT_BODY}`;
    const nameX = PAD + 60;
    const nameMaxW = WIDTH - PAD - 300 - nameX;
    ctx.fillText(ellipsize(ctx, r.nickname, nameMaxW), nameX, cy + 1);

    // Valor (verde, destaque)
    ctx.textAlign = 'right';
    ctx.fillStyle = GREEN;
    ctx.font = FONT_DISP.replace('700', '700 38px');
    ctx.fillText(fmt(r.total), WIDTH - PAD - 16, cy + 1);
  });

  drawFooter(ctx, canvas);
  return canvas;
}

/**
 * Lista genérica: rótulo à esquerda, valor (dourado) à direita.
 * Serve para estatísticas, gabarito de longo prazo, etc.
 */
export function drawGenericList(
  title: string,
  items: { label: string; value: string }[],
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(items.length);
  drawHeader(ctx, canvas, title);

  const startY = HEADER_H;
  items.forEach((it, i) => {
    const y = startY + i * ROW_H;
    drawRowBg(ctx, y, i);
    const cy = y + ROW_H / 2;

    // Rótulo
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TXT_2;
    ctx.font = `500 28px ${FONT_BODY}`;
    const labelX = PAD + 28;
    const labelMaxW = WIDTH - PAD - 360 - labelX;
    ctx.fillText(ellipsize(ctx, it.label, labelMaxW), labelX, cy + 1);

    // Valor (dourado)
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = `700 30px ${FONT_BODY}`;
    const valMaxW = 330;
    ctx.fillText(ellipsize(ctx, it.value, valMaxW), WIDTH - PAD - 16, cy + 1);
  });

  drawFooter(ctx, canvas);
  return canvas;
}

// ------------------------------------------------------------------
// Exportação PNG
// ------------------------------------------------------------------

/** Converte o canvas num Blob PNG. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Falha ao gerar a imagem PNG.'));
    }, 'image/png');
  });
}

/**
 * Tenta compartilhar via navigator.share (com o arquivo PNG);
 * se indisponível, faz download via <a download>.
 */
export async function shareOrDownload(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const name = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
  const blob = await canvasToBlob(canvas);

  // Tenta compartilhamento nativo com arquivo
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  try {
    if (typeof nav.share === 'function' && typeof File !== 'undefined') {
      const file = new File([blob], name, { type: 'image/png' });
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Bolão da Copa' });
        return;
      }
    }
  } catch (err) {
    // Usuário cancelou o share nativo → não faz fallback nem lança.
    if (err instanceof DOMException && err.name === 'AbortError') return;
    // Outros erros: cai no download abaixo.
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
