/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Initialize Firebase App in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyAK9sKJ1BjkBtw4kAwuvfomLDIaB2LRhxI",
  authDomain: "bloodmap-e723c.firebaseapp.com",
  projectId: "bloodmap-e723c",
  storageBucket: "bloodmap-e723c.firebasestorage.app",
  messagingSenderId: "132032640050",
  appId: "1:132032640050:web:ebbc6267c421e1f3a3782b",
  measurementId: "G-WCFXK6SLJL",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message:", payload);

  const title = payload.notification?.title || payload.data?.title || "Urgent Blood Request Alert";
  const body =
    payload.notification?.body ||
    payload.data?.body ||
    "A matching blood request has been posted nearby!";

  const targetUrl =
    payload.data?.url ||
    (payload.data?.request_id ? `/requests/${payload.data.request_id}` : "/requests");

  const options = {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      url: targetUrl,
      request_id: payload.data?.request_id,
    },
    tag: payload.data?.request_id || "blood-map-request",
    renotify: true,
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    (event.notification.data?.request_id
      ? `/requests/${event.notification.data.request_id}`
      : "/requests");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If app tab is open, navigate and focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes("/requests") && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
