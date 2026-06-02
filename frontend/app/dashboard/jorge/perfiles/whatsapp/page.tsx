'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Search, Phone, Info, X } from 'lucide-react';
import { ConversacionWhatsApp } from '../bandeja/ConversacionWhatsApp';
import { telefonoE164 } from '../bandeja/api';

// Número piloto de Meta (sandbox) con el que ya validamos el end-to-end.
const PILOTO = '+56958655810';
const LS_KEY = 'wa_inbox_recientes';

export default function MensajesWhatsAppPage() {
  const [input, setInput] = useState('');
  const [activo, setActivo] = useState<string>('');
  const [recientes, setRecientes] = useState<string[]>([]);

  // Cargar recientes de localStorage + abrir el piloto por defecto.
  useEffect(() => {
    let guardados: string[] = [];
    try {
      guardados = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
      guardados = [];
    }
    if (!guardados.includes(PILOTO)) guardados = [PILOTO, ...guardados];
    setRecientes(guardados);
    setActivo(PILOTO);
  }, []);

  const abrir = useCallback((raw: string) => {
    const phone = telefonoE164(raw);
    if (!phone) return;
    setActivo(phone);
    setInput('');
    setRecientes((prev) => {
      const next = [phone, ...prev.filter((p) => p !== phone)].slice(0, 12);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* localStorage no disponible: seguimos en memoria */
      }
      return next;
    });
  }, []);

  const quitarReciente = (phone: string) => {
    setRecientes((prev) => {
      const next = prev.filter((p) => p !== phone);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <MessageSquare className="h-7 w-7 text-emerald-600" />
          Mensajes WhatsApp
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversaciones que entran y salen por la <strong>Cloud API oficial</strong> de
          Aremko. Lo que respondas acá se envía desde el WhatsApp del negocio y queda
          guardado en la ficha del cliente.
        </p>
      </div>

      {/* Aviso de etapa: bandeja interina */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <strong>Etapa piloto.</strong> Por ahora abres una conversación por número.
          El listado automático de mensajes nuevos (cola <em>requiere atención</em>) se
          activa cuando Django exponga el endpoint de conversaciones. Mientras tanto, el
          número piloto ya está cargado abajo para que pruebes ver y responder.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* Columna izquierda: buscador + recientes */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Abrir conversación</CardTitle>
            <CardDescription className="text-xs">
              Ingresa el teléfono del cliente (con o sin +).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                abrir(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Button type="submit" size="sm" disabled={!input.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </form>

            {recientes.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Recientes
                </p>
                <ul className="space-y-1">
                  {recientes.map((p) => (
                    <li key={p} className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => abrir(p)}
                        className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                          p === activo
                            ? 'bg-emerald-50 font-medium text-emerald-800'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <span className="truncate">{p}</span>
                        {p === PILOTO && (
                          <span className="ml-auto rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                            piloto
                          </span>
                        )}
                      </button>
                      {p !== PILOTO && (
                        <button
                          type="button"
                          onClick={() => quitarReciente(p)}
                          className="ml-1 rounded p-1 text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100"
                          title="Quitar de recientes"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Columna derecha: hilo + responder */}
        <div>
          {activo ? (
            <ConversacionWhatsApp
              key={activo}
              telefono={activo}
              nombre={activo}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-slate-400">
                Ingresa un teléfono para abrir la conversación.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
