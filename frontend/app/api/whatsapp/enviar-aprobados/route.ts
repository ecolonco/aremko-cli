import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Proxy server-side (detrás del login del dashboard) para disparar el envío de
// plantillas APROBADAS (H-012). El mass-send NO queda expuesto público: solo un
// usuario logueado puede llegar acá, y la X-API-Key (server-only) se agrega aquí
// para llamar al endpoint keyed del backend (`run-template-campaign`).
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  const key = process.env.LUNA_API_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { error: 'Falta configurar LUNA_API_KEY (o API URL) en el servidor.' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${base}/api/v1/whatsapp/run-template-campaign`, {
      method: 'POST',
      headers: { 'X-API-Key': key },
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de red' },
      { status: 502 }
    );
  }
}
