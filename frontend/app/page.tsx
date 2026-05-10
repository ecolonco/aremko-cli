import { redirect } from 'next/navigation';

export default function Home() {
  // Por ahora, redirigimos directamente al dashboard de Jorge
  // En Fase 2, aquí habrá una página de login
  redirect('/dashboard/jorge');
}
