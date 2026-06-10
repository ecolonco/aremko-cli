// Cliente de la Bandeja de salida "Conexión-Masajes".
// Pega contra el backend Go (/api/v1/masaje/outbox/...), que a su vez proxea a
// Django agregando la X-API-Key (el navegador no la conoce). Preservamos el
// status code para mapear 409 (ya no está pendiente) / 422 (envío falló o
// cliente dado de baja) a mensajes claros.

import type { MasajeOutboxItem, MasajeOutboxResponse } from './types';

const apiBase = () =>
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080';

const BASE = '/api/v1/masaje/outbox';

// URL del preview HTML (para usar directo como src de un iframe; refleja el
// cuerpo actual, post-edición).
export const previewUrl = (id: number): string => `${apiBase()}${BASE}/${id}/preview`;

export const fetchOutbox = async (): Promise<MasajeOutboxResponse> => {
  const res = await fetch(`${apiBase()}${BASE}?incluir_programados=1&limit=200`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as MasajeOutboxResponse;
};

// Resultado de una acción que puede fallar con mensaje (editar/enviar/cancelar).
export interface AccionResult {
  ok: boolean;
  status: number;
  item?: MasajeOutboxItem;
  estado?: string;
  error?: string | null;
  // 409 estructurados del send (anti-duplicado, Django 2026-06-10). El 409
  // antiguo de "ya no está pendiente" viene sin motivo.
  motivo?: 'anti_saturacion' | 'orden_cadencia' | string | null;
  detalle?: string | null;
  desbloquea_en?: string | null;
}

const accion = async (
  method: 'PATCH' | 'POST',
  path: string,
  body: Record<string, unknown>
): Promise<AccionResult> => {
  const res = await fetch(`${apiBase()}${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return {
    ok: res.ok && json.ok !== false,
    status: res.status,
    item: json.item as MasajeOutboxItem | undefined,
    estado: json.estado as string | undefined,
    error: (json.error as string | undefined) ?? null,
    motivo: (json.motivo as string | undefined) ?? null,
    detalle: (json.detalle as string | undefined) ?? null,
    desbloquea_en: (json.desbloquea_en as string | undefined) ?? null,
  };
};

export const editarItem = (id: number, asunto: string, cuerpo: string, operador: string) =>
  accion('PATCH', `/${id}`, { asunto, cuerpo, operador });

// forzar=true salta la anti-saturación (confirmar con el operador antes).
// No aplica al bloqueo por orden de cadencia, que es duro.
export const enviarItem = (id: number, operador: string, forzar = false) =>
  accion('POST', `/${id}/send`, forzar ? { operador, forzar: true } : { operador });

export const cancelarItem = (id: number, operador: string) =>
  accion('POST', `/${id}/cancel`, { operador });
