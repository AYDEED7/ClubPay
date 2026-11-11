async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm || !options.body ? options.body : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
};

export const money = (n, currency = 'USD') =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
