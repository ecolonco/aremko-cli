export type UserRole = 'jorge' | 'deborah' | 'angelica' | 'ernesto';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export const USERS: Record<UserRole, User> = {
  jorge: {
    id: '1',
    name: 'Jorge',
    role: 'jorge',
    email: 'jorge@aremko.cl'
  },
  deborah: {
    id: '2',
    name: 'Deborah',
    role: 'deborah',
    email: 'deborah@aremko.cl'
  },
  angelica: {
    id: '3',
    name: 'Angélica',
    role: 'angelica',
    email: 'angelica@aremko.cl'
  },
  ernesto: {
    id: '4',
    name: 'Ernesto',
    role: 'ernesto',
    email: 'ernesto@aremko.cl'
  }
};
