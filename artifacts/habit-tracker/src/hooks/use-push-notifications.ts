import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";

const API_BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/+$/, "");

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushState = "unsupported" | "default" | "granted" | "denied" | "loading";

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!isSupported || !user) {
      setState(isSupported ? "default" : "unsupported");
      return;
    }

    (async () => {
      try {
        const swUrl = `${import.meta.env.BASE_URL}sw.js`;
        const reg = await navigator.serviceWorker.register(swUrl, {
          scope: import.meta.env.BASE_URL,
        });
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        setSubscription(existing);
        const perm = Notification.permission;
        if (perm === "granted" && existing) setState("granted");
        else if (perm === "denied") setState("denied");
        else setState("default");
      } catch {
        setState("unsupported");
      }
    })();
  }, [user, isSupported]);

  useEffect(() => {
    if (!isSupported) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "PLAY_STREAK_SOUND") {
        const audio = new Audio(`${import.meta.env.BASE_URL}streak-notification.mp3`);
        audio.play().catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setState("loading");
    try {
      const keyRes = await fetch(`${API_BASE}/api/push/vapid-key`);
      if (!keyRes.ok) { setState("default"); return false; }
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      });

      setSubscription(sub);
      setState("granted");
      return true;
    } catch {
      const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
      setState(perm === "denied" ? "denied" : "default");
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!subscription) return;
    setState("loading");
    try {
      await fetch(`${API_BASE}/api/push/unsubscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setState("default");
    } catch {
      setState("granted");
    }
  }, [subscription]);

  return { state, subscribe, unsubscribe };
}
