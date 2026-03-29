import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const BASE_URL = import.meta.env.BASE_URL ?? "/";

const registerSchema = z.object({
  name: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user]);

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    setLoading(true);
    try {
      // 1. Create the account via our API (creates the profile with pending status + sends admin email)
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error al registrarse", description: data.error || "Ocurrió un problema", variant: "destructive" });
        return;
      }

      // 2. Sign in with Supabase to establish the proper session (with refresh_token)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email.toLowerCase(),
        password: values.password,
      });

      if (signInError) {
        // Account was created but sign-in failed — that's OK, redirect to login
        toast({ title: "¡Registro exitoso!", description: "Inicia sesión para continuar." });
        setLocation("/login");
        return;
      }

      toast({ title: "¡Bienvenido!", description: "Tu cuenta está pendiente de aprobación." });
      // onAuthStateChange will fire and redirect via useEffect
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${base}auth/callback`,
        skipBrowserRedirect: false,
      },
    });
    if (error) {
      toast({ title: "Error con Google", description: "No se pudo continuar con Google", variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100/50 p-8 border border-purple-50">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-primary to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 -rotate-3 mb-3">
              <CheckCircle2 className="w-8 h-8 text-white rotate-3" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">Compy</span>
          </div>

          <h1 className="text-3xl font-bold text-center text-foreground mb-2">Crear Cuenta</h1>
          <p className="text-center text-muted-foreground mb-8">Únete y comienza a registrar tus hábitos</p>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleRegister}
            disabled={googleLoading}
            className="w-full h-12 rounded-xl mb-4 font-medium border-gray-200 hover:bg-gray-50 flex items-center gap-3"
          >
            {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Registrarse con Google
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">o con email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre" className="h-12 rounded-xl bg-gray-50/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input placeholder="tu@correo.com" className="h-12 rounded-xl bg-gray-50/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="h-12 rounded-xl bg-gray-50/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" disabled={loading}
                className="w-full h-12 mt-2 rounded-xl font-semibold text-lg transition-all shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5 mr-2" />Registrarse</>}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">Inicia sesión aquí</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
