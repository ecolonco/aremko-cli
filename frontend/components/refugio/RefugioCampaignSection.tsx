'use client';

import { useState } from 'react';
import type { RefugioCampaign, RefugioThresholds } from '@/lib/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Etiquetas humanas + emoji para plataforma + posición de Meta Ads.
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

function positionLabel(key: string): string {
  if (!key) return '—';
  // Snake_case → "Snake case"
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const formatCLP = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v ?? 0);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('es-CL').format(v ?? 0);

const formatPct = (v: number, digits = 2) =>
  `${(v ?? 0).toFixed(digits)}%`;

type Status = 'green' | 'yellow' | 'red';

function statusColor(s: Status): string {
  switch (s) {
    case 'green':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'yellow':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'red':
      return 'bg-red-100 text-red-800 border-red-200';
  }
}

function ctrStatus(ctr: number, t: RefugioThresholds): Status {
  if (ctr >= t.ctr.green_min) return 'green';
  if (ctr >= t.ctr.yellow_min) return 'yellow';
  return 'red';
}

function cplStatus(cpl: number, t: RefugioThresholds): Status {
  if (cpl === 0) return 'yellow'; // sin leads aún
  if (cpl <= t.cpl_clp.green_max) return 'green';
  if (cpl <= t.cpl_clp.yellow_max) return 'yellow';
  return 'red';
}

function freqStatus(freq: number, t: RefugioThresholds): Status {
  if (freq <= t.frequency.green_max) return 'green';
  if (freq <= t.frequency.yellow_max) return 'yellow';
  return 'red';
}

interface Props {
  data: RefugioCampaign;
}

