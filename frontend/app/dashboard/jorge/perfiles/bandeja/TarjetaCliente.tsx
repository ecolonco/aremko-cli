'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  SkipForward,
  XCircle,
  Copy,
  ExternalLink,
  Edit3,
  Save,
  Undo2,
  Sparkles,
  Loader2,
  Ban,
} from 'lucide-react';
import type { Contacto, RegionGeografica } from './types';
import { fetchExplicacion } from './api';
import { useDraftStore } from './useDraftStore';
import { RegionBadge } from './RegionBadge';
import { EditorUbicacion } from './EditorUbicacion';

interface TarjetaClienteProps {
  contacto: Contacto;
  disabled?: boolean;
  operador: string;
  onEnviado: (contacto: Contacto, mensajeEditado?: string) => void;
  onOmitir: (contacto: Contacto) => void;
  onNoAplica: (contacto: Contacto) => void;
  onBloquear: (contacto: Contacto) => void;
}

const valorColor: Record<string, string> = {
  Campeón: 'bg-emerald-100 text-emerald-900',
  Leal: 'bg-emerald-50 text-emerald-800',
  'Gran Gastador Ocasional': 'bg-blue-50 text-blue-800',
  Regular: 'bg-sky-50 text-sky-800',
  'En Prueba': 'bg-yellow-50 text-yellow-800',
  'En Riesgo': 'bg-orange-100 text-orange-900',
  Dormido: 'bg-red-100 text-red-900',
  Perdido: 'bg-gray-100 text-gray-800',
  'Pre-sistema': 'bg-purple-50 text-purple-800',
};

// Detecta si el evento de teclado se originó en un input/textarea para
// no disparar atajos mientras el operador escribe.
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
};

