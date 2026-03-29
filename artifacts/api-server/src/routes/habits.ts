import { Router, type IRouter } from "express";
import { Pool } from "pg";
import { supabaseAdmin } from "../lib/supabase";
import { requireActive } from "../lib/auth";
import { sendPush } from "../lib/webpush";
import { format } from "date-fns";

const router: IRouter = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getPrivacyMap(habitIds: string[]): Promise<Map<string, boolean>> {
  if (!habitIds.length) return new Map();
  const result = await pool.query(
    `SELECT supabase_habit_id, is_private FROM habit_metadata WHERE supabase_habit_id = ANY($1)`,
    [habitIds]
  );
  const map = new Map<string, boolean>();
  for (const row of result.rows) map.set(row.supabase_habit_id, row.is_private);
  return map;
}

async function setPrivacy(habitId: string, isPrivate: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO habit_metadata (supabase_habit_id, is_private)
     VALUES ($1, $2)
     ON CONFLICT (supabase_habit_id) DO UPDATE SET is_private = $2, updated_at = NOW()`,
    [habitId, isPrivate]
  );
}

function formatHabit(h: any, isPrivate = false) {
  return {
    id: h.id,
    userId: h.user_id,
    name: h.name,
    emoji: h.description || "✨",
    options: h.options,
    isPrivate,
    createdAt: h.created_at,
  };
}

function formatLog(l: any) {
  return {
    habitId: l.habit_id,
    date: l.date,
    optionIndex: parseInt(l.value, 10),
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

  const habits = data || [];
  const privacyMap = await getPrivacyMap(habits.map(h => h.id));
  res.json(habits.map(h => formatHabit(h, privacyMap.get(h.id) ?? false)));
});

// ── Create habit ──────────────────────────────────────────────────────────────
router.post("/habits", requireActive, async (req, res): Promise<void> => {
  const { name, emoji, options, isPrivate } = req.body;
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

  const privacy = isPrivate ?? false;
  if (privacy) await setPrivacy(data.id, true);
  res.status(201).json(formatHabit(data, privacy));
});

// ── Get habit detail + logs ────────────────────────────────────────────────────
router.get("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const habitId = req.params.habitId as string;

  const { data: habit, error: habitError } = await supabaseAdmin
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", req.user!.id)
    .single();

  if (habitError || !habit) { res.status(404).json({ error: "Hábito no encontrado" }); return; }

  const currentYear = new Date().getFullYear();
  const [{ data: logs }, privacyMap] = await Promise.all([
    supabaseAdmin
      .from("habit_logs")
      .select("*")
      .eq("habit_id", habitId)
      .gte("date", `${currentYear}-01-01`)
      .lte("date", `${currentYear}-12-31`),
    getPrivacyMap([habitId]),
  ]);

  res.json({ ...formatHabit(habit, privacyMap.get(habitId) ?? false), logs: (logs || []).map(formatLog) });
});

// ── Update habit ──────────────────────────────────────────────────────────────
router.patch("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const habitId = req.params.habitId as string;

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

  let privacy = false;
  if (req.body.isPrivate != null) {
    await setPrivacy(habitId, req.body.isPrivate);
    privacy = req.body.isPrivate;
  } else {
    const privacyMap = await getPrivacyMap([habitId]);
    privacy = privacyMap.get(habitId) ?? false;
  }

  res.json(formatHabit(data, privacy));
});

// ── Delete habit ──────────────────────────────────────────────────────────────
router.delete("/habits/:habitId", requireActive, async (req, res): Promise<void> => {
  const habitId = req.params.habitId as string;

  await supabaseAdmin.from("habit_logs").delete().eq("habit_id", habitId).eq("user_id", req.user!.id);
  await supabaseAdmin.from("habits").delete().eq("id", habitId).eq("user_id", req.user!.id);
  await pool.query(`DELETE FROM habit_metadata WHERE supabase_habit_id = $1`, [habitId]);

  res.sendStatus(204);
});

// ── Upsert log ────────────────────────────────────────────────────────────────
router.put("/habits/:habitId/logs/:date", requireActive, async (req, res): Promise<void> => {
  const habitId = req.params.habitId as string;
  const date = req.params.date as string;
  const { optionIndex } = req.body;

  if (!habitId || optionIndex == null) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const { data: habit } = await supabaseAdmin
    .from("habits").select("id").eq("id", habitId).eq("user_id", req.user!.id).single();

  if (!habit) { res.status(404).json({ error: "Hábito no encontrado" }); return; }

  const { data, error } = await supabaseAdmin
    .from("habit_logs")
    .upsert(
      { habit_id: habitId, date, value: String(optionIndex) },
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

  // ── Check for negative streak and send push notification (async, don't await) ─
  (async () => {
    try {
      const { data: habit } = await supabaseAdmin
        .from("habits").select("options").eq("id", habitId).single();
      if (!habit) return;

      const options: any[] = habit.options ?? [];
      const opt = options[optionIndex];
      if (!opt?.isNegative) return;

      // Fetch all logs for this habit this year to calculate streak
      const currentYear = new Date().getFullYear();
      const { data: allLogs } = await supabaseAdmin
        .from("habit_logs")
        .select("date, value")
        .eq("habit_id", habitId)
        .gte("date", `${currentYear}-01-01`);

      const logsByDate = new Map<string, number>();
      for (const l of (allLogs ?? [])) logsByDate.set(l.date, parseInt(l.value, 10));

      const exemptIdx = options.findIndex((o: any) => o.isExempt);
      let streak = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let checkDate = new Date(today);

      for (let guard = 0; guard < 400; guard++) {
        const ds = format(checkDate, "yyyy-MM-dd");
        const logged = logsByDate.get(ds);
        if (logged === exemptIdx && exemptIdx >= 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        if (logged === optionIndex) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      if (streak < 5) return;

      // Fetch all user subscriptions
      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", req.user!.id);

      if (!subs || subs.length === 0) return;

      const label = opt.label ?? "No";
      const body = streak < 10
        ? `Llevas ${streak} días seguidos marcando "${label}". ¿Puedes cambiar hoy?`
        : `${streak} días de racha en "${label}". Un pequeño paso hoy puede romper este patrón.`;

      for (const sub of subs) {
        try {
          await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth_key },
            { title: "Compy · Racha a revisar", body, tag: `streak-${habitId}` }
          );
        } catch (pushErr: any) {
          if (pushErr?.statusCode === 410) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    } catch (err) {
      req.log.error({ err }, "Push notification error after log upsert");
    }
  })();
});

// ── Delete log ────────────────────────────────────────────────────────────────
router.delete("/habits/:habitId/logs/:date", requireActive, async (req, res): Promise<void> => {
  const habitId = req.params.habitId as string;
  const date = req.params.date as string;

  await supabaseAdmin
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("date", date);

  res.sendStatus(204);
});

export default router;
