'use client';

import { useEffect, useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';
import { UserRole } from '@/lib/types/user';

interface DashboardShellProps {
  userRole: UserRole;
  userName: string;
  userFullName?: string;
  children: React.ReactNode;
}

export default function DashboardShell({ userRole, userName, userFullName, children }: DashboardShellProps) {
  // Empezamos cerrado para evitar mismatch de hidratación; al montar abrimos si es desktop
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setSidebarOpen(true);
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        userRole={userRole}
        userName={userName}
        userFullName={userFullName}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex flex-col flex-1 min-w-0 transition-[padding] duration-200 ease-in-out ${
          sidebarOpen ? 'md:pl-64' : 'pl-0'
        }`}
      >
        {/* Top bar con hamburger */}
        <div className="sticky top-0 z-20 flex items-center h-12 px-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <span className="ml-2 text-sm text-gray-500 truncate">aremko-cli</span>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
