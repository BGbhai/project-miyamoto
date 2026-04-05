const BUILD = "20260405d";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      const staleKeys = cacheKeys.filter((name) => /miya|miyamoto/i.test(name));
      await Promise.all(staleKeys.map((name) => caches.delete(name)));
      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });

      await Promise.all(
        clients.map((client) => {
          const url = new URL(client.url);
          url.searchParams.set("refresh", BUILD);
          return client.navigate(url.toString());
        }),
      );
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
