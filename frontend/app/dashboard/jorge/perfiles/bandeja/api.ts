// Wrapper de fetch para los 9 endpoints OVC del backend Go.
// Centraliza el manejo de envelope { success, data, error } y errores de red.

import type {
  SiguienteResponse,
  Conflict409,
  ResumenDia,
  TipoRespuesta,
} from './types';

const apiBase = () =>
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080';

const OVC = '/api/v1/ovc';

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json.data as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<{ data: T; conflict?: Conflict409 }> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 409 && json.conflict) {
    return { data: null as T, conflict: json.conflict };
  }
  if (!json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return { data: json.data as T };
}

// ====================================================================
// 1. GET siguiente
// ====================================================================
export const fetchSiguiente = () =>
  getJSON<SiguienteResponse>(`${OVC}/bandeja-whatsapp/siguiente`);

// ====================================================================
// 2. POST marcar-enviado
// ====================================================================
export interface MarcarEnviadoBody {
  operador: string;
  mensaje_enviado_editado?: string;
}

export interface MarcarEnviadoResult {
  status?: string;
  contacto_id?: number;
  siguiente_contacto?: SiguienteResponse;
}

export const marcarEnviado = (
  contactoID: number,
  body: MarcarEnviadoBody
) =>
  postJSON<MarcarEnviadoResult>(
    `${OVC}/bandeja-whatsapp/${contactoID}/marcar-enviado`,
    body
  );

// ====================================================================
// 3. POST marcar-omitido
// ====================================================================
export const marcarOmitido = (contactoID: number, operador: string) =>
  postJSON<null>(`${OVC}/bandeja-whatsapp/${contactoID}/marcar-omitido`, {
    operador,
  });

// ====================================================================
// 4. POST marcar-no-aplica
// ====================================================================
export const marcarNoAplica = (
  contactoID: number,
  operador: string,
  razon?: string
) =>
  postJSON<null>(`${OVC}/bandeja-whatsapp/${contactoID}/marcar-no-aplica`, {
    operador,
    razon,
  });

// ====================================================================
// 5. POST registrar-respuesta
// ====================================================================
export interface RegistrarRespuestaBody {
  respondio: boolean;
  tipo_respuesta: TipoRespuesta;
  nota_operador?: string;
  operador: string;
}

export const registrarRespuesta = (
  contactoID: number,
  body: RegistrarRespuestaBody
) =>
  postJSON<null>(
    `${OVC}/bandeja-whatsapp/${contactoID}/registrar-respuesta`,
    body
  );

// ====================================================================
// 6. GET explicacion (stub por ahora)
// ====================================================================
export interface ExplicacionResponse {
  explicacion: string;
  fuente?: string;
}

export const fetchExplicacion = (contactoID: number) =>
  getJSON<ExplicacionResponse>(
    `${OVC}/bandeja-whatsapp/explicacion/${contactoID}`
  );

// ====================================================================
// 7. GET resumen-dia
// ====================================================================
export const fetchResumenDia = (fecha?: string) => {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return getJSON<ResumenDia>(`${OVC}/bandeja-whatsapp/resumen-dia${q}`);
};

// ====================================================================
// 8. GET movimientos
// ====================================================================
export interface MatrixMovimientoCell {
  antes: string;
  despues: string;
  cantidad: number;
  atribuidos_whatsapp: number;
}

export interface MovimientoDia {
  fecha: string;
  positivos: number;
  negativos: number;
}

export interface MovimientosResponse {
  periodo: { desde: string; hasta: string };
  totales: {
    positivos: number;
    negativos: number;
    saldo_neto: number;
    atribuidos_whatsapp: number;
  };
  matriz_eje_valor: MatrixMovimientoCell[];
  movimientos_por_dia: MovimientoDia[];
}

export const fetchMovimientos = (desde: string, hasta: string) => {
  const q = new URLSearchParams({ desde, hasta }).toString();
  return getJSON<MovimientosResponse>(`${OVC}/movimientos?${q}`);
};

// ====================================================================
// 9. GET scripts-estadisticas
// ====================================================================
export interface ScriptStats {
  script_id: string;
  nombre: string;
  enviados: number;
  respondieron: number;
  tasa_respuesta: number;
  reservaron: number;
  tasa_conversion: number;
  ingreso_atribuido: number;
}

export interface ScriptsEstadisticasResponse {
  scripts: ScriptStats[];
}

export const fetchScriptsEstadisticas = (desde: string, hasta: string) => {
  const q = new URLSearchParams({ desde, hasta }).toString();
  return getJSON<ScriptsEstadisticasResponse>(
    `${OVC}/scripts-estadisticas?${q}`
  );
};
