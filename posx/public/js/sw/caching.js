const SCRIPT_CACHE = 'posx-scripts-v1';
const DOCTYPE_CACHE = 'posx-doctype-v1';

const cacheKeyPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url);
    url.searchParams.delete('_');
    return url.toString();
  },
};

workbox.routing.registerRoute(
  ({ url }) => url.pathname.endsWith('frappe.client.get_js'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: SCRIPT_CACHE,
    plugins: [
      cacheKeyPlugin,
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.endsWith('frappe.desk.form.load.getdoctype'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: DOCTYPE_CACHE,
    plugins: [
      cacheKeyPlugin,
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);
