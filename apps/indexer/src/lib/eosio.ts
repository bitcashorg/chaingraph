import { APIClient, FetchProvider } from "@wharfkit/antelope";
import fetch from "node-fetch";
import { config } from "../config";

const primaryRpcUrl = config.reader.rpc_url;
const backupRpcUrl: string | undefined = (config.reader as any).rpc_url_backup;
let activeRpcUrl = primaryRpcUrl;

const clientForUrl = (url: string) => new APIClient({ provider: new FetchProvider(url, { fetch }) });

const chooseInitialUrl = () => {
  // Prefer primary if we're currently on backup and a backup exists, to attempt failback
  if (activeRpcUrl !== primaryRpcUrl && primaryRpcUrl) return primaryRpcUrl;
  return activeRpcUrl;
};

const alternateUrl = (tried: string): string | undefined => {
  if (backupRpcUrl && tried === primaryRpcUrl) return backupRpcUrl;
  if (primaryRpcUrl && tried === backupRpcUrl) return primaryRpcUrl;
  return undefined;
};

export const rpcCall = async <T>(fn: (client: APIClient) => Promise<T>): Promise<T> => {
  const firstUrl = chooseInitialUrl();
  try {
    const res = await fn(clientForUrl(firstUrl));
    // If we succeeded using primary, mark active as primary
    if (firstUrl === primaryRpcUrl) activeRpcUrl = primaryRpcUrl;
    return res;
  } catch (e) {
    const alt = alternateUrl(firstUrl);
    if (!alt) throw e;
    const res = await fn(clientForUrl(alt));
    activeRpcUrl = alt;
    return res;
  }
};

export const getInfo = async (): Promise<any> => {
  const tryFetch = async (url: string) => {
    const r = await fetch(`${url}/v1/chain/get_info`);
    if (!r.ok) throw new Error(`get_info failed: ${r.status}`);
    return r.json();
  };
  const firstUrl = chooseInitialUrl();
  try {
    const res = await tryFetch(firstUrl);
    if (firstUrl === primaryRpcUrl) activeRpcUrl = primaryRpcUrl;
    return res;
  } catch (e) {
    const alt = alternateUrl(firstUrl);
    if (!alt) throw e;
    const res = await tryFetch(alt);
    activeRpcUrl = alt;
    return res;
  }
};

export const resolveWorkingRpcUrl = async (): Promise<string> => {
  const firstUrl = chooseInitialUrl();
  const tryFetch = async (url: string) => {
    const r = await fetch(`${url}/v1/chain/get_info`);
    if (!r.ok) throw new Error(`get_info failed: ${r.status}`);
    return r.json();
  };
  try {
    await tryFetch(firstUrl);
    if (firstUrl === primaryRpcUrl) activeRpcUrl = primaryRpcUrl;
    return firstUrl;
  } catch (_e) {
    const alt = alternateUrl(firstUrl);
    if (!alt) return firstUrl; // no alternate configured
    await tryFetch(alt);
    activeRpcUrl = alt;
    return alt;
  }
};

export const getActiveRpcUrl = (): string => activeRpcUrl;
