import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import type { Database } from "./types";

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

function getLegacyJwtRole(value: string): string | null {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as {
      role?: unknown;
    };

    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
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

function getSupabaseServerConfiguration() {
  const supabaseUrl =
    cleanEnvironmentValue(process.env.SUPABASE_URL) ||
    cleanEnvironmentValue(process.env.VITE_SUPABASE_URL) ||
    cleanEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const keyCandidates = [
    cleanEnvironmentValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cleanEnvironmentValue(process.env.SUPABASE_SECRET_KEY),
    cleanEnvironmentValue(process.env.SUPABASE_KEY),
    getSecretKeyFromJson(cleanEnvironmentValue(process.env.SUPABASE_SECRET_KEYS)),
  ].filter((value): value is string => Boolean(value));

  const adminKey = keyCandidates
    .map(parseElevatedSupabaseKey)
    .find((candidate): candidate is AdminKey => candidate !== null);

  if (!supabaseUrl) {
    throw new Error("Configuration Supabase serveur incomplète : ajoute SUPABASE_URL dans Vercel.");
  }

  try {
    const parsedUrl = new URL(supabaseUrl);

    if (parsedUrl.protocol !== "https:") {
      throw new Error("protocol");
    }
  } catch {
    throw new Error(
      "SUPABASE_URL est invalide. Utilise l’URL https://…supabase.co sans guillemets.",
    );
  }

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
    supabaseUrl,
    adminKey,
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
  const { supabaseUrl, adminKey } = getSupabaseServerConfiguration();

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

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createSupabaseAdminClient();
    }

    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
