import { NextResponse } from 'next/server';

// Diagnóstico TEMPORAL: indica si las variables LOGIN_PW_* están definidas
// en el servidor. NUNCA expone el valor — solo si existe y su largo (útil
// para detectar espacios/comillas accidentales). Protegido por una clave
// temporal en la URL (?k=aremko-diag) para no depender de la sesión.
export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get('k');
  if (k !== 'aremko-diag') {
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

  const secretos = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    LUNA_API_KEY: !!process.env.LUNA_API_KEY,
  };

  return NextResponse.json({ status, secretos, nodeEnv: process.env.NODE_ENV });
}
