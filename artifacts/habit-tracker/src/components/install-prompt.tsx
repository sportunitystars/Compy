import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus } from "lucide-react";

const STORAGE_KEY = "compy_install_dismissed";

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function wasDismissed() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    if (isIOS()) {
      setTimeout(() => {
        setMode("ios");
        setShow(true);
      }, 2000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setTimeout(() => {
        setMode("android");
        setShow(true);
      }, 2000);
    };

    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  function dismiss() {
    markDismissed();
    setShow(false);
  }

  async function install() {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === "accepted") markDismissed();
      deferredPrompt.current = null;
    }
    setShow(false);
  }

  if (!show || !mode) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="install-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={dismiss}
      >
        <motion.div
          key="install-sheet"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm mx-4 mb-6 bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <img
                src="/apple-touch-icon.png"
                alt="Compy"
                className="w-14 h-14 rounded-2xl shadow-md"
              />
              <div>
                <p className="font-bold text-lg text-gray-900 leading-tight">Compy</p>
                <p className="text-sm text-gray-500">compy.replit.app</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 pb-6">
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">
              Instala <strong>Compy</strong> en tu celular para acceder más rápido y usarla como una app nativa, ¡sin abrir el navegador!
            </p>

            {mode === "android" && (
              <div className="flex gap-3">
                <button
                  onClick={dismiss}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Ahora no
                </button>
                <button
                  onClick={install}
                  className="flex-1 py-3 rounded-2xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/30 hover:bg-primary/90 transition-colors"
                >
                  Instalar
                </button>
              </div>
            )}

            {mode === "ios" && (
              <>
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                      <Share className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">Paso 1</p>
                      <p className="text-xs text-gray-600">
                        Toca el botón <strong>Compartir</strong>{" "}
                        <span className="inline-block align-middle">⬆️</span>{" "}
                        en la barra de Safari
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">Paso 2</p>
                      <p className="text-xs text-gray-600">
                        Selecciona <strong>"Añadir a pantalla de inicio"</strong>
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="w-full py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Entendido
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
