export function newId(prefix = ''): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}${cryptoApi.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}${Date.now().toString(36)}-${random}`;
}
