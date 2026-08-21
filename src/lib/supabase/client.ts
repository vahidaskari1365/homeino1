"use client";
import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | undefined;
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public environment variables are required");
  client ??= createClient(url, key);
  return client;
}
