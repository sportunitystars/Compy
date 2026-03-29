import webpush from "web-push";
import { logger } from "./logger";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@compy.app";

if (!vapidPublicKey || !vapidPrivateKey) {
  logger.warn("VAPID keys not configured — push notifications disabled");
} else {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export { vapidPublicKey };

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string; sound?: boolean }
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    // 410 Gone = subscription expired/unsubscribed — caller should delete it
    if (err?.statusCode === 410) {
      throw err;
    }
    logger.error({ err }, "Failed to send push notification");
  }
}
