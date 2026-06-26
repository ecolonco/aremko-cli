'use client';

import { FileText, CalendarCheck, Send, AlertTriangle } from 'lucide-react';
import type { PropuestaReserva, ReservaCreada } from './types';

const clp = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

interface Props {
  propuesta: PropuestaReserva | null; // pendiente de que el cliente apruebe
  reservaCreada: ReservaCreada | null; // ya aprobada por el cliente (H-039)
  // Pone un borrador en el cajón para que Deborah lo revise y lo envíe.
  onUsarTexto: (texto: string) => void;
}

const borradorCotizacion = (url: string) =>
  `Hola 🌿 Te preparamos la cotización de tu experiencia en Aremko. Revísala con calma y, si todo está bien, tócala para aprobarla:\n${url}\n\nCualquier duda, aquí estamos. ✨`;

const borradorFicha = (url: string) =>
  `¡Listo! 🌿 Aquí tienes tu ficha de reserva con todos los detalles de tu experiencia en Aremko:\n${url}`;

// H-039 (Cotización boutique + Aprobar): el cajón muestra la cotización (link que
// envía Deborah) y, tras el Aprobar del cliente, el banner pasa a "Revisar y enviar
// Ficha". Reemplaza al viejo botón "Crear reserva" (ahora la reserva la crea el
// cliente al aprobar la cotización, no Deborah).
export function CotizacionCajon({ propuesta, reservaCreada, onUsarTexto }: Props) {
  // Estado 2 — reserva ya creada por el Aprobar del cliente → enviar la Ficha.
  // (Prioriza sobre la propuesta, que a esta altura ya debería venir null.)
  if (reservaCreada) {
    const urlFicha = reservaCreada.url_ficha;
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-emerald-900">
          <CalendarCheck className="h-4 w-4 flex-shrink-0" />
          Reserva creada Nº {reservaCreada.numero} — revisa y envía la Ficha
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

  if (!propuesta) return null;

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
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-900">
        <FileText className="h-4 w-4 flex-shrink-0" />
        Cotización lista — envíala para que el cliente la apruebe
      </div>
      <div className="space-y-0.5 text-amber-900/90">
        {positivos.map((s, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate">
              {s.servicio_nombre} · {s.fecha} {s.hora} · {s.cantidad_personas}p
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
