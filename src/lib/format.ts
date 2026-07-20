/**
 * Helpers de formatação de texto/nome.
 */

/**
 * Gera as iniciais de um nome (1 ou 2 letras, maiúsculas).
 * Nome único → 2 primeiras letras; vários → 1ª do primeiro + 1ª do último.
 * Vazio vira base '?' (retorna '?'). Lógica copiada de ProfilePage/CopaTab etc.
 */
export function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  const raw =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return raw.toUpperCase();
}
