'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  CalendarCheck,
  Send,
  AlertTriangle,
  X,
  Pencil,
  Trash2,
  Minus,
  Plus,
  Check,
  Loader2,
  ShoppingCart,
} from 'lucide-react';
import type { PropuestaReserva, ReservaCreada, CarritoEnCurso } from './types';
import {
  editarPropuestaLuna,
  descartarPropuestaLuna,
  fetchCatalogoAgregables,
  type CatalogoAgregablesResp,
  type AgregableAmbientacion,
  type AgregableProducto,
} from './api';

const clp = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

// Reservas creadas que Deborah ya cerró en el cajón (tras enviar la Ficha). Se guarda
// en el navegador para que el banner verde NO reaparezca al Actualizar (Django lo sigue
// devolviendo hasta 48h). Por estación, no por servidor.
const STORAGE_KEY = 'aremko:reservas_creadas_cerradas';

interface Props {
  propuesta: PropuestaReserva | null; // pendiente de que el cliente apruebe
  reservaCreada: ReservaCreada | null; // ya aprobada por el cliente (H-039)
  carrito: CarritoEnCurso | null; // H-046: carrito que Luna arma antes de cotizar (solo lectura)
  // Pone un borrador en el cajón para que Deborah lo revise y lo envíe.
  onUsarTexto: (texto: string) => void;
  // H-042: tras editar o descartar la cotización, releer la conversación para repintar
  // el cajón con lo que recalculó Django (o hacerlo desaparecer si se descartó).
  onRefrescar: () => void;
}

// H-042: una línea editable del cajón (solo servicios y productos reales; la línea
// sintética de descuento no entra porque no tiene id y Django la recalcula sola).
interface LineaEditable {
  key: string;
  nombre: string;
  esProducto: boolean;
  servicioId?: number;
  productoId?: number;
  fecha: string | null;
  hora: string | null;
  cantidad: number;
}

const borradorCotizacion = (url: string) =>
  `Hola 🌿 Te preparamos la cotización de tu experiencia en Aremko. Revísala con calma y, si todo está bien, tócala para aprobarla:\n${url}\n\nCualquier duda, aquí estamos. ✨`;

const borradorFicha = (url: string) =>
  `¡Listo! 🌿 Aquí tienes tu ficha de reserva con todos los detalles de tu experiencia en Aremko:\n${url}`;

// Construye las líneas editables desde la propuesta: toma solo las que traen id
// (servicio_id o producto_id). Para productos la cantidad viene en cantidad_personas.
const construirLineas = (p: PropuestaReserva): LineaEditable[] =>
  p.servicios
    .filter((s) => s.servicio_id != null || s.producto_id != null)
    .map((s, i) => ({
      key: `${s.servicio_id ?? 'p'}-${s.producto_id ?? 's'}-${i}`,
      nombre: s.servicio_nombre,
      esProducto: !!s.producto_id || !!s.es_producto,
      servicioId: s.servicio_id ?? undefined,
      productoId: s.producto_id ?? undefined,
      fecha: s.fecha,
      hora: s.hora,
      cantidad: s.cantidad_personas,
    }));

