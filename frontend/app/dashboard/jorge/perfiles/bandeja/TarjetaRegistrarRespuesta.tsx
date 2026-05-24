'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  CheckCircle2,
  HelpCircle,
  HeartCrack,
  Clock,
  XCircle,
  MessageCircleOff,
  CircleDashed,
  Save,
  ExternalLink,
} from 'lucide-react';
import type { Contacto, TipoRespuesta } from './types';

interface TarjetaRegistrarRespuestaProps {
  contacto: Contacto;
  disabled?: boolean;
  onGuardar: (
    contacto: Contacto,
    tipo: TipoRespuesta,
    nota: string
  ) => void;
}

interface OpcionRespuesta {
  tipo: TipoRespuesta;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // clases de tailwind para borde + bg cuando seleccionada
}

const OPCIONES: OpcionRespuesta[] = [
  {
    tipo: 'reservo',
    label: 'Reservó',
    desc: 'Cerró una reserva concreta',
    icon: CheckCircle2,
    color: 'border-emerald-500 bg-emerald-50',
  },
  {
    tipo: 'interesado',
    label: 'Interesada/o',
    desc: 'Respondió con buena onda, no cerró aún',
    icon: HelpCircle,
    color: 'border-sky-500 bg-sky-50',
  },
  {
    tipo: 'consulto_precio',
    label: 'Consultó precio',
    desc: 'Pidió valores antes de decidir',
    icon: CircleDashed,
    color: 'border-amber-500 bg-amber-50',
  },
  {
    tipo: 'mas_adelante',
    label: 'Más adelante',
    desc: 'Sin presión, vuelve en 60 días',
    icon: Clock,
    color: 'border-indigo-500 bg-indigo-50',
  },
  {
    tipo: 'rechazo',
    label: 'Rechazó',
    desc: 'Dijo que no, pero sigue contactable',
    icon: HeartCrack,
    color: 'border-orange-500 bg-orange-50',
  },
  {
    tipo: 'opt_out',
    label: 'Pidió no escribir más',
    desc: 'Bloqueo permanente — no recibirá más WhatsApp',
    icon: XCircle,
    color: 'border-red-500 bg-red-50',
  },
  {
    tipo: 'sin_respuesta',
    label: 'Sin respuesta',
    desc: 'No contestó nada en estos días',
    icon: MessageCircleOff,
    color: 'border-slate-400 bg-slate-100',
  },
];

const diasDesde = (fechaIso?: string): string => {
  if (!fechaIso) return '';
  const enviada = new Date(fechaIso);
  if (Number.isNaN(enviada.getTime())) return '';
  const diff = Math.floor((Date.now() - enviada.getTime()) / 86_400_000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff} días`;
};

const formatFecha = (fechaIso?: string): string => {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return fechaIso;
  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

export function TarjetaRegistrarRespuesta({
  contacto,
  disabled,
  onGuardar,
}: TarjetaRegistrarRespuestaProps) {
  const { cliente, perfil_resumen: perfil, mensaje_enviado_editado, mensaje_renderizado } = contacto;
  const textoEnviado = mensaje_enviado_editado || mensaje_renderizado;

  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoRespuesta | null>(null);
  const [nota, setNota] = useState('');

  // Reset al cambiar de contacto.
  useEffect(() => {
    setTipoSeleccionado(null);
    setNota('');
  }, [contacto.id]);

  const opcion = useMemo(
    () => OPCIONES.find((o) => o.tipo === tipoSeleccionado),
    [tipoSeleccionado]
  );

  const handleGuardar = () => {
    if (!tipoSeleccionado || disabled) return;
    onGuardar(contacto, tipoSeleccionado, nota);
  };

  return (
    <Card className="overflow-hidden border-indigo-200">
      <CardHeader className="border-b bg-indigo-50/50 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Respuesta pendiente
            </p>
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
        {/* Recordatorio: mensaje que se envió + cuándo */}
        <section>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Le escribimos el {formatFecha(contacto.fecha_envio)} (
            {diasDesde(contacto.fecha_envio)})
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-700">
            {textoEnviado}
          </pre>
        </section>

        {/* Opciones de respuesta */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ¿Qué pasó con {cliente.nombre.split(' ')[0]}?
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPCIONES.map((opt) => {
              const Icon = opt.icon;
              const seleccionada = tipoSeleccionado === opt.tipo;
              return (
                <button
                  key={opt.tipo}
                  type="button"
                  onClick={() => setTipoSeleccionado(opt.tipo)}
                  disabled={disabled}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 ${
                    seleccionada
                      ? `${opt.color} ring-2 ring-offset-1`
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                      seleccionada ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Nota libre */}
        <section>
          <label
            htmlFor="nota-operador"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Nota (opcional)
          </label>
          <textarea
            id="nota-operador"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder='Ej: "Quiere venir el viernes con su marido a una tina"'
            className="w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </section>

        {/* Aviso si la opción tiene side effect importante */}
        {opcion?.tipo === 'opt_out' && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            ⚠ Esta acción es <strong>permanente</strong>. {cliente.nombre.split(' ')[0]} no
            recibirá más WhatsApp salvo que se desbloquee manualmente en admin Django.
          </div>
        )}
        {opcion?.tipo === 'mas_adelante' && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-900">
            {cliente.nombre.split(' ')[0]} no volverá a aparecer en la bandeja por <strong>60 días</strong>.
          </div>
        )}

        {/* Guardar */}
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            onClick={handleGuardar}
            disabled={disabled || !tipoSeleccionado}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            Guardar respuesta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
