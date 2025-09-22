'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

interface User {
  id: string;
  username: string;
  avatar?: string;
  isAdmin: boolean;
  role?: string;
  isLeader?: boolean;
}

// Wrapper autour de NextAuth pour fournir une API similaire à l'ancien hook
export function useSimpleAuth() {
  // const { data: session, status } = useSession();
  const session = {user: {id: '1', name: 'John Doe', image: 'https://example.com/avatar.png', isAdmin: false, role: 'admin', isLeader: false}};
  const status = 'loading';

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        username: session.user.name ?? '',
        avatar: session.user.image ?? undefined,
        isAdmin: (session.user as any).isAdmin ?? false,
        role: (session.user as any).role ?? undefined,
        isLeader: (session.user as any).isLeader ?? false,
      }
    : null;

  return {
    user,
    isLoading: status === 'loading',
    login: () => signIn('discord'),
    logout: () => signOut({ callbackUrl: '/' }),
    isAuthenticated: !!session,
  };
}