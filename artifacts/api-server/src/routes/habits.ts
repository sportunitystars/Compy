import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireActive } from "../lib/auth";

const router: IRouter = Router();

function formatHabit(h: any) {
  return {
    id: h.id,
    userId: h.user_id,
    name: h.name,
    emoji: h.description || "✨",
    options: h.options,
    createdAt: h.created_at,
  };
}

function formatLog(l: any) {
  return {
    habitId: l.habit_id,
    date: l.date,
    optionIndex: l.option_index,
  };
}

// ── List habits ───────────────────────────────────────────────────────────────
router.get("/habits", requireActive, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("habits")
    .select("*")
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: true });

  if (error) {
    req.log.error({ error }, "Failed to fetch habits");
    res.status(500).json({ error: "Error al obtener hábitos" });
    return;
  }

  res.json((data || []).map(formatHabit));
});

// ── Create habit ──────────────────────────────────────────────────────────────
router.post("/habits", requireActive, async (req, res): Promise<void> => {
  const { name, emoji, options } = req.body;
  if (!name || !options || !Array.isArray(options)) {
    res.status(400).json({ error: "Nombre y opciones son requeridos" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("habits")
    .insert({ user_id: req.user!.id, name, description: emoji || "✨", options })
    .select()
    .single();

  if (error) {
    req.log.error({ error }, "Failed to create habit");
    res.status(500).json({ error: "Error al crear hábito" });
    return;
  }

  res.status(201).json(formatHabit(data));
});

// ── Get habit detail + logs ────────────────────────────────────────────────────
router.get("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const habitId = parseInt(req.params.habitId as string, 10);
  if (isNaN(habitId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { data: habit, error: habitError } = await supabaseAdmin
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", req.user!.id)
    .single();

  if (habitError || !habit) { res.status(404).json({ error: "Hábito no encontrado" }); return; }

  const currentYear = new Date().getFullYear();
  const { data: logs } = await supabaseAdmin
    .from("habit_logs")
    .select("*")
    .eq("habit_id", habitId)
    .eq("user_id", req.user!.id)
    .like("date", `${currentYear}-%`);

  res.json({ ...formatHabit(habit), logs: (logs || []).map(formatLog) });
});

// ── Update habit ──────────────────────────────────────────────────────────────
router.patch("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const habitId = parseInt(req.params.habitId as string, 10);
  if (isNaN(habitId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const updates: any = {};
  if (req.body.name != null) updates.name = req.body.name;
  if (req.body.emoji != null) updates.description = req.body.emoji;
  if (req.body.options != null) updates.options = req.body.options;

  const { data, error } = await supabaseAdmin
    .from("habits")
    .update(updates)
    .eq("id", habitId)
    .eq("user_id", req.user!.id)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ error: "Hábito no encontrado" }); return; }

  res.json(formatHabit(data));
});

// ── Delete habit ──────────────────────────────────────────────────────────────
router.delete("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const habitId = parseInt(req.params.habitId as string, 10);
  if (isNaN(habitId)) { res.status(400).json({ error: "ID inválido" }); return; }

  await supabaseAdmin.from("habit_logs").delete().eq("habit_id", habitId).eq("user_id", req.user!.id);
  await supabaseAdmin.from("habits").delete().eq("id", habitId).eq("user_id", req.user!.id);

  res.sendStatus(204);
});

// ── Upsert log ────────────────────────────────────────────────────────────────
router.put("/habits/:habitId/logs/:date", requireActive, async (req, res): Promise<void> => {
  const habitId = parseInt(req.params.habitId as string, 10);
  const date = req.params.date as string;
  const { optionIndex } = req.body;

  if (isNaN(habitId) || optionIndex == null) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  // Verify habit belongs to user
  const { data: habit } = await supabaseAdmin
    .from("habits").select("id").eq("id", habitId).eq("user_id", req.user!.id).single();

  if (!habit) { res.status(404).json({ error: "Hábito no encontrado" }); return; }

  const { data, error } = await supabaseAdmin
    .from("habit_logs")
    .upsert(
      { habit_id: habitId, user_id: req.user!.id, date, option_index: optionIndex },
      { onConflict: "habit_id,date" }
    )
    .select()
    .single();

  if (error) {
    req.log.error({ error }, "Failed to upsert log");
    res.status(500).json({ error: "Error al guardar el registro" });
    return;
  }

  res.json(formatLog(data));
});

// ── Delete log ────────────────────────────────────────────────────────────────
router.delete("/habits/:habitId/logs/:date", requireActive, async (req, res): Promise<void> => {
  const habitId = parseInt(req.params.habitId as string, 10);
  const date = req.params.date as string;

  if (isNaN(habitId)) { res.status(400).json({ error: "ID inválido" }); return; }

  await supabaseAdmin
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", req.user!.id)
    .eq("date", date);

  res.sendStatus(204);
});

export default router;
