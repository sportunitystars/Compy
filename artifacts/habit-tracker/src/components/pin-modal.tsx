import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePinContext } from "@/contexts/pin-context";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

async function apiPost(path: string, body: object, token?: string) {
  const res = await fetch(`${BASE_URL}api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  mode: "set" | "unlock";
  onSuccess?: () => void;
}

export function PinModal({ open, onClose, mode, onSuccess }: PinModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [confirm, setConfirm] = useState<string[]>(["", "", "", ""]);
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDigits, setShowDigits] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { unlock } = usePinContext();

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setConfirm(["", "", "", ""]);
      setStep("enter");
      setError("");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  const currentDigits = step === "confirm" ? confirm : digits;
  const setCurrentDigits = step === "confirm" ? setConfirm : setDigits;

  function handleInput(index: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...currentDigits];
    next[index] = val;
    setCurrentDigits(next);
    setError("");
    if (val && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (val && index === 3) {
      const pin = next.join("");
      if (pin.length === 4) setTimeout(() => handleSubmitPin(next), 50);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !currentDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmitPin(pinDigits: string[]) {
    const pin = pinDigits.join("");
    if (pin.length < 4) return;

    if (mode === "set") {
      if (step === "enter") {
        setStep("confirm");
        setConfirm(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }
      if (pin !== digits.join("")) {
        setError("Los PINs no coinciden. Intenta de nuevo.");
        setConfirm(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }
    }

    setLoading(true);
    try {
      const finalPin = mode === "set" ? digits.join("") : pin;
      const path = mode === "set" ? "/pin/set" : "/pin/verify";
      const result = await apiPost(path, { pin: finalPin });

      if (mode === "set") {
        if (result.ok) {
          onSuccess?.();
          onClose();
        } else {
          setError(result.error || "Error al guardar el PIN");
        }
      } else {
        if (result.valid) {
          unlock();
          onSuccess?.();
          onClose();
        } else {
          setError("PIN incorrecto. Intenta de nuevo.");
          setDigits(["", "", "", ""]);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
        }
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            />

            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-center">
                {mode === "set"
                  ? step === "enter" ? "Crea tu PIN de 4 dígitos" : "Confirma tu PIN"
                  : "Ingresa tu PIN"}
              </h2>
              <p className="text-sm text-muted-foreground text-center mt-1">
                {mode === "set"
                  ? step === "enter"
                    ? "Este PIN protegerá tus hábitos privados"
                    : "Escribe el PIN nuevamente para confirmar"
                  : "Ingresa tu PIN para ver tus hábitos privados"}
              </p>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              {(step === "confirm" ? confirm : digits).map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type={showDigits ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-all
                    ${d ? "border-primary bg-primary/5" : "border-border bg-gray-50"}
                    focus:border-primary focus:ring-2 focus:ring-primary/20`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowDigits(!showDigits)}
              className="flex items-center gap-1 text-xs text-muted-foreground mx-auto mb-2 hover:text-foreground transition-colors"
            >
              {showDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showDigits ? "Ocultar" : "Mostrar"} dígitos
            </button>

            {error && (
              <p className="text-sm text-red-500 text-center mt-2 font-medium">{error}</p>
            )}

            {loading && (
              <p className="text-sm text-muted-foreground text-center mt-3">Verificando...</p>
            )}

            <Button
              variant="ghost"
              className="w-full mt-4 text-muted-foreground"
              onClick={onClose}
            >
              Cancelar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
