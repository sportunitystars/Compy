import { Resend } from "resend";
import { logger } from "./logger";

const ADMIN_EMAIL = "luisgomezm10@gmail.com";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — emails will be skipped");
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendNewUserNotification(userEmail: string, userName: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: "Habit Tracker <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject: "Nuevo usuario registrado — Habit Tracker",
      html: `
        <h2>Nuevo usuario registrado</h2>
        <p><strong>Nombre:</strong> ${userName}</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p>Este usuario está en estado <strong>pendiente</strong>. Entra al panel de administración para aprobar o rechazar su acceso.</p>
      `,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send new user notification email");
  }
}

export async function sendApprovalEmail(userEmail: string, userName: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: "Habit Tracker <onboarding@resend.dev>",
      to: userEmail,
      subject: "¡Tu cuenta ha sido aprobada! — Habit Tracker",
      html: `
        <h2>¡Bienvenido, ${userName}!</h2>
        <p>Tu cuenta ha sido aprobada. Ya puedes iniciar sesión y comenzar a registrar tus hábitos.</p>
      `,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send approval email");
  }
}
