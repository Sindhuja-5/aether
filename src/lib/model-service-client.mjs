const DEFAULT_TIMEOUT_MS = 55_000;

function getModelServiceConfig() {
  const baseUrl = process.env.MODEL_SERVICE_URL?.replace(/\/+$/u, '');
  const token = process.env.MODEL_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new Error('Model inference is not configured. Set MODEL_SERVICE_URL and MODEL_SERVICE_TOKEN.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error('MODEL_SERVICE_URL must be an absolute HTTPS URL (or local HTTP URL for development).');
  }
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && isLoopback)) {
    throw new Error('MODEL_SERVICE_URL must use HTTPS except when pointing to localhost.');
  }
  return { baseUrl, token };
}

export async function callModelService(path, payload) {
  const { baseUrl, token } = getModelServiceConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    cache: 'no-store',
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result?.error === 'string' ? result.error : `Model service returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  if (!result || typeof result !== 'object') throw new Error('Model service returned an invalid response.');
  return result;
}
