workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new workbox.strategies.StaleWhileRevalidate()
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname === '/api/method/frappe.client.get_js',
  new workbox.strategies.StaleWhileRevalidate()
);
