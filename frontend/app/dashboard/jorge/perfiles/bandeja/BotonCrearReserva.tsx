'use client';

import { useState } from 'react';
import { Loader2, CalendarCheck, AlertTriangle } from 'lucide-react';
import { crearReservaLuna } from './api';
import type { PropuestaReserva } from './types';

const clp = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

interface Props {
  propuesta: PropuestaReserva;
  // Se llama al crear la reserva con éxito; el padre carga el resumen en el cajón
  // para que Deborah lo envíe al cliente, y refresca el hilo.
  onCreada: (resumenTexto: string) => void;
}

// Banner de aprobación de reserva (H-028): Luna armó la propuesta y el cliente
// confirmó; Deborah la crea con un clic. Aparece sobre el compositor.
export function BotonCrearReserva({ propuesta, onCreada }: Props) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    if (creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await crearReservaLuna(propuesta.propuesta_id);
      onCreada(res.resumen_texto || '');
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : '';
      // La propuesta caduca (TTL) → mensaje accionable en vez del error técnico.
      const expirada = /propuesta_not_found|expir|no existe/i.test(raw);
      setError(
        expirada
          ? 'La propuesta caducó. Pídele a Luna que la regenere (el cliente reconfirma) y vuelve a intentar.'
          : raw || 'No se pudo crear la reserva',
      );
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs">
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-900">
        <CalendarCheck className="h-4 w-4 flex-shrink-0" />
        Propuesta de reserva lista — confirma para crearla
      </div>
      <div className="space-y-0.5 text-amber-900/90">
        {propuesta.servicios.map((s, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate">
              {s.servicio_nombre} · {s.fecha} {s.hora} · {s.cantidad_personas}p
            </span>
            <span className="flex-shrink-0 font-medium">{clp(s.subtotal)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t border-amber-200 pt-0.5 font-semibold">
          <span>Total</span>
          <span>{clp(propuesta.total)}</span>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <button
        type="button"
        onClick={crear}
        disabled={creando}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
        {creando ? 'Creando reserva…' : 'Crear reserva'}
      </button>
    </div>
  );
}
