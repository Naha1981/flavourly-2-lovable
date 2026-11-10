// Only the original app's backend endpoints are forwarded. UI/HTML stays here.
const backend = 'https://flavourly-2-lovable.lovable.app';
export function createPagesProxy(app, fetchBackend = fetch) {
  return {
    ...app,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const serverFn = url.pathname.startsWith('/_serverFn/');
      if (!serverFn && !url.pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
      const origin = request.headers.get('origin');
      if (serverFn && origin && origin !== url.origin) {
        return new Response('Cross-origin request rejected', {status: 403});
      }
      const target = new URL(url.pathname + url.search, backend);
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('cookie');
      // The original same-origin browser check is above. The upstream sees its own origin.
      if (origin === url.origin) headers.set('origin', target.origin);
      const upstream = new Request(target, {method: request.method, headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual', duplex: 'half'});
      const response = await fetchBackend(upstream);
      const outgoing = new Headers(response.headers);
      outgoing.delete('set-cookie');
      outgoing.set('cache-control', 'no-store');
      return new Response(response.body, {status: response.status, statusText: response.statusText, headers: outgoing});
    }
  };
}
