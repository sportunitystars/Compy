import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../lib/auth";
import { sendNewUserNotification } from "../lib/email";

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

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true, // auto-confirm so user can log in immediately
  });

  if (authError) {
    if (authError.message.includes("already registered") || authError.message.includes("already been registered")) {
      res.status(409).json({ error: "Este email ya está registrado" });
    } else {
      res.status(400).json({ error: authError.message });
    }
    return;
  }

  const userId = authData.user.id;
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Upsert profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: userId,
      email: email.toLowerCase(),
      name,
      status: isAdmin ? "active" : "pending",
      role: isAdmin ? "admin" : "user",
    })
    .select()
    .single();

  if (profileError) {
    req.log.error({ profileError }, "Failed to create profile");
    res.status(500).json({ error: "Error al crear perfil" });
    return;
  }

  // Sign in to get a session token for the client
  const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (signInError || !sessionData.session) {
    res.status(500).json({ error: "Error al iniciar sesión automáticamente" });
    return;
  }

  if (!isAdmin) {
    await sendNewUserNotification(email, name);
  }

  res.status(201).json({
    token: sessionData.session.access_token,
    user: formatProfile(profile),
  });
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

  // Get profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    res.status(404).json({ error: "Perfil no encontrado" });
    return;
  }

  res.json({
    token: data.session.access_token,
    user: formatProfile(profile),
  });
});

// ── Google OAuth — initiate ────────────────────────────────────────────────────
router.get("/auth/google", async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.APP_URL || ""}/api/auth/google/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    res.status(503).json({ error: "Google OAuth no está configurado" });
    return;
  }

  res.redirect(data.url);
});

// ── Google OAuth — callback ────────────────────────────────────────────────────
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  // The actual code/token exchange is done client-side by Supabase JS.
  // The server redirects to the frontend which handles the hash/query params.
  const code = req.query.code as string | undefined;

  if (!code) {
    res.redirect("/login?error=google_cancelled");
    return;
  }

  // Exchange code for session using Supabase
  const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    req.log.error({ error }, "Google OAuth callback failed");
    res.redirect("/login?error=google_failed");
    return;
  }

  const googleEmail = data.user.email!.toLowerCase();
  const googleName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || googleEmail.split("@")[0];
  const isAdmin = googleEmail === ADMIN_EMAIL.toLowerCase();

  // Upsert profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabaseAdmin.from("profiles").insert({
      id: data.user.id,
      email: googleEmail,
      name: googleName,
      status: isAdmin ? "active" : "pending",
      role: isAdmin ? "admin" : "user",
    });

    if (!isAdmin) {
      await sendNewUserNotification(googleEmail, googleName);
    }
  }

  // Redirect to frontend with access token
  const token = data.session.access_token;
  res.redirect(`/auth/callback?token=${encodeURIComponent(token)}`);
});

// ── Get current user ──────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", req.user!.id)
    .single();

  if (error || !profile) {
    res.status(404).json({ error: "Perfil no encontrado" });
    return;
  }

  res.json(formatProfile(profile));
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Sesión cerrada" });
});

export default router;
