'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  SkipForward,
  XCircle,
  Ban,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  Clock,
} from 'lucide-react';
import {
  fetchDelDia,
  bloquearCliente,
  marcarNoAplica,
  registrarRespuesta,
} from './api';
import type {
  ContactoHistorial,
  DelDiaResponse,
  EstadoContacto,
  TipoRespuesta,
} from './types';
import { RegionBadge } from './RegionBadge';
import { EditorUbicacion } from './EditorUbicacion';

interface HistorialDrawerProps {
  open: boolean;
  onClose: () => void;
  operadorActivo: string; // username
  /** Llamado después de cualquier acción exitosa, para que la página principal recargue */
  onAccionAplicada: () => void;
}

// ============================================================================
// Helpers visuales por estado
// ============================================================================

const estadoBadge: Record<EstadoContacto, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  enviado: { label: 'Enviado', cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  omitido: { label: 'Saltado', cls: 'bg-yellow-100 text-yellow-800', icon: SkipForward },
  no_aplica: { label: 'No aplica', cls: 'bg-slate-200 text-slate-700', icon: XCircle },
  pendiente: { label: 'Pendiente', cls: 'bg-blue-100 text-blue-800', icon: Clock },
  descartado: { label: 'Descartado', cls: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const formatHora = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================================================
// Sub-componente: fila expandible por contacto
// ============================================================================

interface FilaProps {
  contacto: ContactoHistorial;
  expanded: boolean;
  onToggle: () => void;
  operadorActivo: string;
  onAccion: () => void;
}

function FilaContacto({ contacto, expanded, onToggle, operadorActivo, onAccion }: FilaProps) {
  const [trabajando, setTrabajando] = useState(false);
  const [tipoRespuestaSel, setTipoRespuestaSel] = useState<TipoRespuesta | ''>('');
  // Override local de ciudad para feedback inmediato al editar
  const [regionOverride, setRegionOverride] = useState<typeof contacto.cliente.region_geografica | null>(null);
  const [ciudadOverride, setCiudadOverride] = useState<string | null>(null);
  const regionDisplay = regionOverride ?? contacto.cliente.region_geografica;
  const ciudadDisplay = ciudadOverride !== null ? ciudadOverride : contacto.cliente.ciudad_canonica;

  const badge = estadoBadge[contacto.estado];
  const Icon = badge.icon;
  const yaBloqueado = contacto.cliente_opt_out_actual;
  const yaRespondido = contacto.respondio && contacto.tipo_respuesta;

  // Acciones disponibles según estado actual del contacto
  const puedeBloquear = !yaBloqueado;
  const puedeNoAplica = contacto.estado === 'pendiente';
  const puedeRegistrarRespuesta = contacto.estado === 'enviado' && !yaRespondido;

  const handleBloquear = useCallback(async () => {
    const razon = window.prompt(
      `Bloquear permanente a ${contacto.cliente.nombre}. Razón:`,
      ''
    );
    if (razon === null) return;
    setTrabajando(true);
    try {
      await bloquearCliente(contacto.id, operadorActivo, razon || undefined);
      onAccion();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTrabajando(false);
    }
  }, [contacto, operadorActivo, onAccion]);

  const handleNoAplica = useCallback(async () => {
    const razon = window.prompt(
      `Marcar No aplica a ${contacto.cliente.nombre}. Razón (opcional):`,
      ''
    );
    if (razon === null) return;
    setTrabajando(true);
    try {
      await marcarNoAplica(contacto.id, operadorActivo, razon || undefined);
      onAccion();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTrabajando(false);
    }
  }, [contacto, operadorActivo, onAccion]);

  const handleRegistrarRespuesta = useCallback(async () => {
    if (!tipoRespuestaSel) {
      alert('Selecciona qué tipo de respuesta dio el cliente');
      return;
    }
    setTrabajando(true);
    try {
      await registrarRespuesta(contacto.id, {
        respondio: tipoRespuestaSel !== 'sin_respuesta',
        tipo_respuesta: tipoRespuestaSel,
        operador: operadorActivo,
      });
      onAccion();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTrabajando(false);
    }
  }, [contacto, tipoRespuestaSel, operadorActivo, onAccion]);

  return (
    <div className={`border-b border-slate-200 ${expanded ? 'bg-slate-50' : ''}`}>
      {/* Fila colapsada */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-slate-800">
              {contacto.cliente.nombre}
            </p>
            <RegionBadge
              region={regionDisplay}
              ciudad={ciudadDisplay}
              size="xs"
              showCiudad={false}
            />
            {contacto.perfil_resumen.cohorte?.includes('Pareja Romántica') && (
              <span
                className="inline-flex items-center rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-800"
                title="Pareja Romántica"
              >
                💕
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">
            {contacto.perfil_resumen.cohorte} · script {contacto.script_id}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {yaBloqueado && (
            <Ban
              className="h-3.5 w-3.5 text-red-500"
              aria-label="Cliente bloqueado"
            />
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
          >
            <Icon className="h-3 w-3" />
            {badge.label}
          </span>
          {contacto.fecha_envio && (
            <span className="text-[10px] text-slate-400">
              {formatHora(contacto.fecha_envio)}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Detalle expandido */}
      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {/* Mensaje */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Mensaje{' '}
              {contacto.mensaje_enviado_editado ? '(editado al enviar)' : ''}
            </p>
            <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 font-sans text-xs leading-relaxed text-slate-700">
              {contacto.mensaje_enviado_editado || contacto.mensaje_renderizado}
            </pre>
          </div>

          {/* Metadatos */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="col-span-2 flex items-center gap-2">
              <RegionBadge
                region={regionDisplay}
                ciudad={ciudadDisplay}
                size="xs"
              />
              <EditorUbicacion
                clienteID={contacto.cliente.id}
                regionActual={regionDisplay}
                ciudadActual={ciudadDisplay}
                operador={operadorActivo}
                onActualizada={(region, ciudad) => {
                  setRegionOverride(region);
                  setCiudadOverride(ciudad);
                }}
                modo="expandible"
              />
            </div>
            {contacto.operador && (
              <p>
                <strong>Por:</strong> {contacto.operador}
              </p>
            )}
            {contacto.fecha_envio && (
              <p>
                <strong>Hora:</strong> {formatHora(contacto.fecha_envio)}
              </p>
            )}
            {yaRespondido && (
              <p className="col-span-2">
                <strong>Respuesta registrada:</strong> {contacto.tipo_respuesta}
                {contacto.nota_operador && ` — ${contacto.nota_operador}`}
              </p>
            )}
            {yaBloqueado && (
              <p className="col-span-2 rounded bg-red-50 px-2 py-1 text-red-800">
                <Ban className="mr-1 inline h-3 w-3" />
                Cliente bloqueado permanente (opt-out)
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-2">
            {puedeBloquear && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBloquear}
                disabled={trabajando}
                className="h-7 px-2 text-xs text-red-700 hover:bg-red-50"
              >
                <Ban className="mr-1 h-3 w-3" />
                Bloquear permanente
              </Button>
            )}
            {puedeNoAplica && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNoAplica}
                disabled={trabajando}
                className="h-7 px-2 text-xs"
              >
                <XCircle className="mr-1 h-3 w-3" />
                No aplica
              </Button>
            )}
            {puedeRegistrarRespuesta && (
              <div className="flex w-full items-center gap-1 rounded border border-slate-200 bg-white p-1">
                <MessageSquare className="ml-1 h-3 w-3 text-slate-500" />
                <select
                  value={tipoRespuestaSel}
                  onChange={(e) =>
                    setTipoRespuestaSel(e.target.value as TipoRespuesta | '')
                  }
                  disabled={trabajando}
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                >
                  <option value="">Respuesta tardía…</option>
                  <option value="reservo">Reservó</option>
                  <option value="interesado">Interesada/o</option>
                  <option value="consulto_precio">Consultó precio</option>
                  <option value="mas_adelante">Más adelante</option>
                  <option value="rechazo">Rechazó</option>
                  <option value="opt_out">Pidió no escribir más</option>
                  <option value="sin_respuesta">Sin respuesta</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegistrarRespuesta}
                  disabled={trabajando || !tipoRespuestaSel}
                  className="h-6 px-2 text-xs"
                >
                  Guardar
                </Button>
              </div>
            )}
            {!puedeBloquear && !puedeNoAplica && !puedeRegistrarRespuesta && (
              <p className="text-xs text-slate-400">
                Sin acciones disponibles para este contacto
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Componente principal: drawer lateral
// ============================================================================

type FiltroEstado = 'todos' | EstadoContacto;
type FiltroOperador = 'todos' | 'mios';

export function HistorialDrawer({
  open,
  onClose,
  operadorActivo,
  onAccionAplicada,
}: HistorialDrawerProps) {
  const [data, setData] = useState<DelDiaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroOperador, setFiltroOperador] = useState<FiltroOperador>('todos');
  const [expandedID, setExpandedID] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDelDia({
        operador: filtroOperador === 'mios' ? operadorActivo : undefined,
        limit: 200,
      });
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [filtroOperador, operadorActivo]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  // Polling cada 30s mientras el drawer esté abierto y NO haya una fila
  // expandida (señal de que el operador puede estar leyendo/editando algo).
  useEffect(() => {
    if (!open) return;
    if (expandedID !== null) return; // pausar polling si está editando
    const interval = setInterval(() => {
      cargar();
    }, 30_000);
    return () => clearInterval(interval);
  }, [open, expandedID, cargar]);

  const contactosFiltrados = useMemo(() => {
    if (!data) return [];
    if (filtroEstado === 'todos') return data.contactos;
    return data.contactos.filter((c) => c.estado === filtroEstado);
  }, [data, filtroEstado]);

  const handleAccionExitosa = useCallback(() => {
    // Recarga la lista del drawer + dispara que la página principal también recargue
    cargar();
    onAccionAplicada();
  }, [cargar, onAccionAplicada]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Historial de hoy
            </h2>
            <p className="text-xs text-slate-500">
              Aquí puedes volver atrás y aplicar acciones sobre contactos ya procesados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Stats + Filtros */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          {data && (
            <p className="mb-2 text-xs text-slate-600">
              <strong>{data.stats.enviados}</strong> enviados ·{' '}
              <strong>{data.stats.omitidos}</strong> saltados ·{' '}
              <strong>{data.stats.no_aplica}</strong> no aplica ·{' '}
              <strong>{data.stats.pendientes}</strong> pendientes
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center text-[10px] text-slate-500">
              <Filter className="mr-1 h-3 w-3" />
              Filtros:
            </span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="todos">Todos los estados</option>
              <option value="enviado">Solo enviados</option>
              <option value="omitido">Solo saltados</option>
              <option value="no_aplica">Solo no aplica</option>
              <option value="pendiente">Solo pendientes</option>
            </select>
            <select
              value={filtroOperador}
              onChange={(e) =>
                setFiltroOperador(e.target.value as FiltroOperador)
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="todos">Todos los operadores</option>
              <option value="mios">Solo los míos</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={cargar}
              disabled={loading}
              className="ml-auto h-7 px-2 text-xs"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Refrescar'
              )}
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading && !data ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="m-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">No pude cargar el historial</p>
                <p className="mt-1 text-xs">{error}</p>
                <p className="mt-2 text-xs text-red-600">
                  Si el endpoint /del-dia/ aún no está desplegado en Django,
                  esto es esperado. La feature está lista del lado frontend.
                </p>
              </div>
            </div>
          ) : contactosFiltrados.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              No hay contactos que coincidan con los filtros.
            </p>
          ) : (
            <>
              {/* Aviso si el endpoint truncó por limit */}
              {data && data.total > data.contactos.length && (
                <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
                  Mostrando {data.contactos.length} de {data.total} contactos del día
                  (límite {data.limit_aplicado}). Usá los filtros para acotar.
                </p>
              )}
              <div>
                {contactosFiltrados.map((c) => (
                  <FilaContacto
                    key={c.id}
                    contacto={c}
                    expanded={expandedID === c.id}
                    onToggle={() =>
                      setExpandedID(expandedID === c.id ? null : c.id)
                    }
                    operadorActivo={operadorActivo}
                    onAccion={handleAccionExitosa}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
