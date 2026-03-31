import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2, Loader2, ArrowRight, Eye, EyeOff, Mail, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

const resetSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user]);

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.toLowerCase().trim(),
      password: values.password,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Error al iniciar sesión",
        description: "Email o contraseña incorrectos",
        variant: "destructive",
      });
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    // Build callback URL that works on mobile and any domain
    const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
    const callbackUrl = `${window.location.origin}${base}auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: false,
      },
    });
    if (error) {
      toast({
        title: "Error con Google",
        description: "No se pudo iniciar con Google. Intenta con email y contraseña.",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const onResetSubmit = async (values: z.infer<typeof resetSchema>) => {
    setResetLoading(true);
    const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
    const { error } = await supabase.auth.resetPasswordForEmail(
      values.email.toLowerCase().trim(),
      { redirectTo: `${window.location.origin}${base}auth/callback` }
    );
    setResetLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el correo. Verifica el email e intenta de nuevo.",
        variant: "destructive",
      });
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl p-8 border-2 border-gray-900" style={{ boxShadow: '6px 6px 0 0 #1e293b' }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-primary to-purple-400 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 rotate-3 mb-3">
              <CheckCircle2 className="w-8 h-8 text-white -rotate-3" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">Compy</span>
          </div>

          <AnimatePresence mode="wait">

            {/* ── LOGIN VIEW ── */}
            {view === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-3xl font-bold text-center text-foreground mb-2">Iniciar Sesión</h1>
                <p className="text-center text-muted-foreground mb-8">Continúa tu camino hacia mejores hábitos</p>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full h-12 rounded-xl mb-4 font-medium border-gray-200 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                >
                  {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Continuar con Google
                </Button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">o con email</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="tu@correo.com"
                            autoComplete="email"
                            inputMode="email"
                            className="h-12 rounded-xl bg-gray-50/50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Contraseña</FormLabel>
                          <button
                            type="button"
                            onClick={() => setView("forgot")}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer"
                          >
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="current-password"
                              className="h-12 rounded-xl bg-gray-50/50 pr-12"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button type="submit" disabled={loading}
                      className="w-full h-12 rounded-xl font-semibold text-lg transition-all shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-5 h-5 ml-2" /></>}
                    </Button>
                  </form>
                </Form>

                <div className="mt-8 text-center text-sm text-muted-foreground">
                  ¿No tienes una cuenta?{" "}
                  <Link href="/register" className="font-semibold text-primary hover:underline">Regístrate aquí</Link>
                </div>
              </motion.div>
            )}

            {/* ── FORGOT PASSWORD VIEW ── */}
            {view === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => { setView("login"); setResetSent(false); resetForm.reset(); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver al login
                </button>

                {!resetSent ? (
                  <>
                    <h2 className="text-2xl font-bold text-foreground mb-2">¿Olvidaste tu contraseña?</h2>
                    <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                      Ingresa tu correo y te enviamos un enlace para crear una contraseña nueva.
                    </p>

                    <Form {...resetForm}>
                      <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
                        <FormField control={resetForm.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="tu@correo.com"
                                autoComplete="email"
                                inputMode="email"
                                className="h-12 rounded-xl bg-gray-50/50"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <Button type="submit" disabled={resetLoading}
                          className="w-full h-12 rounded-xl font-semibold text-base gap-2 cursor-pointer">
                          {resetLoading
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : <><Mail className="w-5 h-5" /> Enviar enlace</>
                          }
                        </Button>
                      </form>
                    </Form>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-4"
                  >
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">¡Correo enviado!</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      Revisa tu bandeja de entrada (y spam). El enlace expira en 1 hora.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => { setView("login"); setResetSent(false); resetForm.reset(); }}
                      className="rounded-xl cursor-pointer"
                    >
                      Volver al login
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
