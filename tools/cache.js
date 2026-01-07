import NodeCache from "node-cache";

export const cache = new NodeCache({
  stdTTL: 60, // default TTL = 60 seconds
  checkperiod: 120,
});

export function getCache(key) {
  console.log("Key get: ", key);
  return cache.get(key);
}

export function setCache(key, value, ttl = 60) {
  console.log("Key: ", key);
  console.log("Value: ", value);
  cache.set(key, value, ttl);
}