export function TarjetaCliente({
  contacto,
  disabled,
  operador,
  onEnviado,
  onOmitir,
  onNoAplica,
  onBloquear,
}: TarjetaClienteProps) {
  const { cliente, perfil_resumen: perfil, mensaje_renderizado } = contacto;
  const badge = valorColor[perfil.estado_valor] ?? 'bg-slate-100 text-slate-800';
  const nombreCorto = cliente.nombre.split(' ')[0];

  // Edición del mensaje — persistido en localStorage por contacto_id
  // (si Deborah cierra el navegador en mitad de una edición, retoma).
  const [editando, setEditando] = useState(false);
  const [textoEditado, setTextoEditado, clearDraftEditado] = useDraftStore(
    contacto.id,
    mensaje_renderizado
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Si al cargar el contacto ya hay un borrador persistido distinto del original,
  // abrir el editor automáticamente — señal de que la sesión anterior estaba editando.
  useEffect(() => {
    if (textoEditado !== mensaje_renderizado) {
      setEditando(true);
    }
    // intencional: solo al cambiar de contacto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacto.id]);

  // Explicación generada por IA (stub por ahora)
  const [explicacion, setExplicacion] = useState<string | null>(null);
  const [cargandoExpl, setCargandoExpl] = useState(false);

  // Toast simple de copia (se borra solo)
  const [toast, setToast] = useState<string | null>(null);

  // Override local de la ubicación cuando el operador edita en vivo —
  // permite que el badge se actualice inmediatamente sin esperar nuevo fetch.
  const [regionOverride, setRegionOverride] = useState<RegionGeografica | null>(
    null
  );
  const [ciudadOverride, setCiudadOverride] = useState<string | null>(null);
  const regionDisplay = regionOverride ?? cliente.region_geografica;
  const ciudadDisplay =
    ciudadOverride !== null ? ciudadOverride : cliente.ciudad_canonica;

  // Detección de cohorte Pareja Romántica (servicios románticos en historial).
  // Clientes muy valiosos: 80% Dormido/En Riesgo, ticket $270-540K por celebración.
  const esParejaRomantica = perfil.cohorte?.includes('Pareja Romántica') ?? false;

  // Al cambiar de contacto, resetear UI estado (la edición persistida ya viene
  // del hook useDraftStore que lee localStorage del nuevo contacto.id).
  useEffect(() => {
    setEditando(false);
    setExplicacion(null);
    setRegionOverride(null);
    setCiudadOverride(null);
  }, [contacto.id]);

  // Cargar explicación con lazy fetch al montar (no bloquea el render principal)
  useEffect(() => {
    let cancelado = false;
    setCargandoExpl(true);
    fetchExplicacion(contacto.id)
      .then((r) => {
        if (!cancelado) setExplicacion(r.explicacion || '');
      })
      .catch(() => {
        if (!cancelado) setExplicacion('');
      })
      .finally(() => {
        if (!cancelado) setCargandoExpl(false);
      });
    return () => {
      cancelado = true;
    };
  }, [contacto.id]);

  // Auto-focus en textarea al entrar en modo edición
  useEffect(() => {
    if (editando && textareaRef.current) {
      textareaRef.current.focus();
      // Mover cursor al final
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editando]);

  // Mostrar toast por 2s
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const textoActual = editando ? textoEditado : mensaje_renderizado;
  const textoFueEditado = textoEditado !== mensaje_renderizado;

  const handleCopiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textoActual);
      showToast('Mensaje copiado');
    } catch {
      showToast('No pude copiar — copia manualmente');
    }
  }, [textoActual, showToast]);

  const handleAbrirWhatsApp = useCallback(() => {
    const tel = cliente.telefono_limpio || cliente.telefono.replace(/\D/g, '');
    // Usamos web.whatsapp.com/send (no wa.me) para saltar la pantalla
    // intermedia de elección Desktop/Web. Va directo al chat dentro del
    // mismo navegador donde ya hay sesión iniciada.
    const url = `https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(textoActual)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [cliente, textoActual]);

  const handleEnviadoLocal = useCallback(() => {
    onEnviado(contacto, textoFueEditado ? textoEditado : undefined);
    // El draft ya cumplió su propósito (mensaje enviado real), limpiar storage.
    clearDraftEditado();
  }, [contacto, onEnviado, textoFueEditado, textoEditado, clearDraftEditado]);

  const handleToggleEdicion = useCallback(() => {
    setEditando((e) => !e);
  }, []);

  const handleDescartarEdicion = useCallback(() => {
    setTextoEditado(mensaje_renderizado);
    clearDraftEditado();
    setEditando(false);
  }, [mensaje_renderizado, setTextoEditado, clearDraftEditado]);

  // Atajos de teclado: Enter (enviado), S (saltar), N (no aplica), E (editar).
  // Solo si el foco NO está en input/textarea (para no chocar con la edición).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      if (isTypingTarget(e.target)) return;

      switch (e.key.toLowerCase()) {
        case 'enter':
          e.preventDefault();
          handleEnviadoLocal();
          break;
        case 's':
          e.preventDefault();
          onOmitir(contacto);
          break;
        case 'n':
          e.preventDefault();
          onNoAplica(contacto);
          break;
        case 'b':
          e.preventDefault();
          onBloquear(contacto);
          break;
        case 'e':
          e.preventDefault();
          handleToggleEdicion();
          break;
        case 'c':
          // Solo Ctrl/Cmd+C es nativo; sin modificador, c = copiar mensaje
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleCopiar();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    disabled,
    contacto,
    handleEnviadoLocal,
    onOmitir,
    onNoAplica,
    onBloquear,
    handleToggleEdicion,
    handleCopiar,
  ]);

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="border-b bg-slate-50 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl">{cliente.nombre}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a
                href={`https://web.whatsapp.com/send?phone=${cliente.telefono_limpio}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                title="Abrir chat en WhatsApp Web"
              >
                {cliente.telefono} <ExternalLink className="h-3 w-3" />
              </a>
              <RegionBadge
                region={regionDisplay}
                ciudad={ciudadDisplay}
              />
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${badge}`}
            >
              {perfil.estado_valor}
            </span>
            {esParejaRomantica && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-800"
                title="Cliente con historial de servicios románticos (Ambientación romántica, San Valentín, etc.) — alto valor por celebración"
              >
                💕 Pareja Romántica
              </span>
            )}
          </div>
        </div>
        {/* Editor de ciudad inline (prominente si sin_clasificar, link si ya está clasificado) */}
        <div className="mt-3">
          <EditorUbicacion
            clienteID={cliente.id}
            regionActual={regionDisplay}
            ciudadActual={ciudadDisplay}
            operador={operador}
            onActualizada={(region, ciudad) => {
              setRegionOverride(region);
              setCiudadOverride(ciudad);
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* Perfil resumen */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Perfil
          </h3>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <li>
              <strong>Cohorte:</strong> {perfil.cohorte}
            </li>
            <li>
              <strong>Visitas:</strong> {perfil.visitas_totales} ·{' '}
              <strong>Gasto:</strong> $
              {perfil.gasto_historico.toLocaleString('es-CL')}
            </li>
            <li>
              <strong>Última visita:</strong>{' '}
              {perfil.ultima_visita_humanizada || perfil.ultima_visita} (
              {perfil.dias_sin_venir} días)
            </li>
            {perfil.patron_habitual && (
              <li>
                <strong>Patrón:</strong> {perfil.patron_habitual}
              </li>
            )}
          </ul>
          {esParejaRomantica && (
            <p className="mt-2 rounded-md border border-pink-200 bg-pink-50/60 p-2 text-xs text-pink-900">
              💡 <strong>Cliente romántico:</strong> tiene historial de
              servicios para celebración (aniversario, luna de miel, etc.).
              Considera personalizar el mensaje con tecla{' '}
              <kbd className="rounded bg-white px-1 py-0.5 text-[10px] font-medium">
                E
              </kbd>{' '}
              para mencionar ocasión especial o fecha importante.
            </p>
          )}
          {perfil.servicios_favoritos && perfil.servicios_favoritos.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              <strong>Favoritos:</strong>{' '}
              {perfil.servicios_favoritos.join(', ')}
            </p>
          )}
        </section>

        {/* Mensaje sugerido */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mensaje sugerido (script {contacto.script_id} · salva{' '}
              {contacto.salva}){textoFueEditado && ' · editado'}
            </h3>
            <div className="flex gap-1">
              {!editando ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleEdicion}
                  title="Editar (E)"
                  className="h-7 px-2"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDescartarEdicion}
                  title="Descartar cambios"
                  className="h-7 px-2 text-slate-500"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {editando ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={textoEditado}
                onChange={(e) => setTextoEditado(e.target.value)}
                rows={Math.max(5, textoEditado.split('\n').length + 1)}
                className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-sans text-sm leading-relaxed text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditando(false)}
                className="text-xs"
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                Listo, mensaje editado
              </Button>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
              {mensaje_renderizado}
            </pre>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopiar}
              disabled={disabled}
              title="Copiar mensaje (C)"
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar mensaje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbrirWhatsApp}
              disabled={disabled}
              title="Abrir WhatsApp con mensaje pre-cargado"
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Abrir WhatsApp con mensaje
            </Button>
          </div>
        </section>

        {/* Por qué este mensaje (IA) */}
        {(cargandoExpl || explicacion) && (
          <section className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="mb-1 flex items-center gap-1 font-semibold uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> Por qué este mensaje
            </div>
            {cargandoExpl ? (
              <p className="flex items-center gap-2 text-amber-700">
                <Loader2 className="h-3 w-3 animate-spin" /> Generando…
              </p>
            ) : explicacion ? (
              <p className="leading-relaxed">{explicacion}</p>
            ) : (
              <p className="text-amber-700">
                (sin explicación disponible — el endpoint LLM aún es stub)
              </p>
            )}
          </section>
        )}

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          {/* Bloqueo permanente — a la izquierda, separado y rojo para evitar mis-click */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBloquear(contacto)}
            disabled={disabled}
            title="No volver a contactar — bloqueo permanente (B)"
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <Ban className="mr-2 h-4 w-4" />
            No volver a contactar ·{' '}
            <kbd className="ml-1 text-[10px] opacity-60">B</kbd>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNoAplica(contacto)}
              disabled={disabled}
              title="No aplica — 90 días sin contactar (N)"
            >
              <XCircle className="mr-2 h-4 w-4" />
              No aplica · <kbd className="ml-1 text-[10px] opacity-60">N</kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOmitir(contacto)}
              disabled={disabled}
              title="Saltar (S)"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Saltar · <kbd className="ml-1 text-[10px] opacity-60">S</kbd>
            </Button>
            <Button
              size="sm"
              onClick={handleEnviadoLocal}
              disabled={disabled}
              title="Ya le escribí (Enter)"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Ya le escribí a {nombreCorto} ·{' '}
              <kbd className="ml-1 text-[10px] opacity-60">Enter</kbd>
            </Button>
          </div>
        </div>

        {/* Atajos de teclado, recordatorio sutil */}
        <p className="text-center text-[11px] text-slate-400">
          Atajos: <kbd>Enter</kbd> enviado · <kbd>S</kbd> saltar ·{' '}
          <kbd>N</kbd> no aplica · <kbd>B</kbd> bloquear · <kbd>E</kbd> editar
          · <kbd>C</kbd> copiar
        </p>
      </CardContent>

      {/* Toast flotante */}
      {toast && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </Card>
  );
}
