import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { Pool } from "pg";
import { requireActive } from "../lib/auth";

const router: IRouter = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashPin(pin: string): string {
  return createHash("sha256").update(`compy-pin:${pin}`).digest("hex");
}

// ── Set PIN ────────────────────────────────────────────────────────────────────
router.post("/pin/set", requireActive, async (req, res): Promise<void> => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: "El PIN debe ser de 4 dígitos numéricos" });
    return;
  }

  const pinHash = hashPin(String(pin));
  const userId = req.user!.id;

  try {
    await pool.query(
      `INSERT INTO user_pins (supabase_user_id, pin_hash)
       VALUES ($1, $2)
       ON CONFLICT (supabase_user_id) DO UPDATE SET pin_hash = $2`,
      [userId, pinHash]
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to set PIN");
    res.status(500).json({ error: "Error al guardar el PIN" });
  }
});

// ── Verify PIN ─────────────────────────────────────────────────────────────────
router.post("/pin/verify", requireActive, async (req, res): Promise<void> => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: "PIN inválido" });
    return;
  }

  const userId = req.user!.id;

  try {
    const result = await pool.query(
      `SELECT pin_hash FROM user_pins WHERE supabase_user_id = $1`,
      [userId]
    );

    if (!result.rows.length || !result.rows[0].pin_hash) {
      res.status(404).json({ error: "No hay PIN configurado" });
      return;
    }

    const valid = result.rows[0].pin_hash === hashPin(String(pin));
    res.json({ valid });
  } catch (err) {
    req.log.error({ err }, "Failed to verify PIN");
    res.status(500).json({ error: "Error al verificar el PIN" });
  }
});

// ── Check if PIN is set ────────────────────────────────────────────────────────
router.get("/pin/status", requireActive, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  try {
    const result = await pool.query(
      `SELECT pin_hash FROM user_pins WHERE supabase_user_id = $1`,
      [userId]
    );
    res.json({ hasPin: result.rows.length > 0 && !!result.rows[0].pin_hash });
  } catch (err) {
    req.log.error({ err }, "Failed to check PIN status");
    res.status(500).json({ error: "Error" });
  }
});

export default router;
