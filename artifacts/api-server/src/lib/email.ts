import nodemailer from "nodemailer";
import { logger } from "./logger";

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
const ADMIN_EMAIL = "luisgomezm10@gmail.com";
const APP_NAME = "Compy";
const APP_URL = process.env.APP_URL || "https://6e138a67-f07e-49f7-b1e7-a8c7e4934298-00-31iugwg2vncdv.picard.replit.dev";
const FROM = `${APP_NAME} <${GMAIL_USER}>`;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_PASS) {
    logger.warn("GMAIL_USER or GMAIL_APP_PASSWORD not set — emails will be skipped");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

export async function sendNewUserNotification(userEmail: string, userName: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `${APP_NAME} — Nueva solicitud: ${userName || userEmail}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#111;">Nueva solicitud de acceso</h2>
          <p style="color:#444;"><strong>${userName} (${userEmail})</strong> acaba de solicitar acceso.</p>
          <p style="color:#6b7280;">Este usuario está en estado <strong>pendiente</strong>. Entra al panel para aprobar o rechazar su acceso.</p>
          <a href="${APP_URL}/admin"
             style="display:inline-block;margin-top:20px;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">
            Ir al Panel de Admin →
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
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM,
      to: userEmail,
      subject: `${APP_NAME} — Solicitud recibida`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#111;">Hola${userName ? `, ${userName}` : ""} — estás en la lista.</h2>
          <p style="color:#444;line-height:1.7;">
            Hemos recibido tu solicitud de acceso a <strong>${APP_NAME}</strong>.
            Cuando el administrador apruebe tu cuenta, recibirás un correo con instrucciones para acceder.
          </p>
          <p style="color:#888;font-size:13px;">Gracias por tu paciencia.</p>
        </div>
      `,
    });
    logger.info({ userEmail }, "Pending request email sent to user");
  } catch (err) {
    logger.error({ err }, "Failed to send pending email to user");
  }
}

export async function sendRejectionEmail(userEmail: string, userName: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM,
      to: userEmail,
      subject: `${APP_NAME} — Actualización sobre tu solicitud`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#111;">Hola${userName ? `, ${userName}` : ""}</h2>
          <p style="color:#444;line-height:1.7;">
            Lamentablemente, tu solicitud de acceso a <strong>${APP_NAME}</strong> no fue aprobada en esta ocasión.
            Si crees que esto es un error, puedes intentar registrarte nuevamente o contactar al administrador.
          </p>
          <a href="${APP_URL}/register"
             style="display:inline-block;margin-top:20px;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">
            Volver a solicitar acceso →
          </a>
        </div>
      `,
    });
    logger.info({ userEmail }, "Rejection email sent to user");
  } catch (err) {
    logger.error({ err }, "Failed to send rejection email to user");
  }
}

export async function sendPinResetEmail(userEmail: string, userName: string, code: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM,
      to: userEmail,
      subject: `${APP_NAME} — Código para restablecer tu PIN`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#111;">Hola${userName ? `, ${userName}` : ""}</h2>
          <p style="color:#444;line-height:1.7;">
            Recibimos una solicitud para restablecer tu PIN de <strong>${APP_NAME}</strong>.
            Usa el siguiente código (válido por 15 minutos):
          </p>
          <div style="text-align:center;margin:32px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#4f46e5;background:#f0f0ff;padding:16px 24px;border-radius:12px;">${code}</span>
          </div>
          <p style="color:#888;font-size:13px;">Si no solicitaste este cambio, ignora este correo. Tu PIN actual permanece sin cambios.</p>
        </div>
      `,
    });
    logger.info({ userEmail }, "PIN reset email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send PIN reset email");
  }
}

export async function sendApprovalEmail(userEmail: string, userName: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM,
      to: userEmail,
      subject: `${APP_NAME} — Ya tienes acceso`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#111;">Hola${userName ? `, ${userName}` : ""} — ya puedes entrar.</h2>
          <p style="color:#444;line-height:1.7;">
            Tu solicitud ha sido aprobada. Haz clic en el botón para acceder a <strong>${APP_NAME}</strong>:
          </p>
          <a href="${APP_URL}/login"
             style="display:inline-block;margin-top:20px;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">
            Acceder ahora →
          </a>
          <p style="color:#9ca3af;margin-top:24px;font-size:13px;">¡Mucho éxito construyendo tus mejores hábitos!</p>
        </div>
      `,
    });
    logger.info({ userEmail }, "Approval email sent to user");
  } catch (err) {
    logger.error({ err }, "Failed to send approval email");
  }
}
