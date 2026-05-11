import bcrypt from 'bcryptjs';

export type UserRole = 'superadmin' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  dashboards: string[]; // Dashboards a los que tiene acceso
}

// Contraseñas temporales (pueden cambiar después del primer login)
// jorge: jorge2026
// angelica: angelica2026
// deborah: deborah2026
// ernesto: ernesto2026

const users: User[] = [
  {
    id: '1',
    username: 'jorge',
    name: 'Jorge Aguilera',
    role: 'superadmin',
    // Password: jorge2026
    passwordHash: '$2a$10$YKZqNvXqQX3xJYqKQJYqKuK5FqK5FqK5FqK5FqK5FqK5FqK5FqK5F', // Will be replaced
    dashboards: ['jorge', 'deborah', 'angelica', 'ernesto'], // Acceso total
  },
  {
    id: '2',
    username: 'angelica',
    name: 'Angélica',
    role: 'superadmin',
    // Password: angelica2026
    passwordHash: '$2a$10$YKZqNvXqQX3xJYqKQJYqKuK5FqK5FqK5FqK5FqK5FqK5FqK5FqK5F', // Will be replaced
    dashboards: ['jorge', 'deborah', 'angelica', 'ernesto'], // Acceso total
  },
  {
    id: '3',
    username: 'deborah',
    name: 'Deborah',
    role: 'admin',
    // Password: deborah2026
    passwordHash: '$2a$10$YKZqNvXqQX3xJYqKQJYqKuK5FqK5FqK5FqK5FqK5FqK5FqK5FqK5F', // Will be replaced
    dashboards: ['deborah'], // Solo su dashboard
  },
  {
    id: '4',
    username: 'ernesto',
    name: 'Ernesto',
    role: 'admin',
    // Password: ernesto2026
    passwordHash: '$2a$10$YKZqNvXqQX3xJYqKQJYqKuK5FqK5FqK5FqK5FqK5FqK5FqK5FqK5F', // Will be replaced
    dashboards: ['ernesto'], // Solo su dashboard
  },
];

// Inicializar hashes de contraseñas (se ejecuta al importar)
const initPasswordHashes = async () => {
  const passwords: Record<string, string> = {
    jorge: 'jorge2026',
    angelica: 'angelica2026',
    deborah: 'deborah2026',
    ernesto: 'ernesto2026',
  };

  for (const user of users) {
    const password = passwords[user.username];
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
  }
};

// Inicializar hashes
initPasswordHashes().catch(console.error);

export function getUsers(): User[] {
  return users;
}

export function getUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function canAccessDashboard(
  user: User,
  dashboardUser: string
): boolean {
  return user.dashboards.includes(dashboardUser);
}
