import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetClientMe, getGetClientMeQueryKey, type ClientProfile } from "@workspace/api-client-react";

interface ClientAuthContextType {
  client: ClientProfile | null;
  isLoading: boolean;
  login: (token: string, client: ClientProfile) => void;
  logout: () => void;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

function loadStoredClient(): ClientProfile | null {
  try {
    const raw = localStorage.getItem("client_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("client_token"));
  const [client, setClient] = useState<ClientProfile | null>(loadStoredClient);

  // Re-validate a stored token once per load so a revoked session logs out.
  const { data: meData, isError } = useGetClientMe({
    query: {
      queryKey: getGetClientMeQueryKey(),
      enabled: !!token,
      retry: false,
    },
  });

  useEffect(() => {
    if (isError) {
      localStorage.removeItem("client_token");
      localStorage.removeItem("client_user");
      setToken(null);
      setClient(null);
    }
  }, [isError]);

  useEffect(() => {
    if (meData) {
      setClient(meData);
      localStorage.setItem("client_user", JSON.stringify(meData));
    }
  }, [meData]);

  const login = (newToken: string, newClient: ClientProfile) => {
    localStorage.setItem("client_token", newToken);
    localStorage.setItem("client_user", JSON.stringify(newClient));
    setToken(newToken);
    setClient(newClient);
  };

  const logout = () => {
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_user");
    setToken(null);
    setClient(null);
  };

  return (
    <ClientAuthContext.Provider
      value={{ client: token ? client : null, isLoading: !!token && !client, login, logout }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth(): ClientAuthContextType {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error("useClientAuth must be used within ClientAuthProvider");
  return ctx;
}
