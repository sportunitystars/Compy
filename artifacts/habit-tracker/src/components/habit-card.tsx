import { useState, useRef, useCallback } from "react";
import { Trash2, Flame, TriangleAlert, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { useGetHabit } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MESES = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"
];

const MESES_CORTO = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic"
];

interface HabitOption {
  label: string;
  color: string;
  isPositive?: boolean;
  isNegative?: boolean;
}

interface MonthStats {
  percentages: Array<HabitOption & { percentage: number; count: number }>;
  streak: number;
  streakPositive: boolean;
}

function computeMonthStats(
  options: HabitOption[],
  logs: Array<{ date: string; optionIndex: number }>,
  displayMonth: number,
  displayYear: number
): MonthStats {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const monthPadded = (displayMonth + 1).toString().padStart(2, "0");
  const monthLogs = logs.filter((l) => l.date.startsWith(`${displayYear}-${monthPadded}`));
  const daysInMonth = getDaysInMonth(new Date(displayYear, displayMonth, 1));

  const percentages = options.map((opt, idx) => {
    const count = monthLogs.filter((l) => l.optionIndex === idx).length;
    return {
      ...opt,
      count,
      percentage: daysInMonth > 0 ? Math.round((count / daysInMonth) * 100) : 0,
    };
  });

  // Streak: max consecutive days for any option WITHIN the selected month.
  // For the current month we also check if the streak is still live (going back from today).
  const isCurrentMonthView = displayMonth === now.getMonth() && displayYear === now.getFullYear();
  const lastDayToCheck = isCurrentMonthView ? now.getDate() : daysInMonth;

  const optionStreaks = options.map((opt, idx) => {
    const monthDates = new Set(monthLogs.filter((l) => l.optionIndex === idx).map((l) => l.date));

    // Max streak within the month
    let maxStreak = 0;
    let temp = 0;
    for (let day = 1; day <= lastDayToCheck; day++) {
      const ds = format(new Date(displayYear, displayMonth, day), "yyyy-MM-dd");
      if (monthDates.has(ds)) {
        temp++;
        if (temp > maxStreak) maxStreak = temp;
      } else {
        temp = 0;
      }
    }

    // For the current month, also check active cross-month streak (backward from today)
    let activeStreak = 0;
    if (isCurrentMonthView) {
      const allDates = new Set(logs.filter((l) => l.optionIndex === idx).map((l) => l.date));
      const todayStr = format(now, "yyyy-MM-dd");
      const checkDate = new Date(now);
      if (!allDates.has(todayStr)) checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const ds = format(checkDate, "yyyy-MM-dd");
        if (allDates.has(ds)) { activeStreak++; checkDate.setDate(checkDate.getDate() - 1); }
        else break;
      }
    }

    return { opt, streakCount: Math.max(maxStreak, activeStreak) };
  });

  const best = optionStreaks.reduce(
    (acc, cur) => (cur.streakCount > acc.streakCount ? cur : acc),
    { opt: options[0], streakCount: 0 }
  );

  const streak = best.streakCount;
  const streakPositive = best.opt?.isPositive === true || best.opt?.isNegative !== true;

  return { percentages, streak, streakPositive };
}

interface HabitCardProps {
  habitId: string;
  onDeleteClick: (id: string) => void;
}

