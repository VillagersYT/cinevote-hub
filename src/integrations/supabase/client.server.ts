import { createClient, type User } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

import type { Database } from "./types";

const DEFAULT_SUPABASE_PROJECT_ID = "bpbpwrvorkomylbyflac";
const DEFAULT_SUPABASE_URL = "https://bpbpwrvorkomylbyflac.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aOJpvDR_QFFDIDK8VoaW_Q_1XHK6VIn";

type AdminKey = {
  kind: "secret" | "legacy-service-role";
  source: string;
  value: string;
};

function cleanEnvironmentValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim();

  if (!cleaned) {
    return undefined;
  }

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    return cleaned.slice(1, -1).trim() || undefined;
  }

  return cleaned;
}

function decodeJwtPayload(value: string): Record<string, unknown> | null {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function getLegacyJwtRole(value: string): string | null {
  const role = decodeJwtPayload(value)?.role;
  return typeof role === "string" ? role : null;
}

function parseElevatedSupabaseKey(value: string, source: string): AdminKey | null {
  if (value.startsWith("sb_secret_")) {
    return {
      kind: "secret",
      source,
      value,
    };
  }

  if (getLegacyJwtRole(value) === "service_role") {
    return {
      kind: "legacy-service-role",
      source,
      value,
    };
  }

  return null;
}

function parsePublishableSupabaseKey(value: string): string | null {
  if (value.startsWith("sb_publishable_") || getLegacyJwtRole(value) === "anon") {
    return value;
  }

  return null;
}

function getSecretKeysFromJson(
  value: string | undefined,
): Array<{ source: string; value: string }> {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.entries(parsed).flatMap(([name, candidate]) => {
      const cleaned = typeof candidate === "string" ? cleanEnvironmentValue(candidate) : undefined;

      return cleaned ? [{ source: `SUPABASE_SECRET_KEYS.${name}`, value: cleaned }] : [];
    });
  } catch {
    return [];
  }
}

function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "https:") {
      throw new Error("protocol");
    }

    return parsedUrl.origin;
  } catch {
    throw new Error(
      "L’URL Supabase est invalide. Utilise l’URL https://…supabase.co sans guillemets.",
    );
  }
}

function getProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function getCanonicalSupabaseUrl(): string {
  const browserUrl =
    normalizeSupabaseUrl(
      cleanEnvironmentValue(process.env.VITE_SUPABASE_URL) ||
        cleanEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ) || DEFAULT_SUPABASE_URL;
  const serverUrl =
    normalizeSupabaseUrl(cleanEnvironmentValue(process.env.SUPABASE_URL)) || browserUrl;
  const expectedProjectId =
    cleanEnvironmentValue(process.env.VITE_SUPABASE_PROJECT_ID) ||
    cleanEnvironmentValue(process.env.SUPABASE_PROJECT_ID) ||
    DEFAULT_SUPABASE_PROJECT_ID;
  const browserProjectId = getProjectRef(browserUrl);
  const serverProjectId = getProjectRef(serverUrl);

  if (browserProjectId !== serverProjectId || serverProjectId !== expectedProjectId) {
    throw new Error(
      "Configuration Supabase incohérente : SUPABASE_URL et VITE_SUPABASE_URL doivent viser le même projet.",
    );
  }

  return serverUrl;
}

