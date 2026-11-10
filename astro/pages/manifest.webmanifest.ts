import type { APIRoute } from "astro";
import { pwaManifest } from "@/lib/pwa-manifest";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(pwaManifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
