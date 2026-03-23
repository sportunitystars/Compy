import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { sendApprovalEmail } from "../lib/email";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(formatUser));
});

router.post("/admin/users/:userId/approve", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawId, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  await sendApprovalEmail(user.email, user.name);

  res.json(formatUser(user));
});

router.post("/admin/users/:userId/reject", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawId, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ status: "rejected" })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json(formatUser(user));
});

export default router;
