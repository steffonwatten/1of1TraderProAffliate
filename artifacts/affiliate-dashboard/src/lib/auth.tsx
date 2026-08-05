import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useGetMe, getGetMeQueryKey, type User } from '@workspace/api-client-react';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [_, setLocation] = useLocation();
  const [localToken, setLocalToken] = useState<string | null>(
    () => localStorage.getItem('auth_token')
  );
  const [localUser, setLocalUser] = useState<User | null>(loadStoredUser);

  // Only validate token on page load (when we have a stored token but need to verify it's still valid)
  const { data: meData, isLoading: meLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!localToken && !localUser,
      retry: false,
    },
  });

  // If token validation fails, clear everything
  useEffect(() => {
    if (isError) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setLocalToken(null);
      setLocalUser(null);
    }
  }, [isError]);

  // Use validated user data from /me if available
  const user = localUser || meData || null;
  const isLoading = !!localToken && !localUser && meLoading;

  const login = (token: string, userData: User) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    setLocalToken(token);
    setLocalUser(userData);

    if (userData.role === 'admin') {
      setLocation('/admin');
    } else {
      setLocation('/dashboard');
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setLocalToken(null);
    setLocalUser(null);
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
