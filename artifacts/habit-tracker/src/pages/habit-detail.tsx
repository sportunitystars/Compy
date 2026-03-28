import { useState, useMemo } from "react";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, getDaysInMonth, startOfMonth, getDay, isAfter, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ChevronDown, ChevronUp, Check, Trash2, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useGetHabit, useUpsertLog, useDeleteLog, useUpdateHabit, getGetHabitQueryKey, getListHabitsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const MONTHS = Array.from({ length: 12 }, (_, i) => i);
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

// Helper to get streak stats
function calculateStreaks(logs: { date: string, optionIndex: number }[], options: any[]) {
  // Sort logs by date ascending
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  
  const stats = options.map((opt, index) => {
    let currentStreak = 0;
    let maxStreak = 0;
    let today = new Date();
    today.setHours(0,0,0,0);
    
    // We iterate chronologically
    // A streak is broken if there's a day logged with DIFFERENT option, or if the current date is > 1 day after the last logged date for this option.
    // However, it's easier: just count consecutive days in the year up to 'today'.
    
    // Create a set of dates where this option was chosen
    const dates = new Set(sortedLogs.filter(l => l.optionIndex === index).map(l => l.date));
    
    let tempStreak = 0;
    let start = new Date(today.getFullYear(), 0, 1);
    const end = today;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      if (dates.has(dateStr)) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    
    // Current streak is tempStreak after the loop (which ends on 'today')
    // But what if they haven't logged today yet? A streak shouldn't break until tomorrow.
    // So let's check yesterday.
    let streakCount = 0;
    let checkDate = new Date(today);
    
    // If today is logged, start counting backwards from today. If not, start from yesterday.
    const todayStr = format(today, 'yyyy-MM-dd');
    if (!dates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while(true) {
      if (dates.has(format(checkDate, 'yyyy-MM-dd'))) {
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
    upsertMutation.mutate(
      { habitId, date: dateStr, data: { optionIndex } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHabitQueryKey(habitId) })
      }
    );
  };

  const handleClearLog = (dateStr: string) => {
    deleteLogMutation.mutate(
      { habitId, date: dateStr },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHabitQueryKey(habitId) })
      }
    );
  };

  const streaks = useMemo(() => {
    if (!habit) return [];
    return calculateStreaks(habit.logs, habit.options);
  }, [habit]);

  const totalLogs = habit?.logs.length || 0;

  if (isLoading || !habit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

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
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            onClick={() => setShowSummary(!showSummary)}
          >
            <span className="font-semibold text-foreground">Resumen del Año {currentYear}</span>
            {showSummary ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>
          
          <AnimatePresence>
            {showSummary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border"
              >
                <div className="p-6">
                  <div className="flex flex-wrap gap-6 mb-6">
                    {habit.options.map((opt, idx) => {
                      const stat = streaks[idx];
                      const pct = totalLogs > 0 ? Math.round((stat.totalCount / totalLogs) * 100) : 0;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: opt.color }} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
                            <p className="text-2xl font-bold" style={{ color: opt.color }}>{pct}%</p>
                            <p className="text-xs text-muted-foreground">{stat.totalCount} días</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* STREAK ALERTS */}
                  <div className="space-y-3">
                    {habit.options.map((opt, idx) => {
                      const stat = streaks[idx];
                      if (stat.currentStreak >= 5) {
                        if (opt.isPositive) {
                          return (
                            <div key={idx} className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-3 text-orange-800">
                              <span className="text-2xl">🔥</span>
                              <div>
                                <p className="font-bold">¡Llevas {stat.currentStreak} días seguidos de {opt.label}!</p>
                                <p className="text-sm opacity-90">¡Eso es dedicación pura! Sigue así.</p>
                              </div>
                            </div>
                          );
                        }
                        if (opt.isNegative) {
                          return (
                            <div key={idx} className="bg-slate-100 border border-slate-200 p-4 rounded-xl flex items-center gap-3 text-slate-800">
                              <span className="text-2xl">⚡</span>
                              <div>
                                <p className="font-bold">{stat.currentStreak} días marcando {opt.label}.</p>
                                <p className="text-sm opacity-90">Recuerda que cada nuevo día es una oportunidad para empezar de nuevo.</p>
                              </div>
                            </div>
                          );
                        }
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
  const monthLogs = habit.logs.filter((l: any) => l.date.startsWith(`${year}-${(month+1).toString().padStart(2, '0')}`));
  
  // We need max streak IN THIS MONTH for each option.
  // And current streak (only if this is the current month).
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border flex flex-col">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="font-bold text-lg capitalize">{format(date, 'MMMM', { locale: es })}</h3>
        <span className="text-xs font-semibold text-muted-foreground bg-gray-100 px-2 py-1 rounded-md">
          {monthLogs.length}/{daysInMonth}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {habit.options.map((opt: any, i: number) => {
          const count = monthLogs.filter((l:any) => l.optionIndex === i).length;
          const pct = monthLogs.length > 0 ? Math.round((count / daysInMonth) * 100) : 0;
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

          if (isFuture) {
            return (
              <div key={i} className="aspect-square rounded-md bg-gray-50/50 flex items-center justify-center text-gray-300 text-xs cursor-not-allowed">
                {i + 1}
              </div>
            );
          }

          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button
                  className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-all hover:scale-105 active:scale-95 shadow-sm`}
                  style={{
                    backgroundColor: opt ? opt.color : '#f3f4f6',
                    color: opt ? '#fff' : '#6b7280',
                    border: opt ? `1px solid ${opt.color}` : '1px solid #e5e7eb'
                  }}
                >
                  {i + 1}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 rounded-xl" align="center">
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-center text-muted-foreground font-medium mb-1">
                    {format(dayDate, "d 'de' MMMM", { locale: es })}
                  </div>
                  {habit.options.map((o: any, idx: number) => (
                    <Button 
                      key={idx}
                      variant="ghost" 
                      className={`justify-start h-9 px-3 ${existingLog?.optionIndex === idx ? 'bg-gray-100 font-bold' : ''}`}
                      onClick={() => onLog(dateStr, idx)}
                    >
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: o.color }} />
                      {o.label}
                    </Button>
                  ))}
                  {existingLog && (
                    <Button 
                      variant="ghost" 
                      className="justify-start h-9 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 mt-1 border-t border-border rounded-none"
                      onClick={() => onClear(dateStr)}
                    >
                      <Trash2 className="w-3 h-3 mr-2" /> Borrar
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* STREAKS SECTION PER MONTH */}
      <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
        {habit.options.map((opt: any, i: number) => {
          // Calculate max streak in this month
          let max = 0;
          let curr = 0;
          for(let d=1; d<=daysInMonth; d++) {
            const str = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
            if (monthLogs.find((l:any) => l.date === str && l.optionIndex === i)) {
              curr++;
              if (curr > max) max = curr;
            } else {
              curr = 0;
            }
          }
          // The current streak shown is only if this is the current month
          const showCurrent = isCurrentMonth;

          if (max === 0) return null;

          return (
            <div key={i} className="text-xs p-2 rounded-lg bg-gray-50 border border-border/50">
              <div className="font-semibold mb-1 flex items-center gap-1" style={{ color: opt.color }}>
                {opt.label}
              </div>
              <div className="text-muted-foreground flex flex-col gap-0.5">
                {showCurrent && <span>Actual: {curr} d</span>}
                <span>Max: {max} d</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
