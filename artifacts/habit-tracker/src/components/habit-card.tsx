import { useState } from "react";
import { Flame, TriangleAlert, ChevronLeft, ChevronRight, ChevronDown, MoreHorizontal, Pencil, Trash2, Lock } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { useGetHabit } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

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
  isExempt?: boolean;
}

interface MonthStats {
  percentages: Array<HabitOption & { percentage: number; count: number; maxStreak: number }>;
  streak: number;
  streakColor: string;
  streakIsNegative: boolean;
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

  const isCurrentMonthView = displayMonth === now.getMonth() && displayYear === now.getFullYear();
  const lastDayToCheck = isCurrentMonthView ? now.getDate() : daysInMonth;

  // Find exempt option index and collect exempt days in this month
  const exemptIdx = options.findIndex((o) => o.isExempt);
  const exemptDays = new Set(
    exemptIdx >= 0
      ? monthLogs.filter((l) => l.optionIndex === exemptIdx).map((l) => l.date)
      : []
  );

  // Denominator = total days in month minus exempt days (never just elapsed days)
  const effectiveDays = daysInMonth - exemptDays.size;

  const optionStreaks = options.map((opt, idx) => {
    // Exempt option itself is excluded from streak display
    if (opt.isExempt) return { opt, idx, maxStreak: 0, activeStreak: 0 };

    const monthDates = new Set(monthLogs.filter((l) => l.optionIndex === idx).map((l) => l.date));

    // Max streak: skip (don't break) exempt days
    let maxStreak = 0;
    let temp = 0;
    for (let day = 1; day <= lastDayToCheck; day++) {
      const ds = format(new Date(displayYear, displayMonth, day), "yyyy-MM-dd");
      if (exemptDays.has(ds)) continue; // transparent — don't break streak
      if (monthDates.has(ds)) {
        temp++;
        if (temp > maxStreak) maxStreak = temp;
      } else {
        temp = 0;
      }
    }

    let activeStreak = 0;
    if (isCurrentMonthView) {
      const optDates = new Set(logs.filter((l) => l.optionIndex === idx).map((l) => l.date));
      // Most recent logged day in the month across ALL non-exempt options
      const allMonthDates = logs
        .map((l) => l.date)
        .filter((d) => d.startsWith(`${displayYear}-${monthPadded}`) && !exemptDays.has(d))
        .sort()
        .reverse();
      if (allMonthDates.length > 0) {
        const mostRecentDay = allMonthDates[0];
        // Streak is only active if the most recent non-exempt logged day has THIS option
        if (optDates.has(mostRecentDay)) {
          const checkDate = new Date(mostRecentDay + "T00:00:00");
          let guard = 0;
          while (guard < 400) {
            guard++;
            const ds = format(checkDate, "yyyy-MM-dd");
            if (exemptDays.has(ds)) {
              // Skip exempt day — doesn't break or count
              checkDate.setDate(checkDate.getDate() - 1);
              continue;
            }
            if (optDates.has(ds)) {
              activeStreak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }
      }
    }

    return { opt, idx, maxStreak, activeStreak };
  });

  // Percentages: exclude exempt option, use effectiveDays as denominator
  const percentages = options
    .map((opt, idx) => {
      if (opt.isExempt) return null;
      const count = monthLogs.filter((l) => l.optionIndex === idx).length;
      const maxStreak = optionStreaks.find((s) => s.idx === idx)?.maxStreak ?? 0;
      return {
        ...opt,
        count,
        maxStreak,
        percentage: effectiveDays > 0 ? Math.round((count / effectiveDays) * 100) : 0,
      };
    })
    .filter(Boolean) as MonthStats["percentages"];

  // Current month → show the streak that is actively running right now (backward from today).
  // Past months → show the max consecutive streak reached that month.
  // Exclude exempt option from streak "best" calculation.
  const nonExemptStreaks = optionStreaks.filter((s) => !options[s.idx]?.isExempt);
  const best = nonExemptStreaks.reduce(
    (acc, cur) => {
      const curCount = isCurrentMonthView ? cur.activeStreak : cur.maxStreak;
      const accCount = isCurrentMonthView ? acc.activeStreak : acc.maxStreak;
      return curCount > accCount ? cur : acc;
    },
    { opt: options.find((o) => !o.isExempt) ?? options[0], idx: 0, maxStreak: 0, activeStreak: 0 }
  );

  const streak = isCurrentMonthView ? best.activeStreak : best.maxStreak;
  const streakColor = best.opt?.color ?? "#6366f1";
  const streakIsNegative = best.opt?.isNegative === true;

  return { percentages, streak, streakColor, streakIsNegative };
}

interface HabitCardProps {
  habitId: string;
  onDeleteClick: (id: string) => void;
}

export function HabitCard({ habitId, onDeleteClick }: HabitCardProps) {
  const { data: habit, isLoading } = useGetHabit(habitId);
  const [, navigate] = useLocation();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [open, setOpen] = useState(false);

  if (isLoading || !habit) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-border h-40 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    );
  }

  const logs = (habit as any).logs ?? [];
  const { percentages, streak, streakColor, streakIsNegative } = computeMonthStats(
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
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">

      <a href={`/habits/${habit.id}`} className="block px-5 pt-4 pb-4 pr-8 sm:pr-5 sm:pl-8">

        {/* Row 1: emoji + name (with dropdown) + month picker */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">{habit.emoji}</span>
            {(habit as any).isPrivate && (
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center" title="Hábito privado">
                <Lock className="w-3 h-3 text-primary" />
              </span>
            )}

            {/* Name with dropdown trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="flex items-center gap-1 group/name text-left min-w-0"
                >
                  <h3 className="text-[15px] font-bold text-foreground leading-tight truncate group-hover/name:text-primary transition-colors">
                    {habit.name}
                  </h3>
                  <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 group-hover/name:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); navigate(`/habits/${habit.id}/edit`); }}
                  className="cursor-pointer"
                >
                  <Pencil className="w-4 h-4 mr-2" /> Modificar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDeleteClick(habit.id); }}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <span
              className={`text-[11px] font-bold ${streak < 2 ? "text-muted-foreground/60" : ""}`}
              style={streak >= 2 ? { color: streakColor } : undefined}
            >
              Racha actual
            </span>
            {streak >= 2 ? (
              <div className="flex items-center gap-1 ml-auto">
                {streakIsNegative
                  ? <TriangleAlert className="w-3.5 h-3.5" style={{ color: streakColor }} />
                  : <Flame className="w-3.5 h-3.5" style={{ color: streakColor }} />}
                <span className="text-[11px] font-bold" style={{ color: streakColor }}>
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
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {percentages.filter((opt) => opt.maxStreak >= 2).length === 0 ? (
                <span className="text-[11px] text-muted-foreground/40">Sin racha este mes</span>
              ) : (
                percentages
                  .filter((opt) => opt.maxStreak >= 2)
                  .map((opt) => (
                    <span
                      key={opt.label}
                      className="inline-flex items-center gap-1 text-[11px] font-bold"
                      style={{ color: opt.color }}
                    >
                      {opt.isNegative
                        ? <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                        : <Flame className="w-3.5 h-3.5 shrink-0" />}
                      {opt.label} · {opt.maxStreak} días
                    </span>
                  ))
              )}
            </div>
          </div>
        )}

      </a>
    </div>
  );
}