// H-039 (Cotización boutique + Aprobar) + H-042 (editable + cerrar): el cajón muestra
// la cotización (link que envía Deborah) y, tras el Aprobar del cliente, el banner pasa
// a "Revisar y enviar Ficha". Deborah puede CORREGIR (cantidades / quitar líneas) y
// CERRAR el borrador antes de enviarlo.
export function CotizacionCajon({ propuesta, reservaCreada, carrito, onUsarTexto, onRefrescar }: Props) {
  // IDs de reservas creadas que Deborah ya cerró en este navegador (persisten).
  const [cerradas, setCerradas] = useState<number[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCerradas(JSON.parse(raw));
    } catch {
      /* localStorage no disponible → el banner simplemente no se persiste cerrado */
    }
  }, []);
  const cerrarReserva = (id: number) => {
    setCerradas((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* sin persistencia; se cierra al menos en esta vista */
      }
      return next;
    });
  };

  // H-048 — al aparecer una propuesta nueva con link, autocargar el mensaje
  // conversacional (saludo + link de cotización) en el campo de respuesta, para
  // que Deborah no vea el cajón mudo y solo apriete enviar. Se hace UNA vez por
  // propuesta (ref por propuesta_id): no re-carga en cada poll ni pisa lo que
  // Deborah escriba después. El botón "Poner cotización en el mensaje" sigue para recargar.
  const autoCargadoRef = useRef<string | null>(null);
  useEffect(() => {
    const url = propuesta?.url_cotizacion;
    const id = propuesta?.propuesta_id;
    if (id && url && autoCargadoRef.current !== id) {
      autoCargadoRef.current = id;
      onUsarTexto(borradorCotizacion(url));
    }
  }, [propuesta?.propuesta_id, propuesta?.url_cotizacion, onUsarTexto]);

  // H-042 — estado de edición / cierre de la propuesta.
  const [modo, setModo] = useState<'ver' | 'editar'>('ver');
  const [lineas, setLineas] = useState<LineaEditable[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // H-077 — picker "+ Agregar ítem": ambientaciones + productos del catálogo.
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoAgregablesResp | null>(null);
  const [catalogoCargando, setCatalogoCargando] = useState(false);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const toggleAgregar = async () => {
    const abrir = !agregarAbierto;
    setAgregarAbierto(abrir);
    setFiltro('');
    if (!abrir || catalogo || catalogoCargando) return;
    setCatalogoCargando(true);
    setCatalogoError(null);
    try {
      setCatalogo(await fetchCatalogoAgregables());
    } catch (e) {
      setCatalogoError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo');
    } finally {
      setCatalogoCargando(false);
    }
  };

  // La ambientación acompaña al servicio del día (tina-first): hereda fecha/hora de
  // la primera línea de servicio con fecha. cantidad=1 a propósito — para servicios
  // Django cobra precio_base × cantidad_personas.
  const agregarAmbientacion = (a: AgregableAmbientacion) =>
    setLineas((ls) => {
      const ya = ls.find((l) => l.servicioId === a.servicio_id);
      if (ya) {
        return ls.map((l) =>
          l.servicioId === a.servicio_id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      const base = ls.find((l) => !l.esProducto && l.fecha);
      return [
        ...ls,
        {
          key: `add-s-${a.servicio_id}`,
          nombre: a.nombre,
          esProducto: false,
          servicioId: a.servicio_id,
          fecha: base?.fecha ?? null,
          hora: base?.hora ?? null,
          cantidad: 1,
        },
      ];
    });

  const agregarProducto = (p: AgregableProducto) =>
    setLineas((ls) => {
      const ya = ls.find((l) => l.productoId === p.producto_id);
      if (ya) {
        return ls.map((l) =>
          l.productoId === p.producto_id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...ls,
        {
          key: `add-p-${p.producto_id}`,
          nombre: p.nombre,
          esProducto: true,
          productoId: p.producto_id,
          fecha: null,
          hora: null,
          cantidad: 1,
        },
      ];
    });

  const entrarEditar = () => {
    if (!propuesta) return;
    setLineas(construirLineas(propuesta));
    setError(null);
    setConfirmarCierre(false);
    setAgregarAbierto(false);
    setFiltro('');
    setModo('editar');
  };
  const cancelarEditar = () => {
    setModo('ver');
    setError(null);
  };
  const cambiarCantidad = (key: string, delta: number) =>
    setLineas((ls) =>
      ls.map((l) => (l.key === key ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l)),
    );
  const quitarLinea = (key: string) => setLineas((ls) => ls.filter((l) => l.key !== key));

  const guardar = async () => {
    if (!propuesta) return;
    const servicios = lineas
      .filter((l) => l.servicioId != null)
      .map((l) => ({
        servicio_id: l.servicioId!,
        fecha: l.fecha,
        hora: l.hora,
        cantidad_personas: l.cantidad,
      }));
    const productos = lineas
      .filter((l) => l.productoId != null)
      .map((l) => ({ producto_id: l.productoId!, cantidad: l.cantidad }));
    if (servicios.length === 0) {
      setError('La cotización debe quedar con al menos un servicio.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      // Django recalcula total + descuento; no mandamos precios. Releemos para repintar.
      await editarPropuestaLuna(propuesta.propuesta_id, servicios, productos);
      setModo('ver');
      onRefrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la corrección.');
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = async () => {
    if (!propuesta) return;
    setCerrando(true);
    setError(null);
    try {
      await descartarPropuestaLuna(propuesta.propuesta_id);
      onRefrescar(); // la propuesta queda 'descartada' → el cajón desaparece al releer
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar la cotización.');
      setCerrando(false);
      setConfirmarCierre(false);
    }
  };

  // Estado 2 — reserva ya creada por el Aprobar del cliente → enviar la Ficha.
  // (Prioriza sobre la propuesta, que a esta altura ya debería venir null.) Si Deborah
  // ya la cerró, cae al estado de propuesta (normalmente null → no muestra nada).
  if (reservaCreada && !cerradas.includes(reservaCreada.reserva_id)) {
    const urlFicha = reservaCreada.url_ficha;
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs">
        <div className="mb-1.5 flex items-start gap-1.5 font-semibold text-emerald-900">
          <CalendarCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">Reserva creada Nº {reservaCreada.numero} — revisa y envía la Ficha</span>
          <button
            type="button"
            onClick={() => cerrarReserva(reservaCreada.reserva_id)}
            aria-label="Cerrar aviso"
            title="Cerrar aviso"
            className="-mr-0.5 -mt-0.5 flex-shrink-0 rounded p-0.5 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex justify-between gap-2 text-emerald-900/90">
          <span>Total</span>
          <span className="font-semibold">{clp(reservaCreada.total)}</span>
        </div>
        {urlFicha ? (
          <button
            type="button"
            onClick={() => onUsarTexto(borradorFicha(urlFicha))}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Send className="h-4 w-4" />
            Poner Ficha en el mensaje
          </button>
        ) : (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] text-emerald-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>La reserva se creó pero falta el link de la Ficha. Revísala en el sistema.</span>
          </p>
        )}
      </div>
    );
  }

  // Estado 0 — Carrito en curso (H-046, Fase 1: SOLO LECTURA). Se muestra cuando aún
  // NO hay propuesta (Django garantiza carrito null si ya hay propuesta vigente).
  // Mismo render que el cajón pero en gris, sin botones: Deborah ve el carrito
  // llenándose en vivo con el polling. Al cotizar, Django manda carrito null → este
  // panel desaparece y aparece el cajón ámbar de la propuesta.
  if (!propuesta) {
    if (carrito && carrito.servicios.length > 0) {
      const cPositivos = carrito.servicios.filter(
        (s) => s.subtotal > 0 && !/descuento/i.test(s.servicio_nombre),
      );
      const cBruto = cPositivos.reduce((acc, s) => acc + s.subtotal, 0);
      const cDescuento = cBruto > 0 ? cBruto - carrito.total : 0;
      return (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-2.5 text-xs">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-700">
            <ShoppingCart className="h-4 w-4 flex-shrink-0" />
            Carrito en curso
          </div>
          <div className="space-y-0.5 text-slate-600">
            {cPositivos.map((s, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate">
                  {s.es_producto || !s.fecha
                    ? `${s.servicio_nombre}${s.cantidad_personas > 1 ? ` ×${s.cantidad_personas}` : ''}`
                    : `${s.servicio_nombre} · ${s.fecha} ${s.hora} · ${s.cantidad_personas}p`}
                </span>
                <span className="flex-shrink-0 font-medium">{clp(s.subtotal)}</span>
              </div>
            ))}
            {cDescuento > 0 && (
              <div className="flex justify-between gap-2 text-emerald-700">
                <span>Descuento</span>
                <span className="font-medium">−{clp(cDescuento)}</span>
              </div>
            )}
            <div className="flex justify-between gap-2 border-t border-slate-200 pt-0.5 font-semibold text-slate-700">
              <span>Total parcial</span>
              <span>{clp(carrito.total)}</span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] italic text-slate-400">Se está armando… (aún sin cotización)</p>
        </div>
      );
    }
    return null;
  }

  // Estado 1b — modo EDICIÓN (H-042): cambiar cantidades / quitar líneas. El total NO
  // se calcula aquí; lo recalcula Django al guardar (precios siempre del catálogo).
  if (modo === 'editar') {
    const sinServicios = !lineas.some((l) => l.servicioId != null);
    const q = filtro.trim().toLowerCase();
    const ambFiltradas = (catalogo?.ambientaciones ?? []).filter((a) =>
      a.nombre.toLowerCase().includes(q),
    );
    const prodFiltrados = (catalogo?.productos ?? []).filter((p) =>
      p.nombre.toLowerCase().includes(q),
    );
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-900">
          <Pencil className="h-4 w-4 flex-shrink-0" />
          Corregir cotización
        </div>
        <div className="space-y-1">
          {lineas.map((l) => (
            <div key={l.key} className="flex items-center gap-1.5">
              <span className="flex-1 truncate text-amber-900/90" title={l.nombre}>
                {l.nombre}
                {!l.esProducto && l.fecha ? (
                  <span className="text-amber-700/70"> · {l.fecha} {l.hora}</span>
                ) : null}
              </span>
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.key, -1)}
                  disabled={l.cantidad <= 1 || guardando}
                  aria-label="Quitar uno"
                  className="rounded border border-amber-300 p-0.5 text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center font-semibold text-amber-900">{l.cantidad}</span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.key, 1)}
                  disabled={guardando}
                  aria-label="Agregar uno"
                  className="rounded border border-amber-300 p-0.5 text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => quitarLinea(l.key)}
                  disabled={guardando}
                  aria-label="Quitar línea"
                  title="Quitar línea"
                  className="ml-0.5 rounded p-0.5 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {lineas.length === 0 && (
            <p className="text-amber-700/80">Quitaste todas las líneas. Cancela para volver.</p>
          )}
        </div>
        {/* H-077 — agregar ambientaciones / productos del catálogo a la cotización */}
        <div className="mt-2">
          <button
            type="button"
            onClick={toggleAgregar}
            disabled={guardando}
            className="flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Agregar ítem
          </button>
          {agregarAbierto && (
            <div className="mt-1.5 rounded border border-amber-200 bg-white p-1.5">
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar: tabla, jugo, café, ambientación…"
                className="mb-1 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px] focus:border-amber-400 focus:outline-none"
              />
              {catalogoCargando ? (
                <div className="flex justify-center py-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : catalogoError ? (
                <p className="py-1 text-[11px] text-red-600">{catalogoError}</p>
              ) : catalogo ? (
                <div className="max-h-44 space-y-0.5 overflow-y-auto">
                  {ambFiltradas.length > 0 && (
                    <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Ambientaciones
                    </p>
                  )}
                  {ambFiltradas.map((a) => (
                    <button
                      key={`amb-${a.servicio_id}`}
                      type="button"
                      onClick={() => agregarAmbientacion(a)}
                      className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] text-slate-700 hover:bg-amber-50"
                    >
                      <span className="truncate">{a.nombre}</span>
                      <span className="flex-shrink-0 font-medium text-slate-500">{clp(a.precio)}</span>
                    </button>
                  ))}
                  {prodFiltrados.length > 0 && (
                    <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Productos
                    </p>
                  )}
                  {prodFiltrados.map((p) => (
                    <button
                      key={`prod-${p.producto_id}`}
                      type="button"
                      onClick={() => agregarProducto(p)}
                      className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] text-slate-700 hover:bg-amber-50"
                    >
                      <span className="truncate">{p.nombre}</span>
                      <span className="flex-shrink-0 font-medium text-slate-500">{clp(p.precio)}</span>
                    </button>
                  ))}
                  {ambFiltradas.length === 0 && prodFiltrados.length === 0 && (
                    <p className="py-1 text-[11px] text-slate-400">Sin resultados para “{filtro}”.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-amber-700/80">El total se recalcula al guardar.</p>
        {sinServicios && lineas.length > 0 && (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Debe quedar al menos un servicio (no solo productos).</span>
          </p>
        )}
        {error && (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || sinServicios}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar
          </button>
          <button
            type="button"
            onClick={cancelarEditar}
            disabled={guardando}
            className="rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Estado 1 — propuesta pendiente → resumen + descuento + link de cotización.
  // B3 (descuento explícito): el total ya viene NETO, pero las líneas de servicio suman
  // el BRUTO. Calculamos el descuento como (Σ servicios positivos − total). Esto cubre
  // el pack "Pausa junto al río" (descuento implícito en el total) y el Ritual (que trae
  // una línea cruda "Descuento de servicios"); en ambos sale una sola línea limpia.
  const positivos = propuesta.servicios.filter(
    (s) => s.subtotal > 0 && !/descuento/i.test(s.servicio_nombre),
  );
  const bruto = positivos.reduce((acc, s) => acc + s.subtotal, 0);
  const descuento = bruto > 0 ? bruto - propuesta.total : 0;
  const url = propuesta.url_cotizacion;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs">
      <div className="mb-1.5 flex items-start gap-1.5 font-semibold text-amber-900">
        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span className="flex-1">Cotización lista — envíala para que el cliente la apruebe</span>
        <button
          type="button"
          onClick={entrarEditar}
          aria-label="Corregir cotización"
          title="Corregir cotización"
          className="-mt-0.5 flex-shrink-0 rounded p-0.5 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmarCierre(true)}
          aria-label="Cerrar cotización"
          title="Cerrar cotización"
          className="-mr-0.5 -mt-0.5 flex-shrink-0 rounded p-0.5 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {confirmarCierre && (
        <div className="mb-1.5 rounded border border-amber-300 bg-amber-100/70 p-1.5">
          <p className="mb-1 text-amber-900">¿Cerrar esta cotización? Se descarta el borrador.</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={cerrar}
              disabled={cerrando}
              className="flex items-center justify-center gap-1 rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cerrando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Sí, cerrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmarCierre(false)}
              disabled={cerrando}
              className="rounded border border-amber-300 px-2 py-1 font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      )}
      <div className="space-y-0.5 text-amber-900/90">
        {positivos.map((s, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate">
              {s.es_producto || !s.fecha
                ? // Producto (H-040): sin fecha/hora; muestra ×N solo si hay más de uno.
                  `${s.servicio_nombre}${s.cantidad_personas > 1 ? ` ×${s.cantidad_personas}` : ''}`
                : `${s.servicio_nombre} · ${s.fecha} ${s.hora} · ${s.cantidad_personas}p`}
            </span>
            <span className="flex-shrink-0 font-medium">{clp(s.subtotal)}</span>
          </div>
        ))}
        {descuento > 0 && (
          <div className="flex justify-between gap-2 text-emerald-700">
            <span>Descuento</span>
            <span className="font-medium">−{clp(descuento)}</span>
          </div>
        )}
        <div className="flex justify-between gap-2 border-t border-amber-200 pt-0.5 font-semibold">
          <span>Total</span>
          <span>{clp(propuesta.total)}</span>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {url ? (
        <button
          type="button"
          onClick={() => onUsarTexto(borradorCotizacion(url))}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          <Send className="h-4 w-4" />
          Poner cotización en el mensaje
        </button>
      ) : (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>Esperando el link de cotización del sistema. Si tarda, revisa la propuesta en el admin.</span>
        </p>
      )}
    </div>
  );
}
