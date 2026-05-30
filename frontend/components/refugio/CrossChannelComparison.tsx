'use client';

import type { RefugioCampaign, GoogleAdsRefugio } from '@/lib/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const formatCLP = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v ?? 0);
const formatNumber = (v: number) => new Intl.NumberFormat('es-CL').format(v ?? 0);
const formatPct = (v: number, digits = 2) => `${(v ?? 0).toFixed(digits)}%`;

interface Props {
  meta?: RefugioCampaign | null;
  google?: GoogleAdsRefugio | null;
}

type Winner = 'meta' | 'google' | null;

// betterIs determina qué lado gana en una métrica: 'higher' para CTR/leads/etc,
// 'lower' para CPC/CPL. Si uno tiene 0 datos, no hay ganador todavía.
function winnerBy(metaVal: number, googleVal: number, direction: 'higher' | 'lower'): Winner {
  if (metaVal === 0 && googleVal === 0) return null;
  if (metaVal === 0) return 'google';
  if (googleVal === 0) return 'meta';
  if (direction === 'higher') return metaVal > googleVal ? 'meta' : 'google';
  return metaVal < googleVal ? 'meta' : 'google';
}

export default function CrossChannelComparison({ meta, google }: Props) {
  // Si no hay ninguno, no renderizamos. Si hay solo uno, igual mostramos para
  // que se vea cuál falta y poder activarlo.
  if (!meta && !google) return null;

  const m = meta?.summary;
  const g = google?.summary;

  const metaSpend = m?.spend ?? 0;
  const googleSpend = g?.spend ?? 0;
  const totalSpend = metaSpend + googleSpend;

  const metaLeads = m?.leads ?? 0;
  const googleLeads = g?.conversions ?? 0;
  const totalLeads = metaLeads + googleLeads;

  const metaCPL = m?.cpl ?? 0;
  const googleCPL = g?.cpl ?? 0;

  const metaCTR = m?.ctr ?? 0;
  const googleCTR = g?.ctr ?? 0;

  const metaCPC = m?.cpc ?? 0;
  const googleCPC = g?.avg_cpc ?? 0;

  // Presupuestos declarados (cada canal tiene su propio budget; comparamos % ejecutado
  // contra cada budget, no contra el gasto combinado — eso daba lecturas engañosas).
  const metaBudget = m?.budget_total_clp ?? 0;
  const googleBudget = g?.budget_total_clp ?? 0;
  const metaPctExec = metaBudget > 0 ? (metaSpend / metaBudget) * 100 : null;
  const googlePctExec = googleBudget > 0 ? (googleSpend / googleBudget) * 100 : null;

  // Ganadores por métrica
  const wCTR = winnerBy(metaCTR, googleCTR, 'higher');
  const wCPC = winnerBy(metaCPC, googleCPC, 'lower');
  const wLeads = winnerBy(metaLeads, googleLeads, 'higher');
  const wCPL = winnerBy(metaCPL, googleCPL, 'lower');

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-purple-50/40 via-white to-emerald-50/40">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          ⚔️ Comparativa Canales · Meta vs Google
        </CardTitle>
        <CardDescription>
          La pregunta del millón: ¿qué canal convierte mejor a menor CPL para la campaña Refugio?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Métrica</th>
                <th className="text-right py-2 px-2 font-medium">📘 Meta Ads</th>
                <th className="text-right py-2 px-2 font-medium">🟢 Google Ads</th>
                <th className="text-center py-2 px-2 font-medium">Ganador</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Presupuesto declarado"
                meta={metaBudget > 0 ? formatCLP(metaBudget) : '—'}
                google={googleBudget > 0 ? formatCLP(googleBudget) : '—'}
                winner={null}
              />
              <Row label="Inversión ejecutada" meta={formatCLP(metaSpend)} google={formatCLP(googleSpend)} winner={null} />
              <Row
                label="% presupuesto ejecutado"
                meta={metaPctExec !== null ? formatPct(metaPctExec, 1) : '—'}
                google={googlePctExec !== null ? formatPct(googlePctExec, 1) : '—'}
                winner={null}
              />
              <Row label="Impresiones" meta={formatNumber(m?.impressions ?? 0)} google={formatNumber(g?.impressions ?? 0)} winner={null} />
              <Row label="Clics" meta={formatNumber(m?.clicks ?? 0)} google={formatNumber(g?.clicks ?? 0)} winner={null} />
              <Row label="CTR" meta={formatPct(metaCTR)} google={formatPct(googleCTR)} winner={wCTR} />
              <Row label="CPC promedio" meta={formatCLP(metaCPC)} google={formatCLP(googleCPC)} winner={wCPC} />
              <Row label="Leads (conversiones)" meta={formatNumber(metaLeads)} google={formatNumber(googleLeads)} winner={wLeads} highlight />
              <Row
                label="CPL"
                meta={metaLeads === 0 ? '—' : formatCLP(metaCPL)}
                google={googleLeads === 0 ? '—' : formatCLP(googleCPL)}
                winner={wCPL}
                highlight
              />
              <Row
                label="% del total de leads"
                meta={totalLeads > 0 ? formatPct((metaLeads / totalLeads) * 100, 1) : '—'}
                google={totalLeads > 0 ? formatPct((googleLeads / totalLeads) * 100, 1) : '—'}
                winner={null}
              />
            </tbody>
          </table>
        </div>

        {!meta && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">
            No hay datos de Meta Ads Refugio cargados aún.
          </p>
        )}
        {!google && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">
            Google Ads aún no responde. Si configuraste las env vars en Render hace poco, esperar el redeploy. Si todavía no, ver docs/RENDER-GOOGLE-ADS-ENV.md.
          </p>
        )}
        {meta && google && totalLeads === 0 && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-3">
            Sin leads en ningún canal todavía. Ambas campañas en fase de aprendizaje. Esperar al día 4 (1-jun) para primera lectura accionable.
          </p>
        )}
        {meta && google && totalLeads > 0 && (
          <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-3 py-2 mt-3">
            <strong>Insight rápido:</strong> Meta ha ejecutado {metaPctExec !== null ? metaPctExec.toFixed(1) : '—'}% de su presupuesto y aporta {((metaLeads / totalLeads) * 100).toFixed(0)}% de los leads. Google ha ejecutado {googlePctExec !== null ? googlePctExec.toFixed(1) : '—'}% del suyo y aporta {((googleLeads / totalLeads) * 100).toFixed(0)}%. Mismo presupuesto declarado por canal — el que más leads genere por peso ejecutado gana.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  meta,
  google,
  winner,
  highlight,
}: {
  label: string;
  meta: string;
  google: string;
  winner: Winner;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b ${highlight ? 'bg-indigo-50/30 font-medium' : ''}`}>
      <td className="py-2 px-2">{label}</td>
      <td className={`py-2 px-2 text-right ${winner === 'meta' ? 'font-semibold text-purple-700' : ''}`}>{meta}</td>
      <td className={`py-2 px-2 text-right ${winner === 'google' ? 'font-semibold text-emerald-700' : ''}`}>{google}</td>
      <td className="py-2 px-2 text-center">
        {winner === 'meta' && <Badge className="bg-purple-600 text-white text-xs">Meta</Badge>}
        {winner === 'google' && <Badge className="bg-emerald-600 text-white text-xs">Google</Badge>}
        {winner === null && <span className="text-xs text-muted-foreground">—</span>}
      </td>
    </tr>
  );
}
