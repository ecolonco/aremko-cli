'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface CampaignLite {
  id: string;
  name: string;
  status?: string;
}

// Controles de gestión de una campaña: Pausar/Activar y ajustar presupuesto.
// Cada acción MUEVE dinero real en Meta → pide confirmación antes de ejecutar.
// El presupuesto se ingresa en CLP enteros (la cuenta es CLP, sin decimales).
export default function GestionCampana({
  campaign,
  onResult,
}: {
  campaign: CampaignLite;
  onResult: (msg: string, recargar: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const activa = (campaign.status ?? '').toUpperCase() === 'ACTIVE';

  const pausarOActivar = async () => {
    const accion = activa ? 'pausar' : 'activar';
    if (
      !window.confirm(
        `¿${accion[0].toUpperCase() + accion.slice(1)} la campaña "${campaign.name}"?\n\nAfecta el gasto real en Meta Ads.`
      )
    )
      return;
    setBusy(true);
    try {
      const res = activa
        ? await apiClient.pauseCampaign(campaign.id)
        : await apiClient.activateCampaign(campaign.id);
      onResult(
        res.success
          ? `✅ Campaña "${campaign.name}" ${activa ? 'pausada' : 'activada'}.`
          : `⚠️ No se pudo: ${res.error}`,
        res.success
      );
    } finally {
      setBusy(false);
    }
  };

  const cambiarPresupuesto = async () => {
    const val = window.prompt(
      `Nuevo presupuesto DIARIO en CLP para "${campaign.name}"\n(solo el número, ej. 110000):`
    );
    if (val == null) return;
    const monto = parseInt(val.replace(/[^0-9]/g, ''), 10);
    if (!monto || monto <= 0) {
      onResult('⚠️ Monto inválido.', false);
      return;
    }
    if (
      !window.confirm(
        `Fijar presupuesto diario de "${campaign.name}" en $${monto.toLocaleString('es-CL')} CLP?`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await apiClient.updateCampaignBudget(campaign.id, monto);
      onResult(
        res.success
          ? `✅ Presupuesto de "${campaign.name}" → $${monto.toLocaleString('es-CL')}/día.`
          : `⚠️ No se pudo: ${res.error}`,
        res.success
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={pausarOActivar}
        disabled={busy}
        className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
          activa
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {busy ? '…' : activa ? 'Pausar' : 'Activar'}
      </button>
      <button
        type="button"
        onClick={cambiarPresupuesto}
        disabled={busy}
        className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
      >
        Presupuesto
      </button>
    </div>
  );
}
