import { redirect } from 'next/navigation';

export default function JorgeDashboardRoot() {
  // El menú simplificado expone solo "Informes" (alias de /brief); redirigimos aquí
  // para que cualquier acceso a /dashboard/jorge caiga directo en el brief semanal.
  redirect('/dashboard/jorge/brief');
}
