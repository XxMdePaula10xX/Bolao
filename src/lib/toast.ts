/** Toast simples, sem dependências (mostra uma mensagem flutuante). */
let el: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function toast(message: string, type: 'ok' | 'err' | '' = '') {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    // Anunciado por leitores de tela (feedback de "salvo", erros, etc.).
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast ${type}`;
  // força reflow para reiniciar a animação
  void el.offsetWidth;
  el.classList.add('show');
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => el && el.classList.remove('show'), 2600);
}
