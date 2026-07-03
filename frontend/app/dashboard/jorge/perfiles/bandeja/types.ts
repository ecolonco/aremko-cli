// Types compartidos entre las pantallas del Asistente Deborah.
// Espejo de las structs Go en internal/operacionvueltaacasa/client.go

export type RegionGeografica =
  | 'sur'
  | 'nacional'
  | 'extranjero'
  | 'sin_clasificar';

export interface ClienteSummary {
  id: number;
  nombre: string;
  telefono: string;
  telefono_limpio: string;
  region_geografica?: RegionGeografica;
  ciudad_canonica?: string | null;
}

export interface PerfilResumen {
  estado_valor: string;
  dias_sin_venir: number;
  cohorte: string;
  visitas_totales: number;
  gasto_historico: number;
  ultima_visita: string;
  ultima_visita_humanizada?: string;
  servicios_favoritos?: string[];
  patron_habitual?: string;
}

export interface Contacto {
  id: number;
  cliente: ClienteSummary;
  perfil_resumen: PerfilResumen;
  script_id: string;
  salva: number;
  mensaje_renderizado: string;
  /**
   * Variación generada por IA on-demand (Gemini Flash Lite via OpenRouter).
   * Mismo sentido y placeholders que `mensaje_renderizado`, distinto fraseo.
   * Null cuando: setting OVC_USAR_VARIACIONES_IA=False, LLM falla, timeout,
   * o tipo de contacto no aplica (celebración / respuesta pendiente).
   * Cuando existe, el frontend lo prefiere sobre mensaje_renderizado.
   */
  mensaje_variado?: string | null;
  prioridad: number;
  mensaje_enviado_editado?: string;
  fecha_envio?: string;
  tipo_respuesta?: string;
}

export interface Progreso {
  completados_hoy: number;
  pendientes_hoy: number;
  respuestas_pendientes: number;
  celebraciones_pendientes: number;
}

export interface ResumenSemana {
  mensajes_enviados: number;
  respuestas_recibidas: number;
  tasa_respuesta: number;
  reservas_atribuidas: number;
  ingreso_atribuido: number;
}

export interface ResumenDia {
  fecha: string;
  operador?: string;
  enviados: number;
  omitidos: number;
  no_aplica: number;
  tiempo_total_minutos?: number;
  semana_actual: ResumenSemana;
}

export type TipoSiguiente =
  | 'respuesta_pendiente'
  | 'celebracion'
  | 'nuevo_contacto'
  | 'fin_del_dia';

// Tipos de hito de celebración alineados con EventoCelebracion en Django.
export type TipoCelebracion =
  | 'recuperado_dormido'
  | 'consolidacion_regular'
  | 'migracion_devoto'
  | 'trajo_acompanante'
  | 'subio_a_leal'
  | 'subio_a_campeon';

export interface Celebracion {
  tipo: TipoCelebracion;
  descripcion?: string; // texto rendered desde backend si viene
  fecha?: string;       // YYYY-MM-DD
}

export interface SiguienteResponse {
  tipo: TipoSiguiente;
  contacto?: Contacto;
  celebracion?: Celebracion;
  progreso: Progreso;
  resumen_dia?: ResumenDia;
}

export interface Conflict409 {
  error: string;
  mensaje: string;
  eje_valor_anterior: string;
  eje_valor_actual: string;
}

export type TipoRespuesta =
  | 'reservo'
  | 'interesado'
  | 'consulto_precio'
  | 'mas_adelante'
  | 'rechazo'
  | 'opt_out'
  | 'sin_respuesta';

// Pantallas de la máquina de estados del Asistente
export type PantallaAsistente =
  | 'cargando'
  | 'inicio'
  | 'cliente_actual'
  | 'transicion'
  | 'fin_del_dia'
  | 'error';

// Estados posibles de un ContactoWhatsApp (espejo de Django choices)
export type EstadoContacto =
  | 'pendiente'
  | 'enviado'
  | 'omitido'
  | 'no_aplica'
  | 'descartado'
  | 'expirado_acumulacion';

// Versión extendida del Contacto que devuelve el endpoint /del-dia/.
// Incluye estado actual + metadatos de quién y cuándo.
export interface ContactoHistorial extends Omit<Contacto, 'mensaje_enviado_editado'> {
  estado: EstadoContacto;
  fecha_sugerido?: string;
  fecha_envio?: string;
  operador?: string;
  mensaje_enviado_editado?: string;
  respondio: boolean;
  tipo_respuesta?: TipoRespuesta | '';
  nota_operador?: string;
  cliente_opt_out_actual: boolean;
}

