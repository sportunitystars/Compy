import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { sendNewUserNotification } from "../lib/email";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

const ADMIN_EMAIL = "luisgomezm10@gmail.com";

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

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Este email ya está registrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      status: isAdmin ? "active" : "pending",
      role: isAdmin ? "admin" : "user",
    })
    .returning();

  if (!isAdmin) {
    await sendNewUserNotification(email, name);
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.status(201).json({ token, user: formatUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({ token, user: formatUser(user) });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }
  res.json(formatUser(user));
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Sesión cerrada" });
});

export default router;
