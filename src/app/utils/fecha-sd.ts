/**
 * Utilidades de fecha/hora para la zona horaria de Santo Domingo (UTC-4, sin horario de verano).
 * America/Santo_Domingo nunca cambia de offset, así que podemos hardcodear -04:00.
 */

const TZ = 'America/Santo_Domingo';
const OFFSET = '-04:00';

/** Fecha actual en Santo Domingo en formato 'YYYY-MM-DD' */
export function sdFechaHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** ISO string de la medianoche de inicio del día en Santo Domingo (usa fecha de hoy si no se indica) */
export function sdInicioDelDia(fechaStr?: string): string {
  return new Date(`${fechaStr ?? sdFechaHoy()}T00:00:00${OFFSET}`).toISOString();
}

/** ISO string del final del día en Santo Domingo (usa fecha de hoy si no se indica) */
export function sdFinDelDia(fechaStr?: string): string {
  return new Date(`${fechaStr ?? sdFechaHoy()}T23:59:59.999${OFFSET}`).toISOString();
}

/**
 * Convierte un timestamp almacenado en BD (TIMESTAMPTZ / ISO UTC) a la fecha
 * local de Santo Domingo en formato 'YYYY-MM-DD'.
 */
export function sdFechaDeTimestamp(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString('en-CA', { timeZone: TZ });
}
