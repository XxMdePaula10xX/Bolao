/**
 * Gera um código de convite curto (6 caracteres) para uma edição.
 * Evita caracteres ambíguos (0/O, 1/I/L) para leitura/digitação fácil.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
