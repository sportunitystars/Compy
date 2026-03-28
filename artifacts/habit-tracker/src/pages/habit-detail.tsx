import { useState, useMemo, useRef } from "react";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, getDaysInMonth, startOfMonth, getDay, isAfter, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ChevronDown, ChevronUp, Check, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useGetHabit, useUpsertLog, useDeleteLog, useUpdateHabit, getGetHabitQueryKey, getListHabitsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const MONTHS = Array.from({ length: 12 }, (_, i) => i);
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

// Helper to get streak stats
function calculateStreaks(logs: { date: string, optionIndex: number }[], options: any[]) {
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  // Collect exempt dates (all-time, for current-streak backward walk)
  const exemptIdx = options.findIndex((o: any) => o.isExempt);
  const exemptDates = new Set(
    exemptIdx >= 0 ? sortedLogs.filter(l => l.optionIndex === exemptIdx).map(l => l.date) : []
  );

  const stats = options.map((opt: any, index: number) => {
    if (opt.isExempt) return { index, currentStreak: 0, maxStreak: 0, totalCount: 0 };

    let maxStreak = 0;
    let today = new Date();
    today.setHours(0,0,0,0);

    const dates = new Set(sortedLogs.filter(l => l.optionIndex === index).map(l => l.date));

    // Max streak: skip exempt days (don't break)
    let tempStreak = 0;
    let start = new Date(today.getFullYear(), 0, 1);
    const end = today;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      if (exemptDates.has(dateStr)) continue; // transparent
      if (dates.has(dateStr)) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Current streak: count backward, skipping exempt days
    let streakCount = 0;
    let checkDate = new Date(today);
    const todayStr = format(today, 'yyyy-MM-dd');
    if (!dates.has(todayStr) && !exemptDates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    let guard = 0;
    while (guard < 400) {
      guard++;
      const ds = format(checkDate, 'yyyy-MM-dd');
      if (exemptDates.has(ds)) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      if (dates.has(ds)) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { index, currentStreak: streakCount, maxStreak, totalCount: dates.size };
  });

  return stats;
}

export default function HabitDetail() {
  const [, params] = useRoute("/habits/:id");
  const habitId = params?.id || "";
  const { data: habit, isLoading } = useGetHabit(habitId);
  
  const [showSummary, setShowSummary] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateMutation = useUpdateHabit();
  const upsertMutation = useUpsertLog();
  const deleteLogMutation = useDeleteLog();

  // Track in-flight log mutations to avoid stale refetches overwriting optimistic state
  const pendingLogMutations = useRef(0);

  const handleUpdateName = () => {
    if (!editName.trim() || editName === habit?.name) {
      setIsEditingName(false);
      return;
    }
    updateMutation.mutate(
      { habitId, data: { name: editName } },
      {
        onSuccess: () => {
          setIsEditingName(false);
          queryClient.invalidateQueries({ queryKey: getGetHabitQueryKey(habitId) });
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
        }
      }
    );
  };

  const handleLog = (dateStr: string, optionIndex: number) => {
    const key = getGetHabitQueryKey(habitId);

    // Cancel any in-flight refetch so it doesn't overwrite our optimistic state
    queryClient.cancelQueries({ queryKey: key });

    const previous = queryClient.getQueryData(key);
    pendingLogMutations.current++;

    queryClient.setQueryData(key, (old: any) => {
      if (!old) return old;
      const logs = (old.logs as any[]).filter((l: any) => l.date !== dateStr);
      logs.push({ date: dateStr, optionIndex });
      return { ...old, logs };
    });

    upsertMutation.mutate(
      { habitId, date: dateStr, data: { optionIndex } },
      {
        onError: () => queryClient.setQueryData(key, previous),
        onSettled: () => {
          pendingLogMutations.current--;
          // Only re-fetch once all in-flight mutations have settled
          if (pendingLogMutations.current === 0) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        },
      }
    );
  };

  const handleClearLog = (dateStr: string) => {
    const key = getGetHabitQueryKey(habitId);

    queryClient.cancelQueries({ queryKey: key });

    const previous = queryClient.getQueryData(key);
    pendingLogMutations.current++;

    queryClient.setQueryData(key, (old: any) => {
      if (!old) return old;
      return { ...old, logs: (old.logs as any[]).filter((l: any) => l.date !== dateStr) };
    });

    deleteLogMutation.mutate(
      { habitId, date: dateStr },
      {
        onError: () => queryClient.setQueryData(key, previous),
        onSettled: () => {
          pendingLogMutations.current--;
          if (pendingLogMutations.current === 0) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        },
      }
    );
  };

  const streaks = useMemo(() => {
    if (!habit) return [];
    return calculateStreaks(habit.logs, habit.options);
  }, [habit]);

  // Year-level stats
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const currentYear = today.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const totalYearDays = Math.floor((today.getTime() - yearStart.getTime()) / 86400000) + 1;


  if (isLoading || !habit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white sticky top-0 z-20 border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="text-4xl">{habit.emoji}</div>
            {isEditingName ? (
              <Input 
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleUpdateName}
                onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                className="text-2xl font-bold font-display h-auto py-1 max-w-sm"
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2 group cursor-pointer" onClick={() => {
                setEditName(habit.name);
                setIsEditingName(true);
              }}>
                {habit.name}
                <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        
        {/* YEARLY SUMMARY TOGGLE */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <button
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/80 transition-colors"
            onClick={() => setShowSummary(!showSummary)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-sm">{habit.emoji}</span>
              </div>
              <div>
                <span className="font-bold text-foreground">Resumen</span>
                <p className="text-xs text-muted-foreground mt-0.5">Mes actual · Año {currentYear}</p>
              </div>
            </div>
            {showSummary ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showSummary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border/60"
              >
                <div className="p-5 space-y-5">
                  {/* YEAR STATS */}
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Año {currentYear} · {totalYearDays} días transcurridos
                    </p>
                    <div className="space-y-3">
                      {habit.options.map((opt: any, idx: number) => {
                        if (opt.isExempt) return null;
                        const stat = streaks[idx];
                        const pct = Math.round((stat.totalCount / totalYearDays) * 100);
                        const streakLabel = opt.isNegative ? 'peor racha' : 'mejor racha';
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{opt.label}</span>
                              <span className="text-xs font-bold" style={{ color: opt.color }}>{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-0.5">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: opt.color }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {stat.totalCount} de {totalYearDays} días
                              {stat.maxStreak >= 2 && <span> · {streakLabel}: {stat.maxStreak}d</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STREAK ALERTS */}
                  <div className="space-y-2">
                    {habit.options.map((opt: any, idx: number) => {
                      if (opt.isExempt) return null;
                      const stat = streaks[idx];
                      if (stat.currentStreak < 2) return null;

                      const n = stat.currentStreak;
                      let title = '';
                      let sub = '';

                      if (opt.isPositive) {
                        if (n < 5) {
                          title = `¡${n} días seguidos de ${opt.label}!`;
                          sub = 'Buen comienzo. El hábito se construye día a día.';
                        } else if (n < 10) {
                          title = `¡${n} días de racha en ${opt.label}!`;
                          sub = 'Ya llevas casi una semana. La constancia da sus frutos.';
                        } else if (n < 15) {
                          title = `¡${n} días consecutivos!`;
                          sub = 'Dos semanas seguidas. Esto ya está empezando a ser rutina.';
                        } else if (n < 30) {
                          title = `¡${n} días sin parar!`;
                          sub = 'Más de dos semanas. Tu disciplina está marcando la diferencia.';
                        } else if (n < 60) {
                          title = `¡${n} días! Un mes completo.`;
                          sub = 'Un mes de racha. Eso ya es un hábito de verdad. ¡Extraordinario!';
                        } else {
                          title = `¡${n} días! Eso es imparable.`;
                          sub = 'Más de dos meses sin fallar. Eres un ejemplo de constancia.';
                        }
                        return (
                          <div
                            key={idx}
                            className="rounded-2xl p-4 flex items-start gap-3"
                            style={{ backgroundColor: `${opt.color}12`, border: `1px solid ${opt.color}28` }}
                          >
                            <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: `${opt.color}25` }}>
                              <span className="text-base font-black" style={{ color: opt.color }}>{n}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm leading-snug" style={{ color: opt.color }}>{title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                            </div>
                          </div>
                        );
                      }

                      if (opt.isNegative) {
                        if (n < 5) {
                          title = `${n} días marcando ${opt.label}.`;
                          sub = 'Aún puedes cambiar el rumbo fácilmente. Hoy es un buen día para empezar.';
                        } else if (n < 10) {
                          title = `${n} días seguidos de ${opt.label}.`;
                          sub = 'Una semana acumulando esto. Identifica qué lo está provocando.';
                        } else if (n < 15) {
                          title = `${n} días de ${opt.label}.`;
                          sub = 'Ya van casi dos semanas. Es momento de tomar una acción concreta.';
                        } else if (n < 30) {
                          title = `${n} días seguidos.`;
                          sub = 'Más de dos semanas. Habla con alguien o busca un pequeño cambio hoy.';
                        } else {
                          title = `${n} días marcando ${opt.label}.`;
                          sub = 'Llevas un mes. Recuerda: siempre puedes elegir diferente. Un día a la vez.';
                        }
                        return (
                          <div key={idx} className="rounded-2xl p-4 flex items-start gap-3 bg-slate-50 border border-slate-200">
                            <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-slate-200">
                              <span className="text-base font-black text-slate-600">{n}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-700 leading-snug">{title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CALENDAR GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MONTHS.map(month => (
            <MonthBlock 
              key={month} 
              month={month} 
              year={currentYear} 
              habit={habit} 
              onLog={handleLog}
              onClear={handleClearLog}
            />
          ))}
        </div>
        
      </main>
    </div>
  );
}

// Sub-component for individual month
function MonthBlock({ month, year, habit, onLog, onClear }: { month: number, year: number, habit: any, onLog: any, onClear: any }) {
  const date = new Date(year, month, 1);
  const daysInMonth = getDaysInMonth(date);
  
  // getDay() returns 0 (Sun) to 6 (Sat). We want Monday=0, Sunday=6
  let startDay = getDay(date) - 1;
  if (startDay === -1) startDay = 6;

  const today = new Date();
  today.setHours(0,0,0,0);

  // Month stats calculation
  const monthPadStr = (month+1).toString().padStart(2, '0');
  const monthLogs = habit.logs.filter((l: any) => l.date.startsWith(`${year}-${monthPadStr}`));

  // Exempt option setup
  const exemptIdx = habit.options.findIndex((o: any) => o.isExempt);
  const exemptDaysSet = new Set<string>(
    exemptIdx >= 0 ? monthLogs.filter((l: any) => l.optionIndex === exemptIdx).map((l: any) => l.date) : []
  );
  const exemptCount = exemptDaysSet.size;

  // We need max streak IN THIS MONTH for each option.
  // And current streak (only if this is the current month).
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const lastDayToCount = isCurrentMonth ? today.getDate() : daysInMonth;
  const effectiveDays = lastDayToCount - exemptCount;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border flex flex-col">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="font-bold text-lg capitalize">{format(date, 'MMMM', { locale: es })}</h3>
        <span className="text-xs font-semibold text-muted-foreground bg-gray-100 px-2 py-1 rounded-md">
          {monthLogs.filter((l: any) => !exemptDaysSet.has(l.date)).length}/{effectiveDays > 0 ? effectiveDays : daysInMonth}
          {exemptCount > 0 && <span className="ml-1 text-slate-400">· {exemptCount} exc.</span>}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {habit.options.map((opt: any, i: number) => {
          if (opt.isExempt) return null; // never show exempt option in stats pills
          const count = monthLogs.filter((l:any) => l.optionIndex === i).length;
          const pct = effectiveDays > 0 ? Math.round((count / effectiveDays) * 100) : 0;
          if (count === 0) return null;
          return (
            <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-sm" style={{ color: opt.color, backgroundColor: `${opt.color}15` }}>
              {opt.label} {pct}%
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">
            {d}
          </div>
        ))}
        
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayDate = new Date(year, month, i + 1);
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          const isFuture = isAfter(dayDate, today);
          const existingLog = habit.logs.find((l: any) => l.date === dateStr);
          const opt = existingLog ? habit.options[existingLog.optionIndex] : null;
          const isExemptDay = opt?.isExempt === true;

          if (isFuture) {
            return (
              <div key={i} className="aspect-square rounded-md bg-gray-50/50 flex items-center justify-center text-gray-300 text-xs cursor-not-allowed">
                {i + 1}
              </div>
            );
          }

          return (
            <button
              key={i}
              title={opt ? opt.label : 'Sin registrar'}
              onClick={() => {
                if (!existingLog) {
                  onLog(dateStr, 0);
                } else {
                  const nextIdx = existingLog.optionIndex + 1;
                  if (nextIdx >= habit.options.length) {
                    onClear(dateStr);
                  } else {
                    onLog(dateStr, nextIdx);
                  }
                }
              }}
              className="aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium transition-all hover:scale-110 active:scale-90 shadow-sm"
              style={isExemptDay ? {
                backgroundColor: `${opt!.color}18`,
                color: opt!.color,
                border: `1.5px dashed ${opt!.color}80`,
              } : {
                backgroundColor: opt ? opt.color : '#f3f4f6',
                color: opt ? '#fff' : '#6b7280',
                border: opt ? `1px solid ${opt.color}` : '1px solid #e5e7eb'
              }}
            >
              {i + 1}
              {isExemptDay && <span className="text-[7px] leading-none opacity-70">⊘</span>}
            </button>
          );
        })}
      </div>

    </div>
  );
}
