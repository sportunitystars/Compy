import { Resend } from "resend";
import { logger } from "./logger";

const ADMIN_EMAIL = "luisgomezm10@gmail.com";
const APP_NAME = "Compy";
const APP_URL = "https://6e138a67-f07e-49f7-b1e7-a8c7e4934298-00-31iugwg2vncdv.picard.replit.dev";

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
          <a href="${APP_URL}/admin"
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

export async function sendPendingEmail(userEmail: string, userName: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: `${APP_NAME} <onboarding@resend.dev>`,
      to: userEmail,
      subject: `Tu solicitud de acceso está en revisión — ${APP_NAME}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #4f46e5; width: 56px; height: 56px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px;">✓</span>
            </div>
          </div>
          <h2 style="color: #1e1b4b; text-align: center; margin-bottom: 8px;">¡Solicitud recibida, ${userName}!</h2>
          <p style="color: #6b7280; text-align: center; margin-bottom: 24px;">Tu solicitud de acceso ha sido registrada exitosamente.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #4f46e5; margin-bottom: 24px;">
            <p style="margin: 0; color: #374151;">
              Tu cuenta está actualmente en <strong>revisión</strong>. Una vez que el administrador apruebe tu acceso, recibirás otro correo con la confirmación y podrás iniciar sesión.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
            Si tienes alguna duda, responde a este correo.
          </p>
        </div>
      `,
    });
    logger.info({ userEmail }, "Pending request email sent to user");
  } catch (err) {
    logger.error({ err }, "Failed to send pending email to user");
  }
}

export async function sendRejectionEmail(userEmail: string, userName: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: `${APP_NAME} <onboarding@resend.dev>`,
      to: userEmail,
      subject: `Actualización sobre tu solicitud — ${APP_NAME}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #ef4444; width: 56px; height: 56px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px; color: white;">✕</span>
            </div>
          </div>
          <h2 style="color: #1e1b4b; text-align: center; margin-bottom: 8px;">Hola, ${userName}</h2>
          <p style="color: #6b7280; text-align: center; margin-bottom: 24px;">Tenemos novedades sobre tu solicitud de acceso.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #ef4444; margin-bottom: 24px;">
            <p style="margin: 0; color: #374151;">
              Lamentablemente, tu solicitud de acceso a <strong>${APP_NAME}</strong> no fue aprobada en esta ocasión.
              Si crees que esto es un error, puedes intentar registrarte nuevamente o contactar al administrador.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
            Puedes volver a solicitar acceso en <a href="${APP_URL}/register" style="color: #4f46e5;">esta página</a>.
          </p>
        </div>
      `,
    });
    logger.info({ userEmail }, "Rejection email sent to user");
  } catch (err) {
    logger.error({ err }, "Failed to send rejection email to user");
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
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #10b981; width: 56px; height: 56px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px;">🎉</span>
            </div>
          </div>
          <h2 style="color: #1e1b4b; text-align: center;">¡Bienvenido, ${userName}!</h2>
          <p style="color: #6b7280; text-align: center; margin-bottom: 24px;">Tu cuenta ha sido aprobada. Ya puedes iniciar sesión.</p>
          <div style="text-align: center;">
            <a href="${APP_URL}/login"
               style="display:inline-block; background:#4f46e5; color:white; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600;">
              Iniciar Sesión
            </a>
          </div>
          <p style="color: #9ca3af; margin-top: 24px; font-size: 13px; text-align: center;">¡Mucho éxito construyendo tus mejores hábitos!</p>
        </div>
      `,
    });
    logger.info({ userEmail }, "Approval email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send approval email");
  }
}
