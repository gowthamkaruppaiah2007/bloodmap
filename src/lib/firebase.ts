import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAK9sKJ1BjkBtw4kAwuvfomLDIaB2LRhxI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bloodmap-e723c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bloodmap-e723c",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bloodmap-e723c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "132032640050",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:132032640050:web:ebbc6267c421e1f3a3782b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-WCFXK6SLJL",
};

const VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  "BOh2zsJ-E53s9EW58FI4TFeSaQvY57v6LYSqGTw3PZNMftcrhkON5KwPLfA6cE93eZf3hFEUYiGD_GhDLwiqOic";

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;

  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export async function requestNotificationPermissionAndGetToken(
  userId: string,
): Promise<string | null> {
  try {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported in this browser");
      return null;
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn("Firebase Messaging not supported");
      return null;
    }

    // Register Service Worker
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      serviceWorkerRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration,
    });

    if (token && userId) {
      // Save FCM token to Supabase fcm_tokens table
      const { error } = await supabase.from("fcm_tokens").upsert(
        {
          user_id: userId,
          token,
          device_type: "web",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );

      if (error) {
        console.error("Error saving FCM token to Supabase:", error);
      } else {
        console.log("FCM Token saved to Supabase successfully.");
      }
      return token;
    }

    return null;
  } catch (err) {
    console.error("Failed to request notification permission or get FCM token:", err);
    return null;
  }
}

export async function setupForegroundMessageListener() {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log("Foreground FCM message received:", payload);
    const title = payload.notification?.title || payload.data?.title || "Urgent Blood Request";
    const body =
      payload.notification?.body ||
      payload.data?.body ||
      "A matching blood request needs your help!";
    const requestId = payload.data?.request_id;

    toast.error(`${title}: ${body}`, {
      description: "Click to view request details.",
      action: requestId
        ? {
            label: "View Request",
            onClick: () => {
              window.location.href = `/requests/${requestId}`;
            },
          }
        : undefined,
    });
  });
}
