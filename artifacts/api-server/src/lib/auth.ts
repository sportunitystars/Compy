import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "./supabase";
import { logger } from "./logger";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const token = authHeader.slice(7);

  // Verify the Supabase JWT
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  // Get our custom profile from the profiles table
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    res.status(401).json({ error: "Perfil no encontrado" });
    return;
  }

  req.user = {
    id: data.user.id,
    email: data.user.email!,
    role: profile.role,
    status: profile.status,
    name: profile.name,
  };

  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }
    next();
  });
}

export async function requireActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.status !== "active") {
      res.status(403).json({ error: "Cuenta no activa" });
      return;
    }
    next();
  });
}
