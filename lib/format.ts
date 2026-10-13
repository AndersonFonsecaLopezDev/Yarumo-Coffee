/**
 * Utilidad unificada de formateo de moneda en Pesos Colombianos (COP).
 */
export function formatCop(value?: number | null): string {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}
