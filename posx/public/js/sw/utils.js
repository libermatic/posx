export async function get_args(request) {
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

export function make_response({ payload, status = 200 }) {
  return new Response(JSON.stringify(payload), {
    status,
    ok: 200 <= status && status < 300,
    headers: { 'Content-Type': 'application/json' },
  });
}
