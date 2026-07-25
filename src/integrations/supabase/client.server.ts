import { createClient, type User } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

import type { Database } from "./types";

const DEFAULT_SUPABASE_PROJECT_ID = "bpbpwrvorkomylbyflac";
const DEFAULT_SUPABASE_URL = "https://bpbpwrvorkomylbyflac.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aOJpvDR_QFFDIDK8VoaW_Q_1XHK6VIn";

type AdminKey = {
  kind: "secret" | "legacy-service-role";
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

function parseElevatedSupabaseKey(value: string): AdminKey | null {
  if (value.startsWith("sb_secret_")) {
    return {
      kind: "secret",
      value,
    };
  }

  if (getLegacyJwtRole(value) === "service_role") {
    return {
      kind: "legacy-service-role",
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

function getSecretKeyFromJson(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const defaultKey = parsed.default;

    if (typeof defaultKey === "string") {
      return cleanEnvironmentValue(defaultKey);
    }

    const firstKey = Object.values(parsed).find(
      (candidate): candidate is string => typeof candidate === "string",
    );

    return cleanEnvironmentValue(firstKey);
  } catch {
    return undefined;
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
    cleanEnvironmentValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cleanEnvironmentValue(process.env.SUPABASE_SECRET_KEY),
    cleanEnvironmentValue(process.env.SUPABASE_KEY),
    getSecretKeyFromJson(cleanEnvironmentValue(process.env.SUPABASE_SECRET_KEYS)),
  ].filter((value): value is string => Boolean(value));
  const adminKey = keyCandidates
    .map(parseElevatedSupabaseKey)
    .find((candidate): candidate is AdminKey => candidate !== null);

  if (!adminKey) {
    const hasPublishableKey = keyCandidates.some(
      (value) => value.startsWith("sb_publishable_") || getLegacyJwtRole(value) === "anon",
    );

    throw new Error(
      hasPublishableKey
        ? "La variable serveur contient une clé Supabase publishable/anon. Mets une Secret key sb_secret_… dans SUPABASE_SERVICE_ROLE_KEY."
        : "Ajoute une Secret key Supabase sb_secret_… dans SUPABASE_SERVICE_ROLE_KEY sur Vercel.",
    );
  }

  return {
    adminKey,
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

function createSupabaseAdminClient() {
  const { adminKey, supabaseUrl } = getSupabaseServerConfiguration();

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

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;
let _supabaseUserVerifier: ReturnType<typeof createSupabaseUserVerifierClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createSupabaseAdminClient();
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
