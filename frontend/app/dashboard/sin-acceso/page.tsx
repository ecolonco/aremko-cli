'use client';

import { signOut } from 'next-auth/react';
import { LockClosedIcon } from '@heroicons/react/24/outline';

export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <LockClosedIcon className="h-6 w-6 text-gray-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Sin acceso</h1>
        <p className="mt-3 text-sm text-gray-600">
          Tu usuario todavía no tiene secciones asignadas en aremko-cli. Contacta
          al administrador para que te habilite el acceso.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-6 inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
