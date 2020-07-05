import * as methods from '../store/server_methods';

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
          console.log(
            `%c${endpoint}`,
            [
              'background-color:#009688',
              'color:#fff',
              'padding:0.2em',
              'border-radius:0.4em',
            ].join(';'),
            args
          );
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

function make_response({ payload, status = 200 }) {
  return new Response(JSON.stringify(payload), {
    status,
    ok: 200 <= status && status < 300,
    headers: { 'Content-Type': 'application/json' },
  });
}

function get_endpoint(request) {
  const url = new URL(request.url);
  if (!url.pathname.includes('/api/method/')) {
    return null;
  }
  return url.pathname.replace('/api/method/', '');
}

async function get_args(request) {
  const args = {};
  if (request.method === 'GET') {
    const url = new URL(request.url);
    url.searchParams.forEach((value, key) => {
      args[key] = value;
    });
  } else if (request.method === 'POST') {
    const req = request.clone();
    const text = await req.text();
    const searchParams = new URLSearchParams(text);
    searchParams.forEach((value, key) => {
      args[key] = value;
    });
  }
  return args;
}