export interface DelDiaResponse {
  fecha: string;
  operador_filtro?: string;
  total: number;
  stats: {
    enviados: number;
    omitidos: number;
    no_aplica: number;
    pendientes: number;
    descartados: number;
  };
  limit_aplicado: number;
  contactos: ContactoHistorial[];
}

// ============================================================================
// WhatsApp Cloud API — hilo de conversación (espejo de Django /api/whatsapp/conversation)
// ============================================================================

export type DireccionMensaje = 'in' | 'out';

// Canal de la conversación (bandeja omnicanal, H-016).
export type CanalMensaje = 'whatsapp' | 'instagram' | 'messenger';

export interface MensajeWhatsApp {
  wa_message_id: string;
  direction: DireccionMensaje;
  body: string;            // texto, o caption del adjunto
  type: string;            // text | image | video | audio | voice | document | sticker
  status: string;          // received | sent | delivered | read | failed
  timestamp: string;       // ISO 8601
  media_url?: string | null;  // URL del adjunto en Django (null si es texto)
  mime_type?: string | null;
  filename?: string | null;   // nombre original (documentos)
  canal?: CanalMensaje;       // omnicanal (ausente = whatsapp legacy)
}

// Mensaje del hilo unificado (Django /api/inbox/conversation). A diferencia de
// MensajeWhatsApp usa external_message_id (no wa_message_id) y trae el canal.
export interface MensajeInbox {
  external_message_id: string;
  canal: CanalMensaje;
  direction: DireccionMensaje;
  body: string;
  type: string;
  status: string;
  timestamp: string;
  media_url?: string | null; // adjunto en Django (H-020); null si es texto
  mime_type?: string | null;
  filename?: string | null;
}

export interface ConversacionInboxResponse {
  canal: CanalMensaje;
  external_id: string;
  cliente_id: number | null;
  contact_name?: string | null;
  count: number;
  messages: MensajeInbox[];
  // Borrador del agente IA (H-019), opt-in con &sugerencia=1. Null/ausente si no.
  sugerencia_agente?: SugerenciaAgente | null;
  // Propuesta de reserva pendiente de aprobación de Deborah (H-028). Null si no hay.
  propuesta_reserva?: PropuestaReserva | null;
  // Reserva recién creada por el Aprobar del cliente (H-039). Null si no hay.
  reserva_creada?: ReservaCreada | null;
  // Carrito que Luna va armando antes de cotizar (H-046). Null si no aplica.
  carrito_en_curso?: CarritoEnCurso | null;
}

// Propuesta de reserva que Luna armó y el cliente confirmó (H-028). Deborah la
// aprueba con un botón → se crea la reserva en el sistema.
export interface PropuestaReserva {
  propuesta_id: string;
  resumen: string;
  total: number;
  servicios: {
    servicio_nombre: string;
    // H-042: ids para editar la cotización. Las líneas reales traen uno u otro;
    // la línea sintética de "Descuento de servicios" no trae ninguno (no editable).
    servicio_id?: number; // servicio (tina/masaje/cabaña)
    producto_id?: number; // producto (es_producto:true); su cantidad va en cantidad_personas
    fecha: string | null; // H-040: null si la línea es un producto (tabla/jugo)
    hora: string | null;
    cantidad_personas: number;
    subtotal: number;
    es_producto?: boolean; // H-040: línea de producto agregado a la propuesta (sin fecha/hora)
  }[];
  // H-039: link firmado de la cotización boutique (lo expone Django; no es generable
  // desde aquí). Si viene, el cajón muestra el borrador con este link para que Deborah
  // lo envíe → el cliente abre la cotización y la aprueba.
  url_cotizacion?: string | null;
}

// Carrito en curso que Luna va armando ANTES de generar la cotización (H-046,
// Fase 1: solo lectura). Mismo shape de líneas que PropuestaReserva.servicios para
// reusar el render del cajón. Django lo manda null si no hay ítems, si el carrito
// es viejo (>24h), o si ya hay propuesta_reserva vigente (ahí manda la propuesta).
export interface CarritoEnCurso {
  servicios: PropuestaReserva['servicios'];
  total: number;
  editable: boolean; // Fase 1 = false (solo lectura); Fase 2 lo hará editable
}

// Una combinación válida de tina+masaje (Pausa junto al río) para una fecha,
// con el texto ya formateado listo para pegar en el borrador (H-058).
export interface PausaAlternativa {
  etiqueta: string;
  tina: string;
  hora_tina: string;
  hora_masaje: string;
  precio_total: number;
  precio_con_descuento: number;
  hay_descuento: boolean;
  texto_sugerido: string;
}

export interface PausaAlternativasResponse {
  fecha: string;
  personas: number;
  alternativas: PausaAlternativa[];
}

