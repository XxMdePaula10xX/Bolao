/**
 * Helper de moeda BRL.
 */

/**
 * Formata um valor em reais no padrão pt-BR (ex.: "R$ 100,00").
 * Decisão: manter SEMPRE 2 casas — é o formato mais usado no app
 * (PremiacaoTab/artes.ts) e os valores de premiação podem ser fracionários
 * (ex.: rateio 40/7 = 5,71), então não usamos minimumFractionDigits: 0.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
