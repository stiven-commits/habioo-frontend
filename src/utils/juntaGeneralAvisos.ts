export const metodoDivisionLabel = (metodo: unknown): string => {
  const raw = String(metodo || '').trim().toLowerCase();
  if (raw.includes('alicuota')) return 'Alícuotas';
  return 'Partes iguales';
};
