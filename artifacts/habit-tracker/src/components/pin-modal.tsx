import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Mail, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePinContext } from "@/contexts/pin-context";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

function getApiUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/api${path}`;
}

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  mode: "set" | "unlock";
  onSuccess?: () => void;
}

type Screen = "pin" | "confirm" | "forgot-sent" | "reset-code";

export function PinModal({ open, onClose, mode, onSuccess }: PinModalProps) {
  const [screen, setScreen] = useState<Screen>("pin");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(["", "", "", ""]);
  const [resetCode, setResetCode] = useState("");
  const [newPinDigits, setNewPinDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDigits, setShowDigits] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { unlock } = usePinContext();

  useEffect(() => {
    if (open) {
      setScreen("pin");
      setDigits(["", "", "", ""]);
      setConfirmDigits(["", "", "", ""]);
      setResetCode("");
      setNewPinDigits(["", "", "", ""]);
      setError("");
      setLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    }
  }, [open]);

  const handleDigitInput = useCallback((
    index: number,
    rawVal: string,
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    onComplete?: (pin: string) => void
  ) => {
    const digit = rawVal.replace(/\D/g, "").slice(-1);
    const next = [...arr];
    next[index] = digit;
    setArr(next);
    setError("");

    if (digit && index < 3) {
      refs.current[index + 1]?.focus();
    }
    if (digit && index === 3) {
      const pin = next.join("");
      if (pin.length === 4) {
        onComplete?.(pin);
      }
    }
  }, []);

  const handleDigitKeyDown = useCallback((
    index: number,
    e: React.KeyboardEvent,
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === "Backspace") {
      if (arr[index]) {
        const next = [...arr];
        next[index] = "";
        setArr(next);
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        const next = [...arr];
        next[index - 1] = "";
        setArr(next);
      }
    }
  }, []);

  async function submitPin(pin: string) {
    if (mode === "set" && screen === "pin") {
      setScreen("confirm");
      setConfirmDigits(["", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    if (mode === "set" && screen === "confirm") {
      if (pin !== digits.join("")) {
        setError("Los PINs no coinciden. Intenta de nuevo.");
        setConfirmDigits(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }
      await doSetPin(digits.join(""));
      return;
    }

    if (mode === "unlock" && screen === "pin") {
      await doVerifyPin(pin);
    }
  }

  async function doSetPin(pin: string) {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/pin/set"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.ok) {
        onSuccess?.();
        onClose();
      } else {
        setError(data.error || "Error al guardar el PIN");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function doVerifyPin(pin: string) {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/pin/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.valid) {
        unlock();
        onSuccess?.();
        onClose();
      } else {
        setError("PIN incorrecto. Intenta de nuevo.");
        setDigits(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPin() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl("/pin/forgot"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        setSentEmail(data.email || "tu correo");
        setScreen("forgot-sent");
      } else {
        setError(data.error || "Error al enviar el código");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetWithCode() {
    if (resetCode.length !== 6) {
      setError("Ingresa el código de 6 dígitos");
      return;
    }
    const newPin = newPinDigits.join("");
    if (newPin.length !== 4) {
      setError("Ingresa tu nuevo PIN de 4 dígitos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl("/pin/reset-with-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: resetCode, newPin }),
      });
      const data = await res.json();
      if (data.ok) {
        onSuccess?.();
        onClose();
      } else {
        setError(data.error || "Código incorrecto o expirado");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const currentDigits = screen === "confirm" ? confirmDigits : digits;
  const setCurrentDigits = screen === "confirm" ? setConfirmDigits : setDigits;

  function renderPinTitle() {
    if (screen === "confirm") return "Confirma tu PIN";
    return mode === "set" ? "Crea tu PIN de 4 dígitos" : "Ingresa tu PIN";
  }

  function renderPinSubtitle() {
    if (screen === "confirm") return "Escribe el PIN nuevamente para confirmar";
    return mode === "set"
      ? "Este PIN protegerá tus hábitos privados"
      : "Ingresa tu PIN para ver tus hábitos privados";
  }

  const pinBoxes = (
    <div className="flex justify-center gap-3 mb-2">
      {currentDigits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type={showDigits ? "text" : "password"}
          inputMode="numeric"
          maxLength={2}
          value={d}
          onChange={(e) => handleDigitInput(
            i, e.target.value, currentDigits, setCurrentDigits, inputRefs,
            (pin) => submitPin(pin)
          )}
          onKeyDown={(e) => handleDigitKeyDown(i, e, currentDigits, setCurrentDigits, inputRefs)}
          className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-all
            ${d ? "border-primary bg-primary/5" : "border-border bg-gray-50"}
            focus:border-primary focus:ring-2 focus:ring-primary/20`}
        />
      ))}
    </div>
  );

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
            className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full relative"
          >
            {/* ── PIN entry (set or unlock) ────────────────────── */}
            {(screen === "pin" || screen === "confirm") && (
              <>
                <div className="flex flex-col items-center mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-center">{renderPinTitle()}</h2>
                  <p className="text-sm text-muted-foreground text-center mt-1">{renderPinSubtitle()}</p>
                </div>

                {pinBoxes}

                <button
                  type="button"
                  onClick={() => setShowDigits(!showDigits)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground mx-auto mb-1 hover:text-foreground transition-colors"
                >
                  {showDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showDigits ? "Ocultar" : "Mostrar"} dígitos
                </button>

                {error && (
                  <p className="text-sm text-red-500 text-center mt-2 font-medium">{error}</p>
                )}

                <Button
                  className="w-full mt-4 h-12 rounded-xl"
                  onClick={() => {
                    const pin = currentDigits.join("");
                    if (pin.length === 4) submitPin(pin);
                    else setError("Ingresa los 4 dígitos de tu PIN");
                  }}
                  disabled={loading}
                >
                  {loading ? "Verificando..." : screen === "confirm" ? "Confirmar PIN" : mode === "set" ? "Continuar" : "Ingresar"}
                </Button>

                {mode === "unlock" && screen === "pin" && (
                  <button
                    type="button"
                    onClick={handleForgotPin}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground mx-auto mt-3 hover:text-primary transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Olvidé mi PIN
                  </button>
                )}

                <Button
                  variant="ghost"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </>
            )}

            {/* ── Code sent confirmation ───────────────────────── */}
            {screen === "forgot-sent" && (
              <>
                <div className="flex flex-col items-center mb-6">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                    <Mail className="w-7 h-7 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-bold text-center">Código enviado</h2>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Enviamos un código de 6 dígitos a <strong>{sentEmail}</strong>. Revisa tu bandeja de entrada.
                  </p>
                </div>

                <Button
                  className="w-full h-12 rounded-xl"
                  onClick={() => { setScreen("reset-code"); setError(""); }}
                >
                  Ingresar código
                </Button>
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
              </>
            )}

            {/* ── Reset with code ──────────────────────────────── */}
            {screen === "reset-code" && (
              <>
                <button
                  type="button"
                  onClick={() => { setScreen("pin"); setError(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>

                <div className="flex flex-col items-center mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-center">Restablecer PIN</h2>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Ingresa el código del correo y tu nuevo PIN de 4 dígitos.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Código de verificación</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => {
                        setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setError("");
                      }}
                      className="h-12 text-center text-xl tracking-widest font-bold rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Nuevo PIN de 4 dígitos</label>
                    <div className="flex justify-center gap-3">
                      {newPinDigits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => { newPinRefs.current[i] = el; }}
                          type={showDigits ? "text" : "password"}
                          inputMode="numeric"
                          maxLength={2}
                          value={d}
                          onChange={(e) => handleDigitInput(
                            i, e.target.value, newPinDigits, setNewPinDigits, newPinRefs
                          )}
                          onKeyDown={(e) => handleDigitKeyDown(i, e, newPinDigits, setNewPinDigits, newPinRefs)}
                          className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-all
                            ${d ? "border-primary bg-primary/5" : "border-border bg-gray-50"}
                            focus:border-primary focus:ring-2 focus:ring-primary/20`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center mt-3 font-medium">{error}</p>
                )}

                <Button
                  className="w-full mt-4 h-12 rounded-xl"
                  onClick={handleResetWithCode}
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "Restablecer PIN"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
