// Wrapper de fetch para los 9 endpoints OVC del backend Go.
// Centraliza el manejo de envelope { success, data, error } y errores de red.

import type {
  SiguienteResponse,
  Conflict409,
  ResumenDia,
  TipoRespuesta,
  DelDiaResponse,
  RegionGeografica,
  MetricasOperadoresResponse,
  ConversacionWhatsAppResponse,
  ConversacionesResponse,
  AgenteConfig,
  SugerenciaAprendizaje,
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
// 1.bis GET del-dia (Etapa 5.6 — historial editable)
// ====================================================================
export interface DelDiaOptions {
  fecha?: string;      // YYYY-MM-DD, default: hoy
  operador?: string;   // username, default: todos
  limit?: number;      // default 100, max 500
}

export const fetchDelDia = (opts: DelDiaOptions = {}) => {
  const q = new URLSearchParams();
  if (opts.fecha) q.set('fecha', opts.fecha);
  if (opts.operador) q.set('operador', opts.operador);
  if (opts.limit) q.set('limit', String(opts.limit));
  const query = q.toString();
  return getJSON<DelDiaResponse>(
    `${OVC}/bandeja-whatsapp/del-dia${query ? `?${query}` : ''}`
  );
};

// ====================================================================
// 2. POST marcar-enviado
// ====================================================================
export interface MarcarEnviadoBody {
  operador: string;
  mensaje_enviado_editado?: string;
  /**
   * Fuerza el registro pese a un conflicto de clasificación (409).
   * Lo envía el botón "registrar igual" del ModalConflicto (Task #41).
   * Requiere que el backend Go + Django honren el flag; hasta entonces
   * se ignora server-side y el 409 persiste (el modal lo detecta).
   */
  forzar?: boolean;
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
// 5.bis POST bloquear-cliente (Etapa 5.5.2 — bloqueo permanente)
// ====================================================================

export interface BloquearClienteResponse {
  success: boolean;
  cliente_id: number;
  cliente_bloqueado: boolean; // false si ya estaba bloqueado (idempotente)
  contacto_id: number;
  contacto_actualizado: boolean; // false si contacto ya enviado
}

export const bloquearCliente = (
  contactoID: number,
  operador: string,
  razon?: string
) =>
  postJSON<BloquearClienteResponse>(
    `${OVC}/bandeja-whatsapp/${contactoID}/bloquear-cliente`,
    { operador, razon }
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

// ====================================================================
// 10. POST clientes/{id}/actualizar-ubicacion (Geo.4)
// ====================================================================
export type MatchMethod = 'canonico' | 'alias' | 'extranjero_texto' | 'no_match';

export interface ActualizarUbicacionResponse {
  success: boolean;
  cliente_id: number;
  ciudad_input: string;
  region_geografica: RegionGeografica;
  ciudad_canonica: string | null;
  match_method: MatchMethod;
  match_score: number | null;
}

export const actualizarUbicacion = (
  clienteID: number,
  ciudad: string,
  operador: string
) =>
  postJSON<ActualizarUbicacionResponse>(
    `${OVC}/clientes/${clienteID}/actualizar-ubicacion`,
    { ciudad, operador }
  );

// ====================================================================
// 10.bis POST clientes/{id}/marcar-staff (cliente proxy/staff Aremko)
// ====================================================================

export interface MarcarStaffResponse {
  success: boolean;
  cliente_id: number;
  nombre_cliente: string;
  razon: string;
  contactos_descartados: number;
  already_marked: boolean;
}

export const marcarStaff = (
  clienteID: number,
  razon: string,
  operador: string
) =>
  postJSON<MarcarStaffResponse>(
    `${OVC}/clientes/${clienteID}/marcar-staff`,
    { razon, operador }
  );

// ====================================================================
// 11. GET metricas-operadores (atribución last-touch, ventana 60d)
// ====================================================================
export interface MetricasOperadoresOptions {
  desde?: string;                  // YYYY-MM-DD, default: hace 30d
  hasta?: string;                  // YYYY-MM-DD, default: hoy
  ventana_atribucion_dias?: number; // default 60, rango 1-365
  operadores_esperados?: string;   // coma-separado, fuerza aparición con ceros
}

export const fetchMetricasOperadores = (opts: MetricasOperadoresOptions = {}) => {
  const q = new URLSearchParams();
  if (opts.desde) q.set('desde', opts.desde);
  if (opts.hasta) q.set('hasta', opts.hasta);
  if (opts.ventana_atribucion_dias) {
    q.set('ventana_atribucion_dias', String(opts.ventana_atribucion_dias));
  }
  if (opts.operadores_esperados) {
    q.set('operadores_esperados', opts.operadores_esperados);
  }
  const query = q.toString();
  return getJSON<MetricasOperadoresResponse>(
    `${OVC}/metricas-operadores${query ? `?${query}` : ''}`
  );
};

// ====================================================================
// 12. WhatsApp Cloud API — hilo de conversación + responder
// --------------------------------------------------------------------
// Estos viven en /api/v1/whatsapp/* (NO bajo /ovc). El backend Go agrega
// las credenciales (token de WhatsApp + LUNA_API_KEY) server-side; el
// navegador nunca las porta. La conversación devuelve JSON crudo de
// Django (sin envelope {success,data}); reply sí usa {success,...}.
// ====================================================================

const WA = '/api/v1/whatsapp';

/** Normaliza un teléfono a E.164 con "+" inicial (Django indexa por ese formato). */
export const telefonoE164 = (raw: string): string => {
  const d = (raw || '').replace(/\D/g, '');
  return d ? `+${d}` : '';
};

export const fetchConversacionWhatsApp = async (
  phone: string,
  limit = 200,
  // Pide el borrador del agente IA (H-007). Es opt-in en Django para no gastar
  // LLM en cada apertura: solo lo activamos en la carga inicial / "Actualizar",
  // NO en el auto-refresco cada 12s.
  conSugerencia = false
): Promise<ConversacionWhatsAppResponse> => {
  const params: Record<string, string> = { phone, limit: String(limit) };
  if (conSugerencia) params.sugerencia = '1';
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${apiBase()}${WA}/conversation?${q}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  // Django responde directo { phone, cliente_id, count, messages }.
  return json as ConversacionWhatsAppResponse;
};

export interface ResponderWhatsAppResult {
  success: boolean;
  message_id?: string;
}

export const responderWhatsApp = async (
  phone: string,
  text: string
): Promise<ResponderWhatsAppResult> => {
  const res = await fetch(`${apiBase()}${WA}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone, text }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    // 502 fuera de la ventana de 24h, token vencido, etc. → mensaje de Django/Meta.
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as ResponderWhatsAppResult;
};

/** Envía un adjunto (foto/PDF/voz/video) al cliente vía Cloud API. El texto va como caption. */
export const enviarAdjuntoWhatsApp = async (
  phone: string,
  file: File,
  caption?: string
): Promise<ResponderWhatsAppResult> => {
  const fd = new FormData();
  fd.append('to', phone);
  if (caption) fd.append('caption', caption);
  fd.append('file', file);
  const res = await fetch(`${apiBase()}${WA}/send-media`, {
    method: 'POST',
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    if (res.status === 413) throw new Error('El archivo supera el límite de 16 MB');
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as ResponderWhatsAppResult;
};

/** Lista las conversaciones para poblar la bandeja de entrada (proxy a Django). */
export const fetchConversacionesWhatsApp = async (
  soloPendientes = false,
  limit = 50
): Promise<ConversacionesResponse> => {
  const q = new URLSearchParams({
    solo_pendientes: String(soloPendientes),
    limit: String(limit),
  }).toString();
  const res = await fetch(`${apiBase()}${WA}/conversations?${q}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as ConversacionesResponse;
};

/** Saca una conversación de la cola de pendientes (responder ya la atiende). */
export const marcarAtendidoWhatsApp = async (phone: string): Promise<void> => {
  const res = await fetch(
    `${apiBase()}${WA}/conversations/${encodeURIComponent(phone)}/marcar-atendido`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `HTTP ${res.status}`);
  }
};

export interface EditarNombreResult {
  ok: boolean;
  cliente_id?: number;
  cliente_nombre?: string;
}

/** Corrige el nombre del cliente (ficha canónica en Django) desde la conversación. */
export const editarNombreWhatsApp = async (
  phone: string,
  nombre: string
): Promise<EditarNombreResult> => {
  const res = await fetch(
    `${apiBase()}${WA}/conversations/${encodeURIComponent(phone)}/editar-nombre`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as EditarNombreResult;
};

/** Reporta el delta borrador-vs-enviado del agente (H-010 p1). Fire-and-forget:
 *  es dato de aprendizaje, NO debe afectar el envío → traga cualquier error. */
export const reportarFeedbackAgente = async (data: {
  phone: string;
  wa_message_id: string;
  borrador: string;
  enviado: string;
}): Promise<void> => {
  try {
    await fetch(`${apiBase()}${WA}/agente/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // ignorado a propósito (best-effort)
  }
};

/** Lista las sugerencias de aprendizaje pendientes del agente (H-010 p2). */
export const fetchSugerenciasAprendizaje = async (): Promise<SugerenciaAprendizaje[]> => {
  const res = await fetch(`${apiBase()}${WA}/agente/sugerencias-aprendizaje?estado=pendiente`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
  return (json.sugerencias ?? []) as SugerenciaAprendizaje[];
};

/** Aprueba una sugerencia (opcional texto editado). regla→Conocimiento; hecho→queda para Jorge. */
export const aprobarSugerencia = async (id: number, texto?: string): Promise<void> => {
  const res = await fetch(`${apiBase()}${WA}/agente/sugerencias-aprendizaje/${id}/aprobar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(texto != null ? { texto } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
};

/** Descarta una sugerencia de aprendizaje. */
export const descartarSugerencia = async (id: number): Promise<void> => {
  const res = await fetch(`${apiBase()}${WA}/agente/sugerencias-aprendizaje/${id}/descartar`, {
    method: 'POST',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
};

/** Lee la config del agente IA de WhatsApp (H-007). Proxy a Django, que la
 *  envuelve en `{ok, config}`. */
export const fetchAgenteConfig = async (): Promise<AgenteConfig> => {
  const res = await fetch(`${apiBase()}${WA}/agente/config`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return (json.config ?? json) as AgenteConfig;
};

/** Guarda la config del agente IA. Django valida enum/rangos (400 → mensaje) y
 *  responde `{ok, config}`. */
export const saveAgenteConfig = async (
  cambios: Partial<AgenteConfig>
): Promise<AgenteConfig> => {
  const res = await fetch(`${apiBase()}${WA}/agente/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return (json.config ?? json) as AgenteConfig;
};
