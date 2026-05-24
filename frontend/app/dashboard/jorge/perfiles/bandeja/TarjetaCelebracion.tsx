'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Heart,
  Crown,
  Users2,
  Smile,
  Award,
  Copy,
  ExternalLink,
  CheckCircle2,
  SkipForward,
} from 'lucide-react';
import type { Contacto, Celebracion, TipoCelebracion } from './types';

interface TarjetaCelebracionProps {
  contacto: Contacto;
  celebracion?: Celebracion;
  disabled?: boolean;
  onAgradecido: (contacto: Contacto) => void;
  onOmitir: (contacto: Contacto) => void;
}

// Fallbacks de UI por tipo de hito (cuando el backend no manda descripción).
const HITOS: Record<
  TipoCelebracion,
  { icon: React.ComponentType<{ className?: string }>; titulo: string; bajada: string }
> = {
  recuperado_dormido: {
    icon: Heart,
    titulo: 'Volvió después de mucho tiempo',
    bajada:
      'Estaba dormido (más de 6 meses sin venir) y reservó. Una visita que vale celebrar.',
  },
  consolidacion_regular: {
    icon: Smile,
    titulo: 'Pasó de En Prueba a Regular',
    bajada: 'Ya no es un visitante ocasional, se convirtió en cliente habitual.',
  },
  migracion_devoto: {
    icon: Sparkles,
    titulo: 'Encontró su servicio favorito',
    bajada:
      'De probador esporádico a devoto de un servicio específico. Le está gustando algo.',
  },
  trajo_acompanante: {
    icon: Users2,
    titulo: 'Empezó a venir acompañada/o',
    bajada:
      'Antes venía sola/o, ahora viene en pareja o grupo. Pedirle reseña podría sumar.',
  },
  subio_a_leal: {
    icon: Award,
    titulo: 'Subió a Leal',
    bajada: 'Cliente fiel. Cuídala/o como joya.',
  },
  subio_a_campeon: {
    icon: Crown,
    titulo: '¡Subió a Campeón!',
    bajada: 'Lo mejor de lo mejor. Avisa a Jorge — vale agradecimiento personal.',
  },
};

export function TarjetaCelebracion({
  contacto,
  celebracion,
  disabled,
  onAgradecido,
  onOmitir,
}: TarjetaCelebracionProps) {
  const { cliente, perfil_resumen: perfil, mensaje_renderizado } = contacto;
  const nombreCorto = cliente.nombre.split(' ')[0];
  const hito = celebracion?.tipo ? HITOS[celebracion.tipo] : null;
  const Icon = hito?.icon ?? Sparkles;

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  // Reset toast al cambiar contacto.
  useEffect(() => {
    setToast(null);
  }, [contacto.id]);

  const handleCopiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mensaje_renderizado);
      showToast('Mensaje copiado');
    } catch {
      showToast('No pude copiar — copia manualmente');
    }
  }, [mensaje_renderizado, showToast]);

  const handleAbrirWhatsApp = useCallback(() => {
    const tel = cliente.telefono_limpio || cliente.telefono.replace(/\D/g, '');
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(
      mensaje_renderizado
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [cliente, mensaje_renderizado]);

  return (
    <Card className="relative overflow-hidden border-emerald-300">
      {/* Banner celebración */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-white">
        <div className="rounded-full bg-white/20 p-2">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
            ★ Hito · Celebración
          </p>
          <p className="text-lg font-medium">
            {celebracion?.descripcion ||
              hito?.titulo ||
              '¡Buena noticia con un cliente!'}
          </p>
        </div>
      </div>

      <CardHeader className="border-b bg-emerald-50/40 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{cliente.nombre}</CardTitle>
            <a
              href={`https://wa.me/${cliente.telefono_limpio}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
            >
              {cliente.telefono} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-medium text-slate-700">
              {perfil.estado_valor} · {perfil.cohorte}
            </p>
            <p className="mt-1">
              {perfil.visitas_totales} visitas · $
              {perfil.gasto_historico.toLocaleString('es-CL')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-6">
        {/* Bajada del hito (contexto para el operador) */}
        {hito && (
          <p className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm leading-relaxed text-emerald-900">
            {hito.bajada}
          </p>
        )}

        {/* Mensaje sugerido de agradecimiento (no promo) */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mensaje sugerido (agradecimiento, no promoción)
          </h3>
          <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
            {mensaje_renderizado ||
              `Hola ${nombreCorto}, solo quería agradecerte tu visita reciente. Nos alegró mucho verte por Aremko.`}
          </pre>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopiar}
              disabled={disabled}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar mensaje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbrirWhatsApp}
              disabled={disabled}
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Abrir WhatsApp con mensaje
            </Button>
          </div>
        </section>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOmitir(contacto)}
            disabled={disabled}
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Por ahora no
          </Button>
          <Button
            size="sm"
            onClick={() => onAgradecido(contacto)}
            disabled={disabled}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Ya le agradecí a {nombreCorto}
          </Button>
        </div>
      </CardContent>

      {toast && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </Card>
  );
}
