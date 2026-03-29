import { Router, type IRouter } from "express";
import { Pool } from "pg";
import { requireActive } from "../lib/auth";

const router: IRouter = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Public endpoint — no auth required
router.get("/settings/public", async (req, res): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'free_slots_used'`
    );
    const raw = result.rows.length > 0 ? parseInt(result.rows[0].value, 10) : 0;
    const freeSlotsUsed = isNaN(raw) || raw < 0 ? 0 : Math.min(raw, 100);
    res.json({ freeSlotsUsed });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch public settings");
    res.json({ freeSlotsUsed: 0 });
  }
});

// Admin-only endpoint
router.patch("/admin/settings", requireActive, async (req, res): Promise<void> => {
  const user = req.user!;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Acceso denegado" });
    return;
  }

  const { key, value } = req.body;
  if (!key || value === undefined || value === null) {
    res.status(400).json({ error: "key y value son requeridos" });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, String(value)]
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update setting");
    res.status(500).json({ error: "Error al guardar la configuración" });
  }
});

export default router;
