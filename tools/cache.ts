import NodeCache from "node-cache";

export const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 120,
});

export function getCache(key: string) {
  return cache.get(key);
}

export function setCache(key: string, value: any, ttl = 300) {
  cache.set(key, value, ttl);
}
