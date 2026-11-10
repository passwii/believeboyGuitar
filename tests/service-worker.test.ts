import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const origin = "https://practice.test";
const workerSource = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

type RequestLike = { url: string };
type WorkerListener = (event: unknown) => void;

class MockRequest {
  readonly url: string;
  readonly method: string;

  constructor(input: string | RequestLike, _init?: { cache?: string }) {
    this.url = typeof input === "string" ? new URL(input, origin).toString() : input.url;
    this.method = "GET";
  }
}

class MockResponse {
  readonly ok: boolean;
  readonly status: number;

  constructor(readonly body = "", init: { status?: number } = {}) {
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
  }

  clone() {
    return new MockResponse(this.body, { status: this.status });
  }

  async text() {
    return this.body;
  }

  static error() {
    return new MockResponse("", { status: 500 });
  }
}

function keyOf(input: string | RequestLike): string {
  return typeof input === "string" ? input : input.url;
}

function createInstallHarness(shellHtml: string) {
  const handlers = new Map<string, WorkerListener>();
  const stores = new Map<string, Map<string, MockResponse>>();
  const fetchPaths: string[] = [];

  const fetcher = async (input: string | RequestLike) => {
    const url = new URL(typeof input === "string" ? input : input.url, origin);
    fetchPaths.push(url.pathname);
    const body = url.pathname === "/" || url.pathname === "/metronome" ? shellHtml : "asset";
    return new MockResponse(body);
  };

  const caches = {
    open: async (name: string) => {
      let store = stores.get(name);
      if (!store) {
        store = new Map<string, MockResponse>();
        stores.set(name, store);
      }
      return {
        match: async (input: string | RequestLike) => store?.get(keyOf(input)),
        put: async (input: string | RequestLike, response: MockResponse) => {
          store?.set(keyOf(input), response);
        },
        add: async (input: string | RequestLike) => {
          const response = await fetcher(input);
          if (!response.ok) throw new Error("cache add failed");
          store?.set(keyOf(input), response);
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  const self = {
    location: { origin },
    addEventListener: (name: string, listener: WorkerListener) => handlers.set(name, listener),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };

  runInNewContext(workerSource, {
    self,
    caches,
    fetch: fetcher,
    Request: MockRequest,
    Response: MockResponse,
    URL,
    console,
  });

  const install = handlers.get("install");
  if (!install) throw new Error("Service Worker install handler was not registered");
  let promise: Promise<unknown> | undefined;
  install({ waitUntil: (value: Promise<unknown>) => { promise = value; } });

  return { promise, fetchPaths, stores };
}

describe("Astro Service Worker shell assets", () => {
  it("pre-caches same-origin Astro JavaScript and CSS referenced by shell HTML", async () => {
    const shell = '<astro-island component-url="/_astro/app.js" renderer-url="/_astro/client.js"></astro-island><link rel="stylesheet" href="/_astro/site.css"><script src="https://cdn.invalid/external.js"></script>';
    const harness = createInstallHarness(shell);

    await expect(harness.promise).resolves.toBeUndefined();
    expect(harness.fetchPaths).toContain("/_astro/app.js");
    expect(harness.fetchPaths).toContain("/_astro/client.js");
    expect(harness.fetchPaths).toContain("/_astro/site.css");
    expect(harness.fetchPaths).not.toContain("/external.js");
  });
});
