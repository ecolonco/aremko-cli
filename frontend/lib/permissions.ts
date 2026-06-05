// Permisos por usuario para las secciones de aremko-cli.
//
// Fuente única de verdad para DOS cosas que deben ir sincronizadas:
//   1) qué ítems muestra el Sidebar (componente cliente), y
//   2) a qué rutas deja entrar el middleware (Edge).
//
// Por eso este módulo NO importa íconos ni nada de Node: debe ser seguro para
// el Edge runtime del middleware. Los íconos viven en el Sidebar (mapeados por
// la `key` de cada ítem).
//
// El control es por USUARIO (no por rol), porque hay superadmins (ej. Angélica)
// que igual deben quedar restringidos de alguna sección.

export interface MenuItemDef {
  key: string;
  name: string;
  href: string;
}

// Orden canónico del menú (el Sidebar respeta este orden al filtrar).
export const MENU_ITEMS: MenuItemDef[] = [
  { key: 'informes', name: 'Informes', href: '/dashboard/jorge/brief' },
  { key: 'perfiles', name: 'Perfiles', href: '/dashboard/jorge/perfiles' },
  { key: 'bandeja', name: 'Bandeja WhatsApp', href: '/dashboard/jorge/perfiles/bandeja' },
  { key: 'mensajes', name: 'Mensajes WhatsApp', href: '/dashboard/jorge/perfiles/whatsapp' },
  { key: 'tableros', name: 'Tableros Bandeja', href: '/dashboard/jorge/perfiles/tableros' },
  { key: 'metricas', name: 'Métricas Operadores', href: '/dashboard/jorge/perfiles/metricas-operadores' },
  { key: 'sistema', name: 'Aremko-CLI Sistema', href: '/dashboard/jorge/sistema' },
  { key: 'configuracion', name: 'Configuración', href: '/dashboard/jorge/settings' },
];

const ALL_KEYS = MENU_ITEMS.map((i) => i.key);

// 'all' = acceso total (sin restricción, incluye páginas utilitarias sin menú).
// string[] = solo las secciones cuyas keys estén en la lista.
// [] = ninguna sección (cae en "Sin acceso").
export const USER_PERMISSIONS: Record<string, 'all' | string[]> = {
  jorge: 'all',
  angelica: ALL_KEYS.filter((k) => k !== 'sistema'), // todo menos "Aremko-CLI Sistema"
  deborah: ['bandeja', 'mensajes', 'tableros', 'metricas'],
  ernesto: [], // por ahora, ninguna
};

// Ítems de menú visibles/accesibles para un usuario (en orden canónico).
export function allowedItems(username: string): MenuItemDef[] {
  const perm = USER_PERMISSIONS[username];
  if (perm === 'all') return MENU_ITEMS;
  if (!perm || perm.length === 0) return [];
  return MENU_ITEMS.filter((i) => perm.includes(i.key));
}

// ¿Puede el usuario acceder a esta ruta del dashboard?
// 'all' → todo. En otro caso, solo si la ruta cae dentro de alguno de sus ítems
// (coincidencia exacta o como sub-ruta). El sufijo '/' evita que "/whatsapp"
// matchee por error a "/whatsapp-coexistencia".
export function canAccess(username: string, pathname: string): boolean {
  const perm = USER_PERMISSIONS[username];
  if (perm === 'all') return true;
  if (!perm || perm.length === 0) return false;
  return allowedItems(username).some(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/')
  );
}

// Sección de inicio (a dónde cae el usuario al loguearse / entrar a la raíz).
export function homeHref(username: string): string {
  const perm = USER_PERMISSIONS[username];
  // jorge: /dashboard/jorge (su page redirige a "Mensajes WhatsApp").
  if (perm === 'all') return '/dashboard/jorge';
  const items = allowedItems(username);
  return items.length ? items[0].href : '/dashboard/sin-acceso';
}
