'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  ChartBarIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  CogIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { UserRole } from '@/lib/types/user';
import clsx from 'clsx';

interface SidebarProps {
  userRole: UserRole;
  userName: string;
}

const navigation = {
  jorge: [
    { name: 'Dashboard', href: '/dashboard/jorge', icon: HomeIcon },
    { name: 'Meta Ads', href: '/dashboard/jorge/meta-ads', icon: MegaphoneIcon },
    { name: 'Analytics', href: '/dashboard/jorge/analytics', icon: ChartBarIcon },
    { name: 'Brief Semanal', href: '/dashboard/jorge/brief', icon: DocumentTextIcon },
    { name: 'Equipo', href: '/dashboard/jorge/team', icon: UsersIcon },
    { name: 'Configuración', href: '/dashboard/jorge/settings', icon: CogIcon },
  ],
  deborah: [
    { name: 'Dashboard', href: '/dashboard/deborah', icon: HomeIcon },
    { name: 'Ventas', href: '/dashboard/deborah/sales', icon: ChartBarIcon },
    { name: 'Campañas', href: '/dashboard/deborah/campaigns', icon: MegaphoneIcon },
  ],
  angelica: [
    { name: 'Dashboard', href: '/dashboard/angelica', icon: HomeIcon },
    { name: 'Contenido', href: '/dashboard/angelica/content', icon: DocumentTextIcon },
    { name: 'Campañas', href: '/dashboard/angelica/campaigns', icon: MegaphoneIcon },
    { name: 'Analytics', href: '/dashboard/angelica/analytics', icon: ChartBarIcon },
  ],
  ernesto: [
    { name: 'Dashboard', href: '/dashboard/ernesto', icon: HomeIcon },
    { name: 'Operaciones', href: '/dashboard/ernesto/operations', icon: CogIcon },
    { name: 'Reservas', href: '/dashboard/ernesto/bookings', icon: DocumentTextIcon },
  ],
};

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const userNavigation = navigation[userRole];

  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center h-16 px-6 bg-gray-800">
        <h1 className="text-xl font-bold text-white">aremko-cli</h1>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="mb-4 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {userName}
          </div>
          {userNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
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

      <div className="flex-shrink-0 p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400">
          aremko-cli v0.1.0-alpha
        </div>
      </div>
    </div>
  );
}
