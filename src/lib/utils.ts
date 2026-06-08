/**
 * Funções utilitárias pequenas e sem dependências.
 */

/** Transforma "Bolão da Firma 2026" em "bolao-da-firma-2026". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 50);
}

/** Gera um código de convite curto e legível, ex: "FLEX-7K2D". */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem caracteres ambíguos
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Converte FireDate (Timestamp ou número) em Date do JS. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value);
  // Firestore Timestamp tem o método toDate()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/** Formata uma data para algo como "08 jun, 16:30". */
export function formatMatchDate(value: unknown): string {
  const date = toDate(value);
  if (!date) return 'A definir';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Inicial(is) de um nome, para avatares de texto. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
