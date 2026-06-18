'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Search, AlertTriangle, Play } from 'lucide-react';
import { fetchBibliotecaMedios, type MediaGrupo } from './api';

// Una "tarjeta" seleccionable = una foto o un video de un servicio.
interface MediaCard {
  url: string;
  nombre: string;
  tipoLabel: string;
  esVideo: boolean;
}

interface Props {
  // Se llama al elegir una foto/video. `esVideo` para mostrar el aviso correcto.
  onSelect: (url: string, nombre: string, esVideo: boolean) => void;
  onClose: () => void;
  // Color de acento del canal (para el spinner/botones), opcional.
  accent?: string;
}

// Galería de medios del catálogo (H-025): miniaturas agrupadas por tipo + buscador.
// Pensada para celular: hoja a pantalla casi completa, grid de miniaturas.
export function BibliotecaMedios({ onSelect, onClose, accent = 'text-emerald-600' }: Props) {
  const [grupos, setGrupos] = useState<MediaGrupo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const data = await fetchBibliotecaMedios();
        if (vivo) setGrupos(data.grupos || []);
      } catch (e: unknown) {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Aplana a tarjetas (cada foto y cada video) y filtra por el buscador.
  const grupoCards = useMemo(() => {
    const term = q.trim().toLowerCase();
    return grupos
      .map((g) => {
        const cards: MediaCard[] = [];
        for (const it of g.items) {
          if (term && !it.nombre.toLowerCase().includes(term)) continue;
          for (const f of it.fotos || []) {
            cards.push({ url: f, nombre: it.nombre, tipoLabel: g.label, esVideo: false });
          }
          if (it.video) {
            cards.push({ url: it.video, nombre: it.nombre, tipoLabel: g.label, esVideo: true });
          }
        }
        return { label: g.label, tipo: g.tipo, cards };
      })
      .filter((g) => g.cards.length > 0);
  }, [grupos, q]);

  const totalCards = grupoCards.reduce((a, g) => a + g.cards.length, 0);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      {/* Cabecera */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 p-3">
        <span className="text-sm font-semibold text-slate-800">Biblioteca de fotos y videos</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar biblioteca"
          className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Buscador */}
      <div className="flex-shrink-0 border-b border-slate-100 p-2">
        <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (ej. hornopiren, torre)…"
            className="w-full py-2 text-sm focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : cargando ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className={`h-6 w-6 animate-spin ${accent}`} />
          </div>
        ) : totalCards === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {q ? 'Sin resultados para tu búsqueda.' : 'No hay fotos en la biblioteca todavía.'}
          </p>
        ) : (
          <div className="space-y-5">
            {grupoCards.map((g) => (
              <section key={g.tipo}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {g.label} ({g.cards.length})
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {g.cards.map((c, i) => (
                    <button
                      key={`${c.url}-${i}`}
                      type="button"
                      onClick={() => onSelect(c.url, c.nombre, c.esVideo)}
                      title={`Enviar ${c.nombre}`}
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left transition hover:border-slate-400 hover:shadow"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-slate-100">
                        {c.esVideo ? (
                          <video src={c.url} muted className="h-full w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.url} alt={c.nombre} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                        )}
                      </div>
                      {c.esVideo && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
                          <Play className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span className="block truncate px-1.5 py-1 text-[11px] font-medium text-slate-700">
                        {c.nombre}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
