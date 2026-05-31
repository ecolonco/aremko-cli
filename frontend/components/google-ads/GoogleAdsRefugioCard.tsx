'use client';

import type { GoogleAdsRefugio, GoogleAdsThresholds } from '@/lib/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const formatCLP = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v ?? 0);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('es-CL').format(v ?? 0);

const formatPct = (v: number, digits = 2) => `${(v ?? 0).toFixed(digits)}%`;

type Status = 'green' | 'yellow' | 'red';
function statusColor(s: Status): string {
  switch (s) {
    case 'green':  return 'bg-green-100 text-green-800 border-green-200';
    case 'yellow': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'red':    return 'bg-red-100 text-red-800 border-red-200';
  }
}
function ctrStatus(ctr: number, t: GoogleAdsThresholds): Status {
  if (ctr >= t.ctr_search.green_min) return 'green';
  if (ctr >= t.ctr_search.yellow_min) return 'yellow';
  return 'red';
}
function cplStatus(cpl: number, conv: number, t: GoogleAdsThresholds): Status {
  if (conv === 0) return 'yellow';
  if (cpl <= t.cpl_clp.green_max) return 'green';
  if (cpl <= t.cpl_clp.yellow_max) return 'yellow';
  return 'red';
}
function sisStatus(sis: number, t: GoogleAdsThresholds): Status {
  if (sis >= t.search_impression_share.green_min) return 'green';
  if (sis >= t.search_impression_share.yellow_min) return 'yellow';
  return 'red';
}
function qsStatus(qs: number, t: GoogleAdsThresholds): Status {
  if (qs >= t.quality_score.green_min) return 'green';
  if (qs >= t.quality_score.yellow_min) return 'yellow';
  return 'red';
}
function budgetStatus(pctUsed: number, t: GoogleAdsThresholds): Status {
  const remaining = 100 - (pctUsed || 0);
  if (remaining >= t.budget_remaining_pct.green_min) return 'green';
  if (remaining >= t.budget_remaining_pct.yellow_min) return 'yellow';
  return 'red';
}

interface Props {
  data: GoogleAdsRefugio;
}

