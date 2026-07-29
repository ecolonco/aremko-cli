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
import {
  MessageSquare,
  MessageCircle,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Camera as InstagramIcon,
  Lock,
} from 'lucide-react';
import { ConversacionWhatsApp } from '../bandeja/ConversacionWhatsApp';
import { ConversacionInstagram } from '../bandeja/ConversacionInstagram';
import {
  telefonoE164,
  fetchConversacionesInbox,
} from '../bandeja/api';
import type { ConversacionResumen, CanalMensaje } from '../bandeja/types';

// Canal + id externo de una conversación (la identidad cruza canales).
const canalDe = (c: ConversacionResumen): CanalMensaje => c.canal || 'whatsapp';
// En WhatsApp el id es el teléfono E.164 (con "+", como lo indexan los endpoints
// legacy de WA); en Instagram es el IGSID (external_id).
const extDe = (c: ConversacionResumen): string =>
  canalDe(c) === 'whatsapp' ? c.phone || c.external_id || '' : c.external_id || '';

// Candado 🔒 en la lista: para IG/Messenger, si el último mensaje (de cualquier
// dirección) tiene más de 24h, la ventana de Meta está cerrada con certeza (el
// último ENTRANTE es aún más antiguo). Regla conservadora: si respondimos hace
// poco no lo sabemos con seguridad, así que no marcamos (no sobre-avisamos).
const VENTANA_24H_MS = 24 * 60 * 60 * 1000;
const fueraDeVentana = (c: ConversacionResumen): boolean => {
  const canal = canalDe(c);
  if (canal !== 'instagram' && canal !== 'messenger') return false;
  const t = Date.parse(c.ultimo_timestamp);
  if (Number.isNaN(t)) return false;
  return Date.now() - t >= VENTANA_24H_MS;
};

// Número piloto de Meta (sandbox) con el que validamos el end-to-end.
const PILOTO = '+56958655810';
const POLL_MS = 30_000;

const horaCorta = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
};

