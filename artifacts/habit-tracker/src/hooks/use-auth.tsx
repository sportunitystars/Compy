import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useLocation } from "wouter";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useGetMe, type User } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  session: Session | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Restore session on mount and listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setSessionLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      queryClient.invalidateQueries({ queryKey: [`/api/auth/me`] });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Inject Supabase access_token into all API fetch calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const token = session?.access_token;
      if (token) {
        const [resource, config] = args;
        const headers = { ...(config?.headers ?? {}), Authorization: `Bearer ${token}` };
        return originalFetch(resource, { ...config, headers });
      }
      return originalFetch(...args);
    };
    return () => { window.fetch = originalFetch; };
  }, [session?.access_token]);

  const { data: user, isLoading: userLoading } = useGetMe({
    query: {
      retry: false,
      enabled: !!session,
    } as any,
  });

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    setLocation("/login");
  }, [setLocation]);

  const isLoading = sessionLoading || (!!session && userLoading);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, session, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
