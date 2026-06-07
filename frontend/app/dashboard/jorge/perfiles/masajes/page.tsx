'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Mail,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Eye,
  Pencil,
  Send,
  Trash2,
  Clock,
  X,
  CheckCircle2,
  Copy,
  MapPin,
  Phone,
  MessageCircle,
} from 'lucide-react';
import {
  fetchOutbox,
  editarItem,
  enviarItem,
  cancelarItem,
  previewUrl,
} from './api';
import type { MasajeOutboxItem, MasajeOutboxResponse, OperadorMasaje } from './types';

const POLL_MS = 60_000;
const OPERADORES: OperadorMasaje[] = ['debora', 'angelica', 'jorge'];

const fmtFechaCL = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtFechaVisita = (d?: string | null): string => {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};

// wa.me requiere el número sin "+" ni separadores.
const waLink = (tel?: string): string | null => {
  if (!tel) return null;
  const num = tel.replace(/[^0-9]/g, '');
  return num ? `https://wa.me/${num}` : null;
};

const ESTADO_STYLE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  enviado: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
  cancelado: 'bg-slate-200 text-slate-600',
};

function EstadoBadge({ estado }: { estado: string }) {
  const cls = ESTADO_STYLE[estado] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {estado}
    </span>
  );
}

const GEO_STYLE: Record<string, { cls: string; icon: string }> = {
  sur: { cls: 'bg-emerald-100 text-emerald-800', icon: '✅' },
  nacional: { cls: 'bg-amber-100 text-amber-800', icon: '⚠️' },
  extranjero: { cls: 'bg-amber-100 text-amber-800', icon: '⚠️' },
  sin_clasificar: { cls: 'bg-slate-200 text-slate-600', icon: '❓' },
};

// Badge de elegibilidad geográfica: solo 'sur' es apto para ofrecer visita.
function BadgeGeo({ item }: { item: MasajeOutboxItem }) {
  const region = (item.region as string) ?? 'sin_clasificar';
  const label = item.region_label ?? region;
  const s = GEO_STYLE[region] ?? GEO_STYLE.sin_clasificar;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}
      title={
        region === 'sur'
          ? 'Cliente del sur: puede recibir visita'
          : region === 'sin_clasificar'
            ? 'Sin ciudad reconocida: revisar antes de ofrecer visita'
            : 'Fuera de zona: no ofrecer visita presencial'
      }
    >
      {s.icon} {label}
    </span>
  );
}

// Ficha de contacto del cliente: email/teléfono copiables + WhatsApp + ciudad +
// contexto de la última visita. Reutilizada en la lista y en el modal.
function FichaCliente({
  item,
  onCopiar,
}: {
  item: MasajeOutboxItem;
  onCopiar: (texto: string, etiqueta: string) => void;
}) {
  const wa = waLink(item.destinatario_telefono);
  const tieneReserva = !!item.servicio || item.num_visitas != null;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <span className="truncate">{item.destinatario_email}</span>
        <button
          type="button"
          onClick={() => onCopiar(item.destinatario_email, 'Email')}
          title="Copiar email"
          aria-label="Copiar email"
          className="flex-shrink-0 text-slate-400 hover:text-slate-700"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      {item.destinatario_telefono && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {item.destinatario_telefono}
          </span>
          <button
            type="button"
            onClick={() => onCopiar(item.destinatario_telefono as string, 'Teléfono')}
            title="Copiar teléfono"
            aria-label="Copiar teléfono"
            className="flex-shrink-0 text-slate-400 hover:text-slate-700"
          >
            <Copy className="h-3 w-3" />
          </button>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir chat de WhatsApp"
              className="inline-flex items-center gap-0.5 font-medium text-emerald-600 hover:text-emerald-700"
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 text-xs text-slate-600">
        <MapPin className="h-3 w-3 flex-shrink-0 text-slate-400" />
        <span>{item.ciudad || (item.region_label ?? 'Ciudad no registrada')}</span>
      </div>
      {tieneReserva && (
        <div className="text-xs text-slate-500">
          {item.servicio ? `💆 ${item.servicio}` : ''}
          {item.fecha_visita ? ` · visitó ${fmtFechaVisita(item.fecha_visita)}` : ''}
          {item.num_visitas != null
            ? ` · ${item.cliente_nuevo ? 'cliente nuevo' : `${item.num_visitas} visitas`}`
            : ''}
        </div>
      )}
    </div>
  );
}