// Reserva ya creada tras el Aprobar del cliente en la cotización (H-039, Fase 3).
// Django la expone en el payload de la conversación cuando la última PropuestaReserva
// del hilo quedó en estado 'creada'. El cajón muestra "Revisar y enviar Ficha".
export interface ReservaCreada {
  reserva_id: number;
  numero: string;
  total: number;
  resumen?: string | null;
  url_ficha?: string | null; // link firmado de la Ficha del cliente (Django)
}

// Sugerencia del agente IA (H-007, Fase 1) para el último entrante sin responder.
export interface SugerenciaAgente {
  texto: string;
  escalar: boolean;
  motivo: string | null;
  modo: string | null;
  modelo: string | null;
  error: string | null;
  generada_at: string | null;
  responde_a: string | null; // wa_message_id del entrante al que responde
}

export interface ConversacionWhatsAppResponse {
  phone: string;
  cliente_id: number | null;
  count: number;
  messages: MensajeWhatsApp[];
  sugerencia_agente?: SugerenciaAgente | null;
  propuesta_reserva?: PropuestaReserva | null;
  reserva_creada?: ReservaCreada | null;
  carrito_en_curso?: CarritoEnCurso | null; // H-046: carrito en vivo (solo lectura)
}

// Config del agente IA de WhatsApp (H-007). El backend la proxea a Django.
export interface AgenteConfig {
  activo: boolean;
  modo: 'borrador' | 'auto_info' | 'auto' | string;
  persona_tono: string;
  link_reserva: string;
  model_name: string;
  modelo_efectivo: string;
  temperature: number;
  max_tokens: number;
  history_window: number;
  pausa_horas_tras_humano: number;
  prompt_version: string | number;
  // Mensaje de ausencia (H-008)
  ausencia_activa: boolean;
  ausencia_mensaje: string;
  ausencia_anti_spam_horas: number;
  // Conocimiento / correcciones (H-009a): una regla por línea, autoridad máxima.
  conocimiento: string;
}

// Envío de plantilla por aprobar (H-012): la Bandeja propone contactar a un
// cliente con una plantilla aprobada; Deborah revisa y aprueba.
export interface EnvioPlantilla {
  contacto_id: number;
  cliente_id: number | null;
  cliente_nombre: string | null;
  phone: string;
  motivo: string;
  script_id: number | string;
  plantilla: string;
  preview: string;
  salva: number | string | null;
  prioridad: number | string | null;
  fecha_sugerido: string | null;
}

// Sugerencia de aprendizaje (H-010 p2): el agente clasifica la corrección de
// Deborah y propone una acción. `destino`/`aprueba` vienen listos para mostrar.
export interface SugerenciaAprendizaje {
  id: number;
  phone: string;
  tipo: 'hecho_catalogo' | 'regla' | 'tono' | 'puntual' | string;
  estado: string;
  texto_propuesto: string;
  ref_catalogo: string | null;
  motivo: string | null;
  borrador: string;
  enviado: string;
  destino: string;
  aprueba: string;
  created_at: string;
}

// Fila del listado de conversaciones (bandeja de entrada).
export interface ConversacionResumen {
  phone: string;                 // E.164 (WhatsApp); null/"" en Instagram
  canal?: CanalMensaje;          // omnicanal (H-016); ausente = whatsapp legacy
  external_id?: string;          // identidad por canal: phone (WA) / IGSID (IG)
  contact_name?: string | null;  // nombre del perfil del canal (ej. @usuario IG)
  cliente_id: number | null;
  cliente_nombre: string | null;
  ultimo_mensaje: string;
  ultimo_direction: DireccionMensaje;
  ultimo_timestamp: string;
  sin_responder: number;
  requiere_atencion: boolean;
  total_mensajes: number;
}

export interface ConversacionesResponse {
  count: number;
  conversations: ConversacionResumen[];
}

// ============================================================================
// Métricas atribución por operador (MVP last-touch, ventana 60d)
// ============================================================================

export interface FamiliaStats {
  familia: string;
  reservas: number;
  monto: number;
}

export interface OperadorMetricas {
  username: string;
  mensajes_enviados: number;
  respuestas: number;
  tasa_respuesta: number;
  reservas_atribuidas: number;
  tasa_conversion: number;
  monto_atribuido: number;
  ticket_promedio_atribuido: number;
  familias_top: FamiliaStats[];
}

export interface MetricasOperadoresTotales {
  mensajes_enviados: number;
  respuestas: number;
  tasa_respuesta: number;
  reservas_atribuidas: number;
  tasa_conversion: number;
  monto_atribuido: number;
  ticket_promedio_atribuido: number;
}

export interface MetricasOperadoresResponse {
  periodo: { desde: string; hasta: string };
  ventana_atribucion_dias: number;
  totales: MetricasOperadoresTotales;
  operadores: OperadorMetricas[];
}
