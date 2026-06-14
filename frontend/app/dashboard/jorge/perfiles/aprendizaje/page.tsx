'use client';

// Página propia "Aprendizaje del agente" (H-013): procesar correcciones + revisar
// pendientes/historial. Accesible para Jorge, Angélica y Deborah.

import { Brain } from 'lucide-react';
import SugerenciasAprendizaje from './SugerenciasAprendizaje';

export default function AprendizajePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Brain className="h-6 w-6 text-violet-600" />
        Aprendizaje del agente
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Procesa las correcciones que Deborah hace a los borradores del agente, revísalas y apruébalas.
        Las <strong>reglas</strong> entran al Conocimiento; los <strong>precios/catálogo</strong> quedan
        marcados para actualizar. Apretar “Procesar aprendizaje” clasifica las correcciones recientes.
      </p>
      <div className="mt-6">
        <SugerenciasAprendizaje />
      </div>
    </div>
  );
}
