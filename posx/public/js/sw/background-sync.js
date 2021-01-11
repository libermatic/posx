import db from '../store/db';
import { set_session_state } from '../store';
import { make_response, get_args } from './utils';

const INVOICE_QUEUE = 'posx-invoice-v1';

const queue = new workbox.backgroundSync.Queue(INVOICE_QUEUE, {
  onSync: async function ({ queue: q }) {
    await q.replayRequests();
    const count = await q.getAll();
    if (count && count.length === 0) {
      await set_session_state({ last_sync: new Date() });
    }
    self.clients.matchAll().then((clients) => {
      clients && clients.length && postSyncStatus(clients[0], q);
    });
  },
});

workbox.routing.registerRoute(
  ({ url }) => url.pathname.endsWith('frappe.desk.form.save.savedocs'),
  async function ({ request, event }) {
    const client = await self.clients.get(event.clientId);
    if (client && client.url.includes('desk#point-of-sale')) {
      const { doc } = await get_args(request);
      await queue.pushRequest({ request });
      postSyncStatus(client, queue);
      return getResponse({ doc });
    }
    return fetch(request);
  },
  'POST'
);

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'GET_SYNC_STATUS') {
    self.clients.matchAll().then((clients) => {
      clients && clients.length && postSyncStatus(clients[0], queue);
    });
  }
});

function getResponse({ doc }) {
  const payload = { docinfo: {}, docs: [{ ...JSON.parse(doc), docstatus: 1 }] };
  return make_response({ payload });
}

async function postSyncStatus(client, syncQueue) {
  const [last_sync, unsynced_count] = await Promise.all([
    db.session_state.get('last_sync').then((x) => x && x.value),
    syncQueue.getAll().then((x) => x.length),
  ]);

  client.postMessage({
    type: 'SYNC_STATUS',
    data: { last_sync, unsynced_count },
  });
}
