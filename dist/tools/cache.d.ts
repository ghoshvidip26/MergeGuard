import NodeCache from "node-cache";
export declare const cache: NodeCache;
export declare function getCache(key: string): unknown;
export declare function setCache(key: string, value: any, ttl?: number): void;
