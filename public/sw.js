// Minimal service worker: makes the app installable, always goes to the network
// (live draw data must never be stale), and shows a short notice when offline.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Vinlotteri</title><body style="font-family:system-ui;background:#fbf6ef;color:#2c0a14;text-align:center;padding:4rem 1rem">' +
            "<h1>🍷 Ingen nettilkobling</h1><p>Prøv igjen når du er på nett.</p></body>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
