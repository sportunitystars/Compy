import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../lib/auth";
import { sendNewUserNotification, sendPendingEmail } from "../lib/email";

const router: IRouter = Router();
const ADMIN_EMAIL = "luisgomezm10@gmail.com";

function formatProfile(profile: any) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    status: profile.status,
    role: profile.role,
    createdAt: profile.created_at,
  };
}

// ── Register with email/password ──────────────────────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: "Email, contraseña y nombre son requeridos" });
    return;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("already exists")) {
      res.status(409).json({ error: "Este email ya está registrado" });
    } else {
      res.status(400).json({ error: authError.message });
    }
    return;
  }

  const userId = authData.user.id;
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, email: email.toLowerCase(), name, status: isAdmin ? "active" : "pending", role: isAdmin ? "admin" : "user" })
    .select()
    .single();

  if (profileError) {
    req.log.error({ profileError }, "Failed to create profile");
    res.status(500).json({ error: "Error al crear perfil" });
    return;
  }

  const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (signInError || !sessionData.session) {
    res.status(500).json({ error: "Error al iniciar sesión automáticamente" });
    return;
  }

  if (!isAdmin) {
    await Promise.all([
      sendNewUserNotification(email, name),
      sendPendingEmail(email, name, password),
    ]);
  }

  res.status(201).json({ token: sessionData.session.access_token, user: formatProfile(profile) });
});

// ── Login with email/password ──────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email y contraseña son requeridos" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (error || !data.session) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles").select("*").eq("id", data.user.id).single();

  if (profileError || !profile) {
    res.status(404).json({ error: "Perfil no encontrado" });
    return;
  }

  res.json({ token: data.session.access_token, user: formatProfile(profile) });
});

// ── Get/create current user profile (used after OAuth) ────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  const supaUser = data.user;
  const userEmail = supaUser.email!.toLowerCase();
  const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase();

  // Find or create profile (handles both email and Google OAuth signups)
  let { data: profile } = await supabaseAdmin
    .from("profiles").select("*").eq("id", supaUser.id).single();

  if (!profile) {
    const name =
      supaUser.user_metadata?.full_name ||
      supaUser.user_metadata?.name ||
      supaUser.user_metadata?.display_name ||
      userEmail.split("@")[0];

    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: supaUser.id, email: userEmail, name, status: isAdmin ? "active" : "pending", role: isAdmin ? "admin" : "user" })
      .select()
      .single();

    if (insertError) {
      req.log.error({ insertError }, "Failed to create profile on /me");
      res.status(500).json({ error: "Error al crear perfil" });
      return;
    }

    profile = newProfile;

    if (!isAdmin) {
      await Promise.all([
        sendNewUserNotification(userEmail, name),
        sendPendingEmail(userEmail, name),
      ]);
    }
  }

  res.json(formatProfile(profile));
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Sesión cerrada" });
});

export default router;
