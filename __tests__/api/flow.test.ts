/**
 * Integration test: runs the real API route handlers against a throwaway
 * SQLite database (prisma/test.db), from "press play" to "restore a backup".
 */
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const env = { ...process.env, DATABASE_URL: "file:./test.db" };
process.env.DATABASE_URL = env.DATABASE_URL;

type Handler = (request: Request) => Promise<Response>;
let heartbeat: { POST: Handler };
let tracking: { POST: Handler; GET: Handler };
let stats: { GET: Handler };
let data: { GET: () => Promise<Response>; POST: Handler; DELETE: Handler };

const BASE = "http://localhost:3005";
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const start = Date.now();
const at = (seconds: number) => new Date(start + seconds * 1000).toISOString();
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

async function beat(body: Record<string, unknown>) {
  const response = await heartbeat.POST(new Request(`${BASE}/api/heartbeat`, json("POST", { title: "", idleSeconds: 0, ...body })));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { cwd: root, env, stdio: "ignore" });
  execSync("npx ts-node prisma/seed.ts", { cwd: root, env, stdio: "ignore" });
  heartbeat = await import("@/app/api/heartbeat/route");
  tracking = await import("@/app/api/tracking/route");
  stats = await import("@/app/api/stats/route");
  data = await import("@/app/api/data/route");
}, 120000);

afterAll(async () => {
  const prisma = (await import("@/lib/prisma")).default;
  await prisma.$disconnect();
});

describe("tracking flow", () => {
  it("ignores heartbeats until play is pressed", async () => {
    const result = await beat({ url: "https://github.com/a", timestamp: at(-120) });
    expect(result.body).toMatchObject({ ignored: true, reason: "STOPPED" });
  });

  it("records, categorizes and protects privacy once running", async () => {
    const started = await tracking.POST(new Request(`${BASE}/api/tracking`, json("POST", { action: "start", url: "https://github.com/a" })));
    expect(((await started.json()) as { tracking: { state: string } }).tracking.state).toBe("RUNNING");

    const coding = await beat({ url: "https://github.com/vercel/next.js?token=secret#x", timestamp: at(5) });
    expect(coding.body).toMatchObject({ ignored: false, categoryName: "CODING" });
    await beat({ url: "https://github.com/vercel/next.js", timestamp: at(20), backgroundAudio: ["open.spotify.com"] });
    const outside = await beat({ url: "chrono://outside.chrome", timestamp: at(35) });
    expect(outside.body).toMatchObject({ categoryName: "OUTSIDE_CHROME" });

    const prisma = (await import("@/lib/prisma")).default;
    const stored = await prisma.heartbeat.findMany({ where: { url: { contains: "next.js" } } });
    expect(stored.every((row) => !row.url.includes("?") && !row.url.includes("#") && row.title === "")).toBe(true);
  });

  it("reports sites, outside time and background audio", async () => {
    const response = await stats.GET(new Request(`${BASE}/api/stats?period=day&date=${today()}`));
    const day = (await response.json()) as {
      totalTrackedSeconds: number;
      sites: { host: string }[];
      backgroundAudio: { host: string; seconds: number }[];
      categories: { category: { name: string } }[];
    };
    expect(day.totalTrackedSeconds).toBeGreaterThan(0);
    expect(day.sites.map((site) => site.host)).toContain("github.com");
    expect(day.categories.map((group) => group.category.name)).toContain("CODING");
    expect(day.backgroundAudio[0]).toMatchObject({ host: "open.spotify.com" });
  });

  it("stops recording while paused", async () => {
    await tracking.POST(new Request(`${BASE}/api/tracking`, json("POST", { action: "pause" })));
    const result = await beat({ url: "https://youtube.com/watch", timestamp: at(50) });
    expect(result.body).toMatchObject({ ignored: true, reason: "PAUSED" });
  });

  it("rejects invalid payloads", async () => {
    const response = await heartbeat.POST(new Request(`${BASE}/api/heartbeat`, { method: "POST", body: "{nope" }));
    expect(response.status).toBe(400);
  });
});

