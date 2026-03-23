import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAdmin } from "../lib/auth";
import { sendApprovalEmail } from "../lib/email";

const router: IRouter = Router();

function formatProfile(p: any) {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    status: p.status,
    role: p.role,
    createdAt: p.created_at,
  };
}

// ── List all users ────────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: "Error al obtener usuarios" });
    return;
  }

  res.json((data || []).map(formatProfile));
});

// ── Approve user ──────────────────────────────────────────────────────────────
router.post("/admin/users/:userId/approve", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ status: "active" })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  // Send approval email
  await sendApprovalEmail(data.email, data.name);

  res.json(formatProfile(data));
});

// ── Reject user ───────────────────────────────────────────────────────────────
router.post("/admin/users/:userId/reject", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json(formatProfile(data));
});

export default router;
