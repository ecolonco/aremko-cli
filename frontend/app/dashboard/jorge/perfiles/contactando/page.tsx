'use client';

// Página "Contactando": Deborah pega el número de un cliente y dispara una
// PLANTILLA aprobada de WhatsApp. Uso principal: reabrir el chat de clientes
// antiguos que —tras migrar el número a la Cloud API— ven "esta cuenta no tiene
// WhatsApp" y no pueden escribir primero. Al recibir la plantilla, su teléfono
// reabre la conversación. En frío SOLO se permite plantilla aprobada (regla de
// Meta); por eso se elige entre plantillas, y una admite una línea editable.

import { useMemo, useState } from 'react';

const apiBase = () =>
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080';

interface TemplateOption {
  name: string; // nombre exacto en Meta
  label: string; // etiqueta en el selector
  editable: boolean; // ¿tiene una línea {{1}} editable?
  render: (linea: string) => string; // texto final mostrado/registrado
}

const TEMPLATES: TemplateOption[] = [
  {
    name: 'contacto_general',
    label: 'Mensaje general (texto fijo)',
    editable: false,
    render: () =>
      '¡Hola! 👋 Te escribimos de Aremko Spa Boutique, Puerto Varas.\n' +
      'Cualquier servicio que necesites coordinar, escríbenos por aquí y con gusto te ayudamos. 🌿',
  },
  {
    name: 'contacto_editable',
    label: 'Mensaje con línea editable',
    editable: true,
    render: (linea: string) =>
      '¡Hola! 👋 Te saluda Aremko Spa Boutique, Puerto Varas.\n' +
      (linea.trim() || '...') +
      '\nEscríbenos por aquí y coordinamos lo que necesites. 🌿',
  },
];

// Normaliza un número chileno a formato E.164 sin '+': deja solo dígitos; si
// trae 9 dígitos partiendo en 9 (celular), antepone 56; si ya parte en 56, lo
// deja. Devuelve '' si no parece válido.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Un celular chileno es EXACTAMENTE 56 9 XXXX XXXX = 11 dígitos. Antes se
  // aceptaba cualquier cosa que partiera con 56: el 2026-08-19 salió un envío a
  // un número de 10 dígitos (le faltaba uno) — Meta lo aceptó y lo dio por
  // fallido, y la operadora solo vio "Enviado ✓". Ahora se rechaza antes.
  if (digits.startsWith('56')) return digits.length === 11 && digits[2] === '9' ? digits : '';
  if (digits.length === 9 && digits.startsWith('9')) return '56' + digits;
  if (digits.length === 8) return '569' + digits; // sin el 9 inicial
  return '';
}

interface SendResult {
  ok: boolean;
  phone: string;
  message?: string;
}

export default function ContactandoPage() {
  const [templateName, setTemplateName] = useState(TEMPLATES[0].name);
  const [linea, setLinea] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);

  const template = useMemo(
    () => TEMPLATES.find((t) => t.name === templateName) ?? TEMPLATES[0],
    [templateName]
  );
  const preview = template.render(linea);
  const normalized = normalizePhone(phone);

  const enviar = async () => {
    if (!normalized || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase()}/api/v1/whatsapp/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: normalized,
          template_name: template.name,
          lang: 'es',
          text: template.editable ? linea.trim() : '',
          display_text: preview,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const ok = res.ok && json.success !== false;
      setResults((prev) => [
        {
          ok,
          phone: normalized,
          message: ok ? 'Enviado ✓' : json.error || `Error HTTP ${res.status}`,
        },
        ...prev,
      ]);
      if (ok) setPhone(''); // limpia para pegar el siguiente
    } catch (e) {
      setResults((prev) => [
        { ok: false, phone: normalized, message: e instanceof Error ? e.message : 'Error de red' },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900">Contactando</h1>
      <p className="mt-1 text-sm text-gray-600">
        Pega el número de un cliente y presiona <strong>Enviar</strong>. Le llega un mensaje de
        plantilla que reabre el chat (sirve para los clientes que ven “esta cuenta no tiene
        WhatsApp”). Cuando el cliente responde, sigues la conversación normal en la Bandeja.
      </p>

      {/* Selector de plantilla */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">Plantilla</label>
        <select
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-emerald-500"
        >
          {TEMPLATES.map((t) => (
            <option key={t.name} value={t.name}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Línea editable (solo plantilla editable) */}
      {template.editable && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Línea personalizada
          </label>
          <textarea
            value={linea}
            onChange={(e) => setLinea(e.target.value)}
            rows={2}
            placeholder="Ej: Vimos que nos visitas pronto — quedamos atentos a lo que necesites."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>
      )}

      {/* Preview del mensaje */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Vista previa</label>
        <div className="mt-1 whitespace-pre-line rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-gray-800">
          {preview}
        </div>
      </div>

      {/* Número + Enviar */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Número del cliente</label>
        <div className="mt-1 flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviar();
            }}
            placeholder="+56 9 1234 5678"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-emerald-500"
          />
          <button
            onClick={enviar}
            disabled={!normalized || sending}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {phone && (
          <p className="mt-1 text-xs text-gray-500">
            Se enviará a: <span className="font-mono">{normalized || '— número no válido —'}</span>
          </p>
        )}
      </div>

      {/* Historial de envíos de esta sesión */}
      {results.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700">Enviados en esta sesión</h2>
          <ul className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200">
            {results.map((r, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-mono text-gray-800">{r.phone}</span>
                <span className={r.ok ? 'text-emerald-700' : 'text-red-600'}>{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
