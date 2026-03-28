import { Trash2, Flame, TriangleAlert } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { useGetHabit } from "@workspace/api-client-react";

const MESES = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"
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
  displayMonth: number;
  displayYear: number;
}

function computeMonthStats(
  options: HabitOption[],
  logs: Array<{ date: string; optionIndex: number }>
): MonthStats {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Determine which month to display: current month if it has data,
  // otherwise fall back to the most recent month that has any logs.
  let displayYear = now.getFullYear();
  let displayMonth = now.getMonth();
  let monthPadded = (displayMonth + 1).toString().padStart(2, "0");
  let monthLogs = logs.filter((l) => l.date.startsWith(`${displayYear}-${monthPadded}`));

  if (monthLogs.length === 0 && logs.length > 0) {
    // Find the most recent log date and use that month
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const [ry, rm] = sorted[0].date.split("-").map(Number);
    displayYear = ry;
    displayMonth = rm - 1;
    monthPadded = rm.toString().padStart(2, "0");
    monthLogs = logs.filter((l) => l.date.startsWith(`${displayYear}-${monthPadded}`));
  }

  const daysInMonth = getDaysInMonth(new Date(displayYear, displayMonth, 1));

  // Percentages: same formula as MonthBlock inside habit-detail (count / daysInMonth)
  const percentages = options.map((opt, idx) => {
    const count = monthLogs.filter((l) => l.optionIndex === idx).length;
    return {
      ...opt,
      count,
      percentage: daysInMonth > 0 ? Math.round((count / daysInMonth) * 100) : 0,
    };
  });

  // Streak: same logic as calculateStreaks in habit-detail
  // Uses ALL logs (not just this month) so cross-month streaks are counted correctly
  // Grace period: if today isn't logged yet, start counting from yesterday
  const optionStreaks = options.map((opt, idx) => {
    const dates = new Set(logs.filter((l) => l.optionIndex === idx).map((l) => l.date));
    let streakCount = 0;
    const todayStr = format(now, "yyyy-MM-dd");
    const checkDate = new Date(now);
    if (!dates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const ds = format(checkDate, "yyyy-MM-dd");
      if (dates.has(ds)) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return { opt, streakCount };
  });

  // Pick the option with the longest current streak
  const best = optionStreaks.reduce(
    (acc, cur) => (cur.streakCount > acc.streakCount ? cur : acc),
    { opt: options[0], streakCount: 0 }
  );

  const streak = best.streakCount;
  const streakPositive = best.opt?.isPositive === true || best.opt?.isNegative !== true;

  return { percentages, streak, streakPositive, displayMonth, displayYear };
}

interface HabitCardProps {
  habitId: string;
  onDeleteClick: (id: string) => void;
}

export function HabitCard({ habitId, onDeleteClick }: HabitCardProps) {
  const { data: habit, isLoading } = useGetHabit(habitId);

  if (isLoading || !habit) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-border h-40 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    );
  }

  const logs = (habit as any).logs ?? [];
  const { percentages, streak, streakPositive, displayMonth, displayYear } = computeMonthStats(habit.options as HabitOption[], logs);
  const currentYear = new Date().getFullYear();
  const mesLabel = displayYear !== currentYear
    ? `${MESES[displayMonth]} ${displayYear}`
    : MESES[displayMonth];

  return (
    <div className="relative group bg-white rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteClick(habit.id); }}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white border border-red-200 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-sm"
        title="Eliminar hábito"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <a href={`/habits/${habit.id}`} className="block p-5">
        {/* Top row: emoji + name + month label */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl shrink-0">
              {habit.emoji}
            </div>
            <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {habit.name}
            </h3>
          </div>
          {/* Month + percentage bars */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
            <span className="text-xs font-semibold text-muted-foreground tracking-widest mb-0.5">
              {mesLabel}
            </span>
            {percentages.map((opt) => (
              <div
                key={opt.label}
                className="flex items-center justify-end rounded-md px-2.5 py-0.5 min-w-[52px]"
                style={{ backgroundColor: opt.color }}
              >
                <span className="text-white text-xs font-bold">
                  {opt.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: streak */}
        <div className="border-t border-border/60 pt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Racha actual</span>
          {streak > 0 ? (
            <div className="flex items-center gap-1 ml-auto">
              {streakPositive ? (
                <Flame className="w-4 h-4 text-orange-500" />
              ) : (
                <TriangleAlert className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-bold ${streakPositive ? "text-orange-500" : "text-red-500"}`}>
                {streak}
              </span>
            </div>
          ) : (
            <span className="ml-auto text-xs text-muted-foreground/60">—</span>
          )}
        </div>
      </a>
    </div>
  );
}
