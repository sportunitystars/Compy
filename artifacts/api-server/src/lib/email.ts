import { Resend } from "resend";
import { logger } from "./logger";

const ADMIN_EMAIL = "luisgomezm10@gmail.com";
const APP_NAME = "Habit Tracker";

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
      from: `${APP_NAME} <onboarding@resend.dev>`,
      to: ADMIN_EMAIL,
      subject: `Nuevo usuario registrado — ${APP_NAME}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #4f46e5;">Nuevo usuario registrado</h2>
          <p><strong>Nombre:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p style="color: #6b7280;">Este usuario está en estado <strong>pendiente</strong>. Entra al panel de administración para aprobar o rechazar su acceso.</p>
          <a href="${process.env.APP_URL || 'https://tu-app.replit.app'}/admin" 
             style="display:inline-block; background:#4f46e5; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; margin-top:16px;">
            Ir al Panel de Admin
          </a>
        </div>
      `,
    });
    logger.info({ userEmail }, "New user notification sent to admin");
  } catch (err) {
    logger.error({ err }, "Failed to send new user notification email");
  }
}

export async function sendApprovalEmail(userEmail: string, userName: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: `${APP_NAME} <onboarding@resend.dev>`,
      to: userEmail,
      subject: `¡Tu cuenta ha sido aprobada! — ${APP_NAME}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #4f46e5;">¡Bienvenido, ${userName}! 🎉</h2>
          <p>Tu cuenta ha sido aprobada. Ya puedes iniciar sesión y comenzar a registrar tus hábitos.</p>
          <a href="${process.env.APP_URL || 'https://tu-app.replit.app'}/login" 
             style="display:inline-block; background:#4f46e5; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; margin-top:16px;">
            Iniciar Sesión
          </a>
          <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">¡Mucho éxito construyendo tus mejores hábitos!</p>
        </div>
      `,
    });
    logger.info({ userEmail }, "Approval email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send approval email");
  }
}
