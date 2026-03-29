import { Router, type IRouter } from "express";
import { createHash, randomInt } from "crypto";
import { Pool } from "pg";
import { requireActive } from "../lib/auth";
import { sendPinResetEmail } from "../lib/email";

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

// ── Forgot PIN — send reset code via email ────────────────────────────────────
router.post("/pin/forgot", requireActive, async (req, res): Promise<void> => {
  const user = req.user!;

  try {
    // Generate 6-digit code
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store code (invalidate old ones)
    await pool.query(
      `DELETE FROM pin_reset_codes WHERE supabase_user_id = $1`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO pin_reset_codes (supabase_user_id, code, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, code, expiresAt]
    );

    // Send email
    await sendPinResetEmail(user.email, user.name, code);

    res.json({ ok: true, email: user.email });
  } catch (err) {
    req.log.error({ err }, "Failed to send PIN reset code");
    res.status(500).json({ error: "Error al enviar el código" });
  }
});

// ── Reset PIN with code ───────────────────────────────────────────────────────
router.post("/pin/reset-with-code", requireActive, async (req, res): Promise<void> => {
  const { code, newPin } = req.body;

  if (!code || !/^\d{6}$/.test(String(code))) {
    res.status(400).json({ error: "Código inválido" });
    return;
  }
  if (!newPin || !/^\d{4}$/.test(String(newPin))) {
    res.status(400).json({ error: "El nuevo PIN debe ser de 4 dígitos" });
    return;
  }

  const userId = req.user!.id;

  try {
    const result = await pool.query(
      `SELECT id, expires_at, used FROM pin_reset_codes
       WHERE supabase_user_id = $1 AND code = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, String(code)]
    );

    if (!result.rows.length) {
      res.status(400).json({ error: "Código incorrecto" });
      return;
    }

    const row = result.rows[0];
    if (row.used) {
      res.status(400).json({ error: "Este código ya fue utilizado" });
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
      return;
    }

    // Mark code as used and set new PIN
    await pool.query(`UPDATE pin_reset_codes SET used = true WHERE id = $1`, [row.id]);
    const pinHash = hashPin(String(newPin));
    await pool.query(
      `INSERT INTO user_pins (supabase_user_id, pin_hash)
       VALUES ($1, $2)
       ON CONFLICT (supabase_user_id) DO UPDATE SET pin_hash = $2`,
      [userId, pinHash]
    );

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reset PIN with code");
    res.status(500).json({ error: "Error al restablecer el PIN" });
  }
});

export default router;
