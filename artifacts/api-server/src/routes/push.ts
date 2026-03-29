import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireActive } from "../lib/auth";
import { vapidPublicKey } from "../lib/webpush";

const router: IRouter = Router();

// ── VAPID public key (needed by client to subscribe) ──────────────────────────
router.get("/push/vapid-key", requireActive, (_req, res): void => {
  if (!vapidPublicKey) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
});

// ── Save push subscription ────────────────────────────────────────────────────
router.post("/push/subscribe", requireActive, async (req, res): Promise<void> => {
  const { endpoint, p256dh, auth } = req.body;

  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Subscription data missing" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert(
      { user_id: req.user!.id, endpoint, p256dh, auth_key: auth },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    req.log.error({ error }, "Failed to save push subscription");
    res.status(500).json({ error: "Error al guardar suscripción" });
    return;
  }

  res.status(201).json({ ok: true });
});

// ── Remove push subscription ──────────────────────────────────────────────────
router.delete("/push/unsubscribe", requireActive, async (req, res): Promise<void> => {
  const { endpoint } = req.body;

  if (!endpoint) {
    res.status(400).json({ error: "Endpoint required" });
    return;
  }

  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", req.user!.id)
    .eq("endpoint", endpoint);

  res.sendStatus(204);
});

export default router;
