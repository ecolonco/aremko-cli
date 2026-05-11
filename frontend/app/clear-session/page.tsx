'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ClearSessionPage() {
  const [status, setStatus] = useState('Limpiando sesión...');
  const router = useRouter();

  useEffect(() => {
    const clearSession = async () => {
      try {
        // Sign out and redirect to login
        await signOut({
          redirect: false,
          callbackUrl: '/login'
        });

        setStatus('✅ Sesión limpiada exitosamente');

        // Wait a moment then redirect
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } catch (error) {
        setStatus('❌ Error al limpiar sesión. Intenta borrar cookies manualmente.');
        console.error(error);
      }
    };

    clearSession();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Limpieza de Sesión
          </h1>
          <div className="text-lg text-gray-700 mb-6">
            {status}
          </div>
          <div className="text-sm text-gray-500">
            Serás redirigido a la página de inicio de sesión...
          </div>
        </div>
      </div>
    </div>
  );
}
