import Sidebar from '@/components/layout/Sidebar';
import { USERS } from '@/lib/types/user';

export default function JorgeDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = USERS.jorge;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar userRole={user.role} userName={user.name} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
