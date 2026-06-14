import NextAuth, { DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getUserByUsername, verifyPassword, passwordsReady, type User } from './users';

// Extender tipos de NextAuth para incluir nuestros campos personalizados
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      role: 'superadmin' | 'admin';
      dashboards: string[];
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    username: string;
    name: string;
    role: 'superadmin' | 'admin';
    dashboards: string[];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Esperar a que los hashes de contraseñas estén calculados
        // (evita validar contra un hash vacío en el primer request).
        await passwordsReady;

        const user = getUserByUsername(credentials.username as string);

        if (!user) {
          return null;
        }

        const isValidPassword = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValidPassword) {
          return null;
        }

        // Retornar datos del usuario (sin el password hash)
        return {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          dashboards: user.dashboards,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persistir datos adicionales del usuario en el token
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.dashboards = user.dashboards;
      }
      return token;
    },
    async session({ session, token }) {
      // Agregar datos del token a la sesión
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as 'superadmin' | 'admin';
        session.user.dashboards = token.dashboards as string[];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
});