export default function GoogleAdsRefugioCard({ data }: Props) {
  const { summary, search_terms, quality_scores, thresholds, campaign_name, period } = data;
  const lowQS = (quality_scores || []).filter((k) => k.quality_score > 0 && k.quality_score < 5);
  const conversionsZero = (summary?.conversions ?? 0) === 0;

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-blue-50/40">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span>🟢 Google Ads — Refugio</span>
              <Badge variant="secondary" className="text-xs">Search</Badge>
            </CardTitle>
            <CardDescription>
              {campaign_name} · {period.start} → {period.end}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Presupuesto prepagado</p>
            <p className="text-sm font-medium">
              {formatCLP(summary.budget_total_clp)} ({formatPct(summary.budget_pct_used, 1)} usado)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs — leads/CPL es la métrica primaria */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Leads (conversiones)"
            value={formatNumber(summary.conversions)}
            hint="Métrica primaria"
            highlight
          />
          <MetricCard
            label="CPL"
            value={summary.conversions === 0 ? '—' : formatCLP(summary.cpl)}
            hint="Costo por Lead"
            status={cplStatus(summary.cpl, summary.conversions, thresholds)}
          />
          <MetricCard
            label="Gasto"
            value={formatCLP(summary.spend)}
            hint={`${formatNumber(summary.clicks)} clics · CPC ${formatCLP(summary.avg_cpc)}`}
          />
          <MetricCard
            label="CTR Search"
            value={formatPct(summary.ctr)}
            hint={`Conv. rate ${formatPct(summary.conversion_rate)}`}
            status={ctrStatus(summary.ctr, thresholds)}
          />
        </div>

        {/* Search Impression Share + saldo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={`rounded-lg border p-3 ${statusColor(sisStatus(summary.search_impression_share, thresholds))}`}>
            <p className="text-xs opacity-80">Search Impression Share</p>
            <p className="mt-1 text-xl font-bold">{formatPct(summary.search_impression_share, 1)}</p>
            <p className="text-xs opacity-70">
              {summary.search_impression_share < thresholds.search_impression_share.yellow_min
                ? 'Bajo — subir bid o presupuesto'
                : summary.search_impression_share < thresholds.search_impression_share.green_min
                  ? 'Aceptable'
                  : 'Saludable'}
            </p>
          </div>
          <div className={`rounded-lg border p-3 ${statusColor(budgetStatus(summary.budget_pct_used, thresholds))}`}>
            <p className="text-xs opacity-80">Saldo prepagado restante</p>
            <p className="mt-1 text-xl font-bold">
              {formatCLP(summary.budget_total_clp - summary.spend)} ({(100 - summary.budget_pct_used).toFixed(1)}%)
            </p>
            <p className="text-xs opacity-70">
              {100 - summary.budget_pct_used < thresholds.budget_remaining_pct.yellow_min
                ? 'Recargar antes de que se agote'
                : 'OK'}
            </p>
          </div>
        </div>

        {/* Search Terms — info exclusiva de Google que Meta no tiene */}
        {(search_terms?.length || 0) > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700">
              Top búsquedas reales que generaron clics
              <span className="text-xs text-muted-foreground font-normal ml-2">(info exclusiva de Google)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Búsqueda</th>
                    <th className="text-right py-2 px-2 font-medium">Impr.</th>
                    <th className="text-right py-2 px-2 font-medium">Clics</th>
                    <th className="text-right py-2 px-2 font-medium">CTR</th>
                    <th className="text-right py-2 px-2 font-medium">Gasto</th>
                    <th className="text-right py-2 px-2 font-medium">Leads</th>
                    <th className="text-right py-2 px-2 font-medium">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {search_terms.slice(0, 15).map((t, idx) => {
                    const isNegativeCandidate = t.clicks >= 30 && t.conversions === 0 && t.ctr >= 2;
                    return (
                      <tr key={idx} className={`border-b hover:bg-emerald-50/40 ${isNegativeCandidate ? 'bg-amber-50/50' : ''}`}>
                        <td className="py-2 px-2">
                          <div className="font-medium">{t.term}</div>
                          {isNegativeCandidate && (
                            <div className="text-[10px] text-amber-700 mt-0.5">
                              ⚠ Candidata a negative keyword (CTR alto, 0 leads)
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">{formatNumber(t.impressions)}</td>
                        <td className="py-2 px-2 text-right">{formatNumber(t.clicks)}</td>
                        <td className="py-2 px-2 text-right">
                          <Badge variant="outline" className={`text-xs ${statusColor(ctrStatus(t.ctr, thresholds))}`}>
                            {formatPct(t.ctr)}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right">{formatCLP(t.cost_clp)}</td>
                        <td className="py-2 px-2 text-right">{formatNumber(t.conversions)}</td>
                        <td className="py-2 px-2 text-right">{t.conversions === 0 ? '—' : formatCLP(t.cpl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quality Score Health */}
        {(quality_scores?.length || 0) > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700">
              Quality Score por keyword
              <span className="text-xs text-muted-foreground font-normal ml-2">({lowQS.length} keywords con QS &lt; 5)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Keyword</th>
                    <th className="text-right py-2 px-2 font-medium">QS</th>
                    <th className="text-left py-2 px-2 font-medium">Expected CTR</th>
                    <th className="text-left py-2 px-2 font-medium">Ad Relevance</th>
                    <th className="text-left py-2 px-2 font-medium">Landing</th>
                  </tr>
                </thead>
                <tbody>
                  {quality_scores.slice(0, 15).map((k, idx) => (
                    <tr key={idx} className="border-b hover:bg-emerald-50/40">
                      <td className="py-2 px-2 font-medium">{k.keyword_text}</td>
                      <td className="py-2 px-2 text-right">
                        {k.quality_score > 0 ? (
                          <Badge variant="outline" className={`text-xs ${statusColor(qsStatus(k.quality_score, thresholds))}`}>
                            {k.quality_score}/10
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">
                            Sin datos aún
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{k.expected_ctr || '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground">{k.ad_relevance || '—'}</td>
                      <td className="py-2 px-2 text-muted-foreground">{k.landing_page_experience || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lowQS.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2">
                {lowQS.length} keyword(s) con QS &lt; 5 — pagás más caro por aparecer menos. Revisar landing relevance.
              </p>
            )}
          </div>
        )}

        {conversionsZero && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Aún sin conversiones. Campaña en aprendizaje (1-3 días). Esperar al día 4 (1-jun) antes de tomar decisiones de pausa.
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
  const ringClass = highlight ? 'ring-2 ring-emerald-300' : '';
  return (
    <div className={`rounded-lg border p-4 ${borderClass} ${ringClass}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </div>
  );
}
