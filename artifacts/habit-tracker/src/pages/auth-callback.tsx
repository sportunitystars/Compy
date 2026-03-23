import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const handleCallback = async () => {
      // Supabase automatically picks up the code/hash from the URL
      // Give it a moment then check for the session
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        // Try exchanging the code manually (PKCE flow)
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error");

        if (errorParam) {
          setLocation("/login?error=oauth_cancelled");
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setLocation("/login?error=oauth_failed");
            return;
          }
        } else {
          setLocation("/login");
          return;
        }
      }

      // Invalidate the user query so it re-fetches with the new session
      // This triggers profile creation on the server if it's a new OAuth user
      await queryClient.invalidateQueries({ queryKey: ["getMe"] });

      // Clean URL and redirect
      window.history.replaceState({}, "", "/");
      setLocation("/");
    };

    // Small delay so Supabase JS can process the URL fragment
    setTimeout(handleCallback, 300);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground font-medium">Iniciando sesión...</p>
        <p className="text-sm text-muted-foreground">Un momento por favor</p>
      </div>
    </div>
  );
}
