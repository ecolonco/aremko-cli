'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Link2, CheckCircle2, AlertTriangle, Copy } from 'lucide-react';

// App de Meta: aremko-wa2.
const DEFAULT_APP_ID = '1652095726067095';
// featureType de coexistencia (editable por si Meta lo maneja vía config_id).
const DEFAULT_FEATURE_TYPE = 'whatsapp_business_app_onboarding';

interface SignupResult {
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
}

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export default function WhatsAppCoexistenciaPage() {
  const [appId] = useState(DEFAULT_APP_ID);
  const [configId, setConfigId] = useState('');
  const [featureType, setFeatureType] = useState(DEFAULT_FEATURE_TYPE);
  const [sdkReady, setSdkReady] = useState(false);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [code, setCode] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const appIdRef = useRef(appId);

  const addLog = useCallback((m: string) => {
    setLog((l) => [...l, `${new Date().toISOString().slice(11, 19)} · ${m}`]);
  }, []);

  // Cargar el SDK de Facebook una vez.
  useEffect(() => {
    if (document.getElementById('fb-jssdk')) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: appIdRef.current,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkReady(true);
    };
    const s = document.createElement('script');
    s.id = 'fb-jssdk';
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    document.body.appendChild(s);
  }, []);

  // Capturar el resultado del Embedded Signup (phone_number_id, waba_id).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!String(event.origin).endsWith('facebook.com')) return;
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          addLog(`WA_EMBEDDED_SIGNUP ${data.event || ''}: ${JSON.stringify(data.data || {})}`);
          if (data.data) setResult((r) => ({ ...r, ...data.data }));
        }
      } catch {
        /* mensaje ajeno al signup, ignorar */
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [addLog]);

  const lanzar = () => {
    const FB = window.FB;
    if (!FB) {
      addLog('SDK de Facebook aún no cargó');
      return;
    }
    if (!configId.trim()) {
      addLog('Falta el Configuration ID');
      return;
    }
    setResult(null);
    setCode('');
    addLog('Lanzando Embedded Signup (coexistencia)…');
    FB.login(
      (response: any) => {
        addLog('FB.login → ' + JSON.stringify(response?.authResponse || response?.status || response));
        if (response?.authResponse?.code) setCode(response.authResponse.code);
      },
      {
        config_id: configId.trim(),
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          ...(featureType.trim() ? { featureType: featureType.trim() } : {}),
          sessionInfoVersion: '3',
        },
      }
    );
  };

  const copiar = (v?: string) => {
    if (v) navigator.clipboard?.writeText(v).catch(() => {});
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Link2 className="h-7 w-7 text-emerald-600" />
          Conectar WhatsApp por coexistencia
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera el QR de Embedded Signup para conectar <strong>+56 9 5790 2525</strong> a
          la Cloud API <strong>sin perder la app</strong> de Deborah. Herramienta de
          configuración (uso único).
        </p>
      </div>

      {/* Prerrequisitos */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Antes de lanzar (config en Meta)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-amber-900">
          <p>1. En la app de Meta <strong>aremko-wa2</strong>: crear una configuración de <strong>Facebook Login for Business → WhatsApp Embedded Signup</strong> (tipo coexistencia) y pegar acá el <strong>Configuration ID</strong>.</p>
          <p>2. Whitelistar el dominio de este sitio en la app de Meta (App Domains + dominios permitidos del SDK de JS).</p>
          <p>3. Tener el celular con la SIM +56957902525 a mano para escanear el QR que aparecerá.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Configuración */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configuración</CardTitle>
            <CardDescription className="text-xs">
              SDK: {sdkReady ? '✅ cargado' : '⏳ cargando…'} · App ID: {appId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Configuration ID (de la app de Meta)
              </label>
              <input
                value={configId}
                onChange={(e) => setConfigId(e.target.value)}
                placeholder="ej. 123456789012345"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                featureType (coexistencia) — editable por si hay que afinarlo
              </label>
              <input
                value={featureType}
                onChange={(e) => setFeatureType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Si el QR no aparece, prueba vaciar este campo (coexistencia puede venir
                en la config) o ajustar el valor.
              </p>
            </div>
            <Button
              onClick={lanzar}
              disabled={!sdkReady || !configId.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Lanzar Embedded Signup (mostrar QR)
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Resultado</CardTitle>
            <CardDescription className="text-xs">
              Tras escanear el QR con la app, aquí aparece el Phone Number ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result?.phone_number_id ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="flex items-center gap-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Conectado
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Phone Number ID:</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold">
                      {result.phone_number_id}
                      <button onClick={() => copiar(result.phone_number_id)} title="Copiar">
                        <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
                      </button>
                    </span>
                  </p>
                  {result.waba_id && (
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">WABA ID:</span>
                      <span className="font-mono">{result.waba_id}</span>
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-emerald-700">
                  → Copia el Phone Number ID a Render (`WHATSAPP_PHONE_NUMBER_ID`).
                </p>
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                Aún sin resultado. Lanza el signup y escanea el QR.
              </p>
            )}
            {code && (
              <p className="break-all rounded bg-slate-50 p-2 text-[10px] text-slate-500">
                code: {code}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Log</CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-xs text-slate-400">Sin eventos aún.</p>
          ) : (
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
              {log.join('\n')}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
