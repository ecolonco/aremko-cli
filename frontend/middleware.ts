import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Rutas que requieren autenticación
  const isProtectedRoute = nextUrl.pathname.startsWith('/dashboard');

  // Si no está logueado e intenta acceder a una ruta protegida
  if (!isLoggedIn && isProtectedRoute) {
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si está logueado y está en login, redirigir a dashboard
  if (isLoggedIn && nextUrl.pathname === '/login') {
    const user = req.auth?.user;
    let dashboardPath = '/dashboard/jorge';

    if (user?.username === 'deborah') {
      dashboardPath = '/dashboard/deborah';
    } else if (user?.username === 'angelica') {
      dashboardPath = '/dashboard/angelica';
    } else if (user?.username === 'ernesto') {
      dashboardPath = '/dashboard/ernesto';
    }

    return NextResponse.redirect(new URL(dashboardPath, nextUrl.origin));
  }

  // Si está logueado y está en la raíz, redirigir a dashboard
  if (isLoggedIn && nextUrl.pathname === '/') {
    const user = req.auth?.user;
    let dashboardPath = '/dashboard/jorge';

    if (user?.username === 'deborah') {
      dashboardPath = '/dashboard/deborah';
    } else if (user?.username === 'angelica') {
      dashboardPath = '/dashboard/angelica';
    } else if (user?.username === 'ernesto') {
      dashboardPath = '/dashboard/ernesto';
    }

    return NextResponse.redirect(new URL(dashboardPath, nextUrl.origin));
  }

  // Si no está logueado y está en la raíz, redirigir a login
  if (!isLoggedIn && nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  // Excepción: la Bandeja WhatsApp de Operación Vuelta a Casa es compartida —
  // cualquier operador autenticado (Deborah, Angélica, Ernesto, Jorge) puede
  // trabajarla. El backend registra el username de quien actúa, así medimos
  // desempeño por persona.
  if (
    isLoggedIn &&
    nextUrl.pathname.startsWith('/dashboard/jorge/perfiles/bandeja')
  ) {
    return NextResponse.next();
  }

  // Verificar permisos de acceso a dashboards específicos
  if (isProtectedRoute && isLoggedIn) {
    const user = req.auth?.user;
    const dashboardUser = nextUrl.pathname.split('/dashboard/')[1]?.split('/')[0];

    if (dashboardUser && user) {
      // Superadmins tienen acceso a todo
      if (user.role === 'superadmin') {
        return NextResponse.next();
      }

      // Admins solo tienen acceso a su propio dashboard
      if (user.role === 'admin' && user.username !== dashboardUser) {
        return NextResponse.redirect(
          new URL(`/dashboard/${user.username}`, nextUrl.origin)
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - images and media files
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
