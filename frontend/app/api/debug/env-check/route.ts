import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Diagnóstico TEMPORAL: indica si las variables LOGIN_PW_* están definidas
// en el servidor. NUNCA expone el valor — solo si existe y su largo (útil
// para detectar espacios/comillas accidentales). Detrás del login.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const keys = [
    'LOGIN_PW_JORGE',
    'LOGIN_PW_ANGELICA',
    'LOGIN_PW_DEBORAH',
    'LOGIN_PW_ERNESTO',
  ];

  const status = Object.fromEntries(
    keys.map((k) => {
      const v = process.env[k];
      return [
        k,
        {
          definida: typeof v === 'string' && v.length > 0,
          largo: v?.length ?? 0,
          espaciosAlBorde: v ? v !== v.trim() : false,
        },
      ];
    })
  );

  return NextResponse.json({ status, nodeEnv: process.env.NODE_ENV });
}
