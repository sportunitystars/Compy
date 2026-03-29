import { createContext, useContext, useState, type ReactNode } from "react";

interface PinContextValue {
  isUnlocked: boolean;
  unlock: () => void;
  lock: () => void;
}

const PinContext = createContext<PinContextValue | null>(null);

export function PinProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  return (
    <PinContext.Provider
      value={{
        isUnlocked,
        unlock: () => setIsUnlocked(true),
        lock: () => setIsUnlocked(false),
      }}
    >
      {children}
    </PinContext.Provider>
  );
}

export function usePinContext() {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error("usePinContext must be used inside PinProvider");
  return ctx;
}
