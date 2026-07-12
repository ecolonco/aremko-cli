'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import type { PublicacionPlanificada, PublicacionEstado } from '@/lib/types/api';

// ─── Helpers de presentación ────────────────────────────────────────────────

const ESTADO_LABELS: Record<PublicacionEstado, string> = {
  pendiente: 'Pendiente',
  en_produccion: 'En producción',
  lista: 'Lista',
  publicada: 'Publicada',
  no_aplica: 'No aplica',
};

const ESTADO_STYLES: Record<PublicacionEstado, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  en_produccion: 'bg-blue-100 text-blue-800',
  lista: 'bg-purple-100 text-purple-800',
  publicada: 'bg-green-100 text-green-800',
  no_aplica: 'bg-gray-100 text-gray-500',
};

// Transiciones válidas del workflow (siguiente paso natural por estado).
const SIGUIENTE_ESTADO: Partial<Record<PublicacionEstado, { estado: PublicacionEstado; label: string }>> = {
  pendiente: { estado: 'en_produccion', label: 'Empezar a producir' },
  en_produccion: { estado: 'lista', label: 'Marcar lista' },
  lista: { estado: 'publicada', label: 'Marcar publicada' },
};

const TIPO_EMOJI: Record<string, string> = {
  reel: '🎬',
  carrusel: '🖼️',
  story: '📱',
  post: '📍',
  email: '✉️',
};

function formatDia(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs font-medium text-blue-600 hover:text-blue-800 shrink-0"
    >
      {copied ? '✓ Copiado' : label || 'Copiar'}
    </button>
  );
}

