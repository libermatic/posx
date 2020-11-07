import * as methods from '../store/server_methods';
import logger from '../utils/logger';
import { make_response, get_args } from './utils';

const METHODS = Object.assign(
  ...Object.keys(methods).map((x) => ({
    [x.replace(/__/g, '.')]: methods[x],
  }))
);

self.addEventListener('fetch', (event) => {
  const endpoint = get_endpoint(event.request);
  if (endpoint in METHODS) {
    event.respondWith(
      (async function () {
        const client = await self.clients.get(event.clientId);
        if (client && client.url.includes('desk#point-of-sale')) {
          const args = await get_args(event.request);
          const method = METHODS[endpoint];
          const result = await query_client(method, args);
          if (result) {
            return make_response(result);
          }
          // log unhandled requests
          logger(endpoint, { args });
        }
        return fetch(event.request);
      })()
    );
  }
});

async function query_client(method, args) {
  try {
    const payload = await method(args);
    if (payload) {
      return { payload };
    }
  } catch (error) {
    return {
      payload: {
        _server_messages: JSON.stringify([
          { indicator: 'red', message: error.message },
        ]),
        exc: JSON.stringify([error.stack]),
        exc_type: error.name,
      },
      status: 417,
    };
  }
  return null;
}

function get_endpoint(request) {
  const url = new URL(request.url);
  if (!url.pathname.includes('/api/method/')) {
    return null;
  }
  return url.pathname.replace('/api/method/', '');
}