export function HabitCard({ habitId, onDeleteClick }: HabitCardProps) {
  const { data: habit, isLoading } = useGetHabit(habitId);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [open, setOpen] = useState(false);

  // Long-press to show delete on mobile — all hooks before any early return
  const [showMobileDelete, setShowMobileDelete] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preventNextClick = useRef(false);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowMobileDelete(true);
      preventNextClick.current = true;
    }, 600);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (preventNextClick.current) {
      e.preventDefault();
      preventNextClick.current = false;
      return;
    }
    if (showMobileDelete) {
      e.preventDefault();
      setShowMobileDelete(false);
    }
  }, [showMobileDelete]);

  if (isLoading || !habit) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-border h-40 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    );
  }

  const logs = (habit as any).logs ?? [];
  const { percentages, streak, streakPositive } = computeMonthStats(
    habit.options as HabitOption[],
    logs,
    selectedMonth,
    selectedYear
  );

  const currentYear = now.getFullYear();
  const mesLabel = selectedYear !== currentYear
    ? `${MESES[selectedMonth]} ${selectedYear}`
    : MESES[selectedMonth];

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  return (
    <div
      className="relative group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteClick(habit.id); }}
        className={`absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-white border border-red-100 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center shadow-sm
          ${showMobileDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        title="Eliminar hábito"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <a href={`/habits/${habit.id}`} className="block px-5 pt-4 pb-4" onClick={handleCardClick}>

        {/* Row 1: emoji + name + month picker */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">{habit.emoji}</span>
            <h3 className="text-[15px] font-bold text-foreground leading-tight truncate">
              {habit.name}
            </h3>
          </div>

          {/* Month picker trigger */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerYear(selectedYear); setOpen(true); }}
                className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground/70 tracking-wider hover:text-primary transition-colors shrink-0 cursor-pointer"
              >
                <span>{mesLabel}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-3"
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setPickerYear(y => y - 1); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-bold text-foreground">{pickerYear}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setPickerYear(y => Math.min(y + 1, currentYear)); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors disabled:opacity-30"
                  disabled={pickerYear >= currentYear}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MESES_CORTO.map((m, idx) => {
                  const isFuture = pickerYear === currentYear && idx > now.getMonth();
                  const isSelected = idx === selectedMonth && pickerYear === selectedYear;
                  const isCurrent = idx === now.getMonth() && pickerYear === currentYear;
                  return (
                    <button
                      key={m}
                      disabled={isFuture}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMonth(idx);
                        setSelectedYear(pickerYear);
                        setOpen(false);
                      }}
                      className={`text-xs font-medium py-1.5 rounded-md transition-colors
                        ${isFuture ? "opacity-30 cursor-not-allowed text-muted-foreground" : "hover:bg-gray-100 cursor-pointer"}
                        ${isSelected ? "bg-primary text-white hover:bg-primary" : ""}
                        ${isCurrent && !isSelected ? "text-primary font-bold" : ""}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              {!isCurrentMonth && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMonth(now.getMonth());
                    setSelectedYear(now.getFullYear());
                    setPickerYear(now.getFullYear());
                    setOpen(false);
                  }}
                  className="mt-3 w-full text-xs text-primary hover:underline font-medium"
                >
                  Volver al mes actual
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Row 2: percentage pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {percentages.map((opt) => (
            <span
              key={opt.label}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{ color: opt.color, backgroundColor: `${opt.color}1a` }}
            >
              {opt.label} · {opt.percentage}%
            </span>
          ))}
        </div>

        {/* Row 3: streak (current month) or monthly summary (past month) */}
        {isCurrentMonth ? (
          <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
            <span className={`text-[11px] font-bold ${streak >= 5 ? (streakPositive ? "text-green-600" : "text-red-500") : "text-muted-foreground/60"}`}>
              Racha actual
            </span>
            {streak >= 5 ? (
              <div className="flex items-center gap-1 ml-auto">
                {streakPositive
                  ? <Flame className="w-3.5 h-3.5 text-green-600" />
                  : <TriangleAlert className="w-3.5 h-3.5 text-red-500" />}
                <span className={`text-[11px] font-bold ${streakPositive ? "text-green-600" : "text-red-500"}`}>
                  {streak} días
                </span>
              </div>
            ) : (
              <span className="ml-auto text-[11px] text-muted-foreground/40">—</span>
            )}
          </div>
        ) : (
          <div className="pt-3 border-t border-gray-100">
            <span className="text-[11px] font-bold text-muted-foreground/60 block mb-1.5">Racha</span>
            <div className="flex flex-wrap gap-1.5">
              {percentages.map((opt) => (
                <span
                  key={opt.label}
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ color: opt.color, backgroundColor: `${opt.color}1a` }}
                >
                  {opt.label} · {opt.count} días
                </span>
              ))}
            </div>
          </div>
        )}

      </a>
    </div>
  );
}
