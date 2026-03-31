import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, CheckCircle2, ShieldCheck, LogOut, Trash2, Lock, Unlock, MoreHorizontal, GripVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useListHabits, useDeleteHabit } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { usePinContext } from "@/contexts/pin-context";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/habit-card";
import { PushToggle } from "@/components/push-toggle";
import { PinModal } from "@/components/pin-modal";

const ORDER_STORAGE_KEY = "compy_habit_order";

function loadOrderFromStorage(): string[] {
  try { return JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
function saveOrderToStorage(ids: string[]) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
}

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/api${path}`;
}

async function fetchOrderFromServer(): Promise<string[]> {
  try {
    const res = await fetch(getApiUrl("/habits/order"));
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.order) ? data.order : [];
  } catch { return []; }
}

async function saveOrderToServer(ids: string[]): Promise<void> {
  try {
    await fetch(getApiUrl("/habits/order"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ids }),
    });
  } catch { }
}

function applyOrder(habits: { id: string }[], order: string[]): { id: string }[] {
  if (!order.length) return habits;
  const map = new Map(habits.map(h => [h.id, h]));
  const sorted = order.filter(id => map.has(id)).map(id => map.get(id)!);
  const rest = habits.filter(h => !order.includes(h.id));
  return [...sorted, ...rest];
}

function LockedCard({ onUnlock, onDelete, habitNumber }: { onUnlock: () => void; onDelete: () => void; habitNumber: number }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="relative bg-white rounded-2xl border-2 border-gray-900 overflow-visible cursor-pointer" style={{ boxShadow: '4px 4px 0 0 #1e293b' }}
      onClick={onUnlock}
    >
      <div className="px-5 pt-4 pb-4 pr-8 sm:pr-5 sm:pl-8">

        {/* Row 1: lock icon + name + menu — mirrors HabitCard header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">🔒</span>
            <span className="text-[15px] font-bold text-foreground leading-tight truncate">
              Hábito privado {habitNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 rounded-lg hover:bg-gray-100 text-muted-foreground/60 transition-colors shrink-0"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div
              className="absolute right-2 top-10 bg-white border border-border rounded-xl shadow-lg z-20 py-1 w-40"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => { setShowMenu(false); onUnlock(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-foreground"
              >
                <Unlock className="w-4 h-4" /> Desbloquear
              </button>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                onClick={() => { setShowMenu(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Row 2: blurred placeholder badges — mirrors the options badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["██████", "████████"].map((_, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-100 select-none"
            >
              ██████
            </span>
          ))}
        </div>

        {/* Row 3: footer — mirrors streak / calendar row */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs font-semibold text-gray-200 select-none">████████</span>
          <span className="text-xs text-gray-200 select-none">———</span>
        </div>
      </div>
    </div>
  );
}

function SortableCard({
  habitId,
  isPrivate,
  isUnlocked,
  habitNumber,
  onDeleteClick,
  onUnlockRequest,
}: {
  habitId: string;
  isPrivate: boolean;
  isUnlocked: boolean;
  habitNumber: number;
  onDeleteClick: (id: string) => void;
  onUnlockRequest: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habitId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  if (isPrivate && !isUnlocked) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} className="relative">
        <button
          type="button"
          {...listeners}
          className="touch-none absolute top-2 right-2 sm:right-auto sm:left-2 z-10 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          aria-label="Arrastrar"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <LockedCard
          onUnlock={onUnlockRequest}
          onDelete={() => onDeleteClick(habitId)}
          habitNumber={habitNumber}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <button
        type="button"
        {...listeners}
        className="touch-none absolute top-2 right-2 sm:right-auto sm:left-2 z-10 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        aria-label="Arrastrar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <HabitCard habitId={habitId} onDeleteClick={onDeleteClick} />
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { isHabitUnlocked, unlockHabit, lockAll } = usePinContext();
  const { data: habits, isLoading } = useListHabits();
  const queryClient = useQueryClient();
  const deleteHabit = useDeleteHabit();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>(() => loadOrderFromStorage());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinTargetId, setPinTargetId] = useState<string | null>(null);

  // Year progress — use Date.UTC to avoid DST off-by-one errors
  const now = new Date();
  const nowYear = now.getFullYear();
  const totalDaysInYear =
    Math.floor((Date.UTC(nowYear, 11, 31) - Date.UTC(nowYear, 0, 1)) / 86400000) + 1;
  const daysElapsed =
    Math.floor(
      (Date.UTC(nowYear, now.getMonth(), now.getDate()) - Date.UTC(nowYear, 0, 1)) / 86400000
    ) + 1;
  const yearProgress = Math.round((daysElapsed / totalDaysInYear) * 100);

  // Number private habits by creation order in the list
  const privateHabitsMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    (habits ?? []).forEach(h => {
      if ((h as any).isPrivate) {
        count++;
        map.set(h.id, count);
      }
    });
    return map;
  }, [habits]);

  // Force-invalidate all habit queries on every mount so data is always fresh
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
  }, []);

  useEffect(() => {
    if (!habits) return;
    (async () => {
      const serverOrder = await fetchOrderFromServer();
      const order = serverOrder.length ? serverOrder : loadOrderFromStorage();
      const ordered = applyOrder(habits, order);
      setOrderedIds(ordered.map(h => h.id));
    })();
  }, [habits]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setOrderedIds(prev => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      saveOrderToStorage(next);
      saveOrderToServer(next);
      return next;
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteHabit.mutateAsync({ habitId: id });
    queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
    setConfirmId(null);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-muted-foreground font-medium animate-pulse">Cargando tus hábitos...</p>
      </div>
    );
  }

  const hasPrivate = habits?.some(h => (h as any).isPrivate) ?? false;
  const hasAnyLocked = hasPrivate && habits!.some(h => (h as any).isPrivate && !isHabitUnlocked(h.id));
  const orderedHabits = habits ? applyOrder(habits, orderedIds) : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white sticky top-0 z-10 border-b-2 border-gray-900/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex items-center gap-1.5 cursor-pointer text-primary hover:opacity-75 transition-opacity"
              title="Volver al inicio"
            >
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight hidden sm:block">Compy</span>
            </button>
            <span className="text-border/50">|</span>
            <span className="font-display font-bold text-xl tracking-tight">Mis Hábitos</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {user?.role === "admin" && (
              <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Panel Admin</span>
              </Link>
            )}
            <span className="text-sm font-medium text-foreground hidden sm:block">
              Hola, {user?.name.split(" ")[0]}
            </span>
            {hasPrivate && !hasAnyLocked && (
              <Button
                variant="ghost"
                size="icon"
                onClick={lockAll}
                title="Bloquear hábitos privados"
                className="text-primary hover:text-primary/80 rounded-full"
              >
                <Unlock className="w-5 h-5" />
              </Button>
            )}
            <PushToggle />
            <Button variant="ghost" size="icon" onClick={logout} title="Cerrar Sesión" className="text-muted-foreground hover:text-red-500 rounded-full">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Desktop: three-column grid (title | bar | button). Mobile: title+bar row, then button */}
        <div className="mb-8">
          {/* Mobile layout: flex row with title+bar, then full-width button below */}
          <div className="flex items-start justify-between gap-4 sm:hidden">
            {/* Title + date */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-display font-bold text-foreground">Tu progreso</h1>
              <p className="text-muted-foreground mt-1 text-base">
                {(() => {
                  const raw = format(new Date(), "EEE, d 'de' MMMM", { locale: es });
                  return raw.replace(/\./g, "").replace(/^\w/, c => c.toUpperCase()).replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`);
                })()}
              </p>
            </div>
            {/* Year progress bar — mobile */}
            <div className="w-36 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">{now.getFullYear()}</span>
                <span className="text-[11px] font-bold text-primary">{yearProgress}%</span>
              </div>
              <div className="h-3.5 rounded-full bg-gray-200 overflow-hidden border border-gray-300">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                  style={{ width: `${yearProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{daysElapsed} de {totalDaysInYear} días</p>
            </div>
          </div>

          {/* Desktop layout: flex with absolutely-centered bar */}
          <div className="hidden sm:flex sm:items-center relative">
            {/* Title + date — left */}
            <div className="flex-1">
              <h1 className="text-3xl font-display font-bold text-foreground">Tu progreso</h1>
              <p className="text-muted-foreground mt-1 text-lg">
                {(() => {
                  const raw = format(new Date(), "EEE, d 'de' MMMM", { locale: es });
                  return raw.replace(/\./g, "").replace(/^\w/, c => c.toUpperCase()).replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`);
                })()}
              </p>
            </div>
            {/* Year progress bar — absolutely pinned to exact center */}
            <div className="absolute left-1/2 -translate-x-1/2 w-56 text-center">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">{now.getFullYear()}</span>
                <span className="text-[11px] font-bold text-primary">{yearProgress}%</span>
              </div>
              <div className="h-3.5 rounded-full bg-gray-200 overflow-hidden border border-gray-300">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                  style={{ width: `${yearProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{daysElapsed} de {totalDaysInYear} días</p>
            </div>
            {/* Nuevo Hábito — right */}
            <div className="ml-auto">
              <Link href="/habits/new">
                <Button className="rounded-full h-12 px-6 transition-all text-base font-bold border-2 border-gray-900" style={{ boxShadow: "3px 3px 0 0 #1e293b" }}>
                  <Plus className="w-5 h-5 mr-2" />
                  Nuevo Hábito
                </Button>
              </Link>
            </div>
          </div>

          {/* Nuevo Hábito — full width below on mobile */}
          <div className="mt-4 sm:hidden">
            <Link href="/habits/new">
              <Button className="rounded-xl h-12 px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all text-base w-full">
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Hábito
              </Button>
            </Link>
          </div>
        </div>

        {!habits || habits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-12 text-center border-2 border-gray-900" style={{ boxShadow: '4px 4px 0 0 #1e293b' }}
          >
            <div className="w-20 h-20 bg-indigo-50 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Plus className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Aún no tienes hábitos</h3>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Comienza a construir una mejor versión de ti mismo creando tu primer hábito a seguir.
            </p>
            <Link href="/habits/new">
              <Button size="lg" className="rounded-full h-14 px-8 text-lg font-bold border-2 border-gray-900" style={{ boxShadow: "3px 3px 0 0 #1e293b" }}>Crear mi primer hábito</Button>
            </Link>
          </motion.div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {orderedHabits.map((habit) => {
                  const isPrivate = (habit as any).isPrivate ?? false;
                  const habitNum = privateHabitsMap.get(habit.id) ?? 1;
                  return (
                    <SortableCard
                      key={habit.id}
                      habitId={habit.id}
                      isPrivate={isPrivate}
                      isUnlocked={isHabitUnlocked(habit.id)}
                      habitNumber={habitNum}
                      onDeleteClick={setConfirmId}
                      onUnlockRequest={() => {
                        setPinTargetId(habit.id);
                        setPinModalOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="rotate-2 scale-105 opacity-90 shadow-2xl rounded-3xl">
                  {(orderedHabits.find(h => h.id === activeId) as any)?.isPrivate && !isHabitUnlocked(activeId)
                    ? <LockedCard onUnlock={() => {}} onDelete={() => {}} habitNumber={privateHabitsMap.get(activeId) ?? 1} />
                    : <HabitCard habitId={activeId} onDeleteClick={() => {}} />
                  }
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <PinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        mode="unlock"
        onSuccess={() => {
          if (pinTargetId) unlockHabit(pinTargetId);
          setPinTargetId(null);
        }}
      />

      <AnimatePresence>
        {confirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">¿Eliminar hábito?</h3>
              <p className="text-muted-foreground text-center text-sm mb-6">
                Se eliminarán el hábito y todos sus registros. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setConfirmId(null)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1 rounded-xl" onClick={() => handleDelete(confirmId)} disabled={deleteHabit.isPending}>
                  {deleteHabit.isPending ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
