'use client';

import type { RefugioCampaign } from '@/lib/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const formatCLP = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v ?? 0);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('es-CL').format(v ?? 0);

interface Props {
  data: RefugioCampaign;
  metaAdsTabHref?: string; // ancla a la pestaña Meta Ads del brief
}

export default function RefugioSummaryCard({ data, metaAdsTabHref = '#meta-ads' }: Props) {
  const { summary, campaign_name, period } = data;

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-indigo-50/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          🌿 Campaña Refugio (Meta Ads)
        </CardTitle>
        <CardDescription>
          {campaign_name} · {period.start} → {period.end}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Leads" value={formatNumber(summary.leads)} highlight />
          <Stat label="CPL" value={summary.leads === 0 ? '—' : formatCLP(summary.cpl)} />
          <Stat label="Gasto" value={formatCLP(summary.spend)} />
          <Stat label="Presupuesto usado" value={`${summary.budget_pct_used.toFixed(1)}%`} />
        </div>
        <a
          href={metaAdsTabHref}
          className="mt-3 inline-block text-xs text-purple-700 hover:text-purple-900 font-medium"
        >
          Ver detalle completo en la pestaña Meta Ads →
        </a>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-purple-300 bg-white ring-2 ring-purple-200' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
