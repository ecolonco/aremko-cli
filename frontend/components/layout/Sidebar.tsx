'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  TrophyIcon,
  EnvelopeIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { UserRole } from '@/lib/types/user';
import { allowedItems } from '@/lib/permissions';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  userFullName?: string;
  open: boolean;
  onClose: () => void;
}

// Ícono por sección. Las secciones y los permisos por usuario viven en
// lib/permissions.ts (fuente única, compartida con el middleware).
const ICONS: Record<string, typeof DocumentTextIcon> = {
  informes: DocumentTextIcon,
  'meta-ads': MegaphoneIcon,
  perfiles: UsersIcon,
  bandeja: ChatBubbleLeftRightIcon,
  mensajes: ChatBubbleLeftRightIcon,
  contactando: PaperAirplaneIcon,
  envios: ClipboardDocumentCheckIcon,
  agente: SparklesIcon,
  aprendizaje: AcademicCapIcon,
  masajes: EnvelopeIcon,
  tableros: ChartBarIcon,
  evolucion: ArrowTrendingUpIcon,
  metricas: TrophyIcon,
  sistema: BookOpenIcon,
  configuracion: CogIcon,
};

export default function Sidebar({ userRole, userName, userFullName, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const userNavigation = allowedItems(userRole).map((item) => ({
    name: item.name,
    href: item.href,
    icon: ICONS[item.key] ?? DocumentTextIcon,
  }));

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <>
      {/* Backdrop oscuro detrás del sidebar en mobile cuando está abierto */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-gray-900 transform transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-gray-800">
          <h1 className="text-xl font-bold text-white">aremko-cli</h1>
          <button
            onClick={onClose}
            className="md:hidden text-gray-300 hover:text-white"
            aria-label="Cerrar menú"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto">
          <nav className="flex-1 px-3 py-4 space-y-1">
            <div className="mb-4 px-3 py-2">
              <div className="text-sm font-medium text-white">{userFullName || userName}</div>
              <div className="text-xs text-gray-400">@{userName}</div>
            </div>
            {userNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-shrink-0 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-6 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
            Cerrar sesión
          </button>
          <div className="p-4 text-xs text-gray-400">
            aremko-cli v0.1.0-alpha
          </div>
        </div>
      </aside>
    </>
  );
}
