'use client';

import type { RefugioCampaign, RefugioThresholds } from '@/lib/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const { summary, adsets, variants, thresholds, account_label, campaign_name, period } = data;

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
          <MetricCard label="Leads" value={formatNumber(summary.leads)} hint="Métrica primaria" highlight />
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
                    <th className="text-right py-2 px-2 font-medium">Leads</th>
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
                    <th className="text-right py-2 px-2 font-medium">Leads</th>
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