export default function MensajesWhatsAppPage() {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(false);
  // Conversación activa identificada por (canal, external_id), no por phone.
  const [activo, setActivo] = useState<{ canal: CanalMensaje; externalId: string } | null>(null);
  const [input, setInput] = useState('');
  // En desktop mostramos las dos columnas y abrimos el primer hilo solo;
  // en móvil trabajamos una pantalla a la vez (lista ↔ conversación).
  const [esDesktop, setEsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setEsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // --- Alerta sonora de mensajes nuevos ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Contador de "sin responder" por conversación en el poll anterior, para
  // detectar cuándo llega algo nuevo comparando entre recargas.
  const conteosPrevRef = useRef<Map<string, number> | null>(null);

  // Crea/reactiva el AudioContext. Los navegadores exigen un gesto del usuario
  // para habilitar audio, por eso lo "desbloqueamos" en el primer clic/tecla.
  const obtenerAudio = useCallback((): AudioContext | null => {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  // Alerta sonora TURBO de mensaje nuevo: triple "ding-dong" con 3 voces por
  // nota (sierra + cuadrada + sub-octava) a través de un limitador + makeup gain
  // alto, para que corte la música de fondo de la recepción sin distorsionar.
  const reproducirAlerta = useCallback(() => {
    try {
      const ctx = obtenerAudio();
      if (!ctx) return;
      // Limitador agresivo + makeup alto: máximo volumen percibido sin clip sucio.
      // Toda la señal de la alerta sale por acá.
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -24;
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.002;
      lim.release.value = 0.15;
      const makeup = ctx.createGain();
      makeup.gain.value = 2.6;
      lim.connect(makeup);
      makeup.connect(ctx.destination);

      // Cada nota = 3 voces apiladas para más cuerpo y presencia sobre la música.
      const nota = (freq: number, t: number, dur: number) => {
        const voces: Array<{ type: OscillatorType; f: number; g: number }> = [
          { type: 'sawtooth', f: freq, g: 0.9 },
          { type: 'square', f: freq, g: 0.5 },
          { type: 'sine', f: freq / 2, g: 0.7 }, // sub-octava para cuerpo
        ];
        for (const v of voces) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = v.type;
          osc.frequency.setValueAtTime(v.f, t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(v.g, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(gain);
          gain.connect(lim);
          osc.start(t);
          osc.stop(t + dur);
        }
      };

      const patron = [988, 1319]; // B5 + E6, agudos que cortan el fondo musical
      const pulso = 0.16;
      const gap = 0.06;
      let t = ctx.currentTime;
      for (let rep = 0; rep < 3; rep++) {
        for (const freq of patron) {
          nota(freq, t, pulso);
          t += pulso + gap;
        }
        t += 0.12; // respiro entre repeticiones
      }
    } catch {
      /* audio no disponible */
    }
  }, [obtenerAudio]);

  // Desbloqueo del audio al primer gesto del usuario (política de autoplay).
  useEffect(() => {
    const desbloquear = () => obtenerAudio();
    window.addEventListener('pointerdown', desbloquear);
    window.addEventListener('keydown', desbloquear);
    return () => {
      window.removeEventListener('pointerdown', desbloquear);
      window.removeEventListener('keydown', desbloquear);
    };
  }, [obtenerAudio]);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      try {
        const data = await fetchConversacionesInbox(soloPendientes, 100);
        const lista = data.conversations || [];

        // Contador de "sin responder" por conversación en este poll.
        const conteos = new Map<string, number>();
        for (const c of lista) {
          conteos.set(`${canalDe(c)}:${extDe(c)}`, c.sin_responder || 0);
        }
        // Solo sonamos en recargas silenciosas (el polling en vivo): si alguna
        // conversación tiene más pendientes que antes, o aparece una nueva con
        // pendientes, llegó un mensaje. La carga inicial, el botón "Refrescar" y
        // el cambio de filtro son NO silenciosos → solo fijan la línea base sin
        // sonar, para no alertar por mensajes que ya estaban ahí.
        const previos = conteosPrevRef.current;
        if (silencioso && previos) {
          let hayNuevo = false;
          conteos.forEach((n, key) => {
            if (n > (previos.get(key) || 0)) hayNuevo = true;
          });
          if (hayNuevo) reproducirAlerta();
        }
        conteosPrevRef.current = conteos;

        setConversaciones(lista);
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al cargar conversaciones');
      } finally {
        setCargando(false);
      }
    },
    [soloPendientes, reproducirAlerta]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Auto-refresco de la lista (bandeja de entrada en vivo).
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const id = setInterval(() => cargarRef.current(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Abre el primer hilo automáticamente SOLO en desktop (en móvil se parte en la
  // lista, igual que WhatsApp, y el usuario elige a quién abrir).
  useEffect(() => {
    if (esDesktop && !activo && conversaciones.length > 0) {
      const c = conversaciones[0];
      setActivo({ canal: canalDe(c), externalId: extDe(c) });
    }
  }, [conversaciones, activo, esDesktop]);

  const abrirNumero = (raw: string) => {
    const phone = telefonoE164(raw);
    if (!phone) return;
    setActivo({ canal: 'whatsapp', externalId: phone });
    setInput('');
  };

  const convActiva = activo
    ? conversaciones.find((c) => canalDe(c) === activo.canal && extDe(c) === activo.externalId)
    : undefined;
  const nombreActivo =
    convActiva?.cliente_nombre || convActiva?.contact_name || activo?.externalId || '';

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-6">
      <div className="flex flex-shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-3xl">
            <MessageSquare className="h-6 w-6 flex-shrink-0 text-emerald-600 md:h-7 md:w-7" />
            <InstagramIcon className="-ml-1 h-5 w-5 flex-shrink-0 text-pink-500 md:h-6 md:w-6" />
            <MessageCircle className="-ml-1 h-5 w-5 flex-shrink-0 text-blue-600 md:h-6 md:w-6" />
            Mensajes
          </h2>
          <p className="mt-1 hidden text-sm text-muted-foreground md:block">
            Bandeja unificada de <strong>WhatsApp</strong>, <strong>Instagram</strong> y{' '}
            <strong>Messenger</strong> — respondés los tres canales desde acá. Instagram y Messenger
            solo dentro de las 24 h del último mensaje del cliente. Lo de WhatsApp queda en la ficha
            del cliente.
          </p>
        </div>
        <Button onClick={() => cargar()} variant="outline" size="sm" disabled={cargando}>
          <RefreshCw className={`mr-0 h-4 w-4 md:mr-2 ${cargando ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Refrescar</span>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Columna izquierda: bandeja de entrada (en móvil ocupa todo; se oculta al abrir un hilo) */}
        <Card
          className={`${
            activo ? 'hidden md:flex' : 'flex'
          } w-full min-h-0 flex-col md:w-80 md:flex-shrink-0`}
        >
          <CardHeader className="flex-shrink-0 pb-3">
            <CardTitle className="text-sm">Conversaciones</CardTitle>
            <CardDescription className="text-xs">
              {cargando
                ? 'Cargando…'
                : `${conversaciones.length} ${soloPendientes ? 'pendientes' : 'en total'}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-3">
            {/* Buscador para abrir cualquier número */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                abrirNumero(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Abrir por teléfono…"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Button type="submit" size="sm" disabled={!input.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </form>

            {/* Filtro solo pendientes */}
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={soloPendientes}
                onChange={(e) => setSoloPendientes(e.target.checked)}
                className="rounded border-slate-300"
              />
              Solo las que esperan respuesta
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : cargando ? (
              <div className="flex justify-center py-6 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : conversaciones.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                {soloPendientes
                  ? 'No hay conversaciones pendientes de respuesta.'
                  : 'Aún no hay conversaciones registradas.'}
              </p>
            ) : (
              <ul className="-mx-2 min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                {conversaciones.map((c) => {
                  const canal = canalDe(c);
                  const ext = extDe(c);
                  const sel = !!activo && activo.canal === canal && activo.externalId === ext;
                  const titulo = c.cliente_nombre || c.contact_name || c.phone || ext;
                  return (
                    <li key={`${canal}:${ext}`}>
                      <button
                        type="button"
                        onClick={() => setActivo({ canal, externalId: ext })}
                        className={`flex w-full flex-col gap-0.5 px-2 py-2 text-left transition ${
                          sel ? 'bg-emerald-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {canal === 'instagram' ? (
                              <InstagramIcon className="h-3.5 w-3.5 flex-shrink-0 text-pink-500" />
                            ) : canal === 'messenger' ? (
                              <MessageCircle className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                            )}
                            <span
                              className={`truncate text-sm ${
                                c.sin_responder > 0
                                  ? 'font-semibold text-slate-900'
                                  : 'font-medium text-slate-700'
                              }`}
                            >
                              {titulo}
                            </span>
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-1 text-[10px] text-slate-400">
                            {fueraDeVentana(c) && (
                              <span title="Fuera de la ventana de 24 h — respóndele desde la app de Instagram/Messenger">
                                <Lock className="h-3 w-3 text-amber-500" />
                              </span>
                            )}
                            {horaCorta(c.ultimo_timestamp)}
                          </span>
                        </div>
                        {canal === 'whatsapp' && c.cliente_nombre && (
                          <span className="truncate pl-5 font-mono text-[10px] text-slate-400">
                            {c.phone}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-500">
                            {c.ultimo_direction === 'out' ? 'Tú: ' : ''}
                            {c.ultimo_mensaje}
                          </span>
                          {c.sin_responder > 0 && (
                            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                              {c.sin_responder}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Columna derecha: hilo + responder (en móvil ocupa todo al abrir un hilo) */}
        <div
          className={`${
            activo ? 'flex' : 'hidden md:flex'
          } min-h-0 min-w-0 flex-1`}
        >
          {activo ? (
            activo.canal === 'instagram' || activo.canal === 'messenger' ? (
              <ConversacionInstagram
                key={`${activo.canal}:${activo.externalId}`}
                canal={activo.canal}
                externalId={activo.externalId}
                nombre={nombreActivo}
                onReplySent={() => cargar(true)}
                onAtendido={() => cargar(true)}
                onVolver={() => setActivo(null)}
              />
            ) : (
              <ConversacionWhatsApp
                key={`wa:${activo.externalId}`}
                telefono={activo.externalId}
                nombre={nombreActivo}
                onReplySent={() => cargar(true)}
                onNombreEditado={() => cargar(true)}
                onAtendido={() => cargar(true)}
                onVolver={() => setActivo(null)}
              />
            )
          ) : (
            <Card className="flex w-full items-center justify-center">
              <CardContent className="py-12 text-center text-sm text-slate-400">
                Elige una conversación o ábrela por teléfono.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
