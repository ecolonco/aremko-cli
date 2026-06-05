import { redirect } from 'next/navigation';

export default function JorgeDashboardRoot() {
  // Al entrar a aremko-cli (/dashboard/jorge) caemos directo en "Mensajes WhatsApp",
  // que es la vista de uso diario. "Informes" (el brief, /dashboard/jorge/brief) sigue
  // disponible desde el menú lateral cuando se requiera.
  redirect('/dashboard/jorge/perfiles/whatsapp');
}
