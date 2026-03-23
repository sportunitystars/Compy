import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      setToken(token);
      window.history.replaceState({}, "", "/");
      setLocation("/");
    } else if (error) {
      window.history.replaceState({}, "", "/login");
      setLocation("/login");
    } else {
      setLocation("/login");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Iniciando sesión con Google...</p>
      </div>
    </div>
  );
}
