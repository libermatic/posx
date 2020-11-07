import { make_response, get_args } from './utils';

const INVOICE_QUEUE = 'posx-invoice-v1';

const queue = new workbox.backgroundSync.Queue(INVOICE_QUEUE);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.endsWith('frappe.desk.form.save.savedocs'),
  async function ({ request, event }) {
    const client = await self.clients.get(event.clientId);
    if (client && client.url.includes('desk#point-of-sale')) {
      const { doc } = await get_args(request);
      queue.pushRequest({ request });
      return getResponse({ doc });
    }
    return fetch(request);
  },
  'POST'
);

function getResponse({ doc }) {
  const payload = { docinfo: {}, docs: [{ ...JSON.parse(doc), docstatus: 1 }] };
  return make_response({ payload });
}
