import DashboardShell from '@/components/layout/DashboardShell';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AngelicaDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user;

  return (
    <DashboardShell
      userRole={user.username as any}
      userName={user.username}
      userFullName={user.name}
    >
      {children}
    </DashboardShell>
  );
}
