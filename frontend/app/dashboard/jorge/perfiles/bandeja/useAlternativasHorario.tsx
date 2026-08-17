'use client';

import { useEffect, useState } from 'react';
import { Loader2, Waves, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchExperienciaAlternativas } from './api';
import { EXPERIENCIA_TIPOS } from './types';
import type { TipoExperiencia, ExperienciaAlternativa } from './types';

interface UseAlternativasHorarioOpts {
  /** Inserta el texto sugerido en el cajón de respuesta del canal. */
  onUsarTexto: (texto: string) => void;
  /** Deshabilita el botón (ej. mientras se envía, o fuera de la ventana de 24h). */
  disabled?: boolean;
  /** Al cambiar (nueva conversación) se descartan las alternativas cargadas. */
  resetKey: string;
  /** Clase del botón de la barra, para calzar con los demás íconos del canal. */
  btnClass: string;
  /** Focus ring de los inputs del modal (tema del canal). */
  ringClass: string;
  /** Fondo del botón "Buscar" del modal (tema del canal). */
  buscarBtnClass: string;
  /** Color de acento para el chip de estado (tema del canal). */
  accentText: string;
}

/**
 * Feature "Alternativas de horario" (H-061), compartido por los tres canales de
 * la bandeja: WhatsApp, Instagram y Messenger. Encapsula el estado, la búsqueda
 * y el modal; el parent decide DÓNDE va cada pieza (boton / chip / modal) porque
 * viven en zonas distintas del layout de cada conversación.
 *
 * El motor de fondo (fetchExperienciaAlternativas) es agnóstico del canal: solo
 * pide tipo/fecha/personas y devuelve texto_sugerido listo para el borrador, así
 * que sirve igual para IG/Messenger que para WhatsApp.
 */
export function useAlternativasHorario({
  onUsarTexto,
  disabled,
  resetKey,
  btnClass,
  ringClass,
  buscarBtnClass,
  accentText,
}: UseAlternativasHorarioOpts) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoExperiencia>('pausa');
  const [fecha, setFecha] = useState('');
  const [personas, setPersonas] = useState(2);
  const [alternativas, setAlternativas] = useState<ExperienciaAlternativa[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ritual/Refugio son siempre 2 personas (el endpoint ignora `personas` ahí).
  const opcionTipo = EXPERIENCIA_TIPOS.find((o) => o.tipo === tipo);
  const personasFijas = opcionTipo?.personasFijas;
  // H-108: gift cards no se agendan — sin fecha ni personas (el endpoint los ignora).
  const sinAgenda = !!opcionTipo?.sinAgenda;

  // Las alternativas son de una fecha puntual: no deben sobrevivir el cambio de
  // conversación.
  useEffect(() => {
    setAbierto(false);
    setAlternativas(null);
    setIndice(0);
    setError(null);
  }, [resetKey]);

  // Si ya hay alternativas cargadas, el clic avanza a la siguiente (cicla al
  // llegar al final); si no hay ninguna, abre el modal para elegir tipo/fecha/
  // personas (no hay forma confiable de inferirlos del hilo).
  const onBotonClick = () => {
    if (disabled) return;
    if (alternativas && alternativas.length > 0) {
      const siguiente = (indice + 1) % alternativas.length;
      setIndice(siguiente);
      onUsarTexto(alternativas[siguiente].texto_sugerido);
      return;
    }
    setAbierto(true);
  };

  const cambiarBusqueda = () => {
    setAlternativas(null);
    setIndice(0);
    setError(null);
    setAbierto(true);
  };

  const confirmar = async () => {
    if (!fecha && !sinAgenda) {
      setError('Elegí una fecha');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const data = await fetchExperienciaAlternativas(
        tipo, sinAgenda ? '' : fecha, personasFijas ?? personas);
      if (!data.alternativas || data.alternativas.length === 0) {
        setError('Sin combinaciones disponibles para esa fecha/personas');
        return;
      }
      setAlternativas(data.alternativas);
      setIndice(0);
      onUsarTexto(data.alternativas[0].texto_sugerido);
      setAbierto(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo traer las alternativas');
    } finally {
      setCargando(false);
    }
  };

  const boton = (
    <button
      type="button"
      onClick={onBotonClick}
      disabled={disabled}
      title={
        alternativas && alternativas.length > 0
          ? `Siguiente alternativa (${indice + 1}/${alternativas.length})`
          : 'Alternativas de horario: Pausa, Ritual, Refugio, Noche de Aguas Calientes, tina o masaje solo'
      }
      className={btnClass}
    >
      <Waves className="h-4 w-4" />
    </button>
  );

  const chip =
    alternativas && alternativas.length > 0 ? (
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
        <Waves className={`h-3 w-3 ${accentText}`} />
        <span>
          {EXPERIENCIA_TIPOS.find((o) => o.tipo === tipo)?.label ?? tipo}
          {sinAgenda ? '' : ` ${fecha} · ${personasFijas ?? personas}p`} · opción{' '}
          {indice + 1}/{alternativas.length}
        </span>
        <button
          type="button"
          onClick={cambiarBusqueda}
          className={`underline decoration-dotted hover:opacity-80 ${accentText}`}
        >
          cambiar búsqueda
        </button>
      </div>
    ) : null;

  const modal = abierto ? (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={() => !cargando && setAbierto(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="experiencia-alt-titulo"
        className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="experiencia-alt-titulo" className="text-base font-semibold text-slate-900">
              Alternativas de horario
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {sinAgenda ? 'Elegí qué gift card ofrecer.' : 'Elegí qué buscar y para cuándo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !cargando && setAbierto(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Experiencia</span>
            <select
              value={tipo}
              onChange={(e) => {
                const nuevoTipo = e.target.value as TipoExperiencia;
                setTipo(nuevoTipo);
                const fijas = EXPERIENCIA_TIPOS.find((o) => o.tipo === nuevoTipo)?.personasFijas;
                if (fijas) setPersonas(fijas);
              }}
              className={`mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-1 ${ringClass}`}
            >
              {EXPERIENCIA_TIPOS.map((opt) => (
                <option key={opt.tipo} value={opt.tipo} disabled={!opt.disponible}>
                  {opt.label}
                  {!opt.disponible ? ' (próximamente)' : ''}
                </option>
              ))}
            </select>
          </label>
          {/* H-108: gift cards sin agenda → fecha y personas no aplican (se ocultan).
              La línea de ayuda evita que el modal se vea "vacío" (feedback de Jorge). */}
          {sinAgenda && (
            <p className="text-xs text-slate-500">
              Las gift cards no llevan fecha ni personas. Pulsa <strong>Buscar</strong> para
              traer las del catálogo — la primera se carga al mensaje y con el botón 〰 vas
              pasando a la siguiente.
            </p>
          )}
          {!sinAgenda && (
            <label className="block text-sm">
              <span className="text-slate-600">Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={`mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-1 ${ringClass}`}
              />
            </label>
          )}
          {!sinAgenda && (
            <label className="block text-sm">
              <span className="text-slate-600">
                Personas
                {personasFijas ? ` (fijo en ${personasFijas} para esta experiencia)` : ''}
              </span>
              <input
                type="number"
                min={1}
                max={6}
                value={personasFijas ?? personas}
                disabled={!!personasFijas}
                onChange={(e) => setPersonas(Math.min(6, Math.max(1, Number(e.target.value) || 2)))}
                className={`mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${ringClass}`}
              />
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={confirmar}
            disabled={cargando || (!fecha && !sinAgenda)}
            className={buscarBtnClass}
          >
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>
      </div>
    </>
  ) : null;

  return { boton, chip, modal };
}
