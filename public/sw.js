/*
 * instructBrain Field - service worker.
 *
 * Its ONLY job is to make the app installable.
 *
 * Chrome will not offer to install a web app, and will not fire
 * `beforeinstallprompt`, unless a service worker with a `fetch` handler is
 * registered and active. A correct manifest is NOT enough on its own - which is
 * why the "Add to home screen" offer never appeared on Android however right
 * `manifest.webmanifest` looked.
 *
 * IT CACHES NOTHING, ON PURPOSE. There is no `caches.open` in this file and
 * there should never be one: every request goes to the network exactly as it
 * would with no service worker at all. Someone standing on site must never be
 * handed a stale build of the app that decides what a report says, and an
 * install prompt is not worth that risk. Real offline support, if it is ever
 * wanted, is a separate deliberate change with its own cache versioning and its
 * own way of telling the person what they are looking at.
 */

self.addEventListener("install", () => {
  // Take over on the next load rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Control the page that registered us, so the install offer can appear on the
  // very visit that scanned the QR code rather than the one after it.
  event.waitUntil(self.clients.claim());
});

// Present and inert. The handler exists because Chrome requires one; it does
// nothing, which is the point.
self.addEventListener("fetch", () => {});
