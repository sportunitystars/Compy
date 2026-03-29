import { Router, type IRouter, type Response } from "express";
import { Pool } from "pg";
import { requireActive } from "../lib/auth";

const router: IRouter = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── SSE client registry ──────────────────────────────────────────────────────
const sseClients = new Set<Response>();

function broadcastSettings(freeSlotsUsed: number) {
  const payload = `data: ${JSON.stringify({ freeSlotsUsed })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── Public stream endpoint (SSE) — no auth required ─────────────────────────
router.get("/settings/stream", async (req, res): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send current value immediately on connect
  try {
    const result = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'free_slots_used'`
    );
    const raw = result.rows.length > 0 ? parseInt(result.rows[0].value, 10) : 0;
    const freeSlotsUsed = isNaN(raw) || raw < 0 ? 0 : Math.min(raw, 100);
    res.write(`data: ${JSON.stringify({ freeSlotsUsed })}\n\n`);
  } catch {
    res.write(`data: ${JSON.stringify({ freeSlotsUsed: 0 })}\n\n`);
  }

  sseClients.add(res);

  // Keep-alive ping every 25s to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, 25_000);

  req.on("close", () => {
    sseClients.delete(res);
    clearInterval(keepAlive);
  });
});

// ── Public REST endpoint — no auth required, no caching ─────────────────────
router.get("/settings/public", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
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

// ── Admin-only endpoint ───────────────────────────────────────────────────────
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

    // Push the change instantly to all SSE listeners
    if (key === "free_slots_used") {
      const numeric = parseInt(String(value), 10);
      const clamped = isNaN(numeric) || numeric < 0 ? 0 : Math.min(numeric, 100);
      broadcastSettings(clamped);
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update setting");
    res.status(500).json({ error: "Error al guardar la configuración" });
  }
});

export default router;
