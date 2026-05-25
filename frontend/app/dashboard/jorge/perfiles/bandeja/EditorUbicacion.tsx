'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  MapPin,
  Save,
  X,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Plane,
} from 'lucide-react';
import { actualizarUbicacion, type ActualizarUbicacionResponse } from './api';
import type { RegionGeografica } from './types';

interface EditorUbicacionProps {
  clienteID: number;
  regionActual?: RegionGeografica;
  ciudadActual?: string | null;
  operador: string;
  /** Notifica al padre cuando la edición fue exitosa para que actualice su state */
  onActualizada: (region: RegionGeografica, ciudadCanonica: string | null) => void;
  /** Modo "siempre visible" (caso sin_clasificar) o "expandible" (caso ya clasificado) */
  modo?: 'prominente' | 'expandible';
}

// Detecta el valor especial del backend que indica extranjero genérico.
const esExtranjeroGenerico = (ciudad: string | null | undefined) =>
  ciudad === '_otros_extranjero_';

// Texto humano para mostrar al operador.
const ciudadParaMostrar = (ciudad: string | null | undefined): string => {
  if (!ciudad) return '';
  if (esExtranjeroGenerico(ciudad)) return 'Extranjero';
  return ciudad;
};

export function EditorUbicacion({
  clienteID,
  regionActual,
  ciudadActual,
  operador,
  onActualizada,
  modo,
}: EditorUbicacionProps) {
  const necesitaClasificacion =
    !regionActual || regionActual === 'sin_clasificar';
  // Modo por defecto: prominente si falta clasificación, expandible si ya está
  const modoFinal = modo ?? (necesitaClasificacion ? 'prominente' : 'expandible');

  const [editando, setEditando] = useState(modoFinal === 'prominente');
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ultimoResultado, setUltimoResultado] =
    useState<ActualizarUbicacionResponse | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset al cambiar de cliente
  useEffect(() => {
    setTexto('');
    setUltimoResultado(null);
    setEditando(modoFinal === 'prominente');
    // intencional: no incluyo modoFinal en deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteID]);

  // Focus al editar
  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editando]);

  const handleGuardar = useCallback(async () => {
    const ciudad = texto.trim();
    if (ciudad.length < 2) return;
    setGuardando(true);
    setUltimoResultado(null);
    try {
      const res = await actualizarUbicacion(clienteID, ciudad, operador);
      const data = res.data;
      setUltimoResultado(data);
      // Notificar al padre del nuevo estado
      onActualizada(data.region_geografica, data.ciudad_canonica);
      // Si fue match exitoso, cerrar editor en modo expandible
      if (data.match_method !== 'no_match' && modoFinal === 'expandible') {
        setEditando(false);
        setTexto('');
      }
    } catch (e: unknown) {
      alert(
        `Error al actualizar ciudad: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      setGuardando(false);
    }
  }, [clienteID, texto, operador, modoFinal, onActualizada]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGuardar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (modoFinal === 'expandible') {
        setEditando(false);
        setTexto('');
      }
    }
  };

  // Modo expandible cerrado: solo mostrar link pequeño "Cambiar ciudad"
  if (modoFinal === 'expandible' && !editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 hover:underline"
        title="Cambiar ciudad del cliente"
      >
        <Edit2 className="h-3 w-3" />
        Cambiar ciudad
      </button>
    );
  }

  // Mensaje de resultado de la última acción
  const renderResultado = () => {
    if (!ultimoResultado) return null;
    const { match_method, ciudad_canonica, region_geografica, ciudad_input } =
      ultimoResultado;

    if (match_method === 'no_match') {
      return (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            <strong>&quot;{ciudad_input}&quot;</strong> no coincide con ninguna
            ciudad conocida. Queda guardado para revisión. Si quieres
            clasificarlo, escribe una variante (ej. &quot;Puerto Varas&quot;,
            &quot;Santiago&quot;).
          </span>
        </p>
      );
    }
    if (match_method === 'extranjero_texto') {
      return (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-700">
          <Plane className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            Detectado como <strong>Extranjero</strong>. Este cliente NO recibirá
            WhatsApp del cron automático.
          </span>
        </p>
      );
    }
    // Match canonico o alias
    return (
      <p className="mt-1 flex items-start gap-1.5 text-xs text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
        <span>
          Guardado:{' '}
          <strong>{ciudadParaMostrar(ciudad_canonica)}</strong>{' '}
          (región: {region_geografica})
        </span>
      </p>
    );
  };

  // Modo activo (prominente o expandible abierto): input + botones
  return (
    <div
      className={`${
        modoFinal === 'prominente'
          ? 'rounded-md border border-amber-200 bg-amber-50/60 p-3'
          : 'mt-2 rounded-md border border-slate-200 bg-white p-2'
      }`}
    >
      {modoFinal === 'prominente' && (
        <p className="mb-2 flex items-center gap-1 text-xs text-amber-900">
          <MapPin className="h-3 w-3" />
          <strong>¿De dónde es {operador ? '' : 'el cliente'}?</strong>
          Si sabes la ciudad, escríbela para personalizar futuros mensajes.
        </p>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={guardando}
          placeholder='ej. "Pto Varas", "Santiago", "Concepción"'
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <Button
          size="sm"
          onClick={handleGuardar}
          disabled={guardando || texto.trim().length < 2}
          className="h-8 px-3 text-xs"
        >
          {guardando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Save className="mr-1 h-3.5 w-3.5" />
              Guardar
            </>
          )}
        </Button>
        {modoFinal === 'expandible' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditando(false);
              setTexto('');
              setUltimoResultado(null);
            }}
            disabled={guardando}
            className="h-8 px-2"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {renderResultado()}
    </div>
  );
}
