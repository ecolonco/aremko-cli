'use client';

import { MapPin, Globe2, Plane, HelpCircle } from 'lucide-react';
import type { RegionGeografica } from './types';

interface RegionBadgeProps {
  region?: RegionGeografica;
  ciudad?: string | null;
  size?: 'sm' | 'xs';
  showCiudad?: boolean;
}

// Estilos por región — colores semánticos:
// sur (verde) = mensaje actual funciona
// nacional (azul) = requiere mensaje con alojamiento
// extranjero (gris) = no debería aparecer (excluido del cron)
// sin_clasificar (amarillo) = atención, falta dato
const styles: Record<
  RegionGeografica,
  { cls: string; icon: typeof MapPin; label: string }
> = {
  sur: {
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: MapPin,
    label: 'Sur',
  },
  nacional: {
    cls: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: Globe2,
    label: 'Resto de Chile',
  },
  extranjero: {
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: Plane,
    label: 'Extranjero',
  },
  sin_clasificar: {
    cls: 'bg-amber-50 text-amber-800 border-amber-300',
    icon: HelpCircle,
    label: 'Sin ciudad',
  },
};

export function RegionBadge({
  region,
  ciudad,
  size = 'sm',
  showCiudad = true,
}: RegionBadgeProps) {
  // Si no llega región del backend (caso transición o cliente viejo), no renderizar
  if (!region) return null;

  const s = styles[region];
  const Icon = s.icon;
  const sizeCls =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-xs';
  const iconSize = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  // Texto: si tenemos ciudad canónica + showCiudad → "📍 Puerto Varas · Sur"
  // Si no → "📍 Sur"
  const texto =
    showCiudad && ciudad
      ? `${ciudad} · ${s.label}`
      : s.label;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeCls} ${s.cls}`}
      title={
        region === 'sin_clasificar'
          ? 'Sin ciudad registrada — registrala para personalizar el mensaje'
          : `Región: ${s.label}${ciudad ? ` · ${ciudad}` : ''}`
      }
    >
      <Icon className={iconSize} />
      {texto}
    </span>
  );
}
