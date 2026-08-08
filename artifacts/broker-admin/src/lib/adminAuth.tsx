import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey, type User } from "@workspace/api-client-react";

interface AdminAuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState<User | null>(null);

  const { data, isError, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, retry: false },
  });

  useEffect(() => {
    if (isError) {
      localStorage.removeItem("auth_token");
      setToken(null);
      setUser(null);
    }
  }, [isError]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
    setUser(newUser.role === "admin" ? newUser : null);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  // Derive the user from the /auth/me result in the same render it arrives —
  // an effect-set state here leaves one render where a valid token looks
  // logged-out and Protected bounces to /login on every full page load.
  // Only admins may use this app; an affiliate token counts as logged out.
  const effectiveUser = user ?? (data && data.role === "admin" ? data : null);

  return (
    <AdminAuthContext.Provider
      value={{ user: token ? effectiveUser : null, isLoading: !!token && isLoading, login, logout }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextType {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
