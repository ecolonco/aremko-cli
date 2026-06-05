import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { canAccess, homeHref } from '@/lib/permissions';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;
  const path = nextUrl.pathname;
  const isProtectedRoute = path.startsWith('/dashboard');

  // No logueado intentando una ruta protegida → login (guardando a dónde iba)
  if (!isLoggedIn && isProtectedRoute) {
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(loginUrl);
  }

  // Logueado en /login o en la raíz → a su sección de inicio (según permisos)
  if (isLoggedIn && user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL(homeHref(user.username), nextUrl.origin));
  }

  // No logueado en la raíz → login
  if (!isLoggedIn && path === '/') {
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  // Control de acceso por permisos a las secciones del dashboard.
  // Los permisos por usuario (qué secciones puede ver/abrir) viven en
  // lib/permissions.ts, que también alimenta el Sidebar (una sola fuente).
  if (isProtectedRoute && isLoggedIn && user) {
    // La página "Sin acceso" siempre está disponible (evita loops para usuarios
    // que aún no tienen secciones asignadas, ej. Ernesto).
    if (path.startsWith('/dashboard/sin-acceso')) {
      return NextResponse.next();
    }

    if (canAccess(user.username, path)) {
      return NextResponse.next();
    }

    // Sin permiso para esta sección → a su sección de inicio (o "Sin acceso")
    return NextResponse.redirect(new URL(homeHref(user.username), nextUrl.origin));
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
