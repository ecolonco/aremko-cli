// Tipos de la Bandeja de salida "Conexión-Masajes".
// El backend Go proxea a Django; estos tipos reflejan el JSON que entrega Django
// (ver brief del agente Django). aremko-cli solo muestra/edita/envía/cancela.

export type EstadoMasaje = 'pendiente' | 'enviado' | 'error' | 'cancelado';

export type TipoEmailMasaje =
  | 'gracias_visita'
  | 'resumen_bienestar'
  | 'seguimiento_7d'
  | 'recomendacion_30d'
  | 'reactivacion_60d'
  | 'reactivacion_90d';

export type OperadorMasaje = 'debora' | 'angelica' | 'jorge';

export type RegionMasaje = 'sur' | 'nacional' | 'extranjero' | 'sin_clasificar';

export interface MasajeOutboxItem {
  id: number;
  tipo_email: TipoEmailMasaje | string;
  tipo_label: string;
  estado: EstadoMasaje | string;
  destinatario_nombre: string;
  destinatario_email: string;
  fecha_programada: string | null;
  fecha_envio: string | null;
  asunto: string;
  cuerpo: string;
  reserva_id: number | null;
  enviado_por: string;
  editado_por: string;
  editado_at: string | null;
  error_log: string;
  // Datos enriquecidos del cliente (agregados por Django 2026-06-07).
  destinatario_telefono?: string;
  ciudad?: string | null;
  region?: RegionMasaje | string;
  region_label?: string;
  apto_visita?: boolean;
  servicio?: string | null;
  fecha_visita?: string | null; // YYYY-MM-DD
  num_visitas?: number;
  cliente_nuevo?: boolean;
  // Solo presente en "para_enviar" (vencidos). En "programados" no viene.
  preview_html?: string | null;
}

export interface MasajeOutboxResponse {
  ok: boolean;
  para_enviar: MasajeOutboxItem[];
  programados: MasajeOutboxItem[];
  total_para_enviar: number;
  total_programados: number;
}
