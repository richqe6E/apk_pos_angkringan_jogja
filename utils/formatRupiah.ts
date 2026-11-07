/**
 * Utilitas terpusat untuk format input nominal Rupiah dengan pemisah ribuan titik.
 * Digunakan oleh seluruh TextInput nominal di aplikasi (diskon, bayar, kas keluar, dll).
 */

export function formatRupiahInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : String(value);
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const num = parseInt(digitsOnly, 10);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('id-ID');
}

export function parseRupiahInput(formatted: string | number | null | undefined): number {
  if (formatted === null || formatted === undefined) return 0;
  if (typeof formatted === 'number') return Math.max(0, Math.floor(formatted));
  const digitsOnly = formatted.replace(/\D/g, '');
  if (!digitsOnly) return 0;
  const num = parseInt(digitsOnly, 10);
  return Number.isNaN(num) ? 0 : num;
}

export function formatRupiahDisplay(value: number | null | undefined, withSymbol: boolean = true): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return withSymbol ? 'Rp 0' : '0';
  }
  const num = Math.floor(value);
  const formatted = num.toLocaleString('id-ID');
  return withSymbol ? `Rp ${formatted}` : formatted;
}

