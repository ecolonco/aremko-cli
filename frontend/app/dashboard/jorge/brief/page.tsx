'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  MousePointer,
  Eye,
  Star,
  MessageSquare,
  BarChart3,
  Globe,
  Image,
  Share2,
  ShoppingBag,
  Calendar,
  Sparkles,
  RefreshCw,
  Download,
  Mail
} from 'lucide-react';

interface BriefData {
  data: {
    title: string;
    date_start: string;
    date_stop: string;
    generated_at: string;
    web_analytics?: any;
    bookings?: any;
    meta_ads?: any;
    reviews?: any;
    competitors?: any;
  };
  ai_analysis?: {
    content: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
  content_calendar?: {
    content: string;
    model: string;
  };
}

export default function BriefPage() {
  const [briefData, setBriefData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Cargar brief al montar
  useEffect(() => {
    fetchBrief();
  }, []);

  const fetchBrief = async (withAI = false) => {
    setLoading(true);
    try {
      const endpoint = withAI ? '/api/v1/brief/weekly-ai' : '/api/v1/brief/weekly';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}${endpoint}`);
      const data = await response.json();
      setBriefData(data);
    } catch (error) {
      console.error('Error fetching brief:', error);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleGenerateWithAI = async () => {
    setGenerating(true);
    await fetchBrief(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CL').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading && !briefData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando Brief Semanal...</p>
        </div>
      </div>
    );
  }

  if (!briefData) {
    return <div>No hay datos disponibles</div>;
  }

  const { data, ai_analysis, content_calendar } = briefData;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">📊 Brief Semanal</h2>
          <p className="text-muted-foreground">
            Análisis completo del {data.date_start} al {data.date_stop}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => fetchBrief(false)}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            onClick={handleGenerateWithAI}
            disabled={generating}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <Sparkles className={`h-4 w-4 mr-2 ${generating ? 'animate-pulse' : ''}`} />
            {generating ? 'Generando con IA...' : 'Generar con IA'}
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Enviar Email
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="web">
            <Globe className="h-4 w-4 mr-2" />
            Web
          </TabsTrigger>
          <TabsTrigger value="social">
            <Image className="h-4 w-4 mr-2" />
            Social
          </TabsTrigger>
          <TabsTrigger value="sales">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-2" />
            Opiniones
          </TabsTrigger>
          <TabsTrigger value="competition">
            <Users className="h-4 w-4 mr-2" />
            Competencia
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4 mr-2" />
            IA
          </TabsTrigger>
        </TabsList>

        {/* RESUMEN GENERAL */}
        <TabsContent value="overview" className="space-y-4">
          {ai_analysis && (
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                  Análisis IA - Resumen Ejecutivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {ai_analysis.content}
                </div>
                <div className="mt-4 flex items-center text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-2">{ai_analysis.model}</Badge>
                  <span>{ai_analysis.input_tokens} tokens in</span>
                  <span className="mx-2">•</span>
                  <span>{ai_analysis.output_tokens} tokens out</span>
                  <span className="mx-2">•</span>
                  <span>{(ai_analysis.latency_ms / 1000).toFixed(1)}s</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Web Analytics */}
            {data.web_analytics && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(data.web_analytics.active_users)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(data.web_analytics.new_users)} nuevos usuarios
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sesiones</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(data.web_analytics.sessions)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(data.web_analytics.page_views)} páginas vistas
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Bookings */}
            {data.bookings && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Reservas</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data.bookings.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {data.bookings.paid} pagadas, {data.bookings.pending} pendientes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(data.bookings.revenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      Ticket promedio: {formatCurrency(data.bookings.avg_ticket)}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Meta Ads Summary */}
          {data.meta_ads && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Share2 className="h-5 w-5 mr-2 text-blue-600" />
                  Meta Ads - Resumen de Campañas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Inversión</p>
                    <p className="text-2xl font-bold">{formatCurrency(data.meta_ads.summary.spend)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alcance</p>
                    <p className="text-2xl font-bold">{formatNumber(data.meta_ads.summary.reach)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Clics</p>
                    <p className="text-2xl font-bold">{formatNumber(data.meta_ads.summary.clicks)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CTR</p>
                    <p className="text-2xl font-bold">{data.meta_ads.summary.ctr.toFixed(2)}%</p>
                  </div>
                </div>

                {data.meta_ads.recommendations && data.meta_ads.recommendations.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium mb-2">⚠️ Recomendaciones:</p>
                    <ul className="text-sm space-y-1">
                      {data.meta_ads.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* WEB ANALYTICS */}
        <TabsContent value="web" className="space-y-4">
          {data.web_analytics ? (
            <>
              {/* Tendencias Semanales */}
              {data.web_analytics.weekly_trends && data.web_analytics.weekly_trends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tendencias de las Últimas 4 Semanas</CardTitle>
                    <CardDescription>Evolución de métricas clave semana a semana</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Semana</th>
                            <th className="text-right p-2 font-medium">Usuarios</th>
                            <th className="text-right p-2 font-medium">Sesiones</th>
                            <th className="text-right p-2 font-medium">Pageviews</th>
                            <th className="text-right p-2 font-medium">Tasa Rebote</th>
                            <th className="text-right p-2 font-medium">Duración Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.web_analytics.weekly_trends.map((week: any, idx: number) => {
                            const prevWeek = idx > 0 ? data.web_analytics.weekly_trends[idx - 1] : null;
                            const usersTrend = prevWeek ? ((week.active_users - prevWeek.active_users) / prevWeek.active_users) * 100 : 0;
                            const sessionsTrend = prevWeek ? ((week.sessions - prevWeek.sessions) / prevWeek.sessions) * 100 : 0;
                            const pageViewsTrend = prevWeek ? ((week.page_views - prevWeek.page_views) / prevWeek.page_views) * 100 : 0;
                            const bounceRateTrend = prevWeek ? ((week.bounce_rate - prevWeek.bounce_rate) / prevWeek.bounce_rate) * 100 : 0;

                            return (
                              <tr key={idx} className={`border-b ${idx === data.web_analytics.weekly_trends.length - 1 ? 'bg-blue-50 font-medium' : ''}`}>
                                <td className="p-2">
                                  <div>
                                    <p className="font-medium">{week.week_label}</p>
                                    <p className="text-xs text-muted-foreground">{week.start_date} - {week.end_date}</p>
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  <div>
                                    <p>{formatNumber(week.active_users)}</p>
                                    {prevWeek && (
                                      <p className={`text-xs ${usersTrend > 0 ? 'text-green-600' : usersTrend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {usersTrend > 0 ? '▲' : usersTrend < 0 ? '▼' : '='} {Math.abs(usersTrend).toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  <div>
                                    <p>{formatNumber(week.sessions)}</p>
                                    {prevWeek && (
                                      <p className={`text-xs ${sessionsTrend > 0 ? 'text-green-600' : sessionsTrend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {sessionsTrend > 0 ? '▲' : sessionsTrend < 0 ? '▼' : '='} {Math.abs(sessionsTrend).toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  <div>
                                    <p>{formatNumber(week.page_views)}</p>
                                    {prevWeek && (
                                      <p className={`text-xs ${pageViewsTrend > 0 ? 'text-green-600' : pageViewsTrend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {pageViewsTrend > 0 ? '▲' : pageViewsTrend < 0 ? '▼' : '='} {Math.abs(pageViewsTrend).toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  <div>
                                    <p>{formatPercentage(week.bounce_rate)}</p>
                                    {prevWeek && (
                                      <p className={`text-xs ${bounceRateTrend < 0 ? 'text-green-600' : bounceRateTrend > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {bounceRateTrend > 0 ? '▲' : bounceRateTrend < 0 ? '▼' : '='} {Math.abs(bounceRateTrend).toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="text-right p-2">
                                  <p>{Math.round(week.avg_session_duration)}s</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                      <p className="text-muted-foreground">
                        <span className="text-green-600 font-medium">▲ Verde</span> = Mejora ·
                        <span className="text-red-600 font-medium ml-2">▼ Rojo</span> = Empeora ·
                        <span className="text-gray-600 font-medium ml-2">= Gris</span> = Sin cambio ·
                        <span className="font-medium ml-2">Última semana destacada</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Métricas Principales */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(data.web_analytics.active_users)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(data.web_analytics.new_users)} nuevos ({formatPercentage(data.web_analytics.new_users / data.web_analytics.total_users)})
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sesiones</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(data.web_analytics.sessions)}</div>
                    <p className="text-xs text-muted-foreground">
                      {(data.web_analytics.page_views / data.web_analytics.sessions).toFixed(1)} páginas por sesión
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Páginas Vistas</CardTitle>
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(data.web_analytics.page_views)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(data.web_analytics.event_count)} eventos totales
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tasa de Rebote</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPercentage(data.web_analytics.bounce_rate)}</div>
                    <p className="text-xs text-muted-foreground">
                      {data.web_analytics.bounce_rate < 0.5 ? '✅ Buena retención' : '⚠️ Revisar contenido'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Páginas Más Visitadas - Evolución Semanal */}
              {data.web_analytics.top_pages_weekly && (
                <Card>
                  <CardHeader>
                    <CardTitle>Páginas Más Visitadas - Últimas 4 Semanas</CardTitle>
                    <CardDescription>Evolución de las top 5 páginas semana a semana</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Página</th>
                            <th className="text-right p-2 font-medium">Semana 1</th>
                            <th className="text-right p-2 font-medium">Semana 2</th>
                            <th className="text-right p-2 font-medium">Sem. Pasada</th>
                            <th className="text-right p-2 font-medium">Esta Semana</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Obtener lista única de todas las páginas */}
                          {(() => {
                            const allPages = new Map();
                            ['week_1', 'week_2', 'week_3', 'week_4'].forEach(week => {
                              (data.web_analytics.top_pages_weekly[week] || []).forEach((page: any) => {
                                if (!allPages.has(page.path)) {
                                  allPages.set(page.path, { title: page.title, path: page.path });
                                }
                              });
                            });

                            return Array.from(allPages.values()).slice(0, 5).map((pageInfo: any, idx: number) => {
                              const week1 = (data.web_analytics.top_pages_weekly.week_1 || []).find((p: any) => p.path === pageInfo.path);
                              const week2 = (data.web_analytics.top_pages_weekly.week_2 || []).find((p: any) => p.path === pageInfo.path);
                              const week3 = (data.web_analytics.top_pages_weekly.week_3 || []).find((p: any) => p.path === pageInfo.path);
                              const week4 = (data.web_analytics.top_pages_weekly.week_4 || []).find((p: any) => p.path === pageInfo.path);

                              return (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                  <td className="p-2">
                                    <div className="max-w-xs">
                                      <p className="font-medium truncate text-sm">{pageInfo.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{pageInfo.path}</p>
                                    </div>
                                  </td>
                                  <td className="text-right p-2">
                                    {week1 ? (
                                      <div>
                                        <p className="font-medium">{formatNumber(week1.page_views)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week1.users)} users</p>
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="text-right p-2">
                                    {week2 ? (
                                      <div>
                                        <p className="font-medium">{formatNumber(week2.page_views)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week2.users)} users</p>
                                        {week1 && (
                                          <p className={`text-xs ${week2.page_views > week1.page_views ? 'text-green-600' : week2.page_views < week1.page_views ? 'text-red-600' : 'text-gray-600'}`}>
                                            {week2.page_views > week1.page_views ? '▲' : week2.page_views < week1.page_views ? '▼' : '='} {Math.abs(((week2.page_views - week1.page_views) / week1.page_views) * 100).toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="text-right p-2">
                                    {week3 ? (
                                      <div>
                                        <p className="font-medium">{formatNumber(week3.page_views)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week3.users)} users</p>
                                        {week2 && (
                                          <p className={`text-xs ${week3.page_views > week2.page_views ? 'text-green-600' : week3.page_views < week2.page_views ? 'text-red-600' : 'text-gray-600'}`}>
                                            {week3.page_views > week2.page_views ? '▲' : week3.page_views < week2.page_views ? '▼' : '='} {Math.abs(((week3.page_views - week2.page_views) / week2.page_views) * 100).toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="text-right p-2 bg-blue-50">
                                    {week4 ? (
                                      <div>
                                        <p className="font-bold">{formatNumber(week4.page_views)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week4.users)} users</p>
                                        {week3 && (
                                          <p className={`text-xs font-medium ${week4.page_views > week3.page_views ? 'text-green-600' : week4.page_views < week3.page_views ? 'text-red-600' : 'text-gray-600'}`}>
                                            {week4.page_views > week3.page_views ? '▲' : week4.page_views < week3.page_views ? '▼' : '='} {Math.abs(((week4.page_views - week3.page_views) / week3.page_views) * 100).toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fuentes de Tráfico - Evolución Semanal */}
              {data.web_analytics.traffic_sources_weekly && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fuentes de Tráfico - Últimas 4 Semanas</CardTitle>
                    <CardDescription>Evolución de las principales fuentes de tráfico</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Fuente / Medio</th>
                            <th className="text-right p-2 font-medium">Semana 1</th>
                            <th className="text-right p-2 font-medium">Semana 2</th>
                            <th className="text-right p-2 font-medium">Sem. Pasada</th>
                            <th className="text-right p-2 font-medium">Esta Semana</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const allSources = new Map();
                            ['week_1', 'week_2', 'week_3', 'week_4'].forEach(week => {
                              (data.web_analytics.traffic_sources_weekly[week] || []).forEach((source: any) => {
                                const key = `${source.source}/${source.medium}`;
                                if (!allSources.has(key)) {
                                  allSources.set(key, { source: source.source, medium: source.medium });
                                }
                              });
                            });

                            return Array.from(allSources.values()).slice(0, 6).map((sourceInfo: any, idx: number) => {
                              const key = `${sourceInfo.source}/${sourceInfo.medium}`;
                              const week1 = (data.web_analytics.traffic_sources_weekly.week_1 || []).find((s: any) => `${s.source}/${s.medium}` === key);
                              const week2 = (data.web_analytics.traffic_sources_weekly.week_2 || []).find((s: any) => `${s.source}/${s.medium}` === key);
                              const week3 = (data.web_analytics.traffic_sources_weekly.week_3 || []).find((s: any) => `${s.source}/${s.medium}` === key);
                              const week4 = (data.web_analytics.traffic_sources_weekly.week_4 || []).find((s: any) => `${s.source}/${s.medium}` === key);

                              return (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                  <td className="p-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                                      <div>
                                        <p className="font-medium text-sm">{sourceInfo.source}</p>
                                        <p className="text-xs text-muted-foreground">{sourceInfo.medium}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-right p-2">
                                    {week1 ? (
                                      <div>
                                        <p className="font-medium">{formatNumber(week1.sessions)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week1.new_users)} nuevos</p>
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="text-right p-2">
                                    {week2 ? (
                                      <div>
                                        <p className="font-medium">{formatNumber(week2.sessions)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week2.new_users)} nuevos</p>
                                        {week1 && (
                                          <p className={`text-xs ${week2.sessions > week1.sessions ? 'text-green-600' : week2.sessions < week1.sessions ? 'text-red-600' : 'text-gray-600'}`}>
                                            {week2.sessions > week1.sessions ? '▲' : week2.sessions < week1.sessions ? '▼' : '='} {Math.abs(((week2.sessions - week1.sessions) / week1.sessions) * 100).toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="text-right p-2">
                                    {week3 ? (
                                      <div>
                                        <p className="font-medium">{formatNumber(week3.sessions)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week3.new_users)} nuevos</p>
                                        {week2 && (
                                          <p className={`text-xs ${week3.sessions > week2.sessions ? 'text-green-600' : week3.sessions < week2.sessions ? 'text-red-600' : 'text-gray-600'}`}>
                                            {week3.sessions > week2.sessions ? '▲' : week3.sessions < week2.sessions ? '▼' : '='} {Math.abs(((week3.sessions - week2.sessions) / week2.sessions) * 100).toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="text-right p-2 bg-blue-50">
                                    {week4 ? (
                                      <div>
                                        <p className="font-bold">{formatNumber(week4.sessions)}</p>
                                        <p className="text-xs text-muted-foreground">{formatNumber(week4.new_users)} nuevos</p>
                                        {week3 && (
                                          <p className={`text-xs font-medium ${week4.sessions > week3.sessions ? 'text-green-600' : week4.sessions < week3.sessions ? 'text-red-600' : 'text-gray-600'}`}>
                                            {week4.sessions > week3.sessions ? '▲' : week4.sessions < week3.sessions ? '▼' : '='} {Math.abs(((week4.sessions - week3.sessions) / week3.sessions) * 100).toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Métricas de Comportamiento */}
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Comportamiento</CardTitle>
                  <CardDescription>Cómo interactúan los usuarios con tu sitio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Duración Promedio</p>
                      <p className="text-2xl font-bold">{Math.round(data.web_analytics.avg_session_duration / 60)} min</p>
                      <p className="text-xs text-muted-foreground">{Math.round(data.web_analytics.avg_session_duration)}s por sesión</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total Usuarios</p>
                      <p className="text-2xl font-bold">{formatNumber(data.web_analytics.total_users)}</p>
                      <p className="text-xs text-muted-foreground">{formatPercentage(data.web_analytics.new_users / data.web_analytics.total_users)} son nuevos</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Eventos Totales</p>
                      <p className="text-2xl font-bold">{formatNumber(data.web_analytics.event_count)}</p>
                      <p className="text-xs text-muted-foreground">{(data.web_analytics.event_count / data.web_analytics.sessions).toFixed(1)} por sesión</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Datos de web analytics no disponibles</p>
                  <p className="text-sm text-muted-foreground">
                    Verifica la configuración de Google Analytics 4
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* REDES SOCIALES */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Image className="h-5 w-5 mr-2 text-pink-600" />
                Instagram Orgánico
              </CardTitle>
              <CardDescription>Alcance y engagement orgánico</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">Próximamente</p>
                <p className="text-xs text-muted-foreground">
                  Integración con Instagram Graph API para métricas orgánicas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Share2 className="h-5 w-5 mr-2 text-blue-600" />
                Meta Ads (Facebook/Instagram)
              </CardTitle>
              <CardDescription>Publicidad pagada en redes sociales</CardDescription>
            </CardHeader>
            <CardContent>
              {data.meta_ads && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm font-medium mb-2">🏆 Mejor Campaña</p>
                      <p className="font-medium">{data.meta_ads.best_campaign?.name}</p>
                      <p className="text-2xl font-bold mt-2">{data.meta_ads.best_campaign?.ctr.toFixed(2)}% CTR</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm font-medium mb-2">⚠️ Peor Campaña</p>
                      <p className="font-medium">{data.meta_ads.worst_campaign?.name}</p>
                      <p className="text-2xl font-bold mt-2">{data.meta_ads.worst_campaign?.ctr.toFixed(2)}% CTR</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENTAS */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Ventas y Reservas</CardTitle>
              <CardDescription>Sistema de reservas Aremko</CardDescription>
            </CardHeader>
            <CardContent>
              {data.bookings && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total Reservas</p>
                      <p className="text-3xl font-bold">{data.bookings.total}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Ingresos</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.bookings.revenue)}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Ticket Promedio</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.bookings.avg_ticket)}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Estado</p>
                      <div className="space-y-1">
                        <p className="text-sm">✅ Pagadas: {data.bookings.paid}</p>
                        <p className="text-sm">⏳ Pendientes: {data.bookings.pending}</p>
                        {data.bookings.partial > 0 && <p className="text-sm">🟡 Parciales: {data.bookings.partial}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPINIONES */}
        <TabsContent value="reviews" className="space-y-4">
          {data.reviews && data.reviews.status === 'real_data' ? (
            <>
              {/* Snapshots de Google y TripAdvisor */}
              {data.reviews.snapshots && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <Star className="h-4 w-4 mr-2 text-yellow-500" />
                        Google Maps
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Rating Actual</span>
                          <span className="text-2xl font-bold">
                            {data.reviews.snapshots.google.rating.toFixed(1)} ⭐
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Reviews</span>
                          <span className="text-xl font-semibold">
                            {data.reviews.snapshots.google.total}
                            {data.reviews.snapshots.google.total_delta > 0 && (
                              <span className="text-sm text-green-600 ml-2">
                                +{data.reviews.snapshots.google.total_delta}
                              </span>
                            )}
                          </span>
                        </div>
                        {data.reviews.snapshots.google.rating_delta !== 0 && (
                          <div className="text-sm">
                            Cambio: {data.reviews.snapshots.google.rating_delta > 0 ? '+' : ''}
                            {data.reviews.snapshots.google.rating_delta.toFixed(2)} vs semana anterior
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-base">
                        <Star className="h-4 w-4 mr-2 text-green-600" />
                        TripAdvisor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Rating Actual</span>
                          <span className="text-2xl font-bold">
                            {data.reviews.snapshots.tripadvisor.rating.toFixed(1)} ⭐
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Reviews</span>
                          <span className="text-xl font-semibold">
                            {data.reviews.snapshots.tripadvisor.total}
                            {data.reviews.snapshots.tripadvisor.total_delta > 0 && (
                              <span className="text-sm text-green-600 ml-2">
                                +{data.reviews.snapshots.tripadvisor.total_delta}
                              </span>
                            )}
                          </span>
                        </div>
                        {data.reviews.snapshots.tripadvisor.rating_delta !== 0 && (
                          <div className="text-sm">
                            Cambio: {data.reviews.snapshots.tripadvisor.rating_delta > 0 ? '+' : ''}
                            {data.reviews.snapshots.tripadvisor.rating_delta.toFixed(2)} vs semana anterior
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Encuestas de Satisfacción */}
              {data.reviews.surveys && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                      Encuestas de Satisfacción (Últimas 4 semanas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Total Respuestas</p>
                          <p className="text-3xl font-bold">{data.reviews.surveys.total}</p>
                        </div>
                        {data.reviews.surveys.nps.score !== null && (
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">NPS Score</p>
                            <p className={`text-3xl font-bold ${data.reviews.surveys.nps.score >= 50 ? 'text-green-600' : data.reviews.surveys.nps.score >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {data.reviews.surveys.nps.score}
                            </p>
                          </div>
                        )}
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Promotores</p>
                          <p className="text-2xl font-bold text-green-600">{data.reviews.surveys.nps.promotores}</p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Detractores</p>
                          <p className="text-2xl font-bold text-red-600">{data.reviews.surveys.nps.detractores}</p>
                        </div>
                      </div>

                      {/* Reviews Destacadas */}
                      {data.reviews.surveys.reviews_destacadas && data.reviews.surveys.reviews_destacadas.length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold mb-3">Reviews Destacadas (NPS 9-10)</h4>
                          <div className="space-y-3">
                            {data.reviews.surveys.reviews_destacadas.map((review: any, idx: number) => (
                              <div key={idx} className="p-4 border rounded-lg bg-green-50">
                                <div className="flex items-start justify-between mb-2">
                                  <span className="font-medium">{review.autor}</span>
                                  <span className="text-sm text-muted-foreground">{review.fecha}</span>
                                </div>
                                <p className="text-sm text-gray-700 italic">"{review.comentario}"</p>
                                <div className="mt-2 flex gap-2">
                                  <span className="text-xs px-2 py-1 bg-green-100 rounded">NPS: {review.nps_score}</span>
                                  <span className="text-xs px-2 py-1 bg-blue-100 rounded">Exp: {review.experiencia_general}/5</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reviews Recientes */}
              {data.reviews.recent && data.reviews.recent.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reviews Individuales Recientes</CardTitle>
                    <CardDescription>Últimas reviews capturadas de Google y TripAdvisor</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.reviews.recent.slice(0, 5).map((review: any) => (
                        <div key={review.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={review.fuente === 'google' ? 'default' : 'secondary'}>
                                {review.fuente === 'google' ? 'Google' : 'TripAdvisor'}
                              </Badge>
                              <span className="font-medium">{review.autor}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {Array.from({length: review.rating}).map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                          {review.texto && (
                            <p className="text-sm text-gray-700 mb-2">{review.texto}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{review.fecha}</span>
                            {review.respuesta_publicada && (
                              <span className="text-green-600">✓ Respondida</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Datos de opiniones no disponibles</p>
                  <p className="text-sm text-muted-foreground">
                    {data.reviews?.error || 'Error al cargar datos de reviews'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* COMPETENCIA */}
        <TabsContent value="competition" className="space-y-4">
          {data.competitors && data.competitors.status === 'real_data' ? (
            <>
              {/* Comparativa de Precios */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                    Comparativa de Precios - Entrada Adulto
                  </CardTitle>
                  <CardDescription>
                    Última actualización: {data.competitors.generated_at}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Aremko */}
                    {data.competitors.aremko_precio_referencia?.precio_entrada_adulto && (
                      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div>
                          <p className="font-bold text-lg">Aremko (Nosotros)</p>
                          <p className="text-sm text-muted-foreground">Precio de referencia</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(data.competitors.aremko_precio_referencia.precio_entrada_adulto)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Competidores */}
                    {data.competitors.competitors?.map((competitor: any) => (
                      <div key={competitor.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold">{competitor.nombre}</p>
                          <a
                            href={competitor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {competitor.website}
                          </a>
                        </div>
                        <div className="text-right">
                          {competitor.snapshot?.precio_entrada_adulto ? (
                            <>
                              <p className="text-xl font-bold">
                                {formatCurrency(competitor.snapshot.precio_entrada_adulto)}
                              </p>
                              {data.competitors.aremko_precio_referencia?.precio_entrada_adulto && (
                                <p className="text-xs text-muted-foreground">
                                  {competitor.snapshot.precio_entrada_adulto < data.competitors.aremko_precio_referencia.precio_entrada_adulto ? (
                                    <span className="text-red-600">▼ Más barato que nosotros</span>
                                  ) : competitor.snapshot.precio_entrada_adulto > data.competitors.aremko_precio_referencia.precio_entrada_adulto ? (
                                    <span className="text-green-600">▲ Más caro que nosotros</span>
                                  ) : (
                                    <span className="text-gray-600">= Igual que nosotros</span>
                                  )}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Sin datos</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Servicios Ofrecidos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShoppingBag className="h-5 w-5 mr-2 text-purple-600" />
                    Servicios Ofrecidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Competidor</th>
                          <th className="text-center p-2">Piscinas Termales</th>
                          <th className="text-center p-2">Masajes</th>
                          <th className="text-center p-2">Restaurant</th>
                          <th className="text-center p-2">Alojamiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.competitors.competitors?.map((competitor: any) => (
                          <tr key={competitor.id} className="border-b">
                            <td className="p-2 font-medium">{competitor.nombre}</td>
                            <td className="text-center p-2">
                              {competitor.snapshot?.servicios?.piscinas_termales ? '✅' : '❌'}
                            </td>
                            <td className="text-center p-2">
                              {competitor.snapshot?.servicios?.masajes ? '✅' : '❌'}
                            </td>
                            <td className="text-center p-2">
                              {competitor.snapshot?.servicios?.restaurant ? '✅' : '❌'}
                            </td>
                            <td className="text-center p-2">
                              {competitor.snapshot?.servicios?.alojamiento ? '✅' : '❌'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Redes Sociales */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Share2 className="h-5 w-5 mr-2 text-blue-600" />
                    Presencia en Redes Sociales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.competitors.competitors?.map((competitor: any) => (
                      competitor.social_media && (
                        <div key={competitor.id} className="p-4 border rounded-lg">
                          <p className="font-semibold mb-3">{competitor.nombre}</p>
                          <div className="space-y-2 text-sm">
                            {competitor.social_media.facebook_seguidores && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Facebook:</span>
                                <span className="font-medium">{formatNumber(competitor.social_media.facebook_seguidores)} seguidores</span>
                              </div>
                            )}
                            {competitor.social_media.instagram_seguidores && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Instagram:</span>
                                <span className="font-medium">{formatNumber(competitor.social_media.instagram_seguidores)} seguidores</span>
                              </div>
                            )}
                            {competitor.social_media.engagement_rate && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Engagement:</span>
                                <span className="font-medium">{(competitor.social_media.engagement_rate * 100).toFixed(1)}%</span>
                              </div>
                            )}
                            {competitor.social_media.posts_ultima_semana !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Posts (última semana):</span>
                                <span className="font-medium">{competitor.social_media.posts_ultima_semana}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Competencia</CardTitle>
                <CardDescription>Monitoreo de competidores principales en Puerto Varas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-12 text-center border-2 border-dashed rounded-lg">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Datos no disponibles</p>
                  <p className="text-sm text-muted-foreground">
                    {data.competitors?.error || 'Esperando datos de competidores...'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ANÁLISIS IA */}
        <TabsContent value="ai" className="space-y-4">
          {ai_analysis ? (
            <>
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                    Análisis Inteligente
                  </CardTitle>
                  <CardDescription>
                    Generado por {ai_analysis.model} en {(ai_analysis.latency_ms / 1000).toFixed(1)}s
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {ai_analysis.content}
                  </div>
                </CardContent>
              </Card>

              {content_calendar && (
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                      Calendario de Contenido
                    </CardTitle>
                    <CardDescription>
                      Sugerencias de posts para Instagram y blog
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
                      {content_calendar.content}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="p-12 text-center">
                  <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Análisis IA no generado</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Haz clic en "Generar con IA" para crear análisis inteligente y calendario de contenido
                  </p>
                  <Button onClick={handleGenerateWithAI} disabled={generating}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generar Análisis IA
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