export default function RefugioCampaignSection({ data }: Props) {
  const { summary, adsets, variants, platforms, positions, thresholds, account_label, campaign_name, period } = data;
  const [platformView, setPlatformView] = useState<'platform' | 'position'>('platform');

  // Filtrar plataformas con tráfico real (>0 impresiones), ordenar por leads desc.
  const platformRows = (platforms || [])
    .filter((p) => p.impressions > 0)
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend);

  const positionRows = (positions || [])
    .filter((p) => p.impressions > 0)
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend);

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-indigo-50/40">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span>🌿 Campaña Refugio</span>
              <Badge variant="secondary" className="text-xs">Soft launch</Badge>
            </CardTitle>
            <CardDescription>
              {campaign_name} · {account_label} · {period.start} → {period.end}
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
        {/* Sección 1 — Resumen ejecutivo (Leads/CPL son las métricas primarias) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Leads"
            value={formatNumber(summary.leads)}
            hint={summary.leads_source === 'bd_formulario' ? 'Formulario real (BD)' : 'Evento Pixel (provisorio)'}
            highlight
          />
          <MetricCard
            label="CPL"
            value={summary.leads === 0 ? '—' : formatCLP(summary.cpl)}
            hint="Costo por Lead"
            status={cplStatus(summary.cpl, thresholds)}
          />
          <MetricCard label="Gasto" value={formatCLP(summary.spend)} hint={`${formatNumber(summary.clicks)} clics`} />
          <MetricCard
            label="CTR"
            value={formatPct(summary.ctr)}
            hint={`Freq. ${summary.frequency.toFixed(2)}`}
            status={ctrStatus(summary.ctr, thresholds)}
          />
        </div>
        {summary.leads_source === 'bd_formulario' && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <strong>Leads</strong> = formulario Refugio real (BD, atribuido a Meta por UTM){typeof summary.leads_pixel === 'number' ? ` — evento Pixel Meta: ${summary.leads_pixel}` : ''}. Los desgloses por adset/variante/plataforma de abajo muestran el <strong>evento Lead del Pixel</strong> (única granularidad disponible por anuncio); sirven para dirección, no suman al total real.
          </p>
        )}

        {/* Embudo de conversión Refugio — Etapa 4a: Inversión → Intención WhatsApp → Leads → Ventas */}
        <div className="rounded-lg border border-purple-200 bg-white/60 p-4">
          <p className="text-sm font-semibold text-purple-800 mb-3">🔻 Embudo de conversión Refugio</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs text-muted-foreground">💰 Inversión</p>
              <p className="text-lg font-bold">{formatCLP(summary.spend)}</p>
              <p className="text-xs text-gray-500">{formatNumber(summary.clicks)} clics en anuncios</p>
            </div>
            <div className="rounded-md border-2 border-green-300 bg-green-50 p-3">
              <p className="text-xs text-muted-foreground">📲 Clics WhatsApp</p>
              <p className="text-lg font-bold text-green-700">
                {summary.whatsapp_clicks != null ? formatNumber(summary.whatsapp_clicks) : '—'}
              </p>
              <p className="text-xs text-gray-500">
                {summary.whatsapp_clicks != null
                  ? `${formatCLP(summary.cost_per_whatsapp_click ?? 0)}/clic · ${formatNumber(summary.whatsapp_clicks_meta ?? 0)} de Meta`
                  : 'evento refugio_whatsapp_click'}
              </p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs text-muted-foreground">📝 Leads (form)</p>
              <p className="text-lg font-bold">{formatNumber(summary.leads_reales_total ?? summary.leads)}</p>
              <p className="text-xs text-gray-500">
                {summary.whatsapp_to_lead_rate != null
                  ? `${formatPct(summary.whatsapp_to_lead_rate, 1)} de los clics WhatsApp`
                  : 'formulario real (BD)'}
              </p>
            </div>
            <div className={`rounded-md border p-3 ${(summary.reservas_revenue ?? 0) > 0 ? 'border-2 border-emerald-300 bg-emerald-50' : 'bg-white'}`}>
              <p className="text-xs text-muted-foreground">🛒 Reservas / Ventas</p>
              <p className={`text-lg font-bold ${(summary.reservas_revenue ?? 0) > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                {summary.reservas_revenue != null && summary.reservas_revenue > 0
                  ? formatCLP(summary.reservas_revenue)
                  : summary.reservas_count != null
                    ? '$0'
                    : '—'}
              </p>
              <p className="text-xs text-gray-500">
                {summary.reservas_count != null
                  ? `${formatNumber(summary.reservas_count)} con reserva · ROAS ${summary.roas != null && summary.roas > 0 ? `${summary.roas.toFixed(2)}×` : '—'}`
                  : 'cruce teléfono → reservas'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            La landing <code>/refugio/</code> convierte por dos vías: <strong>formulario</strong> (→BD) y <strong>WhatsApp</strong> (clic al botón wa.me, evento GA4). El cierre a <strong>ventas reales</strong> cruza el teléfono de cada lead (formulario + WhatsApp) contra las reservas del booking system.
            {summary.cpl_intencion != null && summary.cpl_intencion > 0 && (
              <> CPL formulario <strong>{formatCLP(summary.cpl)}</strong> · CPL intención (form + WhatsApp) <strong>{formatCLP(summary.cpl_intencion)}</strong>.</>
            )}
          </p>
        </div>

        {/* Sección 2 — Comparativo por Adset (Fría vs Retargeting) */}
        {adsets.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700">Por audiencia (Adset)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Adset</th>
                    <th className="text-right py-2 px-2 font-medium">Gasto</th>
                    <th className="text-right py-2 px-2 font-medium">Impresiones</th>
                    <th className="text-right py-2 px-2 font-medium">Clics</th>
                    <th className="text-right py-2 px-2 font-medium">CTR</th>
                    <th className="text-right py-2 px-2 font-medium">Freq</th>
                    <th className="text-right py-2 px-2 font-medium">Lead Pixel</th>
                    <th className="text-right py-2 px-2 font-medium">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {adsets.map((a) => (
                    <tr key={a.adset_id} className="border-b hover:bg-purple-50/40">
                      <td className="py-2 px-2 font-medium">{a.adset_name}</td>
                      <td className="py-2 px-2 text-right">{formatCLP(a.spend)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(a.impressions)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(a.clicks)}</td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="outline" className={`text-xs ${statusColor(ctrStatus(a.ctr, thresholds))}`}>
                          {formatPct(a.ctr)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="outline" className={`text-xs ${statusColor(freqStatus(a.frequency, thresholds))}`}>
                          {a.frequency.toFixed(2)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">{formatNumber(a.leads)}</td>
                      <td className="py-2 px-2 text-right">{a.leads === 0 ? '—' : formatCLP(a.cpl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sección 3 — A/B por Variante de copy */}
        {variants.length > 0 && variants.some(v => v.ad_count > 0) && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700">A/B por variante de copy</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Variante</th>
                    <th className="text-right py-2 px-2 font-medium">Ads</th>
                    <th className="text-right py-2 px-2 font-medium">Gasto</th>
                    <th className="text-right py-2 px-2 font-medium">Impresiones</th>
                    <th className="text-right py-2 px-2 font-medium">Clics</th>
                    <th className="text-right py-2 px-2 font-medium">CTR</th>
                    <th className="text-right py-2 px-2 font-medium">Lead Pixel</th>
                    <th className="text-right py-2 px-2 font-medium">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.key} className="border-b hover:bg-purple-50/40">
                      <td className="py-2 px-2 font-medium">
                        Variante {v.key} <span className="text-muted-foreground font-normal">— {v.label}</span>
                      </td>
                      <td className="py-2 px-2 text-right">{v.ad_count}</td>
                      <td className="py-2 px-2 text-right">{formatCLP(v.spend)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(v.impressions)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(v.clicks)}</td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="outline" className={`text-xs ${statusColor(ctrStatus(v.ctr, thresholds))}`}>
                          {formatPct(v.ctr)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">{formatNumber(v.leads)}</td>
                      <td className="py-2 px-2 text-right">{v.leads === 0 ? '—' : formatCLP(v.cpl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Identificación por nombre del anuncio (Variante A/B/C). La variante ganadora se decide por <strong>leads</strong>, no por CTR.
            </p>
          </div>
        )}

        {/* Sección 4 — Por plataforma / Por posición (FB vs IG, Feed vs Stories vs Reels) */}
        {(platformRows.length > 0 || positionRows.length > 0) && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                {platformView === 'platform' ? 'Por plataforma' : 'Por posición / ubicación'}
              </h3>
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => setPlatformView('platform')}
                  className={`px-3 py-1 ${platformView === 'platform' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Plataforma
                </button>
                <button
                  onClick={() => setPlatformView('position')}
                  className={`px-3 py-1 ${platformView === 'position' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Posición
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">{platformView === 'platform' ? 'Plataforma' : 'Plataforma / Posición'}</th>
                    <th className="text-right py-2 px-2 font-medium">Gasto</th>
                    <th className="text-right py-2 px-2 font-medium">Impresiones</th>
                    <th className="text-right py-2 px-2 font-medium">Clics</th>
                    <th className="text-right py-2 px-2 font-medium">CTR</th>
                    <th className="text-right py-2 px-2 font-medium">Lead Pixel</th>
                    <th className="text-right py-2 px-2 font-medium">CPL</th>
                    <th className="text-right py-2 px-2 font-medium">% gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {platformView === 'platform'
                    ? platformRows.map((p) => {
                        const pctSpend = summary.spend > 0 ? (p.spend / summary.spend) * 100 : 0;
                        return (
                          <tr key={p.platform} className="border-b hover:bg-purple-50/40">
                            <td className="py-2 px-2 font-medium">{platformLabel(p.platform)}</td>
                            <td className="py-2 px-2 text-right">{formatCLP(p.spend)}</td>
                            <td className="py-2 px-2 text-right">{formatNumber(p.impressions)}</td>
                            <td className="py-2 px-2 text-right">{formatNumber(p.clicks)}</td>
                            <td className="py-2 px-2 text-right">
                              <Badge variant="outline" className={`text-xs ${statusColor(ctrStatus(p.ctr, thresholds))}`}>
                                {formatPct(p.ctr)}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right font-semibold">{formatNumber(p.leads)}</td>
                            <td className="py-2 px-2 text-right">{p.leads === 0 ? '—' : formatCLP(p.cpl)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{pctSpend.toFixed(1)}%</td>
                          </tr>
                        );
                      })
                    : positionRows.map((p, idx) => {
                        const pctSpend = summary.spend > 0 ? (p.spend / summary.spend) * 100 : 0;
                        return (
                          <tr key={`${p.platform}_${p.position}_${idx}`} className="border-b hover:bg-purple-50/40">
                            <td className="py-2 px-2 font-medium">
                              <span>{platformLabel(p.platform)}</span>
                              <span className="text-muted-foreground"> · {positionLabel(p.position)}</span>
                            </td>
                            <td className="py-2 px-2 text-right">{formatCLP(p.spend)}</td>
                            <td className="py-2 px-2 text-right">{formatNumber(p.impressions)}</td>
                            <td className="py-2 px-2 text-right">{formatNumber(p.clicks)}</td>
                            <td className="py-2 px-2 text-right">
                              <Badge variant="outline" className={`text-xs ${statusColor(ctrStatus(p.ctr, thresholds))}`}>
                                {formatPct(p.ctr)}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right font-semibold">{formatNumber(p.leads)}</td>
                            <td className="py-2 px-2 text-right">{p.leads === 0 ? '—' : formatCLP(p.cpl)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{pctSpend.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {platformView === 'platform'
                ? 'Origen de impresiones, clics y leads por plataforma. Si una plataforma concentra gasto sin generar leads, considerar excluirla del adset.'
                : 'Detalle por ubicación dentro de cada plataforma (Feed, Stories, Reels, etc.). Útil para optimizar creativos en los placements que sí convierten.'}
            </p>
          </div>
        )}

        {summary.leads === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Aún sin leads. Meta está en fase de aprendizaje — el brief recomienda esperar hasta el día 4 ({period.start === '2026-05-28' ? '1-jun' : '~D+4'}) antes de tomar decisiones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  hint,
  status,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  status?: Status;
  highlight?: boolean;
}) {
  const borderClass = status ? statusColor(status) : 'border-gray-200 bg-white';
  const ringClass = highlight ? 'ring-2 ring-purple-300' : '';
  return (
    <div className={`rounded-lg border p-4 ${borderClass} ${ringClass}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </div>
  );
}
