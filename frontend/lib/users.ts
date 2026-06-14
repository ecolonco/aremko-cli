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

const users: User[] = [
  {
    id: '1',
    username: 'jorge',
    name: 'Jorge Aguilera',
    role: 'superadmin',
    passwordHash: '', // Se calcula en initPasswordHashes()
    dashboards: ['jorge', 'deborah', 'angelica', 'ernesto'], // Acceso total
  },
  {
    id: '2',
    username: 'angelica',
    name: 'Angélica',
    role: 'superadmin',
    passwordHash: '',
    dashboards: ['jorge', 'deborah', 'angelica', 'ernesto'], // Acceso total
  },
  {
    id: '3',
    username: 'deborah',
    name: 'Deborah',
    role: 'admin',
    passwordHash: '',
    dashboards: ['deborah'], // Solo su dashboard
  },
  {
    id: '4',
    username: 'ernesto',
    name: 'Ernesto',
    role: 'admin',
    passwordHash: '',
    dashboards: ['ernesto'], // Solo su dashboard
  },
];

// Las contraseñas se leen desde variables de entorno (Vercel):
//   LOGIN_PW_JORGE, LOGIN_PW_ANGELICA, LOGIN_PW_DEBORAH, LOGIN_PW_ERNESTO
// Si una variable no está definida, se usa la contraseña temporal como
// respaldo (transición). Una vez configuradas en Vercel, las temporales
// quedan deshabilitadas y conviene eliminar este respaldo.
const TEMP_PASSWORDS: Record<string, string> = {
  jorge: 'jorge2026',
  angelica: 'angelica2026',
  deborah: 'deborah2026',
  ernesto: 'ernesto2026',
};

// Inicializar hashes de contraseñas (se ejecuta al importar)
const initPasswordHashes = async () => {
  for (const user of users) {
    const envVar = `LOGIN_PW_${user.username.toUpperCase()}`;
    const password = process.env[envVar] || TEMP_PASSWORDS[user.username];
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
  }
};

// Inicializar hashes. Se exporta la promesa para que el login pueda
// ESPERAR a que los hashes estén listos antes de validar (evita un race
// condition en serverless donde authorize() corre antes de terminar).
export const passwordsReady: Promise<void> = initPasswordHashes().catch(
  (err) => {
    console.error('Error inicializando hashes de contraseñas:', err);
  }
);

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
