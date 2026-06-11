'use client';

import type { GiftCardCampaign } from '@/lib/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Card de la campaña "GiftCard Día del Padre" en la pestaña Social del brief.
// Espejo liviano de RefugioCampaignSection: acá la métrica primaria son las
// COMPRAS del píxel (evento Purchase) y su valor (ROAS), no los leads.

function platformLabel(key: string): string {
  switch (key) {
    case 'facebook':         return '📘 Facebook';
    case 'instagram':        return '📷 Instagram';
    case 'audience_network': return '🌐 Audience Network';
    case 'messenger':        return '💬 Messenger';
    case 'threads':          return '🧵 Threads';
    default:                 return key || '—';
  }
}

const formatCLP = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v ?? 0);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('es-CL').format(v ?? 0);

const formatPct = (v: number, digits = 2) => `${(v ?? 0).toFixed(digits)}%`;

// Días que quedan hasta la fecha de fin (Día del Padre). 0 = es hoy; negativo = terminó.
function daysLeft(endDate: string): number {
  const end = new Date(`${endDate}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface Props {
  data: GiftCardCampaign;
}

export default function GiftCardCampaignSection({ data }: Props) {
  const { summary, platforms, account_label, campaign_name, period, end_date } = data;

  const remaining = daysLeft(end_date);
  const finished = remaining < 0;

  const platformRows = (platforms || [])
    .filter((p) => p.impressions > 0)
    .sort((a, b) => b.clicks - a.clicks || b.spend - a.spend);

  return (
    <Card className="border-rose-200 bg-gradient-to-br from-rose-50/40 to-amber-50/40">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span>🎁 GiftCard Día del Padre</span>
              {finished ? (
                <Badge variant="secondary" className="text-xs">Finalizada</Badge>
              ) : (
                <Badge className="text-xs bg-rose-600 hover:bg-rose-600">
                  {remaining === 0 ? '¡Es hoy!' : `Quedan ${remaining} día${remaining === 1 ? '' : 's'}`}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {campaign_name} · {account_label} · {period.start} → {period.end} · termina el 21-jun
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Presupuesto</p>
            <p className="text-sm font-medium">
              {formatCLP(summary.budget_total_clp)} ({formatPct(summary.budget_pct_used, 1)} usado)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen ejecutivo — compras y retorno primero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Compras"
            value={formatNumber(summary.purchases)}
            hint="Evento Purchase del píxel"
            highlight
          />
          <Metric
            label="Costo por compra"
            value={summary.purchases === 0 ? '—' : formatCLP(summary.cost_per_purchase)}
            hint="Gasto / compras"
          />
          <Metric
            label="Ingresos atribuidos"
            value={summary.purchase_value > 0 ? formatCLP(summary.purchase_value) : '—'}
            hint="Valor de compras (Meta)"
          />
          <Metric
            label="ROAS"
            value={summary.roas > 0 ? `${summary.roas.toFixed(2)}×` : '—'}
            hint="Ingresos / gasto"
            highlight={summary.roas >= 1}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Gasto" value={formatCLP(summary.spend)} hint={`de ${formatCLP(summary.budget_total_clp)}`} />
          <Metric label="Clics" value={formatNumber(summary.clicks)} hint={`CPC ${formatCLP(summary.cpc)}`} />
          <Metric label="CTR" value={formatPct(summary.ctr)} hint={`${formatNumber(summary.impressions)} impresiones`} />
          <Metric label="Alcance" value={formatNumber(summary.reach)} hint={`frecuencia ${(summary.frequency ?? 0).toFixed(2)}`} />
        </div>

        {/* Desglose por plataforma (los UTM dinámicos separan fb/ig también en GA4) */}
        {platformRows.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Por plataforma</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-1.5 pr-2">Plataforma</th>
                    <th className="py-1.5 px-2 text-right">Gasto</th>
                    <th className="py-1.5 px-2 text-right">Clics</th>
                    <th className="py-1.5 px-2 text-right">CTR</th>
                    <th className="py-1.5 px-2 text-right">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map((p) => (
                    <tr key={p.platform} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{platformLabel(p.platform)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCLP(p.spend)}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(p.clicks)}</td>
                      <td className="py-1.5 px-2 text-right">{formatPct(p.ctr)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCLP(p.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Las compras del píxel pueden tardar horas en consolidarse; el total oficial de gift cards
          vendidas vive en la BD del booking system. Destino del anuncio:{' '}
          <span className="font-mono">aremko.cl/ventas/giftcards/</span>
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-rose-300 bg-rose-50' : 'bg-white/60'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-rose-700' : ''}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
