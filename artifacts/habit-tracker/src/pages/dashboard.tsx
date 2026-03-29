import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
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

function loadOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
function saveOrder(ids: string[]) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
}
function applyOrder(habits: { id: string }[], order: string[]): { id: string }[] {
  if (!order.length) return habits;
  const map = new Map(habits.map(h => [h.id, h]));
  const sorted = order.filter(id => map.has(id)).map(id => map.get(id)!);
  const rest = habits.filter(h => !order.includes(h.id));
  return [...sorted, ...rest];
}

function LockedCard({ onUnlock, onDelete }: { onUnlock: () => void; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-visible cursor-pointer"
      onClick={onUnlock}
    >
      <div className="px-5 pt-4 pb-4">

        {/* Row 1: lock icon + name + menu — mirrors HabitCard header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">🔒</span>
            <span className="text-[15px] font-bold text-foreground leading-tight truncate">
              Hábito privado
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 rounded-lg hover:bg-gray-100 text-muted-foreground/40 transition-colors shrink-0"
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
  onDeleteClick,
  onUnlockRequest,
}: {
  habitId: string;
  isPrivate: boolean;
  isUnlocked: boolean;
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
        {/* drag handle */}
        <button
          type="button"
          {...listeners}
          className="touch-none absolute top-2 right-8 z-10 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          aria-label="Arrastrar"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <LockedCard
          onUnlock={onUnlockRequest}
          onDelete={() => onDeleteClick(habitId)}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      {/* drag handle — esquina superior izquierda, no bloquea scroll */}
      <button
        type="button"
        {...listeners}
        className="touch-none absolute top-2 left-2 z-10 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
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
  const { isUnlocked, lock } = usePinContext();
  const { data: habits, isLoading } = useListHabits();
  const queryClient = useQueryClient();
  const deleteHabit = useDeleteHabit();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  useEffect(() => {
    if (habits) {
      const saved = loadOrder();
      const ordered = applyOrder(habits, saved);
      setOrderedIds(ordered.map(h => h.id));
    }
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
      saveOrder(next);
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
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-muted-foreground font-medium animate-pulse">Cargando tus hábitos...</p>
      </div>
    );
  }

  const habitsWithMeta = habits as (typeof habits extends (infer T)[] | undefined ? T & { isPrivate?: boolean } : never)[] | undefined;
  const hasPrivate = habitsWithMeta?.some(h => (h as any).isPrivate) ?? false;
  const orderedHabits = habits ? applyOrder(habits, orderedIds) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white sticky top-0 z-10 border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" />
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
            {hasPrivate && (
              isUnlocked ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lock}
                  title="Bloquear hábitos privados"
                  className="text-primary hover:text-primary/80 rounded-full"
                >
                  <Unlock className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPinModalOpen(true)}
                  title="Ver hábitos privados"
                  className="text-muted-foreground hover:text-primary rounded-full"
                >
                  <Lock className="w-5 h-5" />
                </Button>
              )
            )}
            <PushToggle />
            <Button variant="ghost" size="icon" onClick={logout} title="Cerrar Sesión" className="text-muted-foreground hover:text-red-500 rounded-full">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Tu progreso</h1>
            <p className="text-muted-foreground mt-1 text-base sm:text-lg">
              {(() => {
                const raw = format(new Date(), "EEE, d 'de' MMMM", { locale: es });
                return raw.replace(/\./g, "").replace(/^\w/, c => c.toUpperCase()).replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`);
              })()}
            </p>
          </div>
          <Link href="/habits/new">
            <Button className="rounded-xl h-12 px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all text-base w-full sm:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Hábito
            </Button>
          </Link>
        </div>

        {!habits || habits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-12 text-center border border-border shadow-sm"
          >
            <div className="w-20 h-20 bg-indigo-50 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Plus className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Aún no tienes hábitos</h3>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Comienza a construir una mejor versión de ti mismo creando tu primer hábito a seguir.
            </p>
            <Link href="/habits/new">
              <Button size="lg" className="rounded-xl h-14 px-8 text-lg">Crear mi primer hábito</Button>
            </Link>
          </motion.div>
        ) : (
          <>
          {/* Mobile: horizontal scroll row */}
          <div className="flex md:hidden overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {orderedHabits.map((habit) => (
              <div key={habit.id} className="shrink-0 w-[260px] snap-start">
                {(habit as any).isPrivate && !isUnlocked ? (
                  <LockedCard
                    onUnlock={() => setPinModalOpen(true)}
                    onDelete={() => setConfirmId(habit.id)}
                  />
                ) : (
                  <HabitCard habitId={habit.id} onDeleteClick={setConfirmId} />
                )}
              </div>
            ))}
          </div>

          {/* Desktop: sortable grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orderedHabits.map((habit) => (
                  <SortableCard
                    key={habit.id}
                    habitId={habit.id}
                    isPrivate={(habit as any).isPrivate ?? false}
                    isUnlocked={isUnlocked}
                    onDeleteClick={setConfirmId}
                    onUnlockRequest={() => setPinModalOpen(true)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="rotate-2 scale-105 opacity-90 shadow-2xl rounded-3xl">
                  {(orderedHabits.find(h => h.id === activeId) as any)?.isPrivate && !isUnlocked
                    ? <LockedCard />
                    : <HabitCard habitId={activeId} onDeleteClick={() => {}} />
                  }
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          </>
        )}
      </main>

      <PinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        mode="unlock"
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