export default function BandejaMasajesPage() {
  const [data, setData] = useState<MasajeOutboxResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operador, setOperador] = useState<OperadorMasaje>('jorge');
  const [aviso, setAviso] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<MasajeOutboxItem | null>(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const d = await fetchOutbox();
      setData(d);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar la bandeja');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Auto-refresco suave (volumen bajo, no hace falta más frecuente).
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const id = setInterval(() => cargarRef.current(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const mapError = (status: number, msg?: string | null): string => {
    if (status === 409)
      return 'Este seguimiento ya no está pendiente (quizás ya se envió o se canceló). Refresca la bandeja.';
    if (status === 401) return 'Credencial no válida con el servidor.';
    if (status === 404) return 'El seguimiento ya no existe.';
    return msg || `Error (HTTP ${status})`;
  };

  const onEnviar = async (item: MasajeOutboxItem) => {
    if (
      !window.confirm(
        `¿Enviar ahora el email a ${item.destinatario_nombre} (${item.destinatario_email})?\n\nEs definitivo: una vez enviado no se puede deshacer.`
      )
    )
      return;
    setAccionando(item.id);
    setAviso(null);
    try {
      const r = await enviarItem(item.id, operador);
      if (r.ok) {
        setAviso(`✅ Email enviado a ${item.destinatario_nombre}.`);
      } else if (r.status === 422 && r.estado === 'cancelado') {
        setAviso(`⚠️ ${item.destinatario_nombre} se dio de baja; no se envió.`);
      } else {
        setAviso(`⚠️ ${mapError(r.status, r.error)}`);
      }
      setDetalle(null);
      await cargar(true);
    } catch (e: unknown) {
      setAviso(`⚠️ ${e instanceof Error ? e.message : 'Error al enviar'}`);
    } finally {
      setAccionando(null);
    }
  };

  const onCancelar = async (item: MasajeOutboxItem) => {
    if (
      !window.confirm(
        `Este email a ${item.destinatario_nombre} quedará descartado y NO se enviará.\n\n(No se borra el registro; queda en el historial como descartado.) ¿Continuar?`
      )
    )
      return;
    setAccionando(item.id);
    setAviso(null);
    try {
      const r = await cancelarItem(item.id, operador);
      if (r.ok) setAviso(`🗑️ Email a ${item.destinatario_nombre} descartado (no se enviará).`);
      else setAviso(`⚠️ ${mapError(r.status, r.error)}`);
      setDetalle(null);
      await cargar(true);
    } catch (e: unknown) {
      setAviso(`⚠️ ${e instanceof Error ? e.message : 'Error al cancelar'}`);
    } finally {
      setAccionando(null);
    }
  };

  const onCopiar = async (texto: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(`📋 ${etiqueta} copiado al portapapeles.`);
    } catch {
      setAviso('⚠️ No se pudo copiar (el navegador bloqueó el portapapeles).');
    }
  };

  const paraEnviar = data?.para_enviar ?? [];
  const programados = data?.programados ?? [];

  // Cuántos correos pendientes tiene cada cliente (por email) en "Para enviar",
  // para avisar cuando un mismo cliente aparece más de una vez y no contactarlo de más.
  const conteoPorCliente: Record<string, number> = {};
  for (const it of paraEnviar) {
    const k = (it.destinatario_email || '').toLowerCase();
    if (k) conteoPorCliente[k] = (conteoPorCliente[k] || 0) + 1;
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Mail className="h-7 w-7 text-emerald-600" />
            Conexión-Masajes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Emails de seguimiento de bienestar post-masaje. Revísalos, edítalos si hace falta y
            envíalos uno por uno. El formato de marca (logo, botones, baja) lo agrega el sistema.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Operando como:
            <select
              value={operador}
              onChange={(e) => setOperador(e.target.value as OperadorMasaje)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm capitalize focus:border-emerald-500 focus:outline-none"
            >
              {OPERADORES.map((o) => (
                <option key={o} value={o} className="capitalize">
                  {o}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => cargar()} variant="outline" size="sm" disabled={cargando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Aviso de acción */}
      {aviso && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          <span>{aviso}</span>
          <button
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error de carga */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Para enviar (vencidos, accionables) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-emerald-600" />
            Para enviar
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {paraEnviar.length}
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Vencidos y listos para revisar y enviar a su destinatario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex justify-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : paraEnviar.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay emails pendientes de enviar. 🎉
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {paraEnviar.map((item) => {
                const nCliente =
                  conteoPorCliente[(item.destinatario_email || '').toLowerCase()] || 0;
                return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-900">
                        {item.destinatario_nombre}
                      </span>
                      <EstadoBadge estado={item.estado} />
                      <BadgeGeo item={item} />
                      {nCliente > 1 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                          title="Este cliente tiene más de un correo pendiente en esta lista. Revísalos antes de enviar para no contactarlo de más."
                        >
                          ⚠️ {nCliente} correos para este cliente
                        </span>
                      )}
                    </div>
                    <FichaCliente item={item} onCopiar={onCopiar} />
                    <div className="text-xs text-slate-600">
                      {item.tipo_label} · <Clock className="inline h-3 w-3" />{' '}
                      {fmtFechaCL(item.fecha_programada)}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCopiar(item.cuerpo, 'Mensaje')}
                      title="Copiar el texto del mensaje para pegarlo en WhatsApp"
                    >
                      <Copy className="mr-1 h-4 w-4" /> Copiar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDetalle(item)}>
                      <Eye className="mr-1 h-4 w-4" /> Ver
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={accionando === item.id || item.estado !== 'pendiente'}
                      onClick={() => onEnviar(item)}
                    >
                      {accionando === item.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-4 w-4" />
                      )}
                      Enviar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={accionando === item.id || item.estado !== 'pendiente'}
                      onClick={() => onCancelar(item)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Descartar
                    </Button>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Programados (futuros, solo lectura) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-slate-500" />
            Programados
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {programados.length}
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Futuros (aún no vencen). Solo visibilidad; podrás enviarlos cuando lleguen a “Para
            enviar”.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {programados.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No hay emails programados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {programados.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {item.destinatario_nombre}
                      </span>
                      <BadgeGeo item={item} />
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {item.ciudad ? `${item.ciudad} · ` : ''}
                      {item.tipo_label} · {fmtFechaCL(item.fecha_programada)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setDetalle(item)}>
                    <Eye className="mr-1 h-4 w-4" /> Ver
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Modal detalle: ver preview + editar + acciones */}
      {detalle && (
        <DetalleModal
          item={detalle}
          operador={operador}
          accionando={accionando === detalle.id}
          onClose={() => setDetalle(null)}
          onEnviar={() => onEnviar(detalle)}
          onCancelar={() => onCancelar(detalle)}
          onGuardado={async (actualizado) => {
            setDetalle(actualizado);
            await cargar(true);
          }}
          onAviso={setAviso}
          onCopiar={onCopiar}
        />
      )}
    </div>
  );
}

function DetalleModal({
  item,
  operador,
  accionando,
  onClose,
  onEnviar,
  onCancelar,
  onGuardado,
  onAviso,
  onCopiar,
}: {
  item: MasajeOutboxItem;
  operador: OperadorMasaje;
  accionando: boolean;
  onClose: () => void;
  onEnviar: () => void;
  onCancelar: () => void;
  onGuardado: (actualizado: MasajeOutboxItem) => void;
  onAviso: (msg: string) => void;
  onCopiar: (texto: string, etiqueta: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [asunto, setAsunto] = useState(item.asunto);
  const [cuerpo, setCuerpo] = useState(item.cuerpo);
  const [guardando, setGuardando] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const esPendiente = item.estado === 'pendiente';

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await editarItem(item.id, asunto, cuerpo, operador);
      if (r.ok && r.item) {
        onGuardado(r.item);
        setEditando(false);
        setRefresh((n) => n + 1); // recarga el iframe del preview con lo editado
        onAviso('✏️ Cambios guardados.');
      } else {
        onAviso(`⚠️ No se pudo guardar (HTTP ${r.status}). ${r.error ?? ''}`.trim());
      }
    } catch (e: unknown) {
      onAviso(`⚠️ ${e instanceof Error ? e.message : 'Error al guardar'}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{item.destinatario_nombre}</h3>
              <EstadoBadge estado={item.estado} />
              <BadgeGeo item={item} />
            </div>
            <p className="text-xs text-slate-500">
              {item.tipo_label}
              {item.fecha_visita ? ` · visitó ${fmtFechaVisita(item.fecha_visita)}` : ''}
            </p>
            <div className="mt-1.5">
              <FichaCliente item={item} onCopiar={onCopiar} />
            </div>
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => onCopiar(item.cuerpo, 'Mensaje')}
                title="Para pegarlo en WhatsApp"
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                <Copy className="h-3 w-3" /> Copiar mensaje
              </button>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-4">
          {editando ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Asunto</label>
                <input
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Cuerpo (texto; el sistema agrega logo, botones y footer al enviar)
                </label>
                <textarea
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  rows={12}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Asunto:</span> {item.asunto}
              </p>
              <p className="text-xs text-slate-500">
                Vista previa del email tal como lo recibirá el cliente:
              </p>
              <iframe
                key={refresh}
                title="Vista previa del email"
                src={`${previewUrl(item.id)}?t=${refresh}`}
                sandbox=""
                className="h-[50vh] w-full rounded-md border border-slate-200 bg-white"
              />
            </div>
          )}

          {/* Auditoría */}
          {(item.enviado_por || item.editado_por || item.error_log) && (
            <div className="mt-3 space-y-0.5 border-t pt-3 text-xs text-slate-500">
              {item.editado_por && (
                <div>
                  Editado por {item.editado_por}
                  {item.editado_at ? ` · ${fmtFechaCL(item.editado_at)}` : ''}
                </div>
              )}
              {item.enviado_por && (
                <div>
                  Enviado por {item.enviado_por}
                  {item.fecha_envio ? ` · ${fmtFechaCL(item.fecha_envio)}` : ''}
                </div>
              )}
              {item.error_log && <div className="text-red-600">Error: {item.error_log}</div>}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4">
          {editando ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditando(false);
                  setAsunto(item.asunto);
                  setCuerpo(item.cuerpo);
                }}
                disabled={guardando}
              >
                Cancelar edición
              </Button>
              <Button size="sm" onClick={guardar} disabled={guardando}>
                {guardando ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                Guardar
              </Button>
            </>
          ) : esPendiente ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={onCancelar} disabled={accionando}>
                <Trash2 className="mr-1 h-4 w-4" /> Descartar
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={onEnviar}
                disabled={accionando}
              >
                {accionando ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Enviar
              </Button>
            </>
          ) : (
            <span className="text-xs text-slate-400">
              Este seguimiento ya no se puede modificar (estado: {item.estado}).
            </span>
          )}
        </div>
      </div>
    </>
  );
}
