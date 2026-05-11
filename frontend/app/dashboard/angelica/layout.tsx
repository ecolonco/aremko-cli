import Sidebar from '@/components/layout/Sidebar';
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
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        userRole={user.username as any}
        userName={user.username}
        userFullName={user.name}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
