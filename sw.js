// Minimal service worker: makes SocialEye installable and able to receive shared links.
// It does not cache social content.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
