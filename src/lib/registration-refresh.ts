export const REGISTRATION_REFRESH_VERSION = '20260811a';

const REGISTRATION_CHUNK_PATTERN = /\/_next\/static\/chunks\/app\/auth\/register\/(?:page|layout)-([a-z0-9]+)\.js/i;

export function resolveRegistrationRefreshKey(documentRef: Document) {
  const scripts = Array.from(documentRef.querySelectorAll<HTMLScriptElement>('script[src]'));
  const registerScript = scripts.find((script) => REGISTRATION_CHUNK_PATTERN.test(script.src));
  const chunkHash = registerScript?.src.match(REGISTRATION_CHUNK_PATTERN)?.[1] ?? '';

  return chunkHash ? `${REGISTRATION_REFRESH_VERSION}:${chunkHash}` : REGISTRATION_REFRESH_VERSION;
}