describe("your data", () => {
  it("exports, deletes and restores the history", async () => {
    const backup = await (await data.GET()).text();
    const exported = JSON.parse(backup) as { sessions: unknown[] };
    expect(exported.sessions.length).toBeGreaterThan(0);

    const refused = await data.DELETE(new Request(`${BASE}/api/data`, json("DELETE", { confirm: "yes" })));
    expect(refused.status).toBe(400);

    const deleted = await data.DELETE(new Request(`${BASE}/api/data`, json("DELETE", { confirm: "DELETE HISTORY" })));
    expect(((await deleted.json()) as { sessions: number }).sessions).toBe(exported.sessions.length);

    const restored = await data.POST(new Request(`${BASE}/api/data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: backup }));
    expect(await restored.json()).toMatchObject({ restored: true, sessions: exported.sessions.length });
  });
});

describe("settings routes", () => {
  type Json = Record<string, unknown>;
  const call = async (handler: Handler, method: string, url: string, body?: unknown) => {
    const response = await handler(new Request(`${BASE}${url}`, body === undefined ? { method } : json(method, body)));
    return { status: response.status, body: (await response.json()) as Json & Json[] };
  };

  it("manages categories: create, type, limit, reorder, delete", async () => {
    const categories = await import("@/app/api/categories/route");
    const created = await call(categories.POST, "POST", "/api/categories", { name: "deep work", color: "sky", productivity: "PRODUCTIVE" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "DEEP_WORK", productivity: "PRODUCTIVE" });

    const duplicate = await call(categories.POST, "POST", "/api/categories", { name: "DEEP_WORK", color: "sky" });
    expect(duplicate.status).toBe(409);

    const updated = await call(categories.PUT, "PUT", "/api/categories", { id: created.body.id, dailyLimitSeconds: 1800, productivity: "DISTRACTING" });
    expect(updated.body).toMatchObject({ dailyLimitSeconds: 1800, productivity: "DISTRACTING" });

    const list = await call(categories.GET as unknown as Handler, "GET", "/api/categories");
    const ids = (list.body as unknown as { id: string }[]).map((c) => c.id).reverse();
    const reordered = await call(categories.PATCH, "PATCH", "/api/categories", { orderedIds: ids });
    expect((reordered.body as unknown as { id: string }[])[0].id).toBe(ids[0]);

    const system = (list.body as unknown as { id: string; name: string }[]).find((c) => c.name === "IDLE")!;
    expect((await call(categories.PUT, "PUT", "/api/categories", { id: system.id, name: "NAP" })).status).toBe(400);
    expect((await call(categories.DELETE, "DELETE", "/api/categories", { id: system.id })).status).toBe(400);
    expect((await call(categories.DELETE, "DELETE", "/api/categories", { id: created.body.id })).body).toMatchObject({ deleted: true });
  });

  it("manages site rules and applies them to heartbeats", async () => {
    const rules = await import("@/app/api/rules/route");
    const categories = await call((await import("@/app/api/categories/route")).GET as unknown as Handler, "GET", "/api/categories");
    const media = (categories.body as unknown as { id: string; name: string }[]).find((c) => c.name === "MEDIA")!;

    const rule = await call(rules.POST, "POST", "/api/rules", { pattern: "*.example.org", categoryId: media.id });
    expect(rule.status).toBe(201);
    const all = await call(rules.GET as unknown as Handler, "GET", "/api/rules");
    const ids = (all.body as unknown as { id: string }[]).map((r) => r.id);
    await call(rules.PATCH, "PATCH", "/api/rules", { orderedIds: [rule.body.id as string, ...ids.filter((id) => id !== rule.body.id)] });
    expect((await call(rules.PUT, "PUT", "/api/rules", { id: rule.body.id, pattern: "*.example.net" })).body).toMatchObject({ pattern: "*.example.net" });

    await tracking.POST(new Request(`${BASE}/api/tracking`, json("POST", { action: "start" })));
    const result = await beat({ url: "https://www.example.net/page", timestamp: at(58) });
    expect(result.body).toMatchObject({ categoryName: "MEDIA" });
    expect((await call(rules.DELETE, "DELETE", "/api/rules", { id: rule.body.id })).body).toMatchObject({ deleted: true });
  });

  it("never stores ignored sites", async () => {
    const ignore = await import("@/app/api/ignore-patterns/route");
    const pattern = await call(ignore.POST, "POST", "/api/ignore-patterns", { pattern: "*.bank.test" });
    expect(pattern.status).toBe(201);
    const result = await beat({ url: "https://my.bank.test/account", timestamp: at(59) });
    expect(result.body).toMatchObject({ ignored: true, reason: "IGNORED" });
    expect((await call(ignore.GET as unknown as Handler, "GET", "/api/ignore-patterns")).body.length).toBeGreaterThan(0);
    expect((await call(ignore.DELETE, "DELETE", "/api/ignore-patterns", { id: pattern.body.id })).body).toMatchObject({ deleted: true });
  });

  it("reads and validates settings", async () => {
    const settings = await import("@/app/api/settings/route");
    expect((await call(settings.GET as unknown as Handler, "GET", "/api/settings")).body).toMatchObject({ dailyGoalSeconds: 14400 });
    expect((await call(settings.PUT, "PUT", "/api/settings", { dailyGoalSeconds: 7200 })).body).toMatchObject({ dailyGoalSeconds: 7200 });
    expect((await call(settings.PUT, "PUT", "/api/settings", { inactivityDelaySeconds: 5 })).status).toBe(400);
  });

  it("serves timeline, sessions, week and month views", async () => {
    const timeline = await import("@/app/api/timeline/route");
    const sessions = await import("@/app/api/sessions/route");
    expect(((await call(timeline.GET, "GET", `/api/timeline?date=${today()}`)).body as unknown as unknown[]).length).toBeGreaterThan(0);
    expect(((await call(sessions.GET, "GET", `/api/sessions?date=${today()}`)).body as unknown as unknown[]).length).toBeGreaterThan(0);
    expect((await call(stats.GET, "GET", `/api/stats?period=week&date=${today()}`)).body).toHaveProperty("days");
    expect((await call(stats.GET, "GET", `/api/stats?period=month&date=${today()}`)).body).toHaveProperty("monthlyTotal");
    expect((await call(stats.GET, "GET", "/api/stats?period=year&date=nope")).status).toBe(400);
  });

  it("stops tracking, and shuts the server down when the launcher started it", async () => {
    process.env.CHRONO_LAUNCHER = "1";
    const exit = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const stopped = await tracking.POST(new Request(`${BASE}/api/tracking`, json("POST", { action: "stop" })));
    const body = (await stopped.json()) as { serverStopping?: boolean; tracking: { state: string; accumulatedSeconds: number } };
    expect(body.tracking).toMatchObject({ state: "STOPPED", accumulatedSeconds: 0 });
    expect(body.serverStopping).toBe(true);
    const store = globalThis as { __chronoShutdown?: ReturnType<typeof setTimeout> };
    expect(store.__chronoShutdown).toBeDefined();
    clearTimeout(store.__chronoShutdown);
    delete store.__chronoShutdown;
    delete process.env.CHRONO_LAUNCHER;
    exit.mockRestore();
  });

  it("answers the health check and the popup status", async () => {
    const status = await tracking.GET(new Request(`${BASE}/api/tracking?url=https://github.com/x`));
    expect(((await status.json()) as { pulse: { site: { host: string } } }).pulse.site.host).toBe("github.com");
    const health = await (await import("@/app/api/health/route")).GET();
    expect(await health.json()).toEqual({ app: "CHRONO.EXE", ok: true });
  });
});
