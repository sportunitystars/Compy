import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Lock, Bell, BarChart2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/api${path}`;
}

const TOTAL_SLOTS = 100;

async function fetchPublicSettings(): Promise<{ freeSlotsUsed: number }> {
  const res = await fetch(getApiUrl(`/settings/public?_=${Date.now()}`));
  if (!res.ok) return { freeSlotsUsed: 0 };
  return res.json();
}

const FEATURES = [
  {
    emoji: "🎨",
    title: "Hábitos a tu medida",
    desc: "Crea hábitos con opciones de color y nombres propios. ¿Corriste o caminaste? ¡Tú decides cómo registrarlo!",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  {
    emoji: "🔒",
    title: "Hábitos privados",
    desc: "Protege con PIN los hábitos que son solo tuyos. Nadie más puede verlos aunque compartas la pantalla.",
    bg: "bg-rose-50",
    border: "border-rose-100",
  },
  {
    emoji: "🔥",
    title: "Rachas motivadoras",
    desc: "Cada día que registras suma a tu racha. Visualiza tu progreso del mes de un vistazo y mantén el impulso.",
    bg: "bg-orange-50",
    border: "border-orange-100",
  },
  {
    emoji: "🔔",
    title: "Notificaciones push",
    desc: "Recibe recordatorios para no olvidar ningún día. Las notificaciones llegan aunque la app esté cerrada.",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
];

const STEPS = [
  { emoji: "✏️", num: "01", title: "Crea tu hábito", desc: "Dale un nombre, un emoji y define tus opciones diarias (Sí/No, Corrí/Caminé, etc.)" },
  { emoji: "👆", num: "02", title: "Registra cada día", desc: "Toca la tarjeta para ciclar por tus opciones. Un toque, ¡listo! Sin formularios largos." },
  { emoji: "📊", num: "03", title: "Mira tu progreso", desc: "Observa tus rachas, porcentajes y estadísticas del mes. ¡El progreso habla solo!" },
];

export default function Landing() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: settingsData } = useQuery({
    queryKey: ["public-settings"],
    queryFn: fetchPublicSettings,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const freeSlotsUsed = settingsData?.freeSlotsUsed ?? null;

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading]);

  const remaining = freeSlotsUsed !== null ? TOTAL_SLOTS - freeSlotsUsed : null;
  const pct = freeSlotsUsed !== null ? Math.min((freeSlotsUsed / TOTAL_SLOTS) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Compy</span>
          </button>
          <Button
            size="sm"
            className="rounded-full px-5 gap-1.5 cursor-pointer"
            onClick={() => setLocation("/login")}
          >
            Entrar <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-indigo-50 -z-10" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-200 rounded-full opacity-20 blur-3xl -z-10" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-indigo-200 rounded-full opacity-20 blur-3xl -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              🎉 ¡Primeras 100 cuentas son gratis!
            </span>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
              Construye hábitos
              <br />
              <span className="text-primary">que realmente duran</span>
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Compy es tu app de hábitos diarios — simple, rápida y completamente en español.
              Sin excusas, sin complicaciones. Solo tú y tus metas. 🚀
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="rounded-2xl px-8 h-14 text-base gap-2 shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-shadow cursor-pointer"
                onClick={() => setLocation("/login")}
              >
                Quiero mi acceso gratis <ArrowRight className="w-5 h-5" />
              </Button>
              <span className="text-sm text-gray-400">Sin tarjeta · Sin contratos · Siempre gratis</span>
            </div>
          </motion.div>

          {/* App mockup cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 flex justify-center gap-4 flex-wrap"
          >
            {[
              { emoji: "🏃", name: "Correr", tags: ["Corrí · 72%", "Caminé · 28%"], color: "bg-green-100 text-green-700", color2: "bg-blue-100 text-blue-700" },
              { emoji: "📚", name: "Leer", tags: ["Sí · 85%", "No · 15%"], color: "bg-emerald-100 text-emerald-700", color2: "bg-rose-100 text-rose-700" },
              { emoji: "💧", name: "Agua", tags: ["Completé · 90%", "Parcial · 10%"], color: "bg-cyan-100 text-cyan-700", color2: "bg-orange-100 text-orange-700" },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-md px-5 py-4 w-52 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{card.emoji}</span>
                  <span className="font-bold text-sm">{card.name}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.color}`}>{card.tags[0]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.color2}`}>{card.tags[1]}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${70 + i * 10}%` }} />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
              Tan fácil como 1, 2, 3 ✨
            </h2>
            <p className="text-gray-500 text-lg">Sin curva de aprendizaje. Empiezas en 2 minutos.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative bg-white rounded-3xl p-7 border border-gray-100 shadow-sm flex flex-col items-center text-center md:items-start md:text-left"
              >
                <span className="absolute -top-3 -left-3 w-9 h-9 bg-primary text-white text-sm font-black rounded-xl flex items-center justify-center shadow-md">
                  {step.num}
                </span>
                <span className="text-4xl mb-4 block">{step.emoji}</span>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
              Todo lo que necesitas 💪
            </h2>
            <p className="text-gray-500 text-lg">Diseñado para que nada se interponga entre tú y tus hábitos.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`${f.bg} border ${f.border} rounded-3xl p-7 flex flex-col items-center text-center sm:items-start sm:text-left`}
              >
                <span className="text-4xl mb-4 block">{f.emoji}</span>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Extra mini-features */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <GripVertical className="w-5 h-5" />, label: "Ordena arrastrando" },
              { icon: <BarChart2 className="w-5 h-5" />, label: "Estadísticas mensuales" },
              { icon: <Lock className="w-5 h-5" />, label: "Hábitos privados con PIN" },
              { icon: <Bell className="w-5 h-5" />, label: "Recordatorios push" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                <span className="text-primary shrink-0">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOMO COUNTER ── */}
      <section className="py-16 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-4xl mb-4 block">🔥</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Acceso 100% gratuito
            </h2>
            <p className="text-violet-200 text-lg mb-10">
              Las primeras <strong className="text-white">100 personas</strong> tienen acceso gratuito de por vida.<br />
              Después pasará a ser de pago. ¡No pierdas tu lugar!
            </p>

            {/* Progress bar */}
            <div className="bg-white/20 rounded-2xl p-6 mb-8 backdrop-blur-sm">
              <div className="flex justify-between text-sm font-semibold mb-3">
                <span>
                  {freeSlotsUsed !== null ? (
                    <><strong className="text-2xl text-white">{freeSlotsUsed}</strong> <span className="text-violet-200">de 100 tomados</span></>
                  ) : (
                    <span className="text-violet-300">Cargando...</span>
                  )}
                </span>
                <span className="text-violet-200">
                  {remaining !== null ? (
                    <><strong className="text-white">{remaining}</strong> disponibles</>
                  ) : null}
                </span>
              </div>
              <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  key={pct}
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </div>
              {remaining !== null && remaining <= 20 && remaining > 0 && (
                <p className="text-yellow-300 font-bold text-sm mt-3 animate-pulse">
                  ⚡ ¡Solo quedan {remaining}! Date prisa.
                </p>
              )}
              {remaining === 0 && (
                <p className="text-red-300 font-bold text-sm mt-3">
                  😬 Accesos gratuitos agotados — pero puedes solicitar acceso igualmente.
                </p>
              )}
            </div>

            <Button
              size="lg"
              variant="secondary"
              className="rounded-2xl px-10 h-14 text-base font-bold gap-2 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer"
              onClick={() => setLocation("/login")}
            >
              Asegurar mi lugar gratis <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-violet-300 text-sm mt-4">
              Sin tarjeta de crédito · Cancela cuando quieras
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-white text-xl">Compy</span>
          </div>
          <p className="text-sm mb-6">Tu compañero de hábitos diarios 🌱</p>
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-primary hover:underline text-sm font-semibold cursor-pointer"
          >
            Ingresar a la app →
          </button>
          <p className="mt-8 text-xs text-gray-600">
            © {new Date().getFullYear()} Compy · Hecho con ❤️ para construir mejores versiones de uno mismo
          </p>
        </div>
      </footer>
    </div>
  );
}
