import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PinContextValue {
  unlockedIds: Set<string>;
  isHabitUnlocked: (id: string) => boolean;
  unlockHabit: (id: string) => void;
  lockAll: () => void;
  // Legacy alias — kept so existing code compiles
  isUnlocked: boolean;
  lock: () => void;
}

const PinContext = createContext<PinContextValue | null>(null);

export function PinProvider({ children }: { children: ReactNode }) {
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  const unlockHabit = useCallback((id: string) => {
    setUnlockedIds(prev => new Set([...prev, id]));
  }, []);

  const lockAll = useCallback(() => {
    setUnlockedIds(new Set());
  }, []);

  const isHabitUnlocked = useCallback((id: string) => unlockedIds.has(id), [unlockedIds]);

  return (
    <PinContext.Provider
      value={{
        unlockedIds,
        isHabitUnlocked,
        unlockHabit,
        lockAll,
        isUnlocked: unlockedIds.size > 0,
        lock: lockAll,
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
