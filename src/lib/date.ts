/**
 * Helpers de data para FireDate (Timestamp | number | null).
 * Lógica centralizada a partir de MatchResults/FeedTab/MatchList.
 */
import type { FireDate } from '@/types';

/** Converte um FireDate (Timestamp | number | null) em milissegundos. */
export function fireToMillis(value: FireDate): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toMillis();
}

/** Formata data/hora em pt-BR (ex.: "18/06, 16:00"). 'A definir' se sem data. */
export function formatDateTime(value: FireDate): string {
  const ms = fireToMillis(value);
  if (!ms) return 'A definir';
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
