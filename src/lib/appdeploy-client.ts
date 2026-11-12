type ApiResponse = { data: any };

async function request(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown
): Promise<ApiResponse> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return { data };
}

export const api = {
  get: (path: string) => request(path, 'GET'),
  post: (path: string, body: unknown) => request(path, 'POST', body),
  put: (path: string, body: unknown) => request(path, 'PUT', body),
};

type RealtimeConnection = {
  ready: Promise<void>;
  connectionId: string | null;
  onMessage: (handler: (message: any) => void) => void;
  disconnect: () => void;
};

export const ws = {
  connect: (): RealtimeConnection => ({
    ready: Promise.resolve(),
    connectionId: null,
    onMessage: () => undefined,
    disconnect: () => undefined,
  }),
};