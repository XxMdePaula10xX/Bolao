/** Logo do Bolão da Copa — escudo com "2×1" em dourado (sem imagem). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size * 1.14,
        borderRadius: `${size * 0.22}px ${size * 0.22}px ${size * 0.5}px ${size * 0.5}px`,
        background: 'var(--panel)',
        border: '2px solid var(--gold)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--disp)',
        fontWeight: 700,
        color: 'var(--gold)',
        fontSize: size * 0.4,
        flex: '0 0 auto',
      }}
    >
      2×1
    </div>
  );
}
