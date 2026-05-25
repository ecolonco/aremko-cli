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
  | 'descartado';

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