// Render de un campo del copy_json según su forma (string, guion, slides, lista).
function CopyDetalle({ copyJson }: { copyJson: Record<string, unknown> }) {
  const ORDEN = [
    'texto', 'guion', 'caption_completo', 'slides', 'asunto', 'preheader',
    'cuerpo_texto_plano_completo', 'texto_sugerido', 'hashtags',
    'tomas_sugeridas', 'audio_sugerido', 'url_cta', 'foto_sugerida',
    'filtro_5_50', 'concepto', 'angulo', 'dato_o_evidencia', 'tipo',
  ];
  const LABELS: Record<string, string> = {
    texto: 'Texto',
    guion: 'Guion',
    caption_completo: 'Caption',
    slides: 'Slides',
    asunto: 'Asunto',
    preheader: 'Preheader',
    cuerpo_texto_plano_completo: 'Cuerpo del email',
    texto_sugerido: 'Texto sugerido',
    hashtags: 'Hashtags',
    tomas_sugeridas: 'Tomas sugeridas',
    audio_sugerido: 'Audio',
    url_cta: 'URL con UTM',
    foto_sugerida: 'Foto sugerida',
    filtro_5_50: 'Filtro 5/50',
    concepto: 'Concepto',
    angulo: 'Ángulo',
    dato_o_evidencia: 'Dato / evidencia',
    tipo: 'Tipo',
  };

  const bloques: React.ReactNode[] = [];
  for (const key of ORDEN) {
    const val = copyJson[key];
    if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) continue;

    if (key === 'guion' && Array.isArray(val)) {
      const guionTexto = (val as Array<Record<string, string>>)
        .map((b) => `[${b.bloque}] ${b.texto}`)
        .join('\n');
      bloques.push(
        <div key={key} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">{LABELS[key]}</span>
            <CopyButton text={guionTexto} />
          </div>
          <div className="space-y-1">
            {(val as Array<Record<string, string>>).map((b, i) => (
              <div key={i} className="text-sm bg-gray-50 rounded px-3 py-1.5">
                <span className="font-mono text-xs text-gray-400 mr-2">{b.bloque}</span>
                <span className="text-gray-900">{b.texto}</span>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (key === 'slides' && Array.isArray(val)) {
      bloques.push(
        <div key={key} className="mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase">{LABELS[key]}</span>
          <div className="space-y-1 mt-1">
            {(val as Array<Record<string, unknown>>).map((s, i) => (
              <div key={i} className="text-sm bg-gray-50 rounded px-3 py-1.5">
                <span className="font-mono text-xs text-gray-400 mr-2">#{String(s.numero ?? i + 1)}</span>
                <span className="text-gray-900 font-medium">{String(s.texto_overlay ?? '')}</span>
                {s.imagen_sugerida ? (
                  <span className="text-gray-500 text-xs block">📷 {String(s.imagen_sugerida)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      );
    } else if (Array.isArray(val)) {
      const texto = (val as unknown[]).map(String).join(key === 'hashtags' ? ' ' : '\n');
      bloques.push(
        <div key={key} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">{LABELS[key] || key}</span>
            <CopyButton text={texto} />
          </div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded px-3 py-1.5">{texto}</p>
        </div>
      );
    } else if (typeof val === 'string') {
      bloques.push(
        <div key={key} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">{LABELS[key] || key}</span>
            <CopyButton text={val} />
          </div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded px-3 py-1.5">{val}</p>
        </div>
      );
    }
  }

  return <div>{bloques.length > 0 ? bloques : <p className="text-sm text-gray-400">Sin copy disponible.</p>}</div>;
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function PublicacionesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [semana, setSemana] = useState<string>(''); // '' = semana actual
  const [semanaInicio, setSemanaInicio] = useState<string>('');
  const [publicaciones, setPublicaciones] = useState<PublicacionPlanificada[]>([]);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [urlPublicada, setUrlPublicada] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState<number | null>(null);

  const cargar = useCallback(async (semanaParam: string) => {
    setLoading(true);
    setError(null);
    const resp = await apiClient.getPublicacionesSemana(semanaParam || undefined);
    if (resp.success && resp.data) {
      setPublicaciones(resp.data.publicaciones);
      setSemanaInicio(resp.data.semana_inicio);
    } else {
      setError(resp.error || 'Error al cargar publicaciones');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar(semana);
  }, [semana, cargar]);

  const moverSemana = (dias: number) => {
    const base = semanaInicio ? new Date(semanaInicio + 'T12:00:00') : new Date();
    base.setDate(base.getDate() + dias);
    setSemana(base.toISOString().slice(0, 10));
  };

  const actualizar = async (pub: PublicacionPlanificada, nuevoEstado: PublicacionEstado) => {
    setGuardando(pub.id);
    const payload: { estado: string; published_url?: string } = { estado: nuevoEstado };
    if (nuevoEstado === 'publicada' && urlPublicada[pub.id]) {
      payload.published_url = urlPublicada[pub.id];
    }
    const resp = await apiClient.actualizarPublicacion(pub.id, payload);
    if (resp.success) {
      await cargar(semana);
    } else {
      setError(resp.error || 'No se pudo actualizar');
    }
    setGuardando(null);
  };

  // Agrupar por día (ya vienen ordenadas por día desde el backend).
  const porDia: Array<[string, PublicacionPlanificada[]]> = [];
  for (const p of publicaciones) {
    const last = porDia[porDia.length - 1];
    if (last && last[0] === p.dia) last[1].push(p);
    else porDia.push([p.dia, [p]]);
  }

  const pendientes = publicaciones.filter((p) => p.estado === 'pendiente' || p.estado === 'en_produccion').length;
  const publicadas = publicaciones.filter((p) => p.estado === 'publicada').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Publicaciones de la semana</h1>
          <p className="mt-2 text-sm text-gray-600">
            La cola de contenido generada por el brief del lunes: cada pieza con su copy listo para
            usar. Marca el avance a medida que produces y publicas — al marcar “Publicada”, pega el
            link del post para que después se le cuelguen las métricas.
          </p>
        </div>

        {/* Selector de semana + resumen */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => moverSemana(-7)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50">
              ← Semana anterior
            </button>
            <span className="text-sm font-medium text-gray-900">
              {semanaInicio ? `Semana del ${formatDia(semanaInicio)}` : '…'}
            </span>
            <button onClick={() => moverSemana(7)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50">
              Semana siguiente →
            </button>
          </div>
          {publicaciones.length > 0 && (
            <span className="text-sm text-gray-500">
              {publicadas}/{publicaciones.length} publicadas · {pendientes} por hacer
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando la semana…</p>
          </div>
        ) : publicaciones.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-sm text-gray-500">
            No hay publicaciones para esta semana todavía. Se generan automáticamente cada lunes a las
            10:00 con el brief semanal.
          </div>
        ) : (
          <div className="space-y-6">
            {porDia.map(([dia, pubs]) => (
              <div key={dia}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 capitalize">
                  {formatDia(dia)}
                </h2>
                <div className="space-y-2">
                  {pubs.map((pub) => {
                    const siguiente = SIGUIENTE_ESTADO[pub.estado];
                    const abierta = expandida === pub.id;
                    return (
                      <div key={pub.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {/* Fila resumen */}
                        <button
                          onClick={() => setExpandida(abierta ? null : pub.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                        >
                          <span className="text-lg shrink-0">{TIPO_EMOJI[pub.tipo] || '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {pub.titulo || pub.pieza_key}
                            </p>
                            <p className="text-xs text-gray-500">
                              {pub.canal} · {pub.tipo}
                              {pub.tiempo_estimado ? ` · ${pub.tiempo_estimado}` : ''}
                              {pub.responsable ? ` · ${pub.responsable}` : ''}
                            </p>
                          </div>
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${ESTADO_STYLES[pub.estado]}`}>
                            {ESTADO_LABELS[pub.estado]}
                          </span>
                          <span className="text-gray-400 text-sm shrink-0">{abierta ? '▲' : '▼'}</span>
                        </button>

                        {/* Detalle expandido */}
                        {abierta && (
                          <div className="border-t border-gray-100 px-4 py-4">
                            <CopyDetalle copyJson={pub.copy_json} />

                            {pub.published_url && (
                              <p className="text-xs text-gray-500 mt-2">
                                Publicado en:{' '}
                                <a href={pub.published_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {pub.published_url}
                                </a>
                              </p>
                            )}

                            {/* Acciones de estado */}
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              {pub.estado === 'lista' && (
                                <input
                                  type="url"
                                  placeholder="Link del post publicado (Instagram/GBP)…"
                                  value={urlPublicada[pub.id] || ''}
                                  onChange={(e) => setUrlPublicada({ ...urlPublicada, [pub.id]: e.target.value })}
                                  className="flex-1 min-w-[220px] text-sm border border-gray-200 rounded-md px-3 py-1.5"
                                />
                              )}
                              {siguiente && (
                                <button
                                  onClick={() => actualizar(pub, siguiente.estado)}
                                  disabled={guardando === pub.id}
                                  className="px-4 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-700 disabled:opacity-50"
                                >
                                  {guardando === pub.id ? 'Guardando…' : siguiente.label}
                                </button>
                              )}
                              {pub.estado !== 'pendiente' && pub.estado !== 'publicada' && (
                                <button
                                  onClick={() => actualizar(pub, 'pendiente')}
                                  disabled={guardando === pub.id}
                                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Volver a pendiente
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
