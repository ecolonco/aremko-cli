'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RefugioCampaignSection from '@/components/refugio/RefugioCampaignSection';
import CrossChannelComparison from '@/components/refugio/CrossChannelComparison';
import GoogleAdsRefugioCard from '@/components/google-ads/GoogleAdsRefugioCard';
import type { RefugioCampaign, GoogleAdsRefugio } from '@/lib/types/api';
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
  Mail,
  Loader2,
  AlertCircle,
  Printer
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
    google_ads?: any;
    reviews?: any;
    competitors?: any;
    instagram_organic?: any;
    facebook_organic?: any;
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
  const [webAnalysisAI, setWebAnalysisAI] = useState<any>(null);
  const [generatingWebAnalysis, setGeneratingWebAnalysis] = useState(false);
  const [instagramAnalysisAI, setInstagramAnalysisAI] = useState<any>(null);
  const [generatingInstagramAnalysis, setGeneratingInstagramAnalysis] = useState(false);
  const [metaAdsAnalysisAI, setMetaAdsAnalysisAI] = useState<any>(null);
  const [generatingMetaAdsAnalysis, setGeneratingMetaAdsAnalysis] = useState(false);
  const [metaAdsAnalysisError, setMetaAdsAnalysisError] = useState<string | null>(null);
  const [instagramAnalysisError, setInstagramAnalysisError] = useState<string | null>(null);
  // Social unificado (Orgánico + Pagado, lectura cruzada) — botón "todo el bloque"
  const [socialAnalysisAI, setSocialAnalysisAI] = useState<any>(null);
  const [generatingSocialAnalysis, setGeneratingSocialAnalysis] = useState(false);
  const [socialAnalysisError, setSocialAnalysisError] = useState<string | null>(null);
  const [salesAnalysisAI, setSalesAnalysisAI] = useState<any>(null);
  const [generatingSalesAnalysis, setGeneratingSalesAnalysis] = useState(false);
  const [salesAnalysisError, setSalesAnalysisError] = useState<string | null>(null);
  const [reviewsAnalysisAI, setReviewsAnalysisAI] = useState<any>(null);
  const [generatingReviewsAnalysis, setGeneratingReviewsAnalysis] = useState(false);
  const [reviewsAnalysisError, setReviewsAnalysisError] = useState<string | null>(null);
  const [overviewAnalysisAI, setOverviewAnalysisAI] = useState<any>(null);
  const [generatingOverviewAnalysis, setGeneratingOverviewAnalysis] = useState(false);
  const [overviewAnalysisError, setOverviewAnalysisError] = useState<string | null>(null);

  // Tendencias mensuales por familia (6/12/18/24 meses)
  const [monthlyTrends, setMonthlyTrends] = useState<any>(null);
  const [monthlyRange, setMonthlyRange] = useState<number>(24);
  const [monthlyMetric, setMonthlyMetric] = useState<'revenue' | 'count'>('revenue');
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  // Tendencias mensuales por producto (mismo patrón, espejo a SKU individual)
  const [productTrends, setProductTrends] = useState<any>(null);
  const [productRange, setProductRange] = useState<number>(24);
  const [productMetric, setProductMetric] = useState<'revenue' | 'count'>('revenue');
  const [productGrouping, setProductGrouping] = useState<boolean>(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Conversiones GA4 — eventos key marcados en GA4 Admin
  const [conversionsData, setConversionsData] = useState<any>(null);
  const [loadingConversions, setLoadingConversions] = useState(false);
  const [conversionsError, setConversionsError] = useState<string | null>(null);

  // Landing genérica — selector de URL en pestaña Web
  const [landingPath, setLandingPath] = useState<string>('/refugio/');
  const [landingPathCustom, setLandingPathCustom] = useState<string>('');
  const [refugioLanding, setRefugioLanding] = useState<any>(null);
  const [loadingRefugioLanding, setLoadingRefugioLanding] = useState(false);
  const [refugioLandingError, setRefugioLandingError] = useState<string | null>(null);

  // Lista de URLs predefinidas + opción "custom" para el selector
  const LANDING_PRESETS = [
    { value: '/refugio/', label: '/refugio/ (campaña Meta Ads)' },
    { value: '/', label: '/ (Home)' },
    { value: '/alojamientos/', label: '/alojamientos/' },
    { value: '/tinas/', label: '/tinas/' },
    { value: '/masajes/', label: '/masajes/' },
    { value: '/productos/', label: '/productos/' },
    { value: '/ventas/cart/', label: '/ventas/cart/' },
    { value: '/ventas/giftcards/', label: '/ventas/giftcards/' },
    { value: '__custom__', label: 'Otra URL…' },
  ];

  // Rango de fechas para la card Landing
  const [landingDatePreset, setLandingDatePreset] = useState<string>('30d');
  const [landingDateCustomStart, setLandingDateCustomStart] = useState<string>('');
  const [landingDateCustomEnd, setLandingDateCustomEnd] = useState<string>('');

  const LANDING_DATE_PRESETS = [
    { value: '7d', label: 'Últimos 7 días' },
    { value: '14d', label: 'Últimos 14 días' },
    { value: '30d', label: 'Últimos 30 días' },
    { value: '90d', label: 'Últimos 90 días' },
    { value: 'refugio_launch', label: 'Desde lanzamiento Refugio (28-may)' },
    { value: 'custom', label: 'Rango personalizado…' },
  ];

  // Combinaciones de familias por reserva (bundling effectiveness)
  const [familyCombos, setFamilyCombos] = useState<any>(null);
  const [combosMetric, setCombosMetric] = useState<'count_reservas' | 'revenue'>('count_reservas');
  const [combosFormat, setCombosFormat] = useState<'absolute' | 'percent'>('absolute');
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [combosError, setCombosError] = useState<string | null>(null);

  // Consulta NL de ventas (parser LLM + endpoint Django /bookings/detalle/)
  const [nlQueryInput, setNlQueryInput] = useState('');
  const [nlQueryRunning, setNlQueryRunning] = useState(false);
  const [nlQueryResult, setNlQueryResult] = useState<any>(null);
  const [nlQueryError, setNlQueryError] = useState<string | null>(null);
  // Toggle Auto / Servicios / Productos para forzar el tipo de consulta.
  // "" = auto-detect (LLM decide); "servicios" = forzar servicios; "productos" = forzar productos.
  const [nlQueryForce, setNlQueryForce] = useState<'' | 'servicios' | 'productos'>('');

  // Export PDF / Print (formato carta — letter)
  const [exporting, setExporting] = useState(false);
  const tabLabels: Record<string, string> = {
    overview: 'resumen',
    web: 'web',
    social: 'social',
    sales: 'ventas',
    reviews: 'opiniones',
    competition: 'competencia',
    ai: 'ia',
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const [html2canvasMod, jsPDFMod] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const html2canvas = (html2canvasMod as any).default || (html2canvasMod as any);
      const JsPDFCtor = (jsPDFMod as any).jsPDF || (jsPDFMod as any).default;

      const el = document.querySelector(`[data-tab-export="${activeTab}"]`) as HTMLElement | null;
      if (!el) {
        alert('No se encontró el contenido de la pestaña a exportar');
        return;
      }

      const scale = 2;
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        ignoreElements: (e: Element) => (e as HTMLElement).classList?.contains?.('no-print') ?? false,
      });

      // Dimensiones del PDF (calculadas antes del walker para poder saber si una card
      // entra entera en una página).
      const pdf = new JsPDFCtor({ unit: 'in', format: 'letter', orientation: 'portrait' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 0.4;
      const imgWidthInches = pageWidth - margin * 2;
      const usableHeightInches = pageHeight - margin * 2;
      const pxPerInch = canvas.width / imgWidthInches;
      const usableHeightPx = usableHeightInches * pxPerInch;

      // Detectar puntos seguros de corte. Reglas:
      // 1. Cada CARD entera (shadcn Card root) es un bloque atómico: solo agregamos
      //    el borde INFERIOR de la card como break point y NO descendemos adentro.
      //    Esto evita romper entre header y body, o entre header y tabla.
      // 2. EXCEPCIÓN: si la card es MÁS alta que una página completa (típico de
      //    la card del análisis IA con texto markdown largo), descendemos para
      //    encontrar break points internos en párrafos, items de lista, etc.
      // 3. Tablas y SVG/recharts: igual atómicos, no descender.
      const containerRect = el.getBoundingClientRect();
      const seen = new Set<number>();
      const safeBreaks: number[] = [];
      const addBreak = (yCanvas: number) => {
        const rounded = Math.round(yCanvas);
        if (rounded <= 0 || rounded > canvas.height) return;
        for (const s of seen) {
          if (Math.abs(s - rounded) < 6) return;
        }
        seen.add(rounded);
        safeBreaks.push(rounded);
      };
      const isShadcnCard = (node: HTMLElement): boolean => {
        // Detección por la clase específica del componente Card de shadcn:
        // "rounded-lg border bg-white text-gray-900 shadow-sm".
        return node.classList.contains('rounded-lg') &&
               node.classList.contains('border') &&
               node.classList.contains('shadow-sm');
      };
      const isAtomicBlock = (node: HTMLElement): boolean => {
        if (isShadcnCard(node)) return true;
        const tag = node.tagName;
        if (tag === 'TABLE' || tag === 'THEAD' || tag === 'TBODY' || tag === 'TR' || tag === 'SVG') return true;
        if (node.classList.contains('recharts-wrapper') || node.classList.contains('recharts-surface')) return true;
        return false;
      };
      const walk = (node: HTMLElement) => {
        if (node.classList?.contains?.('no-print')) return;
        if (node.offsetParent === null && getComputedStyle(node).position !== 'fixed') return;
        const rect = node.getBoundingClientRect();
        if (rect.height < 10) return;
        const bottomYCanvas = (rect.bottom - containerRect.top) * scale;
        const heightCanvasPx = rect.height * scale;

        if (isAtomicBlock(node)) {
          // Bloque atómico: agregar solo el borde inferior.
          addBreak(bottomYCanvas);
          // Solo descender si el bloque es más alto que una página (no entra entero).
          if (heightCanvasPx > usableHeightPx * 0.95) {
            Array.from(node.children).forEach((child) => {
              if (child instanceof HTMLElement) walk(child);
            });
          }
          return;
        }

        addBreak(bottomYCanvas);
        Array.from(node.children).forEach((child) => {
          if (child instanceof HTMLElement) walk(child);
        });
      };
      walk(el);
      addBreak(canvas.height);
      safeBreaks.sort((a, b) => a - b);

      // Pagina cortando en el corte seguro más cercano antes del límite ideal de la página.
      // Si una sola card supera la altura de página, hace un corte forzado.
      let pageStart = 0;
      let firstPage = true;
      let safetyCounter = 0; // límite contra loops infinitos
      while (pageStart < canvas.height - 1 && safetyCounter < 50) {
        safetyCounter++;
        const idealEnd = pageStart + usableHeightPx;
        let pageEnd: number;
        const candidates = safeBreaks.filter((bp) => bp > pageStart + 50 && bp <= idealEnd);
        if (candidates.length > 0) {
          pageEnd = candidates[candidates.length - 1];
        } else if (idealEnd >= canvas.height) {
          pageEnd = canvas.height;
        } else {
          // Card más alta que una página — corte forzado al ideal.
          pageEnd = idealEnd;
        }

        const sliceHeight = pageEnd - pageStart;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo obtener contexto 2d para el slice');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, sliceHeight);
        ctx.drawImage(canvas, 0, -pageStart);

        const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightInches = sliceHeight / pxPerInch;

        if (!firstPage) pdf.addPage();
        pdf.addImage(sliceImg, 'JPEG', margin, margin, imgWidthInches, sliceHeightInches);
        firstPage = false;
        pageStart = pageEnd;
      }

      const today = new Date().toISOString().slice(0, 10);
      pdf.save(`aremko-brief-${tabLabels[activeTab] || activeTab}-${today}.pdf`);
    } catch (err: any) {
      console.error('Error exportando PDF:', err);
      alert('Error generando PDF: ' + (err?.message || 'desconocido'));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
    // Genera el análisis IA de la pestaña ACTIVA (sus secciones, que son
    // llamadas individuales y rápidas). Reemplaza al viejo brief global
    // /brief/weekly-ai, que se colgaba (timeout >120s) y no mostraba nada.
    setGenerating(true);
    try {
      switch (activeTab) {
        case 'overview':
          await handleGenerateOverviewAnalysis();
          break;
        case 'web':
          await handleGenerateWebAnalysis();
          break;
        case 'social':
          // Bloque completo de Social en UN informe unificado: orgánico (IG+FB) +
          // pagado (Meta Ads) + lectura cruzada orgánico-vs-pagado.
          await handleGenerateSocialAnalysis();
          break;
        case 'sales':
          await handleGenerateSalesAnalysis();
          break;
        case 'reviews':
          await handleGenerateReviewsAnalysis();
          break;
        case 'ai':
          await handleGenerateOverviewAnalysis();
          break;
        default:
          // 'competition' u otras pestañas sin análisis por IA: no-op.
          break;
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWebAnalysis = async () => {
    setGeneratingWebAnalysis(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/web/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        setWebAnalysisAI(data.analysis);
      } else {
        console.error('Error generating web analysis:', data.error);
      }
    } catch (error) {
      console.error('Error generating web analysis:', error);
    } finally {
      setGeneratingWebAnalysis(false);
    }
  };

  const handleGenerateOverviewAnalysis = async () => {
    setGeneratingOverviewAnalysis(true);
    setOverviewAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/overview/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setOverviewAnalysisAI(data.analysis);
      } else {
        const msg = data.error || `HTTP ${response.status}`;
        console.error('Error generating Overview analysis:', msg);
        setOverviewAnalysisError(msg);
      }
    } catch (error: any) {
      const msg = error?.message || 'Error de red al generar el análisis';
      console.error('Error generating Overview analysis:', error);
      setOverviewAnalysisError(msg);
    } finally {
      setGeneratingOverviewAnalysis(false);
    }
  };

  const handleGenerateReviewsAnalysis = async () => {
    setGeneratingReviewsAnalysis(true);
    setReviewsAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/reviews/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setReviewsAnalysisAI(data.analysis);
      } else {
        const msg = data.error || `HTTP ${response.status}`;
        console.error('Error generating Reviews analysis:', msg);
        setReviewsAnalysisError(msg);
      }
    } catch (error: any) {
      const msg = error?.message || 'Error de red al generar el análisis';
      console.error('Error generating Reviews analysis:', error);
      setReviewsAnalysisError(msg);
    } finally {
      setGeneratingReviewsAnalysis(false);
    }
  };

  const fetchMonthlyTrends = useCallback(async (months: number) => {
    setLoadingMonthly(true);
    setMonthlyError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/v1/bookings/monthly?months=${months}`);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
        throw new Error(`HTTP ${res.status} — respuesta no es JSON. Inicio: "${preview}". Reintenta en unos segundos.`);
      }
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setMonthlyTrends(json.data);
    } catch (e: any) {
      setMonthlyError(e?.message || 'Error cargando tendencias');
    } finally {
      setLoadingMonthly(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyTrends(monthlyRange);
  }, [monthlyRange, fetchMonthlyTrends]);

  const fetchProductTrends = useCallback(async (months: number) => {
    setLoadingProducts(true);
    setProductsError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/v1/bookings/monthly-by-product?months=${months}`);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
        throw new Error(`HTTP ${res.status} — respuesta no es JSON. Inicio: "${preview}". Reintenta en unos segundos.`);
      }
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setProductTrends(json.data);
    } catch (e: any) {
      // Endpoint Django puede no existir todavía; lo guardamos como error suave
      // para que la sección no rompa la página entera.
      setProductsError(e?.message || 'Error cargando productos');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchProductTrends(productRange);
  }, [productRange, fetchProductTrends]);

  // Path efectivo a consultar: si está en "custom", usa el input; si no, el preset
  const effectiveLandingPath = landingPath === '__custom__'
    ? (landingPathCustom.trim() || '/refugio/')
    : landingPath;

  // Resuelve el rango de fechas según el preset elegido.
  // Devuelve null si el preset es 'custom' pero no hay fechas completas todavía.
  const resolveLandingDateRange = useCallback((): { start: string; end: string } | null => {
    const today = new Date().toISOString().slice(0, 10);
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 24 * 3600 * 1000).toISOString().slice(0, 10);
    switch (landingDatePreset) {
      case '7d':  return { start: daysAgo(7),  end: today };
      case '14d': return { start: daysAgo(14), end: today };
      case '30d': return { start: daysAgo(30), end: today };
      case '90d': return { start: daysAgo(90), end: today };
      case 'refugio_launch': return { start: '2026-05-28', end: today };
      case 'custom':
        if (landingDateCustomStart && landingDateCustomEnd) {
          return { start: landingDateCustomStart, end: landingDateCustomEnd };
        }
        return null;
      default: return { start: daysAgo(30), end: today };
    }
  }, [landingDatePreset, landingDateCustomStart, landingDateCustomEnd]);

  const fetchLandingMetrics = useCallback(async (path: string, range: { start: string; end: string }) => {
    if (!path) return;
    setLoadingRefugioLanding(true);
    setRefugioLandingError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const url = `${apiUrl}/api/v1/ga4/page-metrics?path=${encodeURIComponent(path)}&date_start=${range.start}&date_stop=${range.end}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'error');
      setRefugioLanding(json.data);
    } catch (e: any) {
      setRefugioLandingError(e?.message || `Error cargando landing ${path}`);
    } finally {
      setLoadingRefugioLanding(false);
    }
  }, []);

  useEffect(() => {
    const range = resolveLandingDateRange();
    if (range) fetchLandingMetrics(effectiveLandingPath, range);
  }, [effectiveLandingPath, resolveLandingDateRange, fetchLandingMetrics]);

  const fetchConversions = useCallback(async () => {
    setLoadingConversions(true);
    setConversionsError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const today = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const res = await fetch(`${apiUrl}/api/v1/ga4/conversions?date_start=${start}&date_stop=${today}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'error');
      setConversionsData(json.data);
    } catch (e: any) {
      setConversionsError(e?.message || 'Error cargando conversiones');
    } finally {
      setLoadingConversions(false);
    }
  }, []);

  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  const fetchFamilyCombos = useCallback(async () => {
    setLoadingCombos(true);
    setCombosError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/v1/bookings/family-combinations?months=24`);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        // Respuesta no-JSON (cold start de Render, 502 de Cloudflare, deploy en curso)
        const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
        throw new Error(`HTTP ${res.status} — respuesta no es JSON. Inicio: "${preview}". Reintenta en unos segundos.`);
      }
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setFamilyCombos(json.data);
    } catch (e: any) {
      setCombosError(e?.message || 'Error cargando combinaciones');
    } finally {
      setLoadingCombos(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilyCombos();
  }, [fetchFamilyCombos]);

  const handleNLQuery = async () => {
    const query = nlQueryInput.trim();
    if (!query) return;
    setNlQueryRunning(true);
    setNlQueryError(null);
    setNlQueryResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/nl-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, force: nlQueryForce || undefined }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (data.success) {
        setNlQueryResult(data);
      } else {
        setNlQueryError(data.error || `HTTP ${response.status}`);
        if (data.parsed_args) {
          setNlQueryResult({ ...data, success: false });
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setNlQueryError('La consulta excedió 15 segundos y fue cancelada.');
      } else {
        setNlQueryError(error?.message || 'Error de red al consultar');
      }
    } finally {
      clearTimeout(timeoutId);
      setNlQueryRunning(false);
    }
  };

  const exportNLResultCSV = () => {
    const rows = nlQueryResult?.result?.rows;
    if (!rows?.length) return;
    const header = ['fecha', 'hora', 'cliente', 'rut', 'email', 'servicio', 'familia', 'proveedor', 'personas', 'precio_unit', 'total', 'pago', 'estado'];
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...rows.map((r: any) => [r.fecha, r.hora, r.cliente_nombre, r.cliente_rut, r.cliente_email, r.servicio_nombre, r.familia, r.proveedor_nombre, r.cantidad_personas, r.precio_unitario, r.total, r.metodo_pago, r.estado].map(escape).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas-${nlQueryResult.parsed_args.fecha_desde}_a_${nlQueryResult.parsed_args.fecha_hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateSalesAnalysis = async () => {
    setGeneratingSalesAnalysis(true);
    setSalesAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/sales/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setSalesAnalysisAI(data.analysis);
      } else {
        const msg = data.error || `HTTP ${response.status}`;
        console.error('Error generating Sales analysis:', msg);
        setSalesAnalysisError(msg);
      }
    } catch (error: any) {
      const msg = error?.message || 'Error de red al generar el análisis';
      console.error('Error generating Sales analysis:', error);
      setSalesAnalysisError(msg);
    } finally {
      setGeneratingSalesAnalysis(false);
    }
  };

  const handleGenerateMetaAdsAnalysis = async () => {
    setGeneratingMetaAdsAnalysis(true);
    setMetaAdsAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/meta-ads/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setMetaAdsAnalysisAI(data.analysis);
      } else {
        const msg = data.error || `HTTP ${response.status}`;
        console.error('Error generating Meta Ads analysis:', msg);
        setMetaAdsAnalysisError(msg);
      }
    } catch (error: any) {
      const msg = error?.message || 'Error de red al generar el análisis';
      console.error('Error generating Meta Ads analysis:', error);
      setMetaAdsAnalysisError(msg);
    } finally {
      setGeneratingMetaAdsAnalysis(false);
    }
  };

  const handleGenerateInstagramAnalysis = async () => {
    setGeneratingInstagramAnalysis(true);
    setInstagramAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/instagram/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setInstagramAnalysisAI(data.analysis);
      } else {
        const msg = data.error || `HTTP ${response.status}`;
        console.error('Error generating Instagram analysis:', msg);
        setInstagramAnalysisError(msg);
      }
    } catch (error: any) {
      const msg = error?.message || 'Error de red al generar el análisis';
      console.error('Error generating Instagram analysis:', error);
      setInstagramAnalysisError(msg);
    } finally {
      setGeneratingInstagramAnalysis(false);
    }
  };

  // Análisis unificado de TODO el bloque Social: orgánico (IG+FB) + pagado (Meta Ads),
  // con lectura cruzada orgánico-vs-pagado. Es lo que dispara el botón "Generar con IA"
  // de arriba cuando la pestaña activa es Social.
  const handleGenerateSocialAnalysis = async () => {
    setGeneratingSocialAnalysis(true);
    setSocialAnalysisError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/analytics/social/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setSocialAnalysisAI(data.analysis);
      } else {
        const msg = data.error || `HTTP ${response.status}`;
        console.error('Error generating Social analysis:', msg);
        setSocialAnalysisError(msg);
      }
    } catch (error: any) {
      const msg = error?.message || 'Error de red al generar el análisis';
      console.error('Error generating Social analysis:', error);
      setSocialAnalysisError(msg);
    } finally {
      setGeneratingSocialAnalysis(false);
    }
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

  // Reglas de agrupación de SKUs en "productos canónicos" para la tabla
  // Evolución por Producto. Captura los grupos detectados en el catálogo real:
  // múltiples variantes de café marley, aguas, jugos, etc. SKUs que no matchean
  // quedan tal cual con su propio renglón.
  const PRODUCT_GROUP_RULES: { match: RegExp; group: string }[] = [
    // Bebidas calientes
    { match: /^caf[eé]\s+marley/i, group: 'Café Marley' },
    { match: /^marley\s+chocolate/i, group: 'Chocolate Marley' },
    { match: /^infusi[oó]n/i, group: 'Infusiones' },
    // Bebidas frías
    { match: /^agua\b/i, group: 'Aguas' },
    { match: /^jugo\s+natural/i, group: 'Jugos Naturales' },
    { match: /^limonada\b(?!\s+natural$)/i, group: 'Limonadas' },
    // Comida
    { match: /^pizza/i, group: 'Pizzas' },
    { match: /^(tabla|productos\s+tablas)/i, group: 'Tablas' },
    { match: /^cacao/i, group: 'CACAO' },
    // Bebidas alcohólicas
    { match: /^\d+\s+botella/i, group: 'Vinos' },
    { match: /^\d+\s+espumante/i, group: 'Espumantes' },
    // Merchandising
    { match: /(travel\s+mug|taz[oó]n|term[oa]\s+marley)/i, group: 'Marley merch' },
    // Operacionales (no facturan pero distorsionan listas)
    { match: /^(facilitar|sabanillas|crisines|frutos\s+seco|galletas\s+tabla|artesanias\s+inventario|uma\s+inventario|otros\b|limonada\s+natural$|producto\s+temporal)/i,
      group: 'Cortesía / Inventario' },
    // Ajustes contables
    { match: /^descuento/i, group: 'Descuentos' },
    { match: /^(aumento\s+de\s+valor|diferencia\s+a\s+favor)/i, group: 'Ajustes' },
  ];

  const productGroupOf = useCallback((name: string): string => {
    for (const r of PRODUCT_GROUP_RULES) {
      if (r.match.test(name)) return r.group;
    }
    return name;
  }, []);

  if (loading && !briefData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando Informe Semanal...</p>
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
          <h2 className="text-3xl font-bold tracking-tight">📊 Informe Semanal</h2>
          <p className="text-muted-foreground">
            Análisis completo del {data.date_start} al {data.date_stop}
          </p>
        </div>
        <div className="flex items-center space-x-2 no-print">
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
          <Button variant="outline" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {exporting ? 'Generando…' : 'Descargar PDF'}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7 no-print">
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
        <TabsContent value="overview" className="space-y-4" data-tab-export="overview">
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
                  <div title="CTR — tasa de clics: % de personas que hicieron clic sobre las que vieron el aviso">
                    <p className="text-sm font-medium text-muted-foreground cursor-help">CTR <span className="text-xs text-gray-400">(tasa de clics)</span></p>
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
        <TabsContent value="web" className="space-y-4" data-tab-export="web">
          {data.web_analytics ? (
            <>
              {/* Botón de Análisis con IA */}
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Análisis Inteligente con IA
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Obtén un análisis completo de ~2 páginas con insights clave y recomendaciones accionables
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateWebAnalysis}
                      disabled={generatingWebAnalysis}
                      className="bg-gradient-to-r from-purple-600 to-blue-600"
                    >
                      <Sparkles className={`h-4 w-4 mr-2 ${generatingWebAnalysis ? 'animate-pulse' : ''}`} />
                      {generatingWebAnalysis ? 'Generando...' : 'Generar Análisis IA'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Resultado del Análisis IA */}
              {webAnalysisAI && (
                <Card className="border-purple-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Análisis IA - Web Analytics
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWebAnalysisAI(null)}
                      >
                        <span className="text-xs">Cerrar ✕</span>
                      </Button>
                    </div>
                    <CardDescription>
                      Generado por {webAnalysisAI.model} en {(webAnalysisAI.latency_ms / 1000).toFixed(1)}s
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                        __html: webAnalysisAI.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                          .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                          .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                          .replace(/\n\n/g, '</p><p class="mt-2">')
                      }} />
                    </div>
                    <div className="mt-6 pt-4 border-t flex items-center text-xs text-muted-foreground gap-4">
                      <Badge variant="outline">{webAnalysisAI.model}</Badge>
                      <span>{webAnalysisAI.input_tokens} tokens in</span>
                      <span>•</span>
                      <span>{webAnalysisAI.output_tokens} tokens out</span>
                      <span>•</span>
                      <span>{(webAnalysisAI.latency_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </CardContent>
                </Card>
              )}

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

              {/* Landing por URL — selector genérico (default /refugio/, campaña Meta Ads) */}
              <Card className={effectiveLandingPath === '/refugio/' || effectiveLandingPath === '/refugio'
                ? 'border-purple-200 bg-gradient-to-br from-purple-50/40 to-indigo-50/40'
                : 'border-gray-200'}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[280px]">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {(effectiveLandingPath === '/refugio/' || effectiveLandingPath === '/refugio') && '🌿 '}
                        Landing <code className="px-1.5 py-0.5 rounded bg-white/70 text-purple-700 text-sm">{effectiveLandingPath}</code>
                      </CardTitle>
                      <CardDescription>
                        Tráfico de la URL seleccionada. Tabla evolución 4 semanas + fuentes de tráfico.
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 no-print">
                      <select
                        value={landingPath}
                        onChange={(e) => setLandingPath(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white min-w-[240px]"
                      >
                        {LANDING_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      {landingPath === '__custom__' && (
                        <input
                          type="text"
                          value={landingPathCustom}
                          onChange={(e) => setLandingPathCustom(e.target.value)}
                          placeholder="ej: /tinas/precios/"
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white min-w-[240px]"
                        />
                      )}
                      <select
                        value={landingDatePreset}
                        onChange={(e) => setLandingDatePreset(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white min-w-[240px]"
                      >
                        {LANDING_DATE_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      {landingDatePreset === 'custom' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={landingDateCustomStart}
                            onChange={(e) => setLandingDateCustomStart(e.target.value)}
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                          />
                          <span className="text-xs text-muted-foreground">→</span>
                          <input
                            type="date"
                            value={landingDateCustomEnd}
                            onChange={(e) => setLandingDateCustomEnd(e.target.value)}
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                          />
                        </div>
                      )}
                      {refugioLanding?.period && (
                        <p className="text-xs text-muted-foreground text-right">
                          {refugioLanding.period.start} → {refugioLanding.period.end}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRefugioLanding && (
                    <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando métricas de /refugio…
                    </div>
                  )}
                  {refugioLandingError && !loadingRefugioLanding && !refugioLanding && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                      No se pudo cargar la landing. Detalle: {refugioLandingError}
                    </div>
                  )}
                  {refugioLanding && !loadingRefugioLanding && (() => {
                    const s = refugioLanding.summary || {};
                    const weekly: any[] = refugioLanding.weekly || [];
                    const sources: any[] = refugioLanding.traffic_sources || [];
                    const fmtDuration = (s: number) => {
                      if (!s) return '0s';
                      const mins = Math.floor(s / 60);
                      const secs = Math.round(s % 60);
                      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                    };
                    return (
                      <div className="space-y-5">
                        {/* KPIs principales */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg border border-purple-200 bg-white p-3 ring-2 ring-purple-100">
                            <p className="text-xs text-muted-foreground">Sesiones</p>
                            <p className="mt-1 text-2xl font-bold">{formatNumber(s.sessions || 0)}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <p className="text-xs text-muted-foreground">Usuarios únicos</p>
                            <p className="mt-1 text-2xl font-bold">{formatNumber(s.active_users || 0)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(s.new_users || 0)} nuevos</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <p className="text-xs text-muted-foreground">Vistas de página</p>
                            <p className="mt-1 text-2xl font-bold">{formatNumber(s.page_views || 0)}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <p className="text-xs text-muted-foreground">Duración promedio</p>
                            <p className="mt-1 text-2xl font-bold">{fmtDuration(s.avg_session_duration || 0)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {((s.engagement_rate || 0) * 100).toFixed(0)}% engagement
                            </p>
                          </div>
                        </div>

                        {/* Evolución semanal */}
                        {weekly.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-gray-700">Evolución por semana</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-white/50">
                                  <tr className="border-b text-xs text-muted-foreground">
                                    <th className="text-left py-2 px-2 font-medium">Semana</th>
                                    <th className="text-right py-2 px-2 font-medium">Sesiones</th>
                                    <th className="text-right py-2 px-2 font-medium">Usuarios</th>
                                    <th className="text-right py-2 px-2 font-medium">Vistas</th>
                                    <th className="text-right py-2 px-2 font-medium">Duración prom.</th>
                                    <th className="text-right py-2 px-2 font-medium">Bounce</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {weekly.map((w, i) => {
                                    const m = w.metrics || {};
                                    const isCurrent = i === weekly.length - 1;
                                    return (
                                      <tr key={w.week_label} className={`border-b ${isCurrent ? 'bg-purple-100/40 font-semibold' : ''}`}>
                                        <td className="py-2 px-2">
                                          {w.start_date} → {w.end_date}
                                          {isCurrent && <span className="ml-2 text-xs text-purple-700">(actual)</span>}
                                        </td>
                                        <td className="py-2 px-2 text-right">{formatNumber(m.sessions || 0)}</td>
                                        <td className="py-2 px-2 text-right">{formatNumber(m.active_users || 0)}</td>
                                        <td className="py-2 px-2 text-right">{formatNumber(m.page_views || 0)}</td>
                                        <td className="py-2 px-2 text-right">{fmtDuration(m.avg_session_duration || 0)}</td>
                                        <td className="py-2 px-2 text-right">{((m.bounce_rate || 0) * 100).toFixed(0)}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Fuentes de tráfico de la landing */}
                        {sources.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-gray-700">¿De dónde viene el tráfico?</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-white/50">
                                  <tr className="border-b text-xs text-muted-foreground">
                                    <th className="text-left py-2 px-2 font-medium">Source</th>
                                    <th className="text-left py-2 px-2 font-medium">Medium</th>
                                    <th className="text-right py-2 px-2 font-medium">Sesiones</th>
                                    <th className="text-right py-2 px-2 font-medium">Usuarios</th>
                                    <th className="text-right py-2 px-2 font-medium">% del tráfico</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sources.map((src, i) => {
                                    const pct = s.sessions > 0 ? (src.sessions / s.sessions) * 100 : 0;
                                    const isMeta = /facebook|instagram|fb|ig|meta/i.test(`${src.source} ${src.medium}`);
                                    return (
                                      <tr key={i} className="border-b">
                                        <td className="py-2 px-2 font-medium">
                                          {src.source}
                                          {isMeta && <span className="ml-1 inline-flex px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-800">Meta</span>}
                                        </td>
                                        <td className="py-2 px-2 text-muted-foreground">{src.medium}</td>
                                        <td className="py-2 px-2 text-right">{formatNumber(src.sessions)}</td>
                                        <td className="py-2 px-2 text-right">{formatNumber(src.users)}</td>
                                        <td className="py-2 px-2 text-right">{pct.toFixed(1)}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {(s.sessions || 0) === 0 && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            Sin sesiones registradas para <code>{effectiveLandingPath}</code> en el rango seleccionado.
                            Verificar que el path sea correcto (incluyendo trailing slash) y que GA4 esté rastreando esa URL.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Páginas Más Visitadas - Evolución Semanal */}
              {data.web_analytics.top_pages_weekly && (
                <Card>
                  <CardHeader>
                    <CardTitle>Páginas Clave del Sitio - Últimas 4 Semanas</CardTitle>
                    <CardDescription>Embudo de reserva (siempre visible) + páginas más relevantes, semana a semana</CardDescription>
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
                          {/* Selección por relevancia: páginas clave del embudo
                              (siempre visibles) + resto del sitio por tráfico.
                              Mismo criterio que LANDING_PRESETS. */}
                          {(() => {
                            const KEY_PATHS = ['/', '/refugio/', '/alojamientos/', '/tinas/', '/masajes/', '/productos/', '/ventas/cart/', '/ventas/giftcards/'];
                            const normPath = (p: string) => (p && p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
                            const isKey = (p: string) => KEY_PATHS.some((k) => normPath(k) === normPath(p));

                            // Páginas únicas + total de visitas en las 4 semanas (para ordenar).
                            const allPages = new Map();
                            ['week_1', 'week_2', 'week_3', 'week_4'].forEach(week => {
                              (data.web_analytics.top_pages_weekly[week] || []).forEach((page: any) => {
                                if (!allPages.has(page.path)) {
                                  allPages.set(page.path, { title: page.title, path: page.path, totalViews: 0 });
                                }
                                allPages.get(page.path).totalViews += page.page_views || 0;
                              });
                            });

                            const pages = Array.from(allPages.values());
                            // Embudo primero (siempre), ordenado por tráfico.
                            const keyRows = pages.filter((p: any) => isKey(p.path)).sort((a: any, b: any) => b.totalViews - a.totalViews);
                            // Resto del sitio: top 15 por tráfico, para cortar la cola larga.
                            const otherRows = pages.filter((p: any) => !isKey(p.path)).sort((a: any, b: any) => b.totalViews - a.totalViews).slice(0, 15);

                            return [...keyRows, ...otherRows].map((pageInfo: any, idx: number) => {
                              const week1 = (data.web_analytics.top_pages_weekly.week_1 || []).find((p: any) => p.path === pageInfo.path);
                              const week2 = (data.web_analytics.top_pages_weekly.week_2 || []).find((p: any) => p.path === pageInfo.path);
                              const week3 = (data.web_analytics.top_pages_weekly.week_3 || []).find((p: any) => p.path === pageInfo.path);
                              const week4 = (data.web_analytics.top_pages_weekly.week_4 || []).find((p: any) => p.path === pageInfo.path);

                              const esClave = isKey(pageInfo.path);
                              const esRefugio = normPath(pageInfo.path) === '/refugio';
                              return (
                                <tr key={idx} className={`border-b hover:bg-gray-50 ${esClave ? 'bg-amber-50/40' : ''}`}>
                                  <td className="p-2">
                                    <div className="max-w-xs">
                                      <p className="font-medium truncate text-sm">
                                        {pageInfo.title}
                                        {esRefugio && (
                                          <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 align-middle">campaña</span>
                                        )}
                                        {esClave && !esRefugio && (
                                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 align-middle">embudo</span>
                                        )}
                                      </p>
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

                            return Array.from(allSources.values()).slice(0, 10).map((sourceInfo: any, idx: number) => {
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

              {/* Conversiones GA4 — eventos key + breakdown por source/medium */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🎯 Conversiones — Últimos 30 días
                  </CardTitle>
                  <CardDescription>
                    Eventos marcados como <strong>Key event</strong> en GA4 Admin → Events. Si la lista viene vacía, hay que marcar los eventos relevantes (Lead, refugio_form_submit, etc.) como key events para que GA4 los reporte como conversiones.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingConversions && (
                    <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando conversiones…
                    </div>
                  )}
                  {conversionsError && !loadingConversions && !conversionsData && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                      No se pudo cargar conversiones. Detalle: {conversionsError}
                    </div>
                  )}
                  {conversionsData && !loadingConversions && (() => {
                    const events: any[] = conversionsData.events || [];
                    const bySource: any[] = conversionsData.by_source || [];
                    const totalConv = conversionsData.total_conversions || 0;
                    const totalUsers = conversionsData.total_users || 0;
                    if (events.length === 0) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                          GA4 no devolvió eventos con conversions &gt; 0 en los últimos 30 días.
                          Esto suele significar que <strong>ningún evento está marcado como Key event</strong> en GA4 Admin → Events.
                          Para ver Leads, abre GA4, ve a Admin → Events, encuentra el evento (ej. <code>Lead</code> o <code>refugio_form_submit</code>) y activá el toggle "Mark as key event".
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-5">
                        {/* Totales */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                            <p className="text-xs text-muted-foreground">Conversiones totales</p>
                            <p className="mt-1 text-3xl font-bold">{formatNumber(totalConv)}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-4">
                            <p className="text-xs text-muted-foreground">Usuarios únicos que convirtieron</p>
                            <p className="mt-1 text-3xl font-bold">{formatNumber(totalUsers)}</p>
                          </div>
                        </div>

                        {/* Por evento */}
                        <div>
                          <h3 className="text-sm font-semibold mb-2 text-gray-700">Por evento</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-xs text-muted-foreground">
                                  <th className="text-left py-2 px-2 font-medium">Evento</th>
                                  <th className="text-right py-2 px-2 font-medium">Conversiones</th>
                                  <th className="text-right py-2 px-2 font-medium">Eventos totales</th>
                                  <th className="text-right py-2 px-2 font-medium">Usuarios</th>
                                </tr>
                              </thead>
                              <tbody>
                                {events.map((e, idx) => (
                                  <tr key={idx} className="border-b">
                                    <td className="py-2 px-2 font-medium"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{e.event_name}</code></td>
                                    <td className="py-2 px-2 text-right font-semibold">{formatNumber(e.conversions)}</td>
                                    <td className="py-2 px-2 text-right text-muted-foreground">{formatNumber(e.event_count)}</td>
                                    <td className="py-2 px-2 text-right text-muted-foreground">{formatNumber(e.total_users)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Por fuente */}
                        {bySource.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-2 text-gray-700">Por fuente de tráfico (atribución)</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b text-xs text-muted-foreground">
                                    <th className="text-left py-2 px-2 font-medium">Evento</th>
                                    <th className="text-left py-2 px-2 font-medium">Source</th>
                                    <th className="text-left py-2 px-2 font-medium">Medium</th>
                                    <th className="text-right py-2 px-2 font-medium">Conversiones</th>
                                    <th className="text-right py-2 px-2 font-medium">Usuarios</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bySource.slice(0, 20).map((row, idx) => {
                                    const isMeta = /facebook|instagram|fb|ig|meta/i.test(`${row.source} ${row.medium}`);
                                    const isGoogle = /google/i.test(row.source);
                                    return (
                                      <tr key={idx} className="border-b">
                                        <td className="py-2 px-2"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.event_name}</code></td>
                                        <td className="py-2 px-2 font-medium">
                                          {row.source}
                                          {isMeta && <span className="ml-1 inline-flex px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-800">Meta</span>}
                                          {isGoogle && <span className="ml-1 inline-flex px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800">Google</span>}
                                        </td>
                                        <td className="py-2 px-2 text-muted-foreground">{row.medium}</td>
                                        <td className="py-2 px-2 text-right font-semibold">{formatNumber(row.conversions)}</td>
                                        <td className="py-2 px-2 text-right text-muted-foreground">{formatNumber(row.total_users)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
        <TabsContent value="social" className="space-y-4" data-tab-export="social">
          {/* 🧠 ANÁLISIS UNIFICADO — orgánico + pagado + lectura cruzada (botón de arriba) */}
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-violet-600" />
                Análisis de Social con IA — Orgánico + Pagado
              </CardTitle>
              <CardDescription>
                Un solo informe de todo el bloque: Instagram + Facebook orgánico y Meta Ads pagado, con lectura cruzada (¿rinde más lo orgánico gratis o lo pagado?). Es lo que genera el botón &quot;Generar con IA&quot; de arriba.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateSocialAnalysis}
                disabled={generatingSocialAnalysis}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {generatingSocialAnalysis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando análisis…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Análisis IA
                  </>
                )}
              </Button>
              {socialAnalysisError && (
                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No se pudo generar el análisis</p>
                    <p className="text-xs mt-1">{socialAnalysisError}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado del análisis unificado de Social */}
          {socialAnalysisAI && (
            <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-violet-600" />
                  Resultados del Análisis IA
                </CardTitle>
                <CardDescription>
                  Análisis generado por {socialAnalysisAI.model || 'IA'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: socialAnalysisAI.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                      .replace(/\n\n/g, '</p><p class="mt-2">')
                  }} />
                </div>
                {socialAnalysisAI.input_tokens && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <p>
                      Tokens: {socialAnalysisAI.input_tokens.toLocaleString()} entrada,{' '}
                      {socialAnalysisAI.output_tokens.toLocaleString()} salida
                      {socialAnalysisAI.latency_ms && ` • ${(socialAnalysisAI.latency_ms / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 🟢 ORGÁNICO — sin inversión (Instagram + Facebook) */}
          <div className="flex items-center gap-2 pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <h2 className="text-base font-semibold text-green-700">Orgánico · Instagram + Facebook</h2>
            <span className="text-xs text-muted-foreground">sin inversión publicitaria</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Image className="h-5 w-5 mr-2 text-pink-600" />
                Instagram Orgánico
              </CardTitle>
              <CardDescription>Alcance e interacción orgánica</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.instagram_organic?.status === 'real_data' ? (
                <div className="space-y-6">
                  {/* AI Analysis Card */}
                  <Card className="bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Sparkles className="h-5 w-5 mr-2 text-pink-600" />
                        Análisis Orgánico con IA
                      </CardTitle>
                      <CardDescription>
                        Instagram + Facebook orgánico, analizados juntos y por separado
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={handleGenerateInstagramAnalysis}
                        disabled={generatingInstagramAnalysis}
                        className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                      >
                        {generatingInstagramAnalysis ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generando análisis...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generar Análisis IA
                          </>
                        )}
                      </Button>
                      {instagramAnalysisError && (
                        <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">No se pudo generar el análisis</p>
                            <p className="text-xs mt-1">{instagramAnalysisError}</p>
                            {instagramAnalysisError.toLowerCase().includes('ai analysis is not enabled') && (
                              <p className="text-xs mt-2">
                                Falta configurar <code className="px-1 bg-red-100 rounded">OPENROUTER_API_KEY</code> en <code className="px-1 bg-red-100 rounded">backend/.env</code>.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* AI Analysis Results */}
                  {instagramAnalysisAI && (
                    <Card className="bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Sparkles className="h-5 w-5 mr-2 text-pink-600" />
                          Resultados del Análisis IA
                        </CardTitle>
                        <CardDescription>
                          Análisis generado por {instagramAnalysisAI.model || 'IA'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                            __html: instagramAnalysisAI.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                              .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                              .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                              .replace(/\n\n/g, '</p><p class="mt-2">')
                          }} />
                        </div>
                        {instagramAnalysisAI.input_tokens && (
                          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                            <p>
                              Tokens: {instagramAnalysisAI.input_tokens.toLocaleString()} entrada,{' '}
                              {instagramAnalysisAI.output_tokens.toLocaleString()} salida
                              {instagramAnalysisAI.latency_ms && ` • ${(instagramAnalysisAI.latency_ms / 1000).toFixed(1)}s`}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Main Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {data.instagram_organic.account_info && (
                      <>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Seguidores
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {data.instagram_organic.account_info.followers_count?.toLocaleString() || '0'}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Publicaciones
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {data.instagram_organic.account_info.media_count?.toLocaleString() || '0'}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Siguiendo
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {data.instagram_organic.account_info.follows_count?.toLocaleString() || '0'}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Ratio
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {data.instagram_organic.account_info.follows_count > 0
                                ? (
                                    data.instagram_organic.account_info.followers_count /
                                    data.instagram_organic.account_info.follows_count
                                  ).toFixed(1)
                                : '0'}
                            </div>
                            <p className="text-xs text-muted-foreground">Seguidores/Siguiendo</p>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>

                  {/* Weekly Trends Table */}
                  {data.instagram_organic.weekly_insights &&
                    data.instagram_organic.weekly_insights.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Tendencias Semanales</CardTitle>
                          <CardDescription>Últimas 4 semanas de actividad orgánica</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-3 px-2 font-medium">Semana</th>
                                  <th className="text-right py-3 px-2 font-medium">Alcance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.instagram_organic.weekly_insights.map((week: any, idx: number) => {
                                  const prevWeek =
                                    idx < data.instagram_organic.weekly_insights.length - 1
                                      ? data.instagram_organic.weekly_insights[idx + 1]
                                      : null;

                                  const reachChange = prevWeek
                                    ? ((week.reach - prevWeek.reach) / prevWeek.reach) * 100
                                    : 0;

                                  return (
                                    <tr key={week.week_label} className="border-b hover:bg-muted/50">
                                      <td className="py-3 px-2 font-medium">{week.week_label}</td>
                                      <td className="py-3 px-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <span>{week.reach?.toLocaleString() || '0'}</span>
                                          {prevWeek && (
                                            <span
                                              className={`text-xs ${
                                                reachChange > 0
                                                  ? 'text-green-600'
                                                  : reachChange < 0
                                                  ? 'text-red-600'
                                                  : 'text-gray-500'
                                              }`}
                                            >
                                              {reachChange > 0 ? '▲' : reachChange < 0 ? '▼' : '─'}{' '}
                                              {Math.abs(reachChange).toFixed(0)}%
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  {/* Mejores publicaciones */}
                  {data.instagram_organic.top_posts && data.instagram_organic.top_posts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Mejores Publicaciones</CardTitle>
                        <CardDescription>Publicaciones con mejor interacción</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="py-2 px-2 font-medium">Publicación</th>
                                <th className="py-2 px-2 font-medium text-right">Alcance</th>
                                <th className="py-2 px-2 font-medium text-right">Me gusta</th>
                                <th className="py-2 px-2 font-medium text-right">Coment.</th>
                                <th className="py-2 px-2 font-medium text-right">Guardados</th>
                                <th className="py-2 px-2 font-medium text-right">Interacción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...data.instagram_organic.top_posts]
                                .sort((a: any, b: any) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
                                .slice(0, 10)
                                .map((post: any) => (
                                  <tr key={post.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="py-2 px-2 max-w-[320px]">
                                      <a
                                        href={post.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="line-clamp-1 text-gray-700 hover:text-pink-600 hover:underline"
                                        title={post.caption}
                                      >
                                        {post.caption?.replace(/\s+/g, ' ').trim().substring(0, 80) || 'Publicación'}
                                      </a>
                                    </td>
                                    <td className="py-2 px-2 text-right">{post.reach?.toLocaleString() || '0'}</td>
                                    <td className="py-2 px-2 text-right">{post.like_count?.toLocaleString() || '0'}</td>
                                    <td className="py-2 px-2 text-right">{post.comments_count?.toLocaleString() || '0'}</td>
                                    <td className="py-2 px-2 text-right">{post.saves_count?.toLocaleString() || '0'}</td>
                                    <td className="py-2 px-2 text-right font-semibold text-pink-600">
                                      {post.engagement_rate !== undefined ? `${post.engagement_rate.toFixed(2)}%` : '—'}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : data?.instagram_organic?.status === 'error' ? (
                <div className="p-8 text-center border-2 border-dashed border-red-200 rounded-lg bg-red-50">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                  <p className="text-sm text-red-600 mb-2">Error al cargar datos de Instagram</p>
                  <p className="text-xs text-red-500">{data.instagram_organic.error}</p>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                  <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Cargando datos de Instagram...</p>
                  <p className="text-xs text-muted-foreground">
                    Conectando con Instagram Graph API
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facebook Orgánico */}
          {data?.facebook_organic && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Share2 className="h-5 w-5 mr-2 text-blue-700" />
                  Facebook Orgánico
                </CardTitle>
                <CardDescription>Alcance e interacción orgánica en la Página</CardDescription>
              </CardHeader>
              <CardContent>
                {data.facebook_organic.status === 'real_data' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Página</div>
                        <div className="text-lg font-bold truncate">{data.facebook_organic.page_info?.name || '—'}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Fans</div>
                        <div className="text-2xl font-bold">{(data.facebook_organic.page_info?.fan_count || 0).toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Seguidores</div>
                        <div className="text-2xl font-bold">{(data.facebook_organic.page_info?.followers_count || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    {data.facebook_organic.top_posts && data.facebook_organic.top_posts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-2 px-2 font-medium">Publicación</th>
                              <th className="py-2 px-2 font-medium text-right">Alcance</th>
                              <th className="py-2 px-2 font-medium text-right">Reacciones</th>
                              <th className="py-2 px-2 font-medium text-right">Coment.</th>
                              <th className="py-2 px-2 font-medium text-right">Compartidos</th>
                              <th className="py-2 px-2 font-medium text-right">Interacción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.facebook_organic.top_posts.map((post: any) => (
                              <tr key={post.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2 px-2 max-w-[320px]">
                                  <a
                                    href={post.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="line-clamp-1 text-gray-700 hover:text-blue-700 hover:underline"
                                    title={post.message}
                                  >
                                    {post.message?.replace(/\s+/g, ' ').trim().substring(0, 80) || 'Publicación'}
                                  </a>
                                </td>
                                <td className="py-2 px-2 text-right">{post.reach ? post.reach.toLocaleString() : '—'}</td>
                                <td className="py-2 px-2 text-right">{(post.reactions || 0).toLocaleString()}</td>
                                <td className="py-2 px-2 text-right">{(post.comments_count || 0).toLocaleString()}</td>
                                <td className="py-2 px-2 text-right">{(post.shares || 0).toLocaleString()}</td>
                                <td className="py-2 px-2 text-right font-semibold text-blue-700">
                                  {post.engagement_rate ? `${post.engagement_rate.toFixed(2)}%` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay publicaciones recientes en la Página de Facebook.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center border-2 border-dashed border-red-200 rounded-lg bg-red-50">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
                    <p className="text-sm text-red-600 mb-1">No se pudo cargar Facebook orgánico</p>
                    <p className="text-xs text-red-500">{data.facebook_organic.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 🔵 PAGADO — campañas con inversión (Meta Ads + Refugio cross-canal) */}
          <div className="flex items-center gap-2 pt-4">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <h2 className="text-base font-semibold text-blue-700">Pagado · Meta Ads + Refugio</h2>
            <span className="text-xs text-muted-foreground">campañas con inversión</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Share2 className="h-5 w-5 mr-2 text-blue-600" />
                Meta Ads (Facebook/Instagram)
              </CardTitle>
              <CardDescription>Publicidad pagada en redes sociales</CardDescription>
            </CardHeader>
            <CardContent>
              {data.meta_ads ? (
                <div className="space-y-6">
                  {/* Comparativa cross-channel Meta vs Google (la pregunta del millón) */}
                  {(data.meta_ads.refugio || data.google_ads?.refugio) && (
                    <CrossChannelComparison
                      meta={(data.meta_ads.refugio as RefugioCampaign) || null}
                      google={(data.google_ads?.refugio as GoogleAdsRefugio) || null}
                    />
                  )}

                  {/* Campaña Refugio — vista dedicada (Leads/CPL como métricas primarias). */}
                  {data.meta_ads.refugio && (
                    <RefugioCampaignSection data={data.meta_ads.refugio as RefugioCampaign} />
                  )}

                  {/* Google Ads Refugio — espejo de Meta */}
                  {data.google_ads?.refugio && (
                    <GoogleAdsRefugioCard data={data.google_ads.refugio as GoogleAdsRefugio} />
                  )}

                  {/* AI Analysis Card */}
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
                        Análisis con IA
                      </CardTitle>
                      <CardDescription>
                        Análisis inteligente de tus campañas de Meta Ads
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={handleGenerateMetaAdsAnalysis}
                        disabled={generatingMetaAdsAnalysis}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        {generatingMetaAdsAnalysis ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generando análisis...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generar Análisis IA
                          </>
                        )}
                      </Button>
                      {metaAdsAnalysisError && (
                        <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">No se pudo generar el análisis</p>
                            <p className="text-xs mt-1">{metaAdsAnalysisError}</p>
                            {metaAdsAnalysisError.toLowerCase().includes('ai analysis is not enabled') && (
                              <p className="text-xs mt-2">
                                Falta configurar <code className="px-1 bg-red-100 rounded">OPENROUTER_API_KEY</code> en <code className="px-1 bg-red-100 rounded">backend/.env</code>.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* AI Analysis Results */}
                  {metaAdsAnalysisAI && (
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
                          Resultados del Análisis IA
                        </CardTitle>
                        <CardDescription>
                          Análisis generado por {metaAdsAnalysisAI.model || 'IA'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                            __html: metaAdsAnalysisAI.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                              .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                              .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                              .replace(/\n\n/g, '</p><p class="mt-2">')
                          }} />
                        </div>
                        {metaAdsAnalysisAI.input_tokens && (
                          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                            <p>
                              Tokens: {metaAdsAnalysisAI.input_tokens.toLocaleString()} entrada,{' '}
                              {metaAdsAnalysisAI.output_tokens.toLocaleString()} salida
                              {metaAdsAnalysisAI.latency_ms && ` • ${(metaAdsAnalysisAI.latency_ms / 1000).toFixed(1)}s`}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Métricas principales */}
                  {data.meta_ads.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Inversión
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatCurrency(data.meta_ads.summary.spend)}</div>
                          <p className="text-xs text-muted-foreground">{data.meta_ads.campaigns_count || 0} campañas</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Alcance
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatNumber(data.meta_ads.summary.reach)}</div>
                          <p className="text-xs text-muted-foreground">{formatNumber(data.meta_ads.summary.impressions)} impresiones</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Clics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatNumber(data.meta_ads.summary.clicks)}</div>
                          <p className="text-xs text-muted-foreground" title="CPC — costo por clic">
                            CPC <span className="text-gray-400">(costo/clic)</span> {formatCurrency(data.meta_ads.summary.cpc)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground cursor-help" title="CTR — tasa de clics: % de personas que hicieron clic sobre las que vieron el aviso">
                            CTR <span className="text-xs text-gray-400">(tasa de clics)</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{data.meta_ads.summary.ctr?.toFixed(2)}%</div>
                          <p className="text-xs text-muted-foreground" title="CPM — costo por mil impresiones">
                            CPM <span className="text-gray-400">(costo/1000 vistas)</span> {formatCurrency(data.meta_ads.summary.cpm)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Desglose por cuenta publicitaria */}
                  {data.meta_ads.accounts && data.meta_ads.accounts.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Por cuenta publicitaria</CardTitle>
                        <CardDescription>De dónde proviene la inversión agregada</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left py-2 px-2 font-medium">Cuenta</th>
                                <th className="text-right py-2 px-2 font-medium">Inversión</th>
                                <th className="text-right py-2 px-2 font-medium">Impresiones</th>
                                <th className="text-right py-2 px-2 font-medium">Clics</th>
                                <th className="text-right py-2 px-2 font-medium">CTR</th>
                                <th className="text-right py-2 px-2 font-medium">Campañas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.meta_ads.accounts.map((acc: any) => (
                                <tr key={acc.id} className="border-b">
                                  <td className="py-2 px-2 font-medium">{acc.label}</td>
                                  <td className="py-2 px-2 text-right">{formatCurrency(acc.summary.spend)}</td>
                                  <td className="py-2 px-2 text-right">{formatNumber(acc.summary.impressions)}</td>
                                  <td className="py-2 px-2 text-right">{formatNumber(acc.summary.clicks)}</td>
                                  <td className="py-2 px-2 text-right">{acc.summary.ctr.toFixed(2)}%</td>
                                  <td className="py-2 px-2 text-right">{acc.campaigns_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Mejor y peor campaña */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.meta_ads.best_campaign && (
                      <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                        <p className="text-sm font-medium mb-2">🏆 Mejor Campaña</p>
                        <p className="font-medium line-clamp-2">{data.meta_ads.best_campaign.name}</p>
                        {data.meta_ads.best_campaign.account_label && (
                          <p className="text-xs text-muted-foreground">{data.meta_ads.best_campaign.account_label}</p>
                        )}
                        <p className="text-2xl font-bold mt-2 text-green-700">
                          {data.meta_ads.best_campaign.ctr?.toFixed(2)}% CTR
                        </p>
                      </div>
                    )}
                    {data.meta_ads.worst_campaign && (
                      <div className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                        <p className="text-sm font-medium mb-2">⚠️ Peor Campaña</p>
                        <p className="font-medium line-clamp-2">{data.meta_ads.worst_campaign.name}</p>
                        {data.meta_ads.worst_campaign.account_label && (
                          <p className="text-xs text-muted-foreground">{data.meta_ads.worst_campaign.account_label}</p>
                        )}
                        <p className="text-2xl font-bold mt-2 text-orange-700">
                          {data.meta_ads.worst_campaign.ctr?.toFixed(2)}% CTR
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Recomendaciones */}
                  {data.meta_ads.recommendations && data.meta_ads.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Sparkles className="h-5 w-5 mr-2 text-yellow-600" />
                          Recomendaciones automáticas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {data.meta_ads.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-yellow-600 mt-0.5">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tabla de campañas */}
                  {((data.meta_ads.recent_campaigns && data.meta_ads.recent_campaigns.length > 0) ||
                    (data.meta_ads.campaigns && data.meta_ads.campaigns.length > 0)) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Top Campañas Pagadas</CardTitle>
                        <CardDescription>
                          {data.meta_ads.recent_campaigns?.length > 0
                            ? `Las ${data.meta_ads.recent_campaigns.length} campañas con mayor inversión en los últimos ${data.meta_ads.recent_range_days || 90} días`
                            : 'Campañas activas esta semana'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-3 px-2 font-medium">Campaña</th>
                                <th className="text-right py-3 px-2 font-medium">Inversión</th>
                                <th className="text-right py-3 px-2 font-medium">Alcance</th>
                                <th className="text-right py-3 px-2 font-medium">Clics</th>
                                <th className="text-right py-3 px-2 font-medium cursor-help" title="CTR — tasa de clics: clics sobre impresiones">CTR</th>
                                <th className="text-right py-3 px-2 font-medium cursor-help" title="CPC — costo por clic">CPC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(data.meta_ads.recent_campaigns?.length > 0
                                ? data.meta_ads.recent_campaigns
                                : data.meta_ads.campaigns
                              ).map((c: any) => (
                                <tr key={c.id} className="border-b hover:bg-muted/50">
                                  <td className="py-3 px-2 font-medium max-w-xs truncate" title={c.name}>{c.name}</td>
                                  <td className="py-3 px-2 text-right">{formatCurrency(c.spend)}</td>
                                  <td className="py-3 px-2 text-right">{formatNumber(c.reach)}</td>
                                  <td className="py-3 px-2 text-right">{formatNumber(c.clicks)}</td>
                                  <td className="py-3 px-2 text-right">
                                    <span className={
                                      c.ctr >= 2 ? 'text-green-600 font-semibold' :
                                      c.ctr < 1 ? 'text-orange-600 font-semibold' :
                                      ''
                                    }>
                                      {c.ctr?.toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="py-3 px-2 text-right">{formatCurrency(c.cpc)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                  <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Cargando datos de Meta Ads...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENTAS */}
        <TabsContent value="sales" className="space-y-4" data-tab-export="sales">
          {/* Consulta en lenguaje natural */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-indigo-600" />
                Consulta en lenguaje natural
              </CardTitle>
              <CardDescription>
                Pregunta por ventas detalladas. Ej servicios: <em>"masaje sueco en abril"</em>, <em>"tinas la semana pasada"</em>. Ej productos: <em>"café marley en abril"</em>, <em>"gift cards este mes"</em>, <em>"tabla quesos el 15 de mayo"</em>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Toggle Auto / Servicios / Productos: el modo Auto deja al LLM
                  detectar, los otros dos fuerzan el tipo si el LLM se equivoca */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Buscar en:</span>
                <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setNlQueryForce('')}
                    className={`px-3 py-1 ${nlQueryForce === '' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    title="El parser decide automáticamente si la pregunta es de servicios o productos"
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setNlQueryForce('servicios')}
                    className={`px-3 py-1 ${nlQueryForce === 'servicios' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    title="Forzar consulta sobre servicios (tinas, masajes, cabañas)"
                  >
                    Servicios
                  </button>
                  <button
                    onClick={() => setNlQueryForce('productos')}
                    className={`px-3 py-1 ${nlQueryForce === 'productos' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    title="Forzar consulta sobre productos (café, tablas, gift cards, etc.)"
                  >
                    Productos
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={nlQueryInput}
                  onChange={(e) => setNlQueryInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !nlQueryRunning) handleNLQuery(); }}
                  placeholder="Escribe tu pregunta sobre ventas…"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={nlQueryRunning}
                />
                <Button
                  onClick={handleNLQuery}
                  disabled={nlQueryRunning || !nlQueryInput.trim()}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {nlQueryRunning ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Consultando…</>
                  ) : 'Consultar'}
                </Button>
              </div>

              {nlQueryError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-700">{nlQueryError}</div>
                </div>
              )}

              {nlQueryResult?.parsed_args && (
                <div className="bg-white border border-indigo-200 rounded-md p-3 text-xs text-gray-600">
                  <span className="font-semibold text-indigo-700">La IA entendió:</span>{' '}
                  {nlQueryResult.parsed_args.fecha_desde && nlQueryResult.parsed_args.fecha_hasta ? (
                    <>
                      <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.fecha_desde}</code>
                      {' → '}
                      <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.fecha_hasta}</code>
                    </>
                  ) : (
                    <code className="bg-indigo-50 px-1 rounded">historial completo</code>
                  )}
                  {nlQueryResult.tipo && (
                    <> · <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${nlQueryResult.tipo === 'productos' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {nlQueryResult.tipo === 'productos' ? '🛍️ productos' : '🧖 servicios'}
                    </span></>
                  )}
                  {nlQueryResult.parsed_args.familia && <> · familia <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.familia}</code></>}
                  {nlQueryResult.parsed_args.servicio && <> · servicio <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.servicio}</code></>}
                  {nlQueryResult.parsed_args.proveedor && <> · proveedor <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.proveedor}</code></>}
                  {nlQueryResult.parsed_args.producto && <> · producto <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.producto}</code></>}
                  {nlQueryResult.parsed_args.categoria && <> · categoría <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.categoria}</code></>}
                  {nlQueryResult.parsed_args.cliente && <> · cliente <code className="bg-indigo-50 px-1 rounded">{nlQueryResult.parsed_args.cliente}</code></>}
                  {typeof nlQueryResult.parse_ms === 'number' && <span className="text-gray-400"> · {(nlQueryResult.parse_ms / 1000).toFixed(1)}s</span>}
                </div>
              )}

              {nlQueryResult?.success && nlQueryResult.parsed_args?.cliente && nlQueryResult.result?.rows?.length > 0 && (() => {
                const rows = nlQueryResult.result.rows;
                const fechas = rows.map((r: any) => r.fecha).filter(Boolean).sort();
                const lastVisit = fechas[fechas.length - 1];
                const firstVisit = fechas[0];
                const today = new Date();
                const last = new Date(lastVisit + 'T00:00:00');
                const days = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
                const uniqueDays = new Set(fechas).size;
                const uniqueClients = new Set(rows.map((r: any) => r.cliente_id)).size;
                let alertColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
                let alertLabel = 'Cliente activo';
                if (days > 365) { alertColor = 'bg-red-50 border-red-200 text-red-800'; alertLabel = '⚠ Cliente lapsed (>1 año sin visitar)'; }
                else if (days > 180) { alertColor = 'bg-amber-50 border-amber-200 text-amber-800'; alertLabel = '⚠ Cliente en riesgo (>6 meses)'; }
                else if (days > 90) { alertColor = 'bg-yellow-50 border-yellow-200 text-yellow-800'; alertLabel = 'Hace >3 meses que no visita'; }
                return (
                  <div className={`border rounded-md p-3 text-sm ${alertColor}`}>
                    <div className="font-semibold mb-1">{alertLabel}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="opacity-70">Última visita:</span><br/><span className="font-semibold">{lastVisit}</span> ({days} días)</div>
                      <div><span className="opacity-70">Primera visita:</span><br/><span className="font-semibold">{firstVisit}</span></div>
                      <div><span className="opacity-70">Visitas únicas:</span><br/><span className="font-semibold">{uniqueDays}</span> días distintos</div>
                      <div><span className="opacity-70">Clientes que matchean:</span><br/><span className="font-semibold">{uniqueClients}</span></div>
                    </div>
                  </div>
                );
              })()}

              {nlQueryResult?.success && nlQueryResult.result && nlQueryResult.tipo === 'productos' && (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold">{nlQueryResult.result.total_lineas}</span> {nlQueryResult.result.total_lineas === 1 ? 'línea' : 'líneas'}
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="font-semibold">{(nlQueryResult.result.total_unidades || 0).toLocaleString('es-CL')}</span> unidades
                      <span className="mx-2 text-gray-400">·</span>
                      Total: <span className="font-semibold text-emerald-700">${(nlQueryResult.result.total_revenue || 0).toLocaleString('es-CL')}</span>
                      {nlQueryResult.result.truncated && <span className="ml-2 text-amber-600">(truncado a 500)</span>}
                    </div>
                  </div>
                  {!nlQueryResult.result.rows || nlQueryResult.result.rows.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">No hay ventas de productos en ese rango.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-left">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Fecha</th>
                            <th className="px-2 py-1.5 font-medium">Cliente</th>
                            <th className="px-2 py-1.5 font-medium">Producto</th>
                            <th className="px-2 py-1.5 font-medium">Categoría</th>
                            <th className="px-2 py-1.5 font-medium text-right">Cant.</th>
                            <th className="px-2 py-1.5 font-medium text-right">P. Unit.</th>
                            <th className="px-2 py-1.5 font-medium text-right">Total</th>
                            <th className="px-2 py-1.5 font-medium">Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nlQueryResult.result.rows.map((row: any, i: number) => (
                            <tr key={`${row.venta_reserva_id}-${row.producto_id}-${i}`} className="border-t hover:bg-gray-50">
                              <td className="px-2 py-1.5">{row.fecha}</td>
                              <td className="px-2 py-1.5">{row.cliente_nombre}</td>
                              <td className="px-2 py-1.5">{row.producto_nombre}</td>
                              <td className="px-2 py-1.5 text-gray-600">{row.categoria || <span className="text-gray-400">—</span>}</td>
                              <td className="px-2 py-1.5 text-right">{row.cantidad}</td>
                              <td className="px-2 py-1.5 text-right">${row.precio_unitario.toLocaleString('es-CL')}</td>
                              <td className="px-2 py-1.5 text-right font-medium">${row.revenue.toLocaleString('es-CL')}</td>
                              <td className="px-2 py-1.5 text-gray-600">{row.metodo_pago}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {nlQueryResult?.success && nlQueryResult.result && nlQueryResult.tipo !== 'productos' && (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold">{nlQueryResult.result.total_filas}</span> {nlQueryResult.result.total_filas === 1 ? 'fila' : 'filas'}
                      <span className="mx-2 text-gray-400">·</span>
                      Total: <span className="font-semibold text-emerald-700">${(nlQueryResult.result.total_revenue || 0).toLocaleString('es-CL')}</span>
                      {nlQueryResult.result.truncated && <span className="ml-2 text-amber-600">(truncado a 500)</span>}
                    </div>
                    {nlQueryResult.result.rows?.length > 0 && (
                      <Button size="sm" variant="outline" onClick={exportNLResultCSV}>
                        <Download className="h-3 w-3 mr-1" />CSV
                      </Button>
                    )}
                  </div>
                  {nlQueryResult.result.rows?.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">No hay ventas en ese rango.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-left">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Fecha</th>
                            <th className="px-2 py-1.5 font-medium">Hora</th>
                            <th className="px-2 py-1.5 font-medium">Cliente</th>
                            <th className="px-2 py-1.5 font-medium">Servicio</th>
                            <th className="px-2 py-1.5 font-medium">Proveedor</th>
                            <th className="px-2 py-1.5 font-medium text-right">Pers.</th>
                            <th className="px-2 py-1.5 font-medium text-right">P. Unit.</th>
                            <th className="px-2 py-1.5 font-medium text-right">Total</th>
                            <th className="px-2 py-1.5 font-medium">Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nlQueryResult.result.rows.map((row: any, i: number) => (
                            <tr key={`${row.reserva_id}-${row.servicio_id}-${i}`} className="border-t hover:bg-gray-50">
                              <td className="px-2 py-1.5">{row.fecha}</td>
                              <td className="px-2 py-1.5">{row.hora}</td>
                              <td className="px-2 py-1.5">{row.cliente_nombre}</td>
                              <td className="px-2 py-1.5">{row.servicio_nombre}</td>
                              <td className="px-2 py-1.5 text-gray-700">{row.proveedor_nombre || <span className="text-gray-400">—</span>}</td>
                              <td className="px-2 py-1.5 text-right">{row.cantidad_personas}</td>
                              <td className="px-2 py-1.5 text-right">${row.precio_unitario.toLocaleString('es-CL')}</td>
                              <td className="px-2 py-1.5 text-right font-medium">${row.total.toLocaleString('es-CL')}</td>
                              <td className="px-2 py-1.5 text-gray-600">{row.metodo_pago}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Card */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-emerald-600" />
                Análisis con IA
              </CardTitle>
              <CardDescription>
                Análisis inteligente de las ventas, mix de servicios, métodos de pago y clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateSalesAnalysis}
                disabled={generatingSalesAnalysis}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                {generatingSalesAnalysis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando análisis...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Análisis IA
                  </>
                )}
              </Button>
              {salesAnalysisError && (
                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No se pudo generar el análisis</p>
                    <p className="text-xs mt-1">{salesAnalysisError}</p>
                    {salesAnalysisError.toLowerCase().includes('ai analysis is not enabled') && (
                      <p className="text-xs mt-2">
                        Falta configurar <code className="px-1 bg-red-100 rounded">OPENROUTER_API_KEY</code> en <code className="px-1 bg-red-100 rounded">backend/.env</code>.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Results */}
          {salesAnalysisAI && (
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-emerald-600" />
                  Resultados del Análisis IA
                </CardTitle>
                <CardDescription>
                  Análisis generado por {salesAnalysisAI.model || 'IA'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: salesAnalysisAI.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                      .replace(/\n\n/g, '</p><p class="mt-2">')
                  }} />
                </div>
                {salesAnalysisAI.input_tokens && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <p>
                      Tokens: {salesAnalysisAI.input_tokens.toLocaleString()} entrada,{' '}
                      {salesAnalysisAI.output_tokens.toLocaleString()} salida
                      {salesAnalysisAI.latency_ms && ` • ${(salesAnalysisAI.latency_ms / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Gestión de Ventas y Reservas</CardTitle>
              <CardDescription>Sistema de reservas Aremko</CardDescription>
            </CardHeader>
            <CardContent>
              {data.bookings ? (
                <div className="space-y-6">
                  {/* Métricas principales */}
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
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Cargando datos de reservas...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clientes */}
          {data.bookings?.client_stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Users className="h-4 w-4 mr-2 text-blue-600" />
                  Clientes
                </CardTitle>
                <CardDescription>Composición de la base y movimiento de la semana</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Base total</p>
                    <p className="text-3xl font-bold">{formatNumber(data.bookings.client_stats.total_clients)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clientes registrados</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                    <p className="text-sm text-muted-foreground mb-1">🆕 Nuevos esta semana</p>
                    <p className="text-3xl font-bold text-green-700">{data.bookings.client_stats.new_clients_week}</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <p className="text-sm text-muted-foreground mb-1">🔁 Recurrentes esta semana</p>
                    <p className="text-3xl font-bold text-blue-700">{data.bookings.client_stats.returning_clients_week}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evolución 12 semanas — matriz familia × clientes */}
          {data.bookings?.weekly_breakdown?.weeks && data.bookings.weekly_breakdown.weeks.length > 0 && (() => {
            const wb = data.bookings.weekly_breakdown;
            const trend = wb.summary?.trend || {};
            const totals = wb.summary?.totals || {};
            const avg = wb.summary?.averages_per_week || {};
            const families = ['Masajes', 'Tinas', 'Cabañas', 'Otros'];

            const newPct = trend.new_clients_first_4w_avg
              ? ((trend.new_clients_last_4w_avg - trend.new_clients_first_4w_avg) / trend.new_clients_first_4w_avg) * 100
              : 0;
            const retPct = trend.returning_clients_first_4w_avg
              ? ((trend.returning_clients_last_4w_avg - trend.returning_clients_first_4w_avg) / trend.returning_clients_first_4w_avg) * 100
              : 0;

            const arrow = (p: number) => p > 0 ? '▲' : p < 0 ? '▼' : '─';
            const color = (p: number) => p > 0 ? 'text-green-600' : p < 0 ? 'text-red-600' : 'text-gray-500';

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <TrendingUp className="h-4 w-4 mr-2 text-indigo-600" />
                    Evolución 12 Semanas — Familias × Clientes
                  </CardTitle>
                  <CardDescription>
                    Tendencia trimestral. Cada celda muestra cantidad de reservas e ingresos por familia.
                    Las últimas dos columnas distinguen clientes nuevos vs. recurrentes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Trend banner */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                      <p className="text-sm font-medium mb-1">🆕 Clientes Nuevos — tendencia</p>
                      <p className="text-2xl font-bold">
                        {trend.new_clients_first_4w_avg?.toFixed(1)} → {trend.new_clients_last_4w_avg?.toFixed(1)}{' '}
                        <span className={`text-sm font-medium ${color(newPct)}`}>
                          {arrow(newPct)} {Math.abs(newPct).toFixed(0)}%
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">promedio primeras 4 vs. últimas 4 semanas</p>
                    </div>
                    <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                      <p className="text-sm font-medium mb-1">🔁 Clientes Recurrentes — tendencia</p>
                      <p className="text-2xl font-bold">
                        {trend.returning_clients_first_4w_avg?.toFixed(1)} → {trend.returning_clients_last_4w_avg?.toFixed(1)}{' '}
                        <span className={`text-sm font-medium ${color(retPct)}`}>
                          {arrow(retPct)} {Math.abs(retPct).toFixed(0)}%
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">promedio primeras 4 vs. últimas 4 semanas</p>
                    </div>
                  </div>

                  {/* Tabla matriz */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2 px-2 font-medium sticky left-0 bg-muted/30">Semana</th>
                          {families.map(f => (
                            <th key={f} className="text-right py-2 px-2 font-medium">{f}</th>
                          ))}
                          <th className="text-right py-2 px-2 font-medium border-l">Total</th>
                          <th className="text-right py-2 px-2 font-medium text-green-700">🆕 Nuevos</th>
                          <th className="text-right py-2 px-2 font-medium text-blue-700">🔁 Recurr.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wb.weeks.map((w: any) => (
                          <tr key={w.iso_week + '-' + w.iso_year} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium sticky left-0 bg-white">
                              <div>{w.date_start}</div>
                              <div className="text-[10px] text-muted-foreground">→ {w.date_stop}</div>
                            </td>
                            {families.map(f => {
                              const fam = w.by_family?.[f] || { count: 0, revenue: 0 };
                              return (
                                <td key={f} className="text-right py-2 px-2">
                                  <div className="font-semibold">{fam.count || 0}</div>
                                  <div className="text-[10px] text-muted-foreground">{formatCurrency(fam.revenue || 0)}</div>
                                </td>
                              );
                            })}
                            <td className="text-right py-2 px-2 font-semibold border-l">
                              <div>{w.total_count}</div>
                              <div className="text-[10px] text-muted-foreground">{formatCurrency(w.total_revenue)}</div>
                            </td>
                            <td className="text-right py-2 px-2 font-semibold text-green-700">{w.new_clients}</td>
                            <td className="text-right py-2 px-2 font-semibold text-blue-700">{w.returning_clients}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/30 font-semibold">
                          <td className="py-2 px-2 sticky left-0 bg-muted/30">Promedio / sem</td>
                          {families.map(f => (
                            <td key={f} className="text-right py-2 px-2 text-muted-foreground">—</td>
                          ))}
                          <td className="text-right py-2 px-2 border-l">
                            <div>{avg.total_count?.toFixed(0)}</div>
                            <div className="text-[10px] text-muted-foreground">{formatCurrency(avg.total_revenue || 0)}</div>
                          </td>
                          <td className="text-right py-2 px-2 text-green-700">{avg.new_clients?.toFixed(1)}</td>
                          <td className="text-right py-2 px-2 text-blue-700">{avg.returning_clients?.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-muted/30 font-semibold">
                          <td className="py-2 px-2 sticky left-0 bg-muted/30">Total 12 sem</td>
                          {families.map(f => (
                            <td key={f} className="text-right py-2 px-2 text-muted-foreground">—</td>
                          ))}
                          <td className="text-right py-2 px-2 border-l">
                            <div>{totals.total_count}</div>
                            <div className="text-[10px] text-muted-foreground">{formatCurrency(totals.total_revenue || 0)}</div>
                          </td>
                          <td className="text-right py-2 px-2 text-green-700">{totals.new_clients_period}</td>
                          <td className="text-right py-2 px-2 text-blue-700">{totals.returning_clients_period}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Clientes únicos del trimestre: <strong>{totals.unique_clients_period}</strong>{' '}
                    ({totals.new_clients_period} nuevos + {totals.returning_clients_period} recurrentes).
                    Rango: {wb.summary?.first_week_start} a {wb.summary?.last_week_stop}.
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Ventas por familia de servicios */}
          {data.bookings?.by_family && data.bookings.by_family.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <BarChart3 className="h-4 w-4 mr-2 text-purple-600" />
                  Ventas por Familia de Servicios
                </CardTitle>
                <CardDescription>Esta semana vs. mismo período del mes anterior y del año anterior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Familia</th>
                        <th className="text-right py-3 px-2 font-medium">Esta semana</th>
                        <th className="text-right py-3 px-2 font-medium">vs. mes anterior</th>
                        <th className="text-right py-3 px-2 font-medium">vs. año anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings.by_family.map((f: any) => {
                        const monthChange = f.previous_month_revenue > 0
                          ? ((f.current_revenue - f.previous_month_revenue) / f.previous_month_revenue) * 100
                          : null;
                        const yearChange = f.previous_year_revenue > 0
                          ? ((f.current_revenue - f.previous_year_revenue) / f.previous_year_revenue) * 100
                          : null;
                        return (
                          <tr key={f.family} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2 font-medium">{f.family}</td>
                            <td className="py-3 px-2 text-right">
                              <div className="font-semibold">{formatCurrency(f.current_revenue)}</div>
                              <div className="text-xs text-muted-foreground">{f.current_count} reservas</div>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(f.previous_month_revenue)}</div>
                              {monthChange !== null && (
                                <div className={`text-xs ${monthChange > 0 ? 'text-green-600' : monthChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '─'} {Math.abs(monthChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(f.previous_year_revenue)}</div>
                              {yearChange !== null && (
                                <div className={`text-xs ${yearChange > 0 ? 'text-green-600' : yearChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {yearChange > 0 ? '▲' : yearChange < 0 ? '▼' : '─'} {Math.abs(yearChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const t = data.bookings.by_family.reduce((acc: any, f: any) => ({
                          current_revenue: acc.current_revenue + (f.current_revenue || 0),
                          current_count: acc.current_count + (f.current_count || 0),
                          previous_month_revenue: acc.previous_month_revenue + (f.previous_month_revenue || 0),
                          previous_year_revenue: acc.previous_year_revenue + (f.previous_year_revenue || 0),
                        }), { current_revenue: 0, current_count: 0, previous_month_revenue: 0, previous_year_revenue: 0 });
                        const monthChange = t.previous_month_revenue > 0
                          ? ((t.current_revenue - t.previous_month_revenue) / t.previous_month_revenue) * 100
                          : null;
                        const yearChange = t.previous_year_revenue > 0
                          ? ((t.current_revenue - t.previous_year_revenue) / t.previous_year_revenue) * 100
                          : null;
                        return (
                          <tr className="bg-muted/50 border-t-2 border-gray-300 font-semibold">
                            <td className="py-3 px-2">TOTAL</td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(t.current_revenue)}</div>
                              <div className="text-xs text-muted-foreground font-normal">{t.current_count} reservas</div>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(t.previous_month_revenue)}</div>
                              {monthChange !== null && (
                                <div className={`text-xs font-normal ${monthChange > 0 ? 'text-green-600' : monthChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '─'} {Math.abs(monthChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(t.previous_year_revenue)}</div>
                              {yearChange !== null && (
                                <div className={`text-xs font-normal ${yearChange > 0 ? 'text-green-600' : yearChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {yearChange > 0 ? '▲' : yearChange < 0 ? '▼' : '─'} {Math.abs(yearChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ventas por familia — Mes a la Fecha */}
          {data.bookings?.by_family_mtd?.families && data.bookings.by_family_mtd.families.length > 0 && (() => {
            const mtd = data.bookings.by_family_mtd;
            const p = mtd.period || {};
            // Formatea "2026-05-01" → "1 may", "2026-05-18" → "18 may"
            const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
            const fmt = (iso?: string) => {
              if (!iso) return '';
              const [y, m, d] = iso.split('-');
              const mm = months[parseInt(m, 10) - 1] || m;
              return `${parseInt(d, 10)} ${mm}`;
            };
            const yearOf = (iso?: string) => iso?.split('-')[0] || '';
            const currentLabel = `${fmt(p.current_start)} al ${fmt(p.current_stop)}`;
            const prevMonthLabel = `${fmt(p.prev_month_start)} al ${fmt(p.prev_month_stop)}`;
            const prevYearLabel = `${fmt(p.prev_year_start)} al ${fmt(p.prev_year_stop)} ${yearOf(p.prev_year_start)}`;

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <BarChart3 className="h-4 w-4 mr-2 text-indigo-600" />
                    Ventas por Familia — Mes a la Fecha
                  </CardTitle>
                  <CardDescription>
                    Del {currentLabel} vs. mismos días del mes y año anterior. Ingresos totales reales
                    (precio × cantidad de personas), no precio unitario.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Familia</th>
                          <th className="text-right py-3 px-2 font-medium">{currentLabel}</th>
                          <th className="text-right py-3 px-2 font-medium">{prevMonthLabel}</th>
                          <th className="text-right py-3 px-2 font-medium">{prevYearLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mtd.families.map((f: any) => {
                          const monthChange = f.previous_month_revenue > 0
                            ? ((f.current_revenue - f.previous_month_revenue) / f.previous_month_revenue) * 100
                            : null;
                          const yearChange = f.previous_year_revenue > 0
                            ? ((f.current_revenue - f.previous_year_revenue) / f.previous_year_revenue) * 100
                            : null;
                          return (
                            <tr key={f.family} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-medium">{f.family}</td>
                              <td className="py-3 px-2 text-right">
                                <div className="font-semibold">{formatCurrency(f.current_revenue)}</div>
                                <div className="text-xs text-muted-foreground">{f.current_count} servicios</div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div>{formatCurrency(f.previous_month_revenue)}</div>
                                <div className="text-xs text-muted-foreground">{f.previous_month_count} servicios</div>
                                {monthChange !== null && (
                                  <div className={`text-xs ${monthChange > 0 ? 'text-green-600' : monthChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '─'} {Math.abs(monthChange).toFixed(0)}%
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div>{formatCurrency(f.previous_year_revenue)}</div>
                                <div className="text-xs text-muted-foreground">{f.previous_year_count} servicios</div>
                                {yearChange !== null && (
                                  <div className={`text-xs ${yearChange > 0 ? 'text-green-600' : yearChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {yearChange > 0 ? '▲' : yearChange < 0 ? '▼' : '─'} {Math.abs(yearChange).toFixed(0)}%
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const t = mtd.families.reduce((acc: any, f: any) => ({
                            current_revenue: acc.current_revenue + (f.current_revenue || 0),
                            current_count: acc.current_count + (f.current_count || 0),
                            previous_month_revenue: acc.previous_month_revenue + (f.previous_month_revenue || 0),
                            previous_month_count: acc.previous_month_count + (f.previous_month_count || 0),
                            previous_year_revenue: acc.previous_year_revenue + (f.previous_year_revenue || 0),
                            previous_year_count: acc.previous_year_count + (f.previous_year_count || 0),
                          }), { current_revenue: 0, current_count: 0, previous_month_revenue: 0, previous_month_count: 0, previous_year_revenue: 0, previous_year_count: 0 });
                          const monthChange = t.previous_month_revenue > 0
                            ? ((t.current_revenue - t.previous_month_revenue) / t.previous_month_revenue) * 100
                            : null;
                          const yearChange = t.previous_year_revenue > 0
                            ? ((t.current_revenue - t.previous_year_revenue) / t.previous_year_revenue) * 100
                            : null;
                          return (
                            <tr className="bg-muted/50 border-t-2 border-gray-300 font-semibold">
                              <td className="py-3 px-2">TOTAL</td>
                              <td className="py-3 px-2 text-right">
                                <div>{formatCurrency(t.current_revenue)}</div>
                                <div className="text-xs text-muted-foreground font-normal">{t.current_count} servicios</div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div>{formatCurrency(t.previous_month_revenue)}</div>
                                <div className="text-xs text-muted-foreground font-normal">{t.previous_month_count} servicios</div>
                                {monthChange !== null && (
                                  <div className={`text-xs font-normal ${monthChange > 0 ? 'text-green-600' : monthChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '─'} {Math.abs(monthChange).toFixed(0)}%
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div>{formatCurrency(t.previous_year_revenue)}</div>
                                <div className="text-xs text-muted-foreground font-normal">{t.previous_year_count} servicios</div>
                                {yearChange !== null && (
                                  <div className={`text-xs font-normal ${yearChange > 0 ? 'text-green-600' : yearChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {yearChange > 0 ? '▲' : yearChange < 0 ? '▼' : '─'} {Math.abs(yearChange).toFixed(0)}%
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Ventas por método de pago */}
          {data.bookings?.by_payment_method && data.bookings.by_payment_method.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                  Ventas por Método de Pago
                </CardTitle>
                <CardDescription>Distribución del ingreso por canal de pago, con comparativa</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Método</th>
                        <th className="text-right py-3 px-2 font-medium">Esta semana</th>
                        <th className="text-right py-3 px-2 font-medium">vs. mes anterior</th>
                        <th className="text-right py-3 px-2 font-medium">vs. año anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings.by_payment_method.map((p: any) => {
                        const monthChange = p.previous_month_revenue > 0
                          ? ((p.current_revenue - p.previous_month_revenue) / p.previous_month_revenue) * 100
                          : null;
                        const yearChange = p.previous_year_revenue > 0
                          ? ((p.current_revenue - p.previous_year_revenue) / p.previous_year_revenue) * 100
                          : null;
                        return (
                          <tr key={p.payment_method} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2 font-medium">{p.payment_method}</td>
                            <td className="py-3 px-2 text-right">
                              <div className="font-semibold">{formatCurrency(p.current_revenue)}</div>
                              <div className="text-xs text-muted-foreground">{p.current_count} reservas</div>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(p.previous_month_revenue)}</div>
                              {monthChange !== null && (
                                <div className={`text-xs ${monthChange > 0 ? 'text-green-600' : monthChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '─'} {Math.abs(monthChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(p.previous_year_revenue)}</div>
                              {yearChange !== null && (
                                <div className={`text-xs ${yearChange > 0 ? 'text-green-600' : yearChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {yearChange > 0 ? '▲' : yearChange < 0 ? '▼' : '─'} {Math.abs(yearChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const t = data.bookings.by_payment_method.reduce((acc: any, p: any) => ({
                          current_revenue: acc.current_revenue + (p.current_revenue || 0),
                          current_count: acc.current_count + (p.current_count || 0),
                          previous_month_revenue: acc.previous_month_revenue + (p.previous_month_revenue || 0),
                          previous_year_revenue: acc.previous_year_revenue + (p.previous_year_revenue || 0),
                        }), { current_revenue: 0, current_count: 0, previous_month_revenue: 0, previous_year_revenue: 0 });
                        const monthChange = t.previous_month_revenue > 0
                          ? ((t.current_revenue - t.previous_month_revenue) / t.previous_month_revenue) * 100
                          : null;
                        const yearChange = t.previous_year_revenue > 0
                          ? ((t.current_revenue - t.previous_year_revenue) / t.previous_year_revenue) * 100
                          : null;
                        return (
                          <tr className="bg-muted/50 border-t-2 border-gray-300 font-semibold">
                            <td className="py-3 px-2">TOTAL</td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(t.current_revenue)}</div>
                              <div className="text-xs text-muted-foreground font-normal">{t.current_count} reservas</div>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(t.previous_month_revenue)}</div>
                              {monthChange !== null && (
                                <div className={`text-xs font-normal ${monthChange > 0 ? 'text-green-600' : monthChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '─'} {Math.abs(monthChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>{formatCurrency(t.previous_year_revenue)}</div>
                              {yearChange !== null && (
                                <div className={`text-xs font-normal ${yearChange > 0 ? 'text-green-600' : yearChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  {yearChange > 0 ? '▲' : yearChange < 0 ? '▼' : '─'} {Math.abs(yearChange).toFixed(0)}%
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detalle día por día */}
          {data.bookings?.daily && data.bookings.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Calendar className="h-4 w-4 mr-2 text-orange-600" />
                  Reservas Día por Día
                </CardTitle>
                <CardDescription>Detalle diario de la semana</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Fecha</th>
                        <th className="text-right py-3 px-2 font-medium">Reservas</th>
                        <th className="text-right py-3 px-2 font-medium">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings.daily.map((d: any) => (
                        <tr key={d.date} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{d.date}</td>
                          <td className="py-3 px-2 text-right">{d.count}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tendencias mensuales largo plazo (6/12/18/24 meses) */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Evolución por Familia — Largo Plazo</CardTitle>
                  <CardDescription>
                    Ingresos y cantidad de servicios por mes. Útil para ver estacionalidad y pendiente de crecimiento.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    {[6, 12, 18, 24].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMonthlyRange(m)}
                        className={`px-3 py-1.5 ${monthlyRange === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setMonthlyMetric('revenue')}
                      className={`px-3 py-1.5 ${monthlyMetric === 'revenue' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Ingresos
                    </button>
                    <button
                      onClick={() => setMonthlyMetric('count')}
                      className={`px-3 py-1.5 ${monthlyMetric === 'count' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Cantidad
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMonthly && (
                <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando tendencias…
                </div>
              )}
              {monthlyError && !loadingMonthly && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  Error: {monthlyError}
                </div>
              )}
              {monthlyTrends && !loadingMonthly && (
                <>
                  {/* Trend banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {(['tinas', 'masajes', 'cabanas', 'otros'] as const).map((fam) => {
                      const s = monthlyTrends.summary_by_family?.[fam];
                      if (!s) return null;
                      const trend = s.trend_slope_pct;
                      const color = trend == null ? 'bg-gray-50 text-gray-700' : trend > 5 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : trend < -5 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200';
                      return (
                        <div key={fam} className={`border rounded-md p-3 ${color}`}>
                          <div className="text-xs uppercase font-semibold opacity-70">{fam}</div>
                          <div className="text-lg font-bold">
                            {trend == null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`}
                          </div>
                          <div className="text-xs opacity-70">
                            promedio ${(s.avg_monthly_revenue || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}/mes
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart */}
                  <div className="w-full" style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyTrends.data?.map((d: any) => ({
                          month: d.month_label,
                          Tinas: d.families?.tinas?.[monthlyMetric] ?? 0,
                          Masajes: d.families?.masajes?.[monthlyMetric] ?? 0,
                          Cabañas: d.families?.cabanas?.[monthlyMetric] ?? 0,
                          Otros: d.families?.otros?.[monthlyMetric] ?? 0,
                        }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            monthlyMetric === 'revenue'
                              ? `$${(v / 1_000_000).toFixed(1)}M`
                              : String(v)
                          }
                          width={70}
                        />
                        <Tooltip
                          formatter={(v: any) =>
                            monthlyMetric === 'revenue'
                              ? `$${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
                              : `${v} servicios`
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="Tinas" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Masajes" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Cabañas" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Otros" stroke="#6b7280" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium sticky left-0 bg-gray-50">Mes</th>
                          <th className="px-2 py-1.5 text-right font-medium text-sky-700">Tinas</th>
                          <th className="px-2 py-1.5 text-right font-medium text-purple-700">Masajes</th>
                          <th className="px-2 py-1.5 text-right font-medium text-emerald-700">Cabañas</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-700">Otros</th>
                          <th className="px-2 py-1.5 text-right font-medium border-l border-gray-200">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyTrends.data?.map((d: any) => {
                          const fmt = (v: number) =>
                            monthlyMetric === 'revenue'
                              ? `$${(v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
                              : String(v || 0);
                          return (
                            <tr key={d.month} className="border-t hover:bg-gray-50">
                              <td className="px-2 py-1.5 font-medium sticky left-0 bg-white">{d.month_label}</td>
                              <td className="px-2 py-1.5 text-right">{fmt(d.families?.tinas?.[monthlyMetric])}</td>
                              <td className="px-2 py-1.5 text-right">{fmt(d.families?.masajes?.[monthlyMetric])}</td>
                              <td className="px-2 py-1.5 text-right">{fmt(d.families?.cabanas?.[monthlyMetric])}</td>
                              <td className="px-2 py-1.5 text-right text-gray-500">{fmt(d.families?.otros?.[monthlyMetric])}</td>
                              <td className="px-2 py-1.5 text-right font-semibold border-l border-gray-200">{fmt(d.total?.[monthlyMetric])}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Resumen por Categoría de Productos (agrupa el summary_by_product) */}
          {productTrends && productTrends.summary_by_product && Object.keys(productTrends.summary_by_product).length > 0 && (() => {
            const summary = productTrends.summary_by_product;
            const months: any[] = productTrends.data || [];

            // Agrupa productos por categoría y arma slope a partir del agregado mensual
            type CatRow = {
              name: string;
              productIds: string[];
              total_revenue: number;
              total_count: number;
              slope_pct: number | null;
            };
            const groups: Record<string, CatRow> = {};
            for (const pid of Object.keys(summary)) {
              const p = summary[pid];
              const cat = p.category ?? 'Sin categoría';
              if (!groups[cat]) {
                groups[cat] = { name: cat, productIds: [], total_revenue: 0, total_count: 0, slope_pct: null };
              }
              groups[cat].productIds.push(pid);
              groups[cat].total_revenue += p.total_revenue || 0;
              groups[cat].total_count += p.total_count || 0;
            }

            // Slope agregado por categoría: 2da mitad vs 1ra mitad del rango mensual
            for (const cat of Object.keys(groups)) {
              const monthly = months.map((m: any) =>
                groups[cat].productIds.reduce((s, pid) => s + (m.products?.[pid]?.revenue ?? 0), 0)
              );
              if (monthly.length >= 4) {
                const half = Math.floor(monthly.length / 2);
                const first = monthly.slice(0, half).reduce((a, b) => a + b, 0);
                const last = monthly.slice(monthly.length - half).reduce((a, b) => a + b, 0);
                groups[cat].slope_pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
              }
            }

            // Total absoluto para porcentaje del mix. Excluimos Descuento del denominador
            // porque es revenue negativo y distorsiona los %.
            const positiveTotal = Object.values(groups)
              .filter((g) => g.name !== 'Descuento' && g.total_revenue > 0)
              .reduce((s, g) => s + g.total_revenue, 0);

            const rows = Object.values(groups).sort((a, b) => b.total_revenue - a.total_revenue);

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumen por Categoría de Productos</CardTitle>
                  <CardDescription>
                    Mix por categoría en los últimos {productTrends.months} meses. % calculado sobre revenue positivo (excluye descuentos).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">Categoría</th>
                          <th className="text-right py-2 px-2 font-medium">Productos</th>
                          <th className="text-right py-2 px-2 font-medium">Revenue</th>
                          <th className="text-right py-2 px-2 font-medium">Unidades</th>
                          <th className="text-right py-2 px-2 font-medium">% del mix</th>
                          <th className="text-right py-2 px-2 font-medium">Tendencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const pct = r.name === 'Descuento' || r.total_revenue <= 0 || positiveTotal === 0
                            ? null
                            : (r.total_revenue / positiveTotal) * 100;
                          const slope = r.slope_pct;
                          const slopeClass =
                            slope == null ? 'text-gray-400'
                            : slope > 5 ? 'text-emerald-600'
                            : slope < -5 ? 'text-red-600'
                            : 'text-yellow-600';
                          const revenueClass = r.total_revenue < 0 ? 'text-red-600' : '';
                          return (
                            <tr key={r.name} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium">{r.name}</td>
                              <td className="py-2 px-2 text-right">{r.productIds.length}</td>
                              <td className={`py-2 px-2 text-right font-semibold ${revenueClass}`}>
                                ${r.total_revenue.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2 px-2 text-right">{r.total_count.toLocaleString('es-CL')}</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {pct == null ? '—' : `${pct.toFixed(1)}%`}
                              </td>
                              <td className={`py-2 px-2 text-right ${slopeClass}`}>
                                {slope == null ? '—' : `${slope > 0 ? '+' : ''}${slope.toFixed(1)}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Tendencia = comparación de segunda mitad vs primera mitad del rango mensual seleccionado.
                    Verde &gt; +5%, rojo &lt; −5%.
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Evolución por Producto — Largo Plazo (espejo de familias, a nivel SKU) */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Evolución por Producto — Largo Plazo</CardTitle>
                  <CardDescription>
                    Cantidad e ingresos por SKU y mes. Productos ordenados por ingreso total descendente. Útil para detectar SKUs en caída y estacionalidad por producto.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    {[6, 12, 18, 24].map((m) => (
                      <button
                        key={m}
                        onClick={() => setProductRange(m)}
                        className={`px-3 py-1.5 ${productRange === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setProductMetric('revenue')}
                      className={`px-3 py-1.5 ${productMetric === 'revenue' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Ingresos
                    </button>
                    <button
                      onClick={() => setProductMetric('count')}
                      className={`px-3 py-1.5 ${productMetric === 'count' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Cantidad
                    </button>
                  </div>
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setProductGrouping(true)}
                      className={`px-3 py-1.5 ${productGrouping ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      title="Une variantes del mismo producto (ej: todos los cafés en 'Café Marley')"
                    >
                      Agrupado
                    </button>
                    <button
                      onClick={() => setProductGrouping(false)}
                      className={`px-3 py-1.5 ${!productGrouping ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      title="Cada SKU en su propia fila"
                    >
                      SKU individual
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProducts && (
                <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando productos…
                </div>
              )}
              {productsError && !loadingProducts && !productTrends && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  Sin datos de productos todavía. El endpoint Django <code className="px-1 bg-amber-100 rounded">monthly-by-product</code> aún no responde — revisar deploy de aremko-django.
                  <div className="text-xs mt-1 opacity-70">Detalle: {productsError}</div>
                </div>
              )}
              {productTrends && productTrends.summary_by_product && Object.keys(productTrends.summary_by_product).length === 0 && !loadingProducts && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                  No hay productos con ventas en los últimos {productRange} meses.
                </div>
              )}
              {productTrends && productTrends.summary_by_product && Object.keys(productTrends.summary_by_product).length > 0 && !loadingProducts && (() => {
                const rawSummary = productTrends.summary_by_product;
                const rawMonths: any[] = productTrends.data || [];
                const fmt = (v: number) =>
                  productMetric === 'revenue'
                    ? `$${(v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
                    : String(v || 0);

                // ─── Transformación según modo ───
                // En modo "Agrupado", colapsamos SKUs en grupos canónicos usando
                // PRODUCT_GROUP_RULES. La estructura `rows` y `months` queda igual
                // que en modo SKU para que el renderizado de la tabla sea uniforme.
                type Row = {
                  key: string;
                  name: string;
                  total_revenue: number;
                  total_count: number;
                  slope_pct: number | null;
                  sku_count: number;
                  member_pids?: string[];
                };
                type MonthCell = { revenue: number; count: number };

                let rows: Row[];
                let monthsForRender: { month: string; month_label: string; cells: Record<string, MonthCell>; total: MonthCell }[];

                if (productGrouping) {
                  // pid → groupName
                  const pidToGroup: Record<string, string> = {};
                  for (const pid of Object.keys(rawSummary)) {
                    pidToGroup[pid] = productGroupOf(rawSummary[pid]?.name || pid);
                  }
                  // Agregar summary por grupo
                  const groupAgg: Record<string, Row> = {};
                  for (const pid of Object.keys(rawSummary)) {
                    const s = rawSummary[pid];
                    const gname = pidToGroup[pid];
                    if (!groupAgg[gname]) {
                      groupAgg[gname] = {
                        key: gname,
                        name: gname,
                        total_revenue: 0,
                        total_count: 0,
                        slope_pct: null,
                        sku_count: 0,
                        member_pids: [],
                      };
                    }
                    groupAgg[gname].total_revenue += s.total_revenue || 0;
                    groupAgg[gname].total_count += s.total_count || 0;
                    groupAgg[gname].sku_count += 1;
                    groupAgg[gname].member_pids!.push(pid);
                  }
                  // Slope agregado por grupo: 2da mitad vs 1ra mitad del rango mensual
                  for (const gname of Object.keys(groupAgg)) {
                    const pids = groupAgg[gname].member_pids!;
                    const monthly = rawMonths.map((m: any) =>
                      pids.reduce((s, pid) => s + (m.products?.[pid]?.revenue ?? 0), 0)
                    );
                    if (monthly.length >= 4) {
                      const half = Math.floor(monthly.length / 2);
                      const first = monthly.slice(0, half).reduce((a, b) => a + b, 0);
                      const last = monthly.slice(monthly.length - half).reduce((a, b) => a + b, 0);
                      groupAgg[gname].slope_pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
                    }
                  }
                  // Construir months con cells por grupo
                  monthsForRender = rawMonths.map((m: any) => {
                    const cells: Record<string, MonthCell> = {};
                    for (const pid of Object.keys(m.products || {})) {
                      const gname = pidToGroup[pid];
                      if (!gname) continue;
                      if (!cells[gname]) cells[gname] = { revenue: 0, count: 0 };
                      cells[gname].revenue += m.products[pid].revenue || 0;
                      cells[gname].count += m.products[pid].count || 0;
                    }
                    return {
                      month: m.month,
                      month_label: m.month_label,
                      cells,
                      total: { revenue: m.total?.revenue || 0, count: m.total?.count || 0 },
                    };
                  });
                  rows = Object.values(groupAgg).sort((a, b) => b.total_revenue - a.total_revenue);
                } else {
                  // Modo SKU individual: 1 fila por producto
                  const pids = Object.keys(rawSummary).sort((a, b) => {
                    const ra = rawSummary[a]?.total_revenue || 0;
                    const rb = rawSummary[b]?.total_revenue || 0;
                    return rb - ra;
                  });
                  rows = pids.map((pid) => {
                    const s = rawSummary[pid];
                    return {
                      key: pid,
                      name: s?.name || pid,
                      total_revenue: s?.total_revenue || 0,
                      total_count: s?.total_count || 0,
                      slope_pct: s?.trend_slope_pct ?? null,
                      sku_count: 1,
                    };
                  });
                  monthsForRender = rawMonths.map((m: any) => {
                    const cells: Record<string, MonthCell> = {};
                    for (const pid of Object.keys(m.products || {})) {
                      cells[pid] = { revenue: m.products[pid].revenue || 0, count: m.products[pid].count || 0 };
                    }
                    return {
                      month: m.month,
                      month_label: m.month_label,
                      cells,
                      total: { revenue: m.total?.revenue || 0, count: m.total?.count || 0 },
                    };
                  });
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-max">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium sticky left-0 bg-gray-50 min-w-[220px] z-10">
                            {productGrouping ? 'Grupo de productos' : 'Producto'}
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium border-l border-gray-200 sticky right-0 bg-gray-50 z-10">
                            Total
                          </th>
                          {monthsForRender.map((m) => (
                            <th key={m.month} className="px-2 py-1.5 text-right font-medium text-gray-600 capitalize">
                              {m.month_label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const total = productMetric === 'revenue' ? r.total_revenue : r.total_count;
                          const slope = r.slope_pct;
                          const slopeColor = slope == null ? 'text-gray-400' : slope > 5 ? 'text-emerald-600' : slope < -5 ? 'text-red-600' : 'text-yellow-600';
                          return (
                            <tr key={r.key} className="border-t hover:bg-gray-50">
                              <td className="px-2 py-1.5 sticky left-0 bg-white z-10 max-w-[260px]">
                                <div className="font-medium truncate" title={r.name}>
                                  {r.name}
                                  {productGrouping && r.sku_count > 1 && (
                                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                                      ({r.sku_count} SKUs)
                                    </span>
                                  )}
                                </div>
                                {slope != null && (
                                  <div className={`text-[10px] ${slopeColor}`}>
                                    tendencia {slope > 0 ? '+' : ''}{slope.toFixed(1)}%
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold border-l border-gray-200 sticky right-0 bg-white z-10">
                                {fmt(total)}
                              </td>
                              {monthsForRender.map((m) => {
                                const cell = m.cells[r.key];
                                const v = cell?.[productMetric] ?? 0;
                                return (
                                  <td key={m.month} className={`px-2 py-1.5 text-right ${v === 0 ? 'text-gray-300' : ''}`}>
                                    {v === 0 ? '·' : fmt(v)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr className="border-t-2 border-gray-300 font-semibold">
                          <td className="px-2 py-1.5 sticky left-0 bg-gray-50 z-10">TOTAL</td>
                          <td className="px-2 py-1.5 text-right border-l border-gray-200 sticky right-0 bg-gray-50 z-10">
                            {fmt(monthsForRender.reduce((acc, m) => acc + m.total[productMetric], 0))}
                          </td>
                          {monthsForRender.map((m) => (
                            <td key={m.month} className="px-2 py-1.5 text-right">
                              {fmt(m.total[productMetric])}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Combinaciones de Familias por Reserva (efectividad de venta combinada) */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Combinaciones de Familias por Reserva</CardTitle>
                  <CardDescription>
                    Últimos 24 meses. Cada celda cuenta reservas (o ingresos) según qué familias incluyó cada reserva. Útil para medir efectividad de campañas de venta combinada.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print h-fit">
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setCombosMetric('count_reservas')}
                      className={`px-3 py-1.5 ${combosMetric === 'count_reservas' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Reservas
                    </button>
                    <button
                      onClick={() => setCombosMetric('revenue')}
                      className={`px-3 py-1.5 ${combosMetric === 'revenue' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Ingresos
                    </button>
                  </div>
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setCombosFormat('absolute')}
                      className={`px-3 py-1.5 ${combosFormat === 'absolute' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      title="Mostrar valor absoluto"
                    >
                      # Absoluto
                    </button>
                    <button
                      onClick={() => setCombosFormat('percent')}
                      className={`px-3 py-1.5 ${combosFormat === 'percent' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      title="Mostrar % del total del mes (sin decimales)"
                    >
                      % del mes
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCombos && (
                <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando combinaciones…
                </div>
              )}
              {combosError && !loadingCombos && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  Error: {combosError}
                </div>
              )}
              {familyCombos && !loadingCombos && (() => {
                const cols = [
                  { key: 'solo_tinas',            label: 'Solo Tinas',         color: 'text-sky-700' },
                  { key: 'solo_masajes',          label: 'Solo Masajes',       color: 'text-purple-700' },
                  { key: 'solo_cabanas',          label: 'Solo Cabañas',       color: 'text-emerald-700' },
                  { key: 'tinas_masajes',         label: 'Tinas + Masajes',    color: 'text-blue-700' },
                  { key: 'cabanas_tinas',         label: 'Cabañas + Tinas',    color: 'text-teal-700' },
                  { key: 'cabanas_tinas_masajes', label: 'Cab + Tin + Mas',    color: 'text-amber-700' },
                ];
                const fmt = (v: number, rowTotal?: number) => {
                  if (combosFormat === 'percent') {
                    if (!rowTotal || rowTotal === 0) return '—';
                    return `${Math.round(((v || 0) / rowTotal) * 100)}%`;
                  }
                  return combosMetric === 'revenue'
                    ? `$${(v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
                    : String(v || 0);
                };
                const summary = familyCombos.summary || {};
                const share = summary.share_by_combination || {};
                const slope = summary.trend_slope_pct_by_combination || {};
                return (
                  <>
                    {/* Trend banner por combinación */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 text-xs">
                      {cols.map((c) => {
                        const sh = share[c.key];
                        const sl = slope[c.key];
                        const trendColor = sl == null ? 'bg-gray-50 text-gray-700 border-gray-200' :
                          sl > 20 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          sl < -20 ? 'bg-red-50 text-red-800 border-red-200' :
                          'bg-yellow-50 text-yellow-800 border-yellow-200';
                        return (
                          <div key={c.key} className={`border rounded-md p-2 ${trendColor}`}>
                            <div className="font-semibold truncate">{c.label}</div>
                            <div className="text-lg font-bold">
                              {sl == null ? '—' : `${sl > 0 ? '+' : ''}${sl.toFixed(0)}%`}
                            </div>
                            {sh && (
                              <div className="opacity-70">
                                {sh.pct_reservas?.toFixed(1)}% res · {sh.pct_revenue?.toFixed(1)}% rev
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Tabla scrollable */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium sticky left-0 bg-gray-50">Mes</th>
                            {cols.map((c) => (
                              <th key={c.key} className={`px-2 py-1.5 text-right font-medium ${c.color}`}>
                                {c.label}
                              </th>
                            ))}
                            <th className="px-2 py-1.5 text-right font-medium border-l border-gray-200">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {familyCombos.data?.map((d: any) => {
                            const rowTotal = d.total?.[combosMetric] || 0;
                            return (
                              <tr key={d.month} className="border-t hover:bg-gray-50">
                                <td className="px-2 py-1.5 font-medium sticky left-0 bg-white">{d.month_label}</td>
                                {cols.map((c) => (
                                  <td key={c.key} className="px-2 py-1.5 text-right">
                                    {fmt(d.combinations?.[c.key]?.[combosMetric], rowTotal)}
                                  </td>
                                ))}
                                <td className="px-2 py-1.5 text-right font-semibold border-l border-gray-200">
                                  {combosFormat === 'percent'
                                    ? '100%'
                                    : (combosMetric === 'revenue'
                                        ? `$${rowTotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
                                        : String(rowTotal))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2">
                          <tr>
                            <td className="px-2 py-1.5 font-semibold sticky left-0 bg-gray-50">Período total</td>
                            {cols.map((c) => {
                              const sh = share[c.key];
                              return (
                                <td key={c.key} className="px-2 py-1.5 text-right text-gray-600">
                                  {sh ? `${combosMetric === 'count_reservas' ? sh.pct_reservas?.toFixed(1) : sh.pct_revenue?.toFixed(1)}%` : '—'}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-right font-bold border-l border-gray-200">
                              {combosMetric === 'count_reservas'
                                ? `${summary.total_reservas?.toLocaleString('es-CL') || 0} res`
                                : `$${(summary.total_revenue || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPINIONES */}
        <TabsContent value="reviews" className="space-y-4" data-tab-export="reviews">
          {/* AI Analysis Card */}
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-yellow-600" />
                Análisis con IA
              </CardTitle>
              <CardDescription>
                Análisis inteligente de reputación online, NPS (lealtad del cliente) y dimensiones del servicio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateReviewsAnalysis}
                disabled={generatingReviewsAnalysis}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700"
              >
                {generatingReviewsAnalysis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando análisis...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Análisis IA
                  </>
                )}
              </Button>
              {reviewsAnalysisError && (
                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No se pudo generar el análisis</p>
                    <p className="text-xs mt-1">{reviewsAnalysisError}</p>
                    {reviewsAnalysisError.toLowerCase().includes('ai analysis is not enabled') && (
                      <p className="text-xs mt-2">
                        Falta configurar <code className="px-1 bg-red-100 rounded">OPENROUTER_API_KEY</code> en <code className="px-1 bg-red-100 rounded">backend/.env</code>.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Results */}
          {reviewsAnalysisAI && (
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-yellow-600" />
                  Resultados del Análisis IA
                </CardTitle>
                <CardDescription>
                  Análisis generado por {reviewsAnalysisAI.model || 'IA'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: reviewsAnalysisAI.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                      .replace(/\n\n/g, '</p><p class="mt-2">')
                  }} />
                </div>
                {reviewsAnalysisAI.input_tokens && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <p>
                      Tokens: {reviewsAnalysisAI.input_tokens.toLocaleString()} entrada,{' '}
                      {reviewsAnalysisAI.output_tokens.toLocaleString()} salida
                      {reviewsAnalysisAI.latency_ms && ` • ${(reviewsAnalysisAI.latency_ms / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                            <p className="text-sm text-muted-foreground mb-1 cursor-help" title="NPS — Net Promoter Score: indicador de lealtad del cliente (promotores menos detractores, escala -100 a +100)">NPS <span className="text-xs text-gray-400">(lealtad cliente)</span></p>
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

                      {/* Distribución NPS: Promotores / Pasivos / Detractores */}
                      {data.reviews.surveys.total > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Distribución NPS</p>
                          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
                            <div
                              className="bg-green-500"
                              style={{ width: `${(data.reviews.surveys.nps.promotores / data.reviews.surveys.total) * 100}%` }}
                              title={`Promotores: ${data.reviews.surveys.nps.promotores}`}
                            />
                            <div
                              className="bg-yellow-400"
                              style={{ width: `${(data.reviews.surveys.nps.pasivos / data.reviews.surveys.total) * 100}%` }}
                              title={`Pasivos: ${data.reviews.surveys.nps.pasivos}`}
                            />
                            <div
                              className="bg-red-500"
                              style={{ width: `${(data.reviews.surveys.nps.detractores / data.reviews.surveys.total) * 100}%` }}
                              title={`Detractores: ${data.reviews.surveys.nps.detractores}`}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>🟢 Promotores ({data.reviews.surveys.nps.promotores})</span>
                            <span>🟡 Pasivos ({data.reviews.surveys.nps.pasivos})</span>
                            <span>🔴 Detractores ({data.reviews.surveys.nps.detractores})</span>
                          </div>
                        </div>
                      )}

                      {/* Calificaciones por Dimensión */}
                      {data.reviews.surveys.calificaciones_promedio && Object.keys(data.reviews.surveys.calificaciones_promedio).length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold mb-3">Calificaciones por Dimensión</h4>
                          <p className="text-xs text-muted-foreground mb-3">Promedio sobre 5 estrellas. Verde ≥ 4.7 · Naranja &lt; 4.4</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2 font-medium">Dimensión</th>
                                  <th className="text-right py-2 px-2 font-medium">Promedio</th>
                                  <th className="text-left py-2 px-2 font-medium w-1/3">Barra</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(data.reviews.surveys.calificaciones_promedio)
                                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                                  .map(([key, value]) => {
                                    const v = value as number;
                                    const label = key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
                                    const color = v >= 4.7 ? 'text-green-600' : v < 4.4 ? 'text-orange-600' : 'text-gray-700';
                                    const barColor = v >= 4.7 ? 'bg-green-500' : v < 4.4 ? 'bg-orange-500' : 'bg-yellow-400';
                                    return (
                                      <tr key={key} className="border-b hover:bg-muted/50">
                                        <td className="py-2 px-2">{label}</td>
                                        <td className={`py-2 px-2 text-right font-semibold ${color}`}>{v.toFixed(2)}</td>
                                        <td className="py-2 px-2">
                                          <div className="h-2 rounded bg-gray-100 overflow-hidden">
                                            <div className={`h-full ${barColor}`} style={{ width: `${(v / 5) * 100}%` }} />
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

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
        <TabsContent value="competition" className="space-y-4" data-tab-export="competition">
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
                          {data.competitors.aremko_precio_referencia.fuente && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {data.competitors.aremko_precio_referencia.fuente}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Competidores */}
                    {data.competitors.competitors?.map((competitor: any) => {
                      const aremkoPrecio = data.competitors.aremko_precio_referencia?.precio_entrada_adulto;
                      const precio = competitor.snapshot?.precio_entrada_adulto;
                      const scrapingFailed = competitor.last_scrape_error != null;
                      const snapshotOk = competitor.snapshot?.scraping_exitoso === true;
                      const truncErr = (competitor.last_scrape_error?.error_mensaje || '').slice(0, 80);
                      return (
                        <div key={competitor.id} className={`flex items-center justify-between p-4 border rounded-lg ${scrapingFailed ? 'bg-red-50/50 border-red-100' : ''}`}>
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
                          <div className="text-right max-w-xs">
                            {precio ? (
                              <>
                                <p className="text-xl font-bold">{formatCurrency(precio)}</p>
                                {aremkoPrecio && (
                                  <p className="text-xs text-muted-foreground">
                                    {precio < aremkoPrecio ? (
                                      <span className="text-red-600">▼ Más barato que nosotros</span>
                                    ) : precio > aremkoPrecio ? (
                                      <span className="text-green-600">▲ Más caro que nosotros</span>
                                    ) : (
                                      <span className="text-gray-600">= Igual que nosotros</span>
                                    )}
                                  </p>
                                )}
                              </>
                            ) : scrapingFailed ? (
                              <>
                                <p className="text-sm text-red-600 font-medium flex items-center justify-end gap-1">
                                  <span>🔴</span>
                                  Sin datos
                                </p>
                                <p className="text-xs text-red-500 mt-1">{truncErr || 'Error al capturar información'}</p>
                                {competitor.last_scrape_error?.fecha_captura && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    último intento: {competitor.last_scrape_error.fecha_captura}
                                  </p>
                                )}
                              </>
                            ) : snapshotOk ? (
                              <p className="text-sm text-muted-foreground italic">Precio no público en su sitio</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Sin datos</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                        {data.competitors.competitors?.map((competitor: any) => {
                          const known = competitor.snapshot?.scraping_exitoso === true;
                          const cell = (val: boolean | undefined) =>
                            known ? (val ? '✅' : '❌') : <span className="text-muted-foreground">—</span>;
                          return (
                            <tr key={competitor.id} className={`border-b ${!known ? 'opacity-40' : ''}`}>
                              <td className="p-2 font-medium">
                                {competitor.nombre}
                                {!known && (
                                  <span className="ml-2 text-[10px] text-red-600" title="Información no capturada">
                                    sin info
                                  </span>
                                )}
                              </td>
                              <td className="text-center p-2">{cell(competitor.snapshot?.servicios?.piscinas_termales)}</td>
                              <td className="text-center p-2">{cell(competitor.snapshot?.servicios?.masajes)}</td>
                              <td className="text-center p-2">{cell(competitor.snapshot?.servicios?.restaurant)}</td>
                              <td className="text-center p-2">{cell(competitor.snapshot?.servicios?.alojamiento)}</td>
                            </tr>
                          );
                        })}
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
        <TabsContent value="ai" className="space-y-4" data-tab-export="ai">
          {/* Análisis Integral con IA */}
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                Análisis Integral del Informe
              </CardTitle>
              <CardDescription>
                Síntesis que cruza Web, Redes Sociales, Meta Ads, Ventas, Opiniones y Competencia.
                Entrega plan de acción concreto para los próximos 30 días.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateOverviewAnalysis}
                disabled={generatingOverviewAnalysis}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                {generatingOverviewAnalysis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cruzando datos de todas las pestañas...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Análisis Integral
                  </>
                )}
              </Button>
              {overviewAnalysisError && (
                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No se pudo generar el análisis</p>
                    <p className="text-xs mt-1">{overviewAnalysisError}</p>
                    {overviewAnalysisError.toLowerCase().includes('ai analysis is not enabled') && (
                      <p className="text-xs mt-2">
                        Falta configurar <code className="px-1 bg-red-100 rounded">OPENROUTER_API_KEY</code> en <code className="px-1 bg-red-100 rounded">backend/.env</code>.
                      </p>
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Nota: este análisis tarda ~10-20 segundos porque recopila datos en vivo de 6 áreas
                (GA4, Instagram, Meta Ads, Reservas, Reviews y Competidores) antes de pedirle a la IA
                que los integre.
              </p>
            </CardContent>
          </Card>

          {/* Resultados Análisis Integral */}
          {overviewAnalysisAI && (
            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                  Análisis Integral - Resultados
                </CardTitle>
                <CardDescription>
                  Generado por {overviewAnalysisAI.model || 'IA'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: overviewAnalysisAI.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
                      .replace(/\n\n/g, '</p><p class="mt-2">')
                  }} />
                </div>
                {overviewAnalysisAI.input_tokens && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <p>
                      Tokens: {overviewAnalysisAI.input_tokens.toLocaleString()} entrada,{' '}
                      {overviewAnalysisAI.output_tokens.toLocaleString()} salida
                      {overviewAnalysisAI.latency_ms && ` • ${(overviewAnalysisAI.latency_ms / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Análisis legacy + Calendario de Contenido (si se generaron con "Generar con IA" del header) */}
          {ai_analysis && (
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                  Análisis IA - Resumen Ejecutivo (legacy)
                </CardTitle>
                <CardDescription>
                  Versión simplificada generada con el botón "Generar con IA" del header
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {ai_analysis.content}
                </div>
              </CardContent>
            </Card>
          )}

          {content_calendar && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Calendar className="h-4 w-4 mr-2 text-blue-600" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
