const SCRIPT_CACHE = 'posx-scripts-v1';

workbox.routing.registerRoute(
  ({ url }) => url.pathname === '/api/method/frappe.client.get_js',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: SCRIPT_CACHE,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);
