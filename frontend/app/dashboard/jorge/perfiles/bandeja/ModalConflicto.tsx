'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Check,
  SkipForward,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import type { Conflict409 } from './types';

// ============================================================================
// ModalConflicto — Task #41
// ----------------------------------------------------------------------------
// Reemplaza el alert() nativo cuando marcar-enviado devuelve un 409: el cliente
// cambió de tramo (eje Valor) entre que se generó la bandeja a las 06:00 y el
// momento en que la operadora actúa. En vez de descartar la acción en silencio,
// le explicamos el contexto y le damos 3 decisiones claras.
// ============================================================================

export interface ModalConflictoProps {
  /** Datos del conflicto que devolvió el backend (null = oculto). */
  conflict: Conflict409 | null;
  /** Nombre del cliente en conflicto, para personalizar el copy. */
  clienteNombre: string;
  /** True mientras se ejecuta cualquiera de las 3 acciones. */
  procesando: boolean;
  /**
   * True cuando ya se intentó "registrar igual" y el backend SIGUIÓ
   * respondiendo 409 (el flag `forzar` aún no está habilitado en Django).
   * Permite mostrar un aviso honesto en vez de quedar en loop.
   */
  forzarNoDisponible?: boolean;
  /** "Sí, envié; registrar igual" — fuerza el registro pese al conflicto. */
  onRegistrarIgual: () => void;
  /** "No envié; saltar" — marca omitido y pasa al siguiente. */
  onSaltar: () => void;
  /** "Descartar" — saca el contacto de la bandeja para reevaluarlo después. */
  onDescartar: () => void;
  /** Cierra el modal sin tomar acción (el contacto queda pendiente). */
  onCerrar: () => void;
}

export function ModalConflicto({
  conflict,
  clienteNombre,
  procesando,
  forzarNoDisponible = false,
  onRegistrarIgual,
  onSaltar,
  onDescartar,
  onCerrar,
}: ModalConflictoProps) {
  // Cerrar con Escape (salvo mientras se procesa una acción).
  useEffect(() => {
    if (!conflict) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !procesando) onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [conflict, procesando, onCerrar]);

  if (!conflict) return null;

  const primerNombre = clienteNombre.split(' ')[0] || clienteNombre;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={() => !procesando && onCerrar()}
      />

      {/* Diálogo centrado */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflicto-titulo"
        className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl"
      >
        {/* Encabezado */}
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2
              id="conflicto-titulo"
              className="text-base font-semibold text-slate-900"
            >
              El perfil de {primerNombre} cambió
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Su clasificación se actualizó después de armar la bandeja de hoy.
            </p>
          </div>
          <button
            onClick={onCerrar}
            disabled={procesando}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo: contexto del cambio */}
        <div className="space-y-3 p-5">
          {conflict.mensaje && (
            <p className="text-sm text-slate-700">{conflict.mensaje}</p>
          )}

          <div className="flex items-center justify-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span className="rounded-md bg-slate-200 px-2 py-1 font-medium text-slate-600 line-through decoration-slate-400">
              {conflict.eje_valor_anterior || '—'}
            </span>
            <ArrowGlyph />
            <span className="rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
              {conflict.eje_valor_actual || '—'}
            </span>
          </div>

          <p className="text-sm text-slate-600">
            El mensaje que estabas por enviar correspondía al tramo anterior.
            ¿Qué hacemos?
          </p>

          {forzarNoDisponible && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El registro forzado todavía no está habilitado en el servidor.
              Por ahora usa <strong>Saltar</strong> o <strong>Descartar</strong>.
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 border-t border-slate-100 p-4">
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            disabled={procesando}
            onClick={onRegistrarIgual}
          >
            {procesando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Sí, ya lo envié — registrar igual
          </Button>

          <Button
            variant="secondary"
            className="w-full justify-start gap-2"
            disabled={procesando}
            onClick={onSaltar}
          >
            <SkipForward className="h-4 w-4" />
            No lo envié — saltar
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-600"
            disabled={procesando}
            onClick={onDescartar}
          >
            <Trash2 className="h-4 w-4" />
            Descartar de la bandeja
          </Button>
        </div>
      </div>
    </>
  );
}

// Flecha decorativa entre los dos tramos (evita depender de otro import).
function ArrowGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
