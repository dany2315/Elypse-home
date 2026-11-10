/**
 * Client Hostaway — LECTURE SEULE, côté serveur uniquement (ne jamais importer
 * depuis un composant client : les clés HOSTAWAY_* sont secrètes).
 *
 * - Jeton OAuth2 « client_credentials » (POST /v1/accessTokens), conservé par un
 *   `TokenStore` (en base pour l'app, voir src/lib/finances/sync.ts) et réutilisé ;
 *   il n'est redemandé que s'il manque ou sur une réponse 401.
 * - Lecture paginée (limit / offset) des listings et des réservations.
 * - Nouvelles tentatives avec attente sur 429 (rate limit) et erreurs 5xx / réseau.
 *
 * Aucune méthode d'écriture n'est exposée : seules des requêtes GET partent vers
 * l'API (hors la demande de jeton).
 */

const API = "https://api.hostaway.com/v1";

export type TokenStore = {
  get(): Promise<string | null>;
  set(token: string, expiresAt: Date | null): Promise<void>;
  clear(): Promise<void>;
};

/** Stockage en mémoire (scripts, tests). */
export function memoryTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    get: async () => token,
    set: async (t) => {
      token = t;
    },
    clear: async () => {
      token = null;
    },
  };
}

export class HostawayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HostawayError";
  }
}

type Envelope<T> = { status: string; result: T; count?: number; limit?: number; offset?: number; message?: string };

export type HostawayClientOptions = {
  accountId?: string;
  apiKey?: string;
  store: TokenStore;
  /** Nombre maximal de tentatives par requête (défaut 6). */
  maxAttempts?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createHostawayClient(opts: HostawayClientOptions) {
  const accountId = opts.accountId ?? process.env.HOSTAWAY_ACCOUNT_ID;
  const apiKey = opts.apiKey ?? process.env.HOSTAWAY_API_KEY;
  const maxAttempts = opts.maxAttempts ?? 6;
  if (!accountId || !apiKey) throw new HostawayError("HOSTAWAY_ACCOUNT_ID et HOSTAWAY_API_KEY doivent être définis");

  let pendingToken: Promise<string> | null = null;

  async function requestToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: accountId!,
      client_secret: apiKey!,
      scope: "general",
    });
    const res = await withRetry(() =>
      fetch(`${API}/accessTokens`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-control": "no-cache" },
        body,
      }),
    );
    if (!res.ok) throw new HostawayError(`Jeton Hostaway refusé (HTTP ${res.status})`, res.status);
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new HostawayError("Réponse de jeton Hostaway invalide");
    const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null;
    await opts.store.set(json.access_token, expiresAt);
    return json.access_token;
  }

  async function token(forceNew = false): Promise<string> {
    if (!forceNew) {
      const stored = await opts.store.get();
      if (stored) return stored;
    }
    // Une seule demande de jeton à la fois.
    pendingToken ??= requestToken().finally(() => {
      pendingToken = null;
    });
    return pendingToken;
  }

  /** Relance sur 429 / 5xx / erreur réseau, avec attente exponentielle (ou Retry-After). */
  async function withRetry(doFetch: () => Promise<Response>): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await doFetch();
        if (res.status !== 429 && res.status < 500) return res;
        lastError = new HostawayError(`HTTP ${res.status}`, res.status);
        if (attempt === maxAttempts) return res;
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      } catch (e) {
        lastError = e;
        if (attempt === maxAttempts) break;
        await sleep(backoff(attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new HostawayError("Hostaway injoignable");
  }

  async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<Envelope<T>> {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

    let renewed = false;
    for (;;) {
      const t = await token(false);
      const res = await withRetry(() =>
        fetch(url, { headers: { Authorization: `Bearer ${t}`, "Cache-control": "no-cache" } }),
      );
      if (res.status === 401 && !renewed) {
        // Jeton expiré ou révoqué : on l'oublie et on en redemande un, une seule fois.
        renewed = true;
        await opts.store.clear();
        await token(true);
        continue;
      }
      if (!res.ok) throw new HostawayError(`Hostaway ${path} : HTTP ${res.status}`, res.status);
      const json = (await res.json()) as Envelope<T>;
      if (json.status !== "success") throw new HostawayError(`Hostaway ${path} : ${json.message ?? json.status}`);
      return json;
    }
  }

  /** Parcourt toutes les pages (limit / offset) d'une liste. */
  async function getAll<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    pageSize = 500,
  ): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await get<T[]>(path, { ...params, limit: pageSize, offset });
      const items = page.result ?? [];
      all.push(...items);
      const total = typeof page.count === "number" ? page.count : undefined;
      if (items.length < pageSize || (total !== undefined && all.length >= total)) break;
    }
    return all;
  }

  return {
    get,
    getAll,
    listListings: () => getAll<HostawayListing>("/listings"),
    /** Réservations (filtres Hostaway : arrivalStartDate, arrivalEndDate, departureStartDate, departureEndDate, listingId, sortOrder…). */
    listReservations: (params: Record<string, string | number | undefined> = {}) =>
      getAll<HostawayReservation>("/reservations", params),
  };
}

export type HostawayClient = ReturnType<typeof createHostawayClient>;

function backoff(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
}

/* ------------------------------ Types (partiels) ----------------------------- */
// Seuls les champs réellement utilisés sont typés ; voir docs/finances-hostaway.md.

export type HostawayListing = {
  id: number;
  name?: string | null;
  internalListingName?: string | null;
  externalListingName?: string | null;
  [key: string]: unknown;
};

export type HostawayReservation = {
  id: number;
  listingMapId: number;
  channelId?: number | null;
  channelName?: string | null;
  status?: string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  reservationDate?: string | null;
  nights?: number | null;
  currency?: string | null;
  [key: string]: unknown;
};
