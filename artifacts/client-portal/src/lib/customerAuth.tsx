import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// Auth state for INDICATOR CUSTOMERS.
//
// Uses raw fetch rather than the generated hooks in @workspace/api-client-react,
// because the /customer/* endpoints are not in lib/api-spec/openapi.yaml yet. When
// they are added and regenerated, this file is where the swap happens — nothing
// else calls the API directly.
//
// Storage keys are prefixed `customer_` and MUST NOT collide with the broker
// portal's `client_*` keys. Both apps can be open on the same origin, and a
// shared key would let one population's token be read as the other's.

export type CustomerProfile = {
  id: number;
  email: string;
  fullName: string | null;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type Membership = {
  status: string;
  renewalDate: string | null;
  startDate: string | null;
};

type CustomerAuthContextType = {
  customer: CustomerProfile | null;
  memberships: Membership[];
  hasActiveMembership: boolean;
  isLoading: boolean;
  login: (token: string, customer: CustomerProfile) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const TOKEN_KEY = "customer_token";
const USER_KEY = "customer_user";

export function getCustomerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper that attaches the bearer token and unwraps the API's error
 * shape into a thrown Error, so callers can `catch` instead of inspecting
 * every response by hand.
 */
export async function customerFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getCustomerToken();
  const res = await fetch(`/api/customer${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body?.message ?? body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

function loadStored(): CustomerProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(loadStored);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [hasActiveMembership, setHasActive] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getCustomerToken());

  const refresh = useCallback(async () => {
    if (!getCustomerToken()) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await customerFetch<{
        customer: CustomerProfile;
        memberships: Membership[];
        hasActiveMembership: boolean;
      }>("/auth/me");
      setCustomer(data.customer);
      setMemberships(data.memberships);
      setHasActive(data.hasActiveMembership);
      localStorage.setItem(USER_KEY, JSON.stringify(data.customer));
    } catch {
      // A stored token that no longer resolves means the session was revoked
      // or expired. Clear it rather than leaving the UI half-logged-in.
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setCustomer(null);
      setMemberships([]);
      setHasActive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = (token: string, next: CustomerProfile) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setCustomer(next);
    setIsLoading(true);
    void refresh();
  };

  const logout = () => {
    // Best-effort server-side revoke; the local clear happens either way so a
    // network failure cannot strand somebody in a session they asked to end.
    void customerFetch("/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setCustomer(null);
    setMemberships([]);
    setHasActive(false);
  };

  return (
    <CustomerAuthContext.Provider
      value={{ customer, memberships, hasActiveMembership, isLoading, login, logout, refresh }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextType {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return ctx;
}
