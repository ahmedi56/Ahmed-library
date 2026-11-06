import { firebaseEnv } from './firebaseConfig';

/**
 * Read-only Firestore over its REST API, without the SDK.
 *
 * Everything a visitor sees from the database — certificate frames, the
 * wall TV's project text, the bedside photo — is world-readable under
 * firestore.rules, so a plain GET with the public web API key returns the
 * same documents the SDK would, for none of its ~157 kB. Same approach as
 * lib/storedResume.ts. Writes stay on the SDK, which only the owner loads.
 */

type RestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: RestValue[] };
  mapValue?: { fields?: Record<string, RestValue> };
};

interface RestDocument {
  name: string;
  fields?: Record<string, RestValue>;
}

export type DocData = Record<string, unknown>;

function decode(v: RestValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue?.fields);
  return null;
}

function decodeFields(fields: Record<string, RestValue> | undefined): DocData {
  const out: DocData = {};
  for (const [key, value] of Object.entries(fields ?? {})) out[key] = decode(value);
  return out;
}

function url(path: string, params: Record<string, string> = {}): string | null {
  const { projectId, apiKey } = firebaseEnv;
  if (!projectId || !apiKey) return null;
  const query = new URLSearchParams({ key: apiKey, ...params });
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${query}`;
}

/** Every document in a collection, by id. Throws on a failed request. */
export async function listCollection(collection: string): Promise<Map<string, DocData>> {
  const docs = new Map<string, DocData>();
  let pageToken = '';
  do {
    const u = url(collection, { pageSize: '100', ...(pageToken ? { pageToken } : {}) });
    if (!u) return docs;
    const res = await fetch(u);
    if (!res.ok) throw new Error(`Firestore ${collection}: HTTP ${res.status}`);
    const body = (await res.json()) as { documents?: RestDocument[]; nextPageToken?: string };
    for (const d of body.documents ?? []) docs.set(d.name.slice(d.name.lastIndexOf('/') + 1), decodeFields(d.fields));
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

/** One document, or null if it doesn't exist. Throws on a failed request. */
export async function getDocument(collection: string, id: string): Promise<DocData | null> {
  const u = url(`${collection}/${id}`);
  if (!u) return null;
  const res = await fetch(u);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore ${collection}/${id}: HTTP ${res.status}`);
  return decodeFields(((await res.json()) as RestDocument).fields);
}
