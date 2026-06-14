'use client';

// Formulario de control del Agente IA de WhatsApp (H-007, Fase 1).
// Proxy a Django (config singleton). Fase 1 = solo BORRADOR: el agente sugiere
// la respuesta en la conversación; Deborah la revisa y envía. NO auto-envía.

import { useEffect, useState } from 'react';
import { Bot, Loader2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchAgenteConfig, saveAgenteConfig } from '../bandeja/api';
import type { AgenteConfig } from '../bandeja/types';

const MODOS: { value: string; label: string; hint: string }[] = [
  { value: 'borrador', label: 'Borrador (Fase 1)', hint: 'Sugiere; Deborah revisa y envía. No auto-envía. (Recomendado para empezar)' },
  { value: 'auto_info', label: 'Auto solo informativo (Fase 2)', hint: 'Auto-responde info pura; escala a humano lo transaccional.' },
  { value: 'auto', label: 'Auto completo (Fase 3)', hint: 'Responde automáticamente dentro de su alcance.' },
];

export default function AgenteIAPage() {
  const [cfg, setCfg] = useState<AgenteConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  // ¿el usuario editó el Conocimiento? Si NO, al guardar re-leemos el valor del
  // servidor para no pisar reglas aprobadas desde "Aprendizaje del agente".
  const [conocimientoDirty, setConocimientoDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCfg(await fetchAgenteConfig());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la config');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const set = <K extends keyof AgenteConfig>(k: K, v: AgenteConfig[K]) => {
    setCfg((c) => (c ? { ...c, [k]: v } : c));
    setOk(false);
  };

  const guardar = async () => {
    if (!cfg || guardando) return;
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      // Si no tocaste el Conocimiento, re-leemos el valor actual del servidor
      // (puede tener reglas recién aprobadas) para NO pisarlas al guardar.
      let conocimiento = cfg.conocimiento;
      if (!conocimientoDirty) {
        try {
          const fresh = await fetchAgenteConfig();
          conocimiento = fresh.conocimiento ?? cfg.conocimiento;
        } catch {
          /* si falla, usamos el que tenemos */
        }
      }
      const saved = await saveAgenteConfig({
        activo: cfg.activo,
        modo: cfg.modo,
        persona_tono: cfg.persona_tono,
        link_reserva: cfg.link_reserva,
        model_name: cfg.model_name,
        temperature: cfg.temperature,
        max_tokens: cfg.max_tokens,
        history_window: cfg.history_window,
        pausa_horas_tras_humano: cfg.pausa_horas_tras_humano,
        ausencia_activa: cfg.ausencia_activa,
        ausencia_mensaje: cfg.ausencia_mensaje,
        ausencia_anti_spam_horas: cfg.ausencia_anti_spam_horas,
        conocimiento,
      });
      setCfg(saved);
      setConocimientoDirty(false);
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const label = 'block text-sm font-medium text-gray-700';
  const inputCls =
    'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:ring-violet-500';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Bot className="h-6 w-6 text-violet-600" />
        Agente IA de WhatsApp
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Responde solo sobre los <strong>servicios publicados</strong> y los{' '}
        <strong>productos con stock</strong> de Aremko. <strong>Fase 1 = borrador:</strong> el agente
        sugiere la respuesta en la conversación y Deborah la revisa antes de enviar.
      </p>

      {cargando ? (
        <div className="flex justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !cfg ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error || 'No hay configuración disponible (¿falta correr la migración en Django?).'}</span>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {/* Mensaje de ausencia (H-008) */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-amber-900">🌙 Mensaje de ausencia</div>
                <div className="text-xs text-amber-700">
                  {cfg.ausencia_activa
                    ? 'ACTIVO — a cada cliente que escribe se le responde la frase fija (no la IA ni Deborah).'
                    : 'Apagado — los mensajes se atienden normal.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => set('ausencia_activa', !cfg.ausencia_activa)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
                  cfg.ausencia_activa ? 'bg-amber-500' : 'bg-gray-300'
                }`}
                aria-pressed={cfg.ausencia_activa}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    cfg.ausencia_activa ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-amber-900">Texto que se envía</label>
              <textarea
                value={cfg.ausencia_mensaje ?? ''}
                onChange={(e) => set('ausencia_mensaje', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div className="mt-3 flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-amber-900">No repetir por (horas)</label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  value={cfg.ausencia_anti_spam_horas ?? 6}
                  onChange={(e) => set('ausencia_anti_spam_horas', Number(e.target.value))}
                  className="mt-1 w-24 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>
              <p className="pb-2 text-[11px] text-amber-700">
                0 = responder a cada mensaje. Recomendado 4-6h.
              </p>
            </div>
            <p className="mt-2 text-[11px] font-medium text-amber-800">
              ⚠️ Acuérdate de presionar <strong>Guardar</strong> (abajo) para aplicar.
            </p>
          </div>

          {/* On / Off */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">Agente activo</div>
              <div className="text-xs text-gray-500">
                {cfg.activo ? 'Encendido — genera sugerencias.' : 'Apagado — no genera nada.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => set('activo', !cfg.activo)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
                cfg.activo ? 'bg-violet-600' : 'bg-gray-300'
              }`}
              aria-pressed={cfg.activo}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  cfg.activo ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Modo */}
          <div>
            <label className={label}>Modo</label>
            <select value={cfg.modo} onChange={(e) => set('modo', e.target.value)} className={inputCls}>
              {MODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {MODOS.find((m) => m.value === cfg.modo)?.hint}
            </p>
          </div>

          {/* Tono / persona */}
          <div>
            <label className={label}>Tono / personalidad (voz de marca)</label>
            <textarea
              value={cfg.persona_tono}
              onChange={(e) => set('persona_tono', e.target.value)}
              rows={4}
              placeholder="Ej: Cálido y cercano, español de Chile. Asistente de Aremko Spa Boutique, Puerto Varas — aguas calientes junto al río."
              className={inputCls}
            />
          </div>

          {/* Conocimiento / correcciones (H-009a) */}
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
            <label className={label}>📚 Conocimiento y correcciones del agente</label>
            <p className="mt-1 mb-2 text-xs text-gray-600">
              Una regla por línea. Tienen <strong>autoridad máxima</strong> (priman sobre el catálogo).
              Cada vez que el agente se equivoque, agrega una línea y deja de equivocarse.
            </p>
            <textarea
              value={cfg.conocimiento ?? ''}
              onChange={(e) => {
                set('conocimiento', e.target.value);
                setConocimientoDirty(true);
              }}
              rows={6}
              placeholder={
                'Las tinas se cobran POR PERSONA, capacidad 1 a 4 personas. Tina Calbuco: $25.000 por persona; siempre aclara que es por persona y la capacidad.\n' +
                'No ofrecer el producto Cacao por este chat.\n' +
                'Solo masajes de relajación y descontracturante se reservan online; el resto se coordina por WhatsApp.'
              }
              className={inputCls}
            />
          </div>

          {/* Link de reserva */}
          <div>
            <label className={label}>Link de reserva (al que deriva)</label>
            <input
              type="text"
              value={cfg.link_reserva}
              onChange={(e) => set('link_reserva', e.target.value)}
              placeholder="https://www.aremko.cl/..."
              className={inputCls}
            />
          </div>

          {/* Modelo */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Modelo (OpenRouter)</label>
              <input
                type="text"
                value={cfg.model_name}
                onChange={(e) => set('model_name', e.target.value)}
                placeholder="(vacío = usa el modelo por defecto)"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                Efectivo: <span className="font-mono">{cfg.modelo_efectivo || '—'}</span>
              </p>
            </div>
            <div>
              <label className={label}>Temperatura</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={cfg.temperature}
                onChange={(e) => set('temperature', Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Parámetros avanzados */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Máx tokens</label>
              <input
                type="number"
                min="1"
                value={cfg.max_tokens}
                onChange={(e) => set('max_tokens', Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={label}>Historial (mensajes)</label>
              <input
                type="number"
                min="0"
                value={cfg.history_window}
                onChange={(e) => set('history_window', Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={label}>Pausa tras humano (h)</label>
              <input
                type="number"
                min="0"
                value={cfg.pausa_horas_tras_humano}
                onChange={(e) => set('pausa_horas_tras_humano', Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">Versión del prompt: {String(cfg.prompt_version)}</p>

          {/* Guardar */}
          <div className="flex items-center gap-3">
            <button
              onClick={guardar}
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
            {ok && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Guardado
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" /> {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
