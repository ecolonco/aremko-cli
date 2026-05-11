import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  // Rutas de dashboard
  const isDashboardRoute = nextUrl.pathname.startsWith('/dashboard');

  // Manejar ruta raíz
  if (nextUrl.pathname === '/') {
    if (isLoggedIn) {
      const user = req.auth?.user;
      let dashboardPath = '/dashboard/jorge'; // Default

      if (user?.username === 'deborah') {
        dashboardPath = '/dashboard/deborah';
      } else if (user?.username === 'angelica') {
        dashboardPath = '/dashboard/angelica';
      } else if (user?.username === 'ernesto') {
        dashboardPath = '/dashboard/ernesto';
      }

      return NextResponse.redirect(new URL(dashboardPath, nextUrl.origin));
    } else {
      return NextResponse.redirect(new URL('/login', nextUrl.origin));
    }
  }

  // Si no está logueado y trata de acceder a dashboard, redirigir a login
  if (isDashboardRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si está logueado y trata de acceder a login, redirigir a su dashboard
  if (isLoggedIn && nextUrl.pathname === '/login') {
    const user = req.auth?.user;
    let dashboardPath = '/dashboard/jorge'; // Default

    if (user?.username === 'deborah') {
      dashboardPath = '/dashboard/deborah';
    } else if (user?.username === 'angelica') {
      dashboardPath = '/dashboard/angelica';
    } else if (user?.username === 'ernesto') {
      dashboardPath = '/dashboard/ernesto';
    }

    return NextResponse.redirect(new URL(dashboardPath, nextUrl.origin));
  }

  // Verificar permisos de acceso a dashboards específicos
  if (isDashboardRoute && isLoggedIn) {
    const user = req.auth?.user;
    const dashboardUser = nextUrl.pathname.split('/dashboard/')[1]?.split('/')[0];

    if (dashboardUser && user) {
      // Superadmins tienen acceso a todo
      if (user.role === 'superadmin') {
        return NextResponse.next();
      }

      // Admins solo tienen acceso a su propio dashboard
      if (user.role === 'admin' && user.username !== dashboardUser) {
        // Redirigir a su dashboard
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
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
