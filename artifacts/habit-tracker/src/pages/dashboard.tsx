import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, CheckCircle2, ShieldCheck, LogOut, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useListHabits, useDeleteHabit } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/habit-card";
import { PushToggle } from "@/components/push-toggle";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { data: habits, isLoading } = useListHabits();
  const queryClient = useQueryClient();
  const deleteHabit = useDeleteHabit();
  const [confirmId, setConfirmId] = useState<string | null>(null);

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
              <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 hidden sm:flex">
                <ShieldCheck className="w-4 h-4" /> Panel Admin
              </Link>
            )}
            <span className="text-sm font-medium text-foreground hidden sm:block">
              Hola, {user?.name.split(" ")[0]}
            </span>
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
                return raw
                  .replace(/\./g, "")
                  .replace(/^\w/, c => c.toUpperCase())
                  .replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`);
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
              <Button size="lg" className="rounded-xl h-14 px-8 text-lg">
                Crear mi primer hábito
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {habits.map((habit, i) => (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <HabitCard
                  habitId={habit.id}
                  onDeleteClick={setConfirmId}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Confirm delete modal */}
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
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setConfirmId(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl"
                  onClick={() => handleDelete(confirmId)}
                  disabled={deleteHabit.isPending}
                >
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
