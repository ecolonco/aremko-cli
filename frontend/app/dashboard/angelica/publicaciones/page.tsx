'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import type { PublicacionPlanificada, PublicacionEstado, RevisionCorreccion } from '@/lib/types/api';

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

// ─── Destino de publicación por canal ───────────────────────────────────────
// "Publicar en un clic": abre directo el lugar donde se pega el contenido, para
// que el CM no tenga que recordar URLs. Google ya no ofrece un deep-link limpio
// al editor de novedades (redirige a limbos de verificación); lo robusto cuando
// administras la ficha es abrir tu ficha por búsqueda del nombre — ahí sale el
// botón "Agregar novedad" sin pantallas raras.
//
// MULTI-TENANT: cuando el sistema se venda a otros negocios, GBP_QUERY / el
// handle de IG salen de la config del tenant, no de constantes fijas.
const GBP_QUERY = 'Aremko Aguas Calientes Puerto Varas';

type Destino = { label: string; url: string; hint: string };

function destinoDe(canal: string): Destino | null {
  const c = (canal || '').toLowerCase();
  if (c.includes('gbp') || c.includes('google')) {
    return {
      label: 'Publicar en Google',
      url: `https://www.google.com/search?q=${encodeURIComponent(GBP_QUERY)}`,
      hint: 'Entra con la cuenta aremkospa@gmail.com (es la dueña de la ficha). ' +
        'En la barra de tu negocio toca “Publicaciones” → “Agregar novedad”, ' +
        'pega el texto, sube la foto aprobada y pon el link.',
    };
  }
  if (c.includes('instagram')) {
    return {
      label: 'Abrir Instagram',
      url: 'https://www.instagram.com/',
      hint: 'Se abre Instagram. Crea la publicación / historia / reel y pega el caption. ' +
        '(En el celular es más cómodo desde la app.)',
    };
  }
  if (c.includes('tiktok')) {
    return {
      label: 'Subir a TikTok',
      url: 'https://www.tiktok.com/upload',
      hint: 'Se abre la subida web de TikTok (cuenta @aremko.spa). Sube el video ORIGINAL exportado ' +
        '(sin marca de agua de Instagram) y pega el caption + hashtags de acá — no descargues el Reel ya ' +
        'publicado para volver a subirlo, baja el alcance.',
    };
  }
  // Email lo lleva Jorge por el flujo de campañas — sin botón acá.
  return null;
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

// El link del sticker/bio suele venir enterrado en el texto ("Sticker de link:
// aremko.cl/blog/..."). Instagram lo pide como campo aparte, así que lo sacamos
// y lo mostramos con su propio botón Copiar. Toma URLs con protocolo o dominios
// con ruta (aremko.cl/blog/...); descarta puntuación final.
function extractUrl(text?: string): string | null {
  if (!text) return null;
  // El texto puede venir de JSON.stringify(copy_json): los saltos de línea
  // escapados (\n) dejan una "n" pegada al dominio ("...🌧️\naremko.cl" →
  // "naremko.cl", link roto). Se neutralizan antes de buscar.
  const clean = text.replace(/\\[nrt]/g, ' ');
  const m = clean.match(
    /(https?:\/\/[^\s'")]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s'")]+)/i,
  );
  if (!m) return null;
  return m[1].replace(/[.,;:)»"']+$/, '');
}

// Chip del link listo para pegar: copia SIEMPRE con https:// (Instagram lo exige).
function LinkChip({ text }: { text?: string }) {
  const url = extractUrl(text);
  if (!url) return null;
  const conProtocolo = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5">
      <div className="min-w-0">
        <span className="text-[11px] font-semibold uppercase text-blue-700">🔗 Link para el sticker</span>
        <p className="truncate text-sm text-blue-900">{conProtocolo}</p>
      </div>
      <CopyButton text={conProtocolo} label="Copiar link" />
    </div>
  );
}

// Chip del prompt de imagen IA (H-064): listo para pegar en el editor que use
// Angélica (Higgsfield, Nano Banana, etc.). La línea de estilo boutique ya
// viene sellada dentro del texto. Django manda '' en historias sin foto
// (encuestas/stickers) → no se muestra nada.
function PromptImagenChip({ prompt }: { prompt?: string }) {
  if (!prompt || !prompt.trim()) return null;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5">
      <div className="min-w-0">
        <span className="text-[11px] font-semibold uppercase text-violet-700">🎨 Prompt de imagen (IA)</span>
        <p className="truncate text-sm text-violet-900">{prompt}</p>
      </div>
      <CopyButton text={prompt} label="Copiar prompt" />
    </div>
  );
}

// Botón "publicar en un clic": abre el destino del canal en una pestaña nueva.
function PublicarCTA({ canal }: { canal: string }) {
  const destino = destinoDe(canal);
  if (!destino) return null;
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-emerald-900">¿Listo para publicar?</span>
        <a
          href={destino.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-1.5 text-sm font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
        >
          {destino.label} →
        </a>
      </div>
      <p className="text-xs text-emerald-800 mt-1.5">{destino.hint}</p>
    </div>
  );
}

// El copywriter mete Story 1 y Story 2 en un mismo texto (separadas por "|").
// En Instagram son DOS historias distintas → las separamos para mostrarlas
// cada una en su recuadro. Divide justo antes de cada "STORY N".
function splitStories(text: string): string[] | null {
  const parts = text
    .split(/\s*\|?\s*(?=STORY\s*\d)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : null;
}

// Render de un campo del copy_json según su forma (string, guion, slides, lista).
// omitTexto: para piezas con segmentos (historias), el texto se muestra por
// historia, así que acá se omite para no duplicarlo.
function CopyDetalle({ copyJson, omitTexto }: { copyJson: Record<string, unknown>; omitTexto?: boolean }) {
  const ORDEN = [
    'texto', 'guion', 'caption_completo', 'slides', 'asunto', 'preheader',
    'cuerpo_texto_plano_completo', 'texto_sugerido', 'hashtags',
    'tomas_sugeridas', 'audio_sugerido', 'url_cta', 'foto_sugerida',
    'prompt_imagen_ia',
    'filtro_5_50', 'concepto', 'angulo', 'dato_o_evidencia', 'tipo',
    'nota_publicacion',
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
    prompt_imagen_ia: '🎨 Prompt para el editor de imágenes IA',
    filtro_5_50: 'Filtro 5/50',
    concepto: 'Concepto',
    angulo: 'Ángulo',
    dato_o_evidencia: 'Dato / evidencia',
    tipo: 'Tipo',
    nota_publicacion: '⚠️ Nota',
  };

  const bloques: React.ReactNode[] = [];
  for (const key of ORDEN) {
    if (omitTexto && (key === 'texto_sugerido' || key === 'caption_completo' || key === 'slides')) continue;
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
      const historias = (key === 'texto_sugerido' || key === 'caption_completo')
        ? splitStories(val)
        : null;
      if (historias) {
        bloques.push(
          <div key={key} className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase">{LABELS[key] || key}</span>
            <div className="space-y-2 mt-1">
              {historias.map((h, i) => (
                <div key={i} className="bg-gray-50 rounded px-3 py-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase">Historia {i + 1}</span>
                    <CopyButton text={h.replace(/^STORY\s*\d\s*[—-]\s*/i, '')} />
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {h.replace(/^STORY\s*\d\s*[—-]\s*/i, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      } else {
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
  }

  return <div>{bloques.length > 0 ? bloques : <p className="text-sm text-gray-400">Sin copy disponible.</p>}</div>;
}

// ─── Revisión de material (Fase 2) ──────────────────────────────────────────

const SEV_STYLE: Record<string, { dot: string; label: string; bg: string; fg: string }> = {
  critico: { dot: '#AF432C', label: 'Crítico', bg: 'rgba(175,67,44,.12)', fg: '#AF432C' },
  importante: { dot: '#B87F33', label: 'Importante', bg: 'rgba(184,127,51,.14)', fg: '#8A5E1F' },
  menor: { dot: '#4E7E5E', label: 'Menor', bg: 'rgba(78,126,94,.14)', fg: '#3C6349' },
};

// Resultado de la revisión IA (compartido: publicación entera o una historia).
function VeredictoBox({
  veredicto,
  resumen,
  correcciones,
}: {
  veredicto: string;
  resumen: string;
  correcciones: RevisionCorreccion[];
}) {
  const cs = correcciones || [];
  const criticos = cs.filter((c) => c.severidad === 'critico').length;
  if (veredicto === 'revisando') {
    return (
      <div className="flex items-center gap-2 mt-3 text-sm text-blue-700 bg-blue-50 rounded-md px-3 py-2">
        <span className="inline-block w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
        El asistente está mirando tu foto…
      </div>
    );
  }
  if (veredicto === 'aprobado') {
    return (
      <div className="mt-3 text-sm text-green-800 bg-green-50 rounded-md px-3 py-2">
        <b>✓ Aprobada.</b> {resumen}
      </div>
    );
  }
  if (veredicto === 'con_observaciones') {
    return (
      <>
        <div className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">
          {criticos > 0
            ? `${criticos} ${criticos === 1 ? 'cosa importante por corregir' : 'cosas importantes por corregir'}`
            : 'Algunas mejoras opcionales'}
          {resumen ? ` · ${resumen}` : ''}
        </div>
        <div className="mt-3 space-y-2">
          {cs.map((c: RevisionCorreccion, i) => {
            const s = SEV_STYLE[c.severidad] || SEV_STYLE.menor;
            return (
              <div key={i} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                  <span className="font-medium text-sm text-gray-900 flex-1">{c.aspecto}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                </div>
                <p className="text-sm text-gray-500">{c.encontrado}</p>
                <p className="text-sm text-gray-900 mt-1">→ {c.correccion}</p>
              </div>
            );
          })}
        </div>
      </>
    );
  }
  return null;
}

function RevisionMaterial({
  pub,
  onUpdate,
}: {
  pub: PublicacionPlanificada;
  onUpdate: (p: PublicacionPlanificada) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Solo para fotos/carruseles/historias (Fase 2). Los reels aún no.
  const soloTexto = pub.tipo === 'email';
  const esVideo = pub.tipo === 'reel';

  // Polling mientras la revisión está corriendo.
  useEffect(() => {
    if (pub.revision_veredicto === 'revisando') {
      pollRef.current = setInterval(async () => {
        const resp = await apiClient.getPublicacion(pub.id);
        if (resp.success && resp.data?.publicacion) {
          const fresh = resp.data.publicacion;
          if (fresh.revision_veredicto !== 'revisando') {
            if (pollRef.current) clearInterval(pollRef.current);
            onUpdate(fresh);
          }
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pub.revision_veredicto, pub.id, onUpdate]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setErr(null);
    const resp = await apiClient.subirMaterial(pub.id, Array.from(files));
    setSubiendo(false);
    if (resp.success && resp.data?.publicacion) {
      onUpdate(resp.data.publicacion);
    } else {
      setErr(resp.error || 'No se pudo subir el material');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  if (soloTexto) return null;

  const v = pub.revision_veredicto;
  const correcciones = pub.revision_json || [];

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Revisión del asistente</span>
        {esVideo && <span className="text-xs text-gray-400">Los reels se revisan pronto — por ahora, fotos e historias</span>}
      </div>

      {!esVideo && (
        <>
          {pub.material_urls?.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {pub.material_urls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`material ${i + 1}`} loading="lazy" className="w-16 h-16 object-cover rounded-md border border-gray-200" />
                </a>
              ))}
            </div>
          )}

          <label className="inline-flex items-center px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-700 cursor-pointer">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
              disabled={subiendo || v === 'revisando'}
            />
            {subiendo ? 'Subiendo…' : pub.material_urls?.length > 0 ? 'Subir versión corregida' : 'Subir foto y pedir revisión'}
          </label>
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}

          <VeredictoBox veredicto={v} resumen={pub.revision_resumen} correcciones={correcciones} />
        </>
      )}
    </div>
  );
}

// Revisión POR HISTORIA (stories): cada Historia tiene su propia foto y su
// propio veredicto — el asistente evalúa si la foto corresponde a ESA historia.
function RevisionSegmentos({
  pub,
  onUpdate,
}: {
  pub: PublicacionPlanificada;
  onUpdate: (p: PublicacionPlanificada) => void;
}) {
  const segmentos = pub.segmentos || [];
  const esCarrusel = pub.tipo === 'carrusel';
  const tituloSeccion = esCarrusel ? 'Revisión por slide' : 'Revisión por historia';
  const introSeccion = esCarrusel
    ? 'Cada slide lleva su propia foto — el asistente revisa que la foto corresponda a lo que dice ese slide.'
    : 'Cada historia lleva su propia foto — el asistente revisa que la foto corresponda a lo que dice esa historia.';
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [err, setErr] = useState<Record<number, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const algunoRevisando = segmentos.some((s) => s.revision_veredicto === 'revisando');

  useEffect(() => {
    if (algunoRevisando) {
      pollRef.current = setInterval(async () => {
        const resp = await apiClient.getPublicacion(pub.id);
        if (resp.success && resp.data?.publicacion) {
          const fresh = resp.data.publicacion;
          onUpdate(fresh);
          if (!(fresh.segmentos || []).some((s) => s.revision_veredicto === 'revisando')) {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [algunoRevisando, pub.id, onUpdate]);

  const onFiles = async (indice: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendo(indice);
    setErr((e) => ({ ...e, [indice]: '' }));
    const resp = await apiClient.subirMaterial(pub.id, Array.from(files), indice);
    setSubiendo(null);
    if (resp.success && resp.data?.publicacion) onUpdate(resp.data.publicacion);
    else setErr((e) => ({ ...e, [indice]: resp.error || 'No se pudo subir el material' }));
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tituloSeccion}</span>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">{introSeccion}</p>
      <div className="space-y-4">
        {segmentos.map((seg) => (
          <div key={seg.indice} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase">{seg.titulo}</span>
              <CopyButton text={seg.texto} />
            </div>
            <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded px-3 py-1.5">{seg.texto}</p>
            <LinkChip text={seg.texto} />
            <PromptImagenChip prompt={seg.prompt_imagen_ia} />

            {seg.material_urls?.length > 0 && (
              <div className="flex gap-2 flex-wrap my-3">
                {seg.material_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`${seg.titulo} ${i + 1}`} loading="lazy" className="w-16 h-16 object-cover rounded-md border border-gray-200" />
                  </a>
                ))}
              </div>
            )}

            <label className="inline-flex items-center mt-2 px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-700 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => onFiles(seg.indice, e.target.files)}
                disabled={subiendo === seg.indice || seg.revision_veredicto === 'revisando'}
              />
              {subiendo === seg.indice
                ? 'Subiendo…'
                : seg.material_urls?.length > 0
                ? 'Subir versión corregida'
                : 'Subir foto y pedir revisión'}
            </label>
            {err[seg.indice] && <p className="text-sm text-red-600 mt-2">{err[seg.indice]}</p>}

            <VeredictoBox
              veredicto={seg.revision_veredicto}
              resumen={seg.revision_resumen}
              correcciones={seg.revision_json}
            />
          </div>
        ))}
      </div>
    </div>
  );
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

  // Reemplaza una sola publicación en la lista (tras subir material / revisión),
  // sin recargar toda la semana.
  const patchPublicacion = useCallback((fresh: PublicacionPlanificada) => {
    setPublicaciones((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
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
                              {/* Tiempo estimado oculto a propósito: Angélica es dueña,
                                  no una ejecutora con cronómetro. El dato sigue en la BD. */}
                              {pub.responsable ? ` · ${pub.responsable}` : ''}
                              {pub.hora_sugerida ? (
                                <span
                                  className="ml-1 text-emerald-700 font-medium"
                                  title="Mejor hora para publicar (más alcance) — sugerencia, no obligación"
                                >
                                  · 🕐 {pub.hora_sugerida}
                                </span>
                              ) : null}
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
                            {pub.segmentos && pub.segmentos.length > 0 ? (
                              <>
                                <CopyDetalle copyJson={pub.copy_json} omitTexto />
                                <RevisionSegmentos pub={pub} onUpdate={patchPublicacion} />
                              </>
                            ) : (
                              <>
                                <CopyDetalle copyJson={pub.copy_json} />
                                <LinkChip text={JSON.stringify(pub.copy_json)} />
                                <RevisionMaterial pub={pub} onUpdate={patchPublicacion} />
                              </>
                            )}

                            <PublicarCTA canal={pub.canal} />

                            {pub.published_url && (
                              <p className="text-xs text-gray-500 mt-2">
                                Publicado en:{' '}
                                <a href={pub.published_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {pub.published_url}
                                </a>
                              </p>
                            )}

                            {/* Acciones de estado */}
                            {pub.estado !== 'publicada' && (
                              <p className="mt-4 text-xs text-gray-500">
                                ¿Ya la publicaste en {pub.canal}? Pega el link del post y márcala como publicada
                                (el tablero no se entera solo de lo que pasa en Google/Instagram).
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {pub.estado !== 'publicada' && (
                                <input
                                  type="url"
                                  placeholder="Link del post publicado (Instagram/GBP)…"
                                  value={urlPublicada[pub.id] || ''}
                                  onChange={(e) => setUrlPublicada({ ...urlPublicada, [pub.id]: e.target.value })}
                                  className="flex-1 min-w-[220px] text-sm border border-gray-200 rounded-md px-3 py-1.5"
                                />
                              )}
                              {pub.estado !== 'publicada' && (
                                <button
                                  onClick={() => actualizar(pub, 'publicada')}
                                  disabled={guardando === pub.id}
                                  className="px-4 py-1.5 text-sm font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {guardando === pub.id ? 'Guardando…' : '✓ Marcar publicada'}
                                </button>
                              )}
                              {/* Paso intermedio opcional (marcar avance); no dup con "Marcar publicada". */}
                              {siguiente && siguiente.estado !== 'publicada' && (
                                <button
                                  onClick={() => actualizar(pub, siguiente.estado)}
                                  disabled={guardando === pub.id}
                                  className="px-4 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-700 disabled:opacity-50"
                                >
                                  {guardando === pub.id ? 'Guardando…' : siguiente.label}
                                </button>
                              )}
                              {pub.estado !== 'pendiente' && (
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
