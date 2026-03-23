import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
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

function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new OAuth2Client(clientId, clientSecret);
}

function getRedirectUri(req: import("express").Request) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}/api/auth/google/callback`;
}

// ─── Email / Password ───────────────────────────────────────────────────────

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

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res): void => {
  const client = getGoogleClient();
  if (!client) {
    res.status(503).json({ error: "Google OAuth no está configurado" });
    return;
  }

  const redirectUri = getRedirectUri(req);
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    redirect_uri: redirectUri,
    prompt: "select_account",
  });

  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const client = getGoogleClient();
  if (!client) {
    res.redirect("/?error=google_not_configured");
    return;
  }

  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error || !code) {
    res.redirect("/login?error=google_cancelled");
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.redirect("/login?error=google_no_email");
      return;
    }

    const googleEmail = payload.email.toLowerCase();
    const googleName = payload.name || googleEmail.split("@")[0];
    const googleId = payload.sub;

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, googleEmail));

    if (!user) {
      const isAdmin = googleEmail === ADMIN_EMAIL.toLowerCase();
      const [created] = await db
        .insert(usersTable)
        .values({
          email: googleEmail,
          name: googleName,
          googleId,
          status: isAdmin ? "active" : "pending",
          role: isAdmin ? "admin" : "user",
        })
        .returning();
      user = created;

      if (!isAdmin) {
        await sendNewUserNotification(googleEmail, googleName);
      }
    } else if (!user.googleId) {
      await db.update(usersTable).set({ googleId }).where(eq(usersTable.id, user.id));
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.redirect(`/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    res.redirect("/login?error=google_failed");
  }
});

// ─── Session ─────────────────────────────────────────────────────────────────

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