function getSupabaseServerConfiguration() {
  const supabaseUrl = getCanonicalSupabaseUrl();
  const keyCandidates = [
    ["SUPABASE_SERVICE_ROLE_KEY", cleanEnvironmentValue(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["SUPABASE_SERVICE_KEY", cleanEnvironmentValue(process.env.SUPABASE_SERVICE_KEY)],
    ["SERVICE_ROLE_KEY", cleanEnvironmentValue(process.env.SERVICE_ROLE_KEY)],
    ["SUPABASE_SECRET_KEY", cleanEnvironmentValue(process.env.SUPABASE_SECRET_KEY)],
    ["SUPABASE_KEY", cleanEnvironmentValue(process.env.SUPABASE_KEY)],
    ["SUPABASE_SERVICE_ROLE", cleanEnvironmentValue(process.env.SUPABASE_SERVICE_ROLE)],
  ]
    .flatMap(([source, value]) =>
      typeof source === "string" && typeof value === "string" ? [{ source, value }] : [],
    )
    .concat(getSecretKeysFromJson(cleanEnvironmentValue(process.env.SUPABASE_SECRET_KEYS)));
  const seenValues = new Set<string>();
  const adminKeys = keyCandidates.flatMap(({ source, value }) => {
    const adminKey = parseElevatedSupabaseKey(value, source);

    if (!adminKey || seenValues.has(adminKey.value)) {
      return [];
    }

    seenValues.add(adminKey.value);
    return [adminKey];
  });
  const hasPublishableKey = keyCandidates.some(
    ({ value }) => value.startsWith("sb_publishable_") || getLegacyJwtRole(value) === "anon",
  );

  return {
    adminKeys,
    hasPublishableKey,
    keyCandidateSources: keyCandidates.map(({ source }) => source),
    supabaseUrl,
  };
}

function getSupabaseUserVerifierConfiguration() {
  const supabaseUrl = getCanonicalSupabaseUrl();
  const keyCandidates = [
    cleanEnvironmentValue(process.env.SUPABASE_PUBLISHABLE_KEY),
    cleanEnvironmentValue(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    cleanEnvironmentValue(process.env.SUPABASE_ANON_KEY),
    cleanEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    getProjectRef(supabaseUrl) === DEFAULT_SUPABASE_PROJECT_ID
      ? DEFAULT_SUPABASE_PUBLISHABLE_KEY
      : undefined,
  ].filter((value): value is string => Boolean(value));
  const publishableKey = keyCandidates
    .map(parsePublishableSupabaseKey)
    .find((candidate): candidate is string => candidate !== null);

  if (!publishableKey) {
    throw new Error("Ajoute VITE_SUPABASE_PUBLISHABLE_KEY dans Vercel pour vérifier les sessions.");
  }

  return {
    publishableKey,
    supabaseUrl,
  };
}

function createSupabaseFetch(adminKey: AdminKey): typeof fetch {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  return (input, init = {}) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    new Headers(init.headers).forEach((value, name) => {
      headers.set(name, value);
    });

    if (adminKey.kind === "secret" && headers.get("authorization") === `Bearer ${adminKey.value}`) {
      headers.delete("authorization");
    }

    headers.set("apikey", adminKey.value);

    return nativeFetch(input, {
      ...init,
      headers,
    });
  };
}

function createSupabaseAdminClient(adminKey: AdminKey, supabaseUrl: string) {
  return createClient<Database>(supabaseUrl, adminKey.value, {
    global: {
      fetch: createSupabaseFetch(adminKey),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createSupabaseAuthenticatedFetch(accessToken: string): typeof fetch {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  return (input, init = {}) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    new Headers(init.headers).forEach((value, name) => {
      headers.set(name, value);
    });

    headers.set("authorization", `Bearer ${accessToken}`);

    return nativeFetch(input, {
      ...init,
      headers,
    });
  };
}

/**
 * Builds a database client that carries the already verified visitor session.
 * It is the safe fallback for administration when Vercel has a bad server key.
 */
export function createSupabaseAuthenticatedClient(accessToken: string) {
  const { publishableKey, supabaseUrl } = getSupabaseUserVerifierConfiguration();

  return createClient<Database>(supabaseUrl, publishableKey, {
    global: {
      fetch: createSupabaseAuthenticatedFetch(accessToken),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createSupabaseUserVerifierClient() {
  const { publishableKey, supabaseUrl } = getSupabaseUserVerifierConfiguration();

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export class SupabaseAdminKeyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAdminKeyConfigurationError";
  }
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

function isInvalidSupabaseApiKeyError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLocaleLowerCase("en-US");

  return normalized.includes("invalid api key") || normalized.includes("api key is invalid");
}

let _supabaseAdmin: SupabaseAdminClient | undefined;
let _verifiedSupabaseAdmin: Promise<SupabaseAdminClient> | undefined;
let _supabaseUserVerifier: ReturnType<typeof createSupabaseUserVerifierClient> | undefined;

/**
 * Chooses a configured elevated key only after Supabase has accepted it.
 * A wrong stale variable cannot mask a valid key configured under another alias.
 */
export function getVerifiedSupabaseAdminClient(): Promise<SupabaseAdminClient> {
  if (!_verifiedSupabaseAdmin) {
    _verifiedSupabaseAdmin = (async () => {
      const { adminKeys, hasPublishableKey, keyCandidateSources, supabaseUrl } =
        getSupabaseServerConfiguration();

      if (adminKeys.length === 0) {
        throw new SupabaseAdminKeyConfigurationError(
          hasPublishableKey
            ? "Les variables serveur Supabase contiennent une clé publishable/anon au lieu d’une Secret key ou service_role key."
            : "Aucune Secret key Supabase valide n’est configurée sur le serveur.",
        );
      }

      const rejectedSources: string[] = [];

      for (const adminKey of adminKeys) {
        const client = createSupabaseAdminClient(adminKey, supabaseUrl);
        const { error } = await client.from("site_settings").select("id", { head: true }).limit(1);

        if (!isInvalidSupabaseApiKeyError(error)) {
          return client;
        }

        rejectedSources.push(adminKey.source);
      }

      console.error(
        `[Supabase admin] rejected elevated key variables: ${rejectedSources.join(", ")}; checked: ${keyCandidateSources.join(", ") || "none"}`,
      );
      throw new SupabaseAdminKeyConfigurationError(
        "Aucune des clés serveur Supabase configurées n’est acceptée par ce projet.",
      );
    })().catch((error: unknown) => {
      _verifiedSupabaseAdmin = undefined;
      throw error;
    });
  }

  return _verifiedSupabaseAdmin;
}

// Kept for backward compatibility with unused legacy server functions. New code uses
// getVerifiedSupabaseAdminClient() so it can reject stale environment variables safely.
export const supabaseAdmin = new Proxy({} as SupabaseAdminClient, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      const { adminKeys, hasPublishableKey, supabaseUrl } = getSupabaseServerConfiguration();
      const adminKey = adminKeys[0];

      if (!adminKey) {
        throw new SupabaseAdminKeyConfigurationError(
          hasPublishableKey
            ? "Les variables serveur Supabase contiennent une clé publishable/anon au lieu d’une Secret key ou service_role key."
            : "Aucune Secret key Supabase valide n’est configurée sur le serveur.",
        );
      }

      _supabaseAdmin = createSupabaseAdminClient(adminKey, supabaseUrl);
    }

    const value = Reflect.get(_supabaseAdmin, prop, _supabaseAdmin);
    return typeof value === "function" ? value.bind(_supabaseAdmin) : value;
  },
});

function getSupabaseUserVerifier() {
  if (!_supabaseUserVerifier) {
    _supabaseUserVerifier = createSupabaseUserVerifierClient();
  }

  return _supabaseUserVerifier;
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<User> {
  const supabaseUrl = getCanonicalSupabaseUrl();
  const projectRef = getProjectRef(supabaseUrl);
  const expectedIssuer = `${supabaseUrl}/auth/v1`;
  const claims = decodeJwtPayload(accessToken);

  if (!claims) {
    throw new Error("Session administrateur invalide. Déconnecte-toi puis reconnecte-toi.");
  }

  if (typeof claims.iss === "string" && claims.iss !== expectedIssuer) {
    console.error(`[Supabase Auth] issuer mismatch for project ${projectRef}`);
    throw new Error("Le compte connecté et le serveur n’utilisent pas le même projet Supabase.");
  }

  if (typeof claims.exp === "number" && claims.exp <= Math.floor(Date.now() / 1_000)) {
    throw new Error("Session administrateur expirée. Déconnecte-toi puis reconnecte-toi.");
  }

  const { data, error } = await getSupabaseUserVerifier().auth.getUser(accessToken);

  if (error || !data.user) {
    const authError = error as {
      code?: string;
      message?: string;
      name?: string;
      status?: number;
    } | null;

    console.error(
      `[Supabase Auth] project=${projectRef} status=${authError?.status ?? "unknown"} code=${authError?.code ?? "unknown"} name=${authError?.name ?? "unknown"} message=${authError?.message ?? "missing user"}`,
    );

    if (authError?.message?.toLocaleLowerCase("en-US").includes("api key")) {
      throw new Error(
        "La clé publishable Supabase de Vercel ne correspond pas au projet utilisé par le site.",
      );
    }

    if (authError?.status === 0) {
      throw new Error("Supabase Auth ne répond pas. Réessaie dans quelques instants.");
    }

    throw new Error("Session administrateur expirée. Déconnecte-toi puis reconnecte-toi.");
  }

  return data.user;
}
