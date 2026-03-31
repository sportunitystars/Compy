import { useState, useMemo, useRef, useCallback } from "react";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, getDaysInMonth, getDay, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ChevronDown, ChevronUp, Edit2, CheckSquare, X, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useGetHabit, useUpsertLog, useDeleteLog, useUpdateHabit, getGetHabitQueryKey, getListHabitsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const MONTHS = Array.from({ length: 12 }, (_, i) => i);
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function calculateStreaks(logs: { date: string, optionIndex: number }[], options: any[]) {
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));

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

    let tempStreak = 0;
    let start = new Date(today.getFullYear(), 0, 1);
    const end = today;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      if (exemptDates.has(dateStr)) continue;
      if (dates.has(dateStr)) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    let streakCount = 0;
    let checkDate = new Date(today);
    const todayStr = format(today, 'yyyy-MM-dd');

    const todayLog = sortedLogs.find(l => l.date === todayStr);
    if (todayLog && !dates.has(todayStr) && !exemptDates.has(todayStr)) {
      return { index, currentStreak: 0, maxStreak, totalCount: dates.size };
    }
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

  // Multi-select state: which month is in select mode (null = none), and which dates are selected
  const [selectMonth, setSelectMonth] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useUpdateHabit();
  const upsertMutation = useUpsertLog();
  const deleteLogMutation = useDeleteLog();

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

  const handleLog = useCallback((dateStr: string, optionIndex: number) => {
    const key = getGetHabitQueryKey(habitId);
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
          if (pendingLogMutations.current === 0) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        },
      }
    );
  }, [habitId, queryClient, upsertMutation]);

  const handleClearLog = useCallback((dateStr: string) => {
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
  }, [habitId, queryClient, deleteLogMutation]);

  // Toggle select mode for a given month
  const handleToggleSelectMode = useCallback((month: number) => {
    if (selectMonth === month) {
      setSelectMonth(null);
      setSelectedDates(new Set());
    } else {
      setSelectMonth(month);
      setSelectedDates(new Set());
    }
  }, [selectMonth]);

  // Toggle a date in/out of the selection set
  const handleToggleDate = useCallback((dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  }, []);

  // Apply an option to all selected dates in parallel, then exit select mode
  const handleBulkApply = useCallback((optionIndex: number) => {
    const dates = Array.from(selectedDates);
    dates.forEach(dateStr => handleLog(dateStr, optionIndex));
    setSelectMonth(null);
    setSelectedDates(new Set());
  }, [selectedDates, handleLog]);

  // Clear logs for all selected dates in parallel, then exit select mode
  const handleBulkClear = useCallback(() => {
    const dates = Array.from(selectedDates);
    dates.forEach(dateStr => handleClearLog(dateStr));
    setSelectMonth(null);
    setSelectedDates(new Set());
  }, [selectedDates, handleClearLog]);

  // Cancel select mode without changes
  const handleExitSelect = useCallback(() => {
    setSelectMonth(null);
    setSelectedDates(new Set());
  }, []);

  const streaks = useMemo(() => {
    if (!habit) return [];
    return calculateStreaks(habit.logs, habit.options);
  }, [habit]);

  const today = new Date();
  const currentYear = today.getFullYear();
  // Use Date.UTC to avoid DST off-by-one: local midnight differences are not
  // always exactly 86400000 ms when daylight saving time changes mid-year.
  const totalYearDays =
    Math.floor(
      (Date.UTC(currentYear, today.getMonth(), today.getDate()) -
       Date.UTC(currentYear, 0, 1)) / 86400000
    ) + 1;

  const exemptYearCount = useMemo(() => {
    if (!habit) return 0;
    const exemptIdx = habit.options.findIndex((o: any) => o.isExempt);
    if (exemptIdx < 0) return 0;
    const yearStr = `${currentYear}-`;
    return habit.logs.filter((l: any) => l.optionIndex === exemptIdx && l.date.startsWith(yearStr)).length;
  }, [habit, currentYear]);

  if (isLoading || !habit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectionActive = selectMonth !== null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-white sticky top-0 z-20 border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground shrink-0">
                <ArrowLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
            </Link>
            <div className="text-2xl sm:text-4xl shrink-0">{habit.emoji}</div>
            {isEditingName ? (
              <Input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleUpdateName}
                onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                className="text-lg sm:text-2xl font-bold font-display h-auto py-1 min-w-0"
              />
            ) : (
              <h1 className="text-xl sm:text-3xl font-display font-bold flex items-center gap-2 group cursor-pointer min-w-0 truncate" onClick={() => {
                setEditName(habit.name);
                setIsEditingName(true);
              }}>
                <span className="truncate">{habit.name}</span>
                <Edit2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

        {/* STICKY: RESUMEN + RACHA */}
        <div className="sticky top-[57px] sm:top-[65px] z-10 bg-background pb-3 space-y-3">

          {/* YEARLY SUMMARY TOGGLE */}
          <div className="bg-white rounded-2xl overflow-hidden border-2 border-gray-900" style={{ boxShadow: '4px 4px 0 0 #1e293b' }}>
            <button
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
              onClick={() => setShowSummary(!showSummary)}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-foreground">Resumen</span>
                <span className="text-sm text-muted-foreground font-medium">{currentYear}</span>
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
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 leading-relaxed">
                        Año {currentYear} · {totalYearDays} días transcurridos · {Math.round((totalYearDays / 365) * 100)}% del año
                      </p>
                      <div className="space-y-4">
                        {habit.options.map((opt: any, idx: number) => {
                          if (opt.isExempt) return null;
                          const stat = streaks[idx];
                          const effectiveYearDays = Math.max(totalYearDays - exemptYearCount, 1);
                          const pct = Math.round((stat.totalCount / effectiveYearDays) * 100);
                          const streakLabel = opt.isNegative ? 'peor racha' : 'mejor racha';
                          return (
                            <div key={idx}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                                <span className="text-sm font-bold" style={{ color: opt.color }}>{pct}%</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden mb-1.5">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: opt.color }} />
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {stat.totalCount} de {effectiveYearDays} días{exemptYearCount > 0 ? ` · ${exemptYearCount} excl.` : ''}
                                {stat.maxStreak >= 2 && <span> · {streakLabel}: {stat.maxStreak}d</span>}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* STREAK MESSAGES */}
          {streaks.some((s, i) => !habit.options[i]?.isExempt && s.currentStreak >= 2) && (
            <div className="space-y-2">
              {habit.options.map((opt: any, idx: number) => {
                if (opt.isExempt) return null;
                const n = streaks[idx].currentStreak;
                if (n < 2) return null;

                let title = '';
                let sub = '';

                if (opt.isPositive) {
                  if (n < 5)       { title = `¡${n} días de racha!`; sub = 'Buen comienzo. El hábito se construye día a día.'; }
                  else if (n < 10) { title = `¡${n} días de racha!`; sub = 'Casi una semana. Tu constancia está dando resultados.'; }
                  else if (n < 15) { title = `¡${n} días de racha!`; sub = 'Dos semanas seguidas. Esto ya está convirtiéndose en rutina.'; }
                  else if (n < 30) { title = `¡${n} días de racha!`; sub = 'Más de dos semanas. Tu disciplina está marcando la diferencia.'; }
                  else if (n < 60) { title = `¡${n} días de racha!`; sub = 'Un mes de racha. Eso ya es un hábito de verdad.'; }
                  else             { title = `¡${n} días de racha!`; sub = 'Más de dos meses sin fallar. Eres un ejemplo de constancia.'; }
                } else if (opt.isNegative) {
                  if (n < 5)       { title = `${n} días de racha.`; sub = 'Aún puedes cambiar el rumbo. Hoy es un buen día para empezar.'; }
                  else if (n < 10) { title = `${n} días de racha.`; sub = 'Una semana así. Identifica qué lo está provocando y actúa hoy.'; }
                  else if (n < 15) { title = `${n} días de racha.`; sub = 'Casi dos semanas. Un pequeño cambio hoy puede romper este patrón.'; }
                  else if (n < 30) { title = `${n} días de racha.`; sub = 'Más de dos semanas. Busca apoyo o cambia algo en tu entorno ahora.'; }
                  else             { title = `${n} días de racha.`; sub = 'Llevas un mes. Recuerda: siempre puedes elegir diferente. Un día a la vez.'; }
                } else {
                  title = `${n} días de racha.`;
                  sub = 'Llevas una racha activa.';
                }

                if (!title) return null;

                return (
                  <div key={idx} className="rounded-2xl px-4 py-3" style={{ backgroundColor: `${opt.color}15`, border: `2px solid ${opt.color}60`, boxShadow: `3px 3px 0 0 ${opt.color}40` }}>
                    <p className="font-bold text-sm leading-snug" style={{ color: opt.color }}>{title}</p>
                    <p className="text-xs mt-0.5 text-muted-foreground">{sub}</p>
                  </div>
                );
              })}
            </div>
          )}

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
              isSelectMode={selectMonth === month}
              selectedDates={selectedDates}
              onToggleSelectMode={() => handleToggleSelectMode(month)}
              onToggleDate={handleToggleDate}
            />
          ))}
        </div>

      </main>

      {/* FLOATING ACTION BAR — shown when dates are selected */}
      <AnimatePresence>
        {selectionActive && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4"
          >
            <div className="max-w-lg mx-auto mb-4 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {selectedDates.size === 0
                      ? "Toca días para seleccionar"
                      : `${selectedDates.size} ${selectedDates.size === 1 ? 'día seleccionado' : 'días seleccionados'}`}
                  </span>
                </div>
                <button
                  onClick={handleExitSelect}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-200 text-muted-foreground transition-colors text-xs font-medium"
                  aria-label="Cancelar selección"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              </div>

              {/* Options row */}
              <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
                {habit.options.map((opt: any, idx: number) => (
                  <button
                    key={idx}
                    disabled={selectedDates.size === 0}
                    onClick={() => handleBulkApply(idx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: opt.isExempt ? `${opt.color}18` : opt.color,
                      color: opt.isExempt ? opt.color : '#fff',
                      border: opt.isExempt ? `1.5px dashed ${opt.color}80` : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}

                <button
                  disabled={selectedDates.size === 0}
                  onClick={handleBulkClear}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 bg-red-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-100 hover:scale-105 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component for individual month
interface MonthBlockProps {
  month: number;
  year: number;
  habit: any;
  onLog: (dateStr: string, optionIndex: number) => void;
  onClear: (dateStr: string) => void;
  isSelectMode: boolean;
  selectedDates: Set<string>;
  onToggleSelectMode: () => void;
  onToggleDate: (dateStr: string) => void;
}

function MonthBlock({ month, year, habit, onLog, onClear, isSelectMode, selectedDates, onToggleSelectMode, onToggleDate }: MonthBlockProps) {
  const date = new Date(year, month, 1);
  const daysInMonth = getDaysInMonth(date);

  let startDay = getDay(date) - 1;
  if (startDay === -1) startDay = 6;

  const today = new Date();
  today.setHours(0,0,0,0);

  const monthPadStr = (month+1).toString().padStart(2, '0');
  const monthLogs = habit.logs.filter((l: any) => l.date.startsWith(`${year}-${monthPadStr}`));

  const exemptIdx = habit.options.findIndex((o: any) => o.isExempt);
  const exemptDaysSet = new Set<string>(
    exemptIdx >= 0 ? monthLogs.filter((l: any) => l.optionIndex === exemptIdx).map((l: any) => l.date) : []
  );
  const exemptCount = exemptDaysSet.size;

  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const effectiveDays = daysInMonth - exemptCount;

  // Only show "Seleccionar" for months that are not entirely in the future
  const firstDayOfMonth = new Date(year, month, 1);
  const monthIsAllFuture = isAfter(firstDayOfMonth, today);

  return (
    <div
      className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col border-2 transition-all duration-200"
      style={{
        borderColor: isSelectMode ? 'rgb(124 58 237 / 0.8)' : '#1e293b',
        boxShadow: isSelectMode ? '4px 4px 0 0 rgb(124 58 237 / 0.5)' : '4px 4px 0 0 #1e293b',
      }}
    >
      {/* Month header */}
      <div className="flex justify-between items-center mb-3 gap-2">
        <h3 className="font-bold text-base sm:text-lg capitalize">{format(date, 'MMMM', { locale: es })}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground bg-gray-100 px-2 py-1 rounded-md">
            {monthLogs.filter((l: any) => !exemptDaysSet.has(l.date)).length}/{effectiveDays > 0 ? effectiveDays : daysInMonth}
            {exemptCount > 0 && <span className="ml-1 text-slate-400">· {exemptCount} excl.</span>}
          </span>
          <button
            onClick={onToggleSelectMode}
            disabled={monthIsAllFuture && !isSelectMode}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              isSelectMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/8'
            }`}
          >
            {isSelectMode ? 'Cancelar' : 'Seleccionar'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {habit.options.map((opt: any, i: number) => {
          if (opt.isExempt) return null;
          const count = monthLogs.filter((l:any) => l.optionIndex === i).length;
          const pct = effectiveDays > 0 ? Math.round((count / effectiveDays) * 100) : 0;
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
          const isSelected = isSelectMode && selectedDates.has(dateStr);

          if (isFuture) {
            return (
              <div key={i} className="aspect-square rounded-full bg-gray-100 flex items-center justify-center text-gray-300 text-xs cursor-not-allowed">
                {i + 1}
              </div>
            );
          }

          if (isSelectMode) {
            return (
              <button
                key={i}
                title={dateStr}
                onClick={() => onToggleDate(dateStr)}
                className="aspect-square min-h-[2rem] rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all active:scale-90 relative"
                style={isExemptDay ? {
                  backgroundColor: isSelected ? `${opt!.color}40` : `${opt!.color}18`,
                  color: opt!.color,
                  border: `2px dashed ${opt!.color}80`,
                  boxShadow: isSelected ? `2px 2px 0 0 ${opt!.color}60` : 'none',
                } : {
                  backgroundColor: isSelected
                    ? (opt ? opt.color : '#7c3aed')
                    : (opt ? opt.color : '#f3f4f6'),
                  color: opt ? '#fff' : (isSelected ? '#fff' : '#9ca3af'),
                  border: '2px solid #1e293b',
                  boxShadow: isSelected ? '2px 2px 0 0 #1e293b' : 'none',
                  opacity: isSelected ? 1 : 0.7,
                }}
              >
                {i + 1}
                {isExemptDay && <span className="text-[7px] leading-none opacity-70">⊘</span>}
                {isSelected && !isExemptDay && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border border-white" />
                )}
              </button>
            );
          }

          // Normal (non-select) mode
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
              className="aspect-square min-h-[2rem] rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all hover:scale-110 active:scale-90"
              style={isExemptDay ? {
                backgroundColor: `${opt!.color}18`,
                color: opt!.color,
                border: `2px dashed ${opt!.color}80`,
              } : opt ? {
                backgroundColor: opt.color,
                color: '#fff',
                border: '2px solid #1e293b',
                boxShadow: '2px 2px 0 0 #1e293b',
              } : {
                backgroundColor: '#f3f4f6',
                color: '#9ca3af',
                border: '2px solid #e5e7eb',
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
