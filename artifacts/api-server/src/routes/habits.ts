import { Router, type IRouter } from "express";
import { db, habitsTable, habitLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireActive } from "../lib/auth";
import { CreateHabitBody, UpdateHabitBody, UpsertLogBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatHabit(habit: typeof habitsTable.$inferSelect) {
  return {
    id: habit.id,
    userId: habit.userId,
    name: habit.name,
    emoji: habit.emoji,
    options: habit.options,
    createdAt: habit.createdAt.toISOString(),
  };
}

function formatLog(log: typeof habitLogsTable.$inferSelect) {
  return {
    habitId: log.habitId,
    date: log.date,
    optionIndex: log.optionIndex,
  };
}

router.get("/habits", requireActive, async (req, res): Promise<void> => {
  const habits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, req.user!.id));

  res.json(habits.map(formatHabit));
});

router.post("/habits", requireActive, async (req, res): Promise<void> => {
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db
    .insert(habitsTable)
    .values({
      userId: req.user!.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji,
      options: parsed.data.options as any,
    })
    .returning();

  res.status(201).json(formatHabit(habit));
});

router.get("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.habitId) ? req.params.habitId[0] : req.params.habitId;
  const habitId = parseInt(rawId, 10);
  if (isNaN(habitId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, req.user!.id)));

  if (!habit) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }

  const currentYear = new Date().getFullYear();
  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(
      and(
        eq(habitLogsTable.habitId, habitId),
        eq(habitLogsTable.userId, req.user!.id)
      )
    );

  const yearLogs = logs.filter((l) => l.date.startsWith(String(currentYear)));

  res.json({
    ...formatHabit(habit),
    logs: yearLogs.map(formatLog),
  });
});

router.patch("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.habitId) ? req.params.habitId[0] : req.params.habitId;
  const habitId = parseInt(rawId, 10);
  if (isNaN(habitId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof habitsTable.$inferInsert> = {};
  if (parsed.data.name != null) updateData.name = parsed.data.name;
  if (parsed.data.emoji != null) updateData.emoji = parsed.data.emoji;
  if (parsed.data.options != null) updateData.options = parsed.data.options as any;

  const [habit] = await db
    .update(habitsTable)
    .set(updateData)
    .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, req.user!.id)))
    .returning();

  if (!habit) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }

  res.json(formatHabit(habit));
});

router.delete("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.habitId) ? req.params.habitId[0] : req.params.habitId;
  const habitId = parseInt(rawId, 10);
  if (isNaN(habitId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  await db
    .delete(habitsTable)
    .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, req.user!.id)));

  await db
    .delete(habitLogsTable)
    .where(and(eq(habitLogsTable.habitId, habitId), eq(habitLogsTable.userId, req.user!.id)));

  res.sendStatus(204);
});

router.put("/habits/:habitId/logs/:date", requireActive, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.habitId) ? req.params.habitId[0] : req.params.habitId;
  const habitId = parseInt(rawId, 10);
  const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

  if (isNaN(habitId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = UpsertLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, req.user!.id)));

  if (!habit) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }

  const [log] = await db
    .insert(habitLogsTable)
    .values({
      habitId,
      userId: req.user!.id,
      date,
      optionIndex: parsed.data.optionIndex,
    })
    .onConflictDoUpdate({
      target: [habitLogsTable.habitId, habitLogsTable.date],
      set: { optionIndex: parsed.data.optionIndex },
    })
    .returning();

  res.json({ habitId: log.habitId, date: log.date, optionIndex: log.optionIndex });
});

router.delete("/habits/:habitId/logs/:date", requireActive, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.habitId) ? req.params.habitId[0] : req.params.habitId;
  const habitId = parseInt(rawId, 10);
  const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

  if (isNaN(habitId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  await db
    .delete(habitLogsTable)
    .where(
      and(
        eq(habitLogsTable.habitId, habitId),
        eq(habitLogsTable.userId, req.user!.id),
        eq(habitLogsTable.date, date)
      )
    );

  res.sendStatus(204);
});

export default router;
