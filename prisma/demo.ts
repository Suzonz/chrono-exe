/**
 * Demo data generator: fills the last 5 weeks with realistic sessions and
 * heartbeats so every view (breakdown, timeline, week, month heatmap) has
 * something to show. Useful for screenshots and portfolio demos.
 *
 *   npm run db:demo            → refuses if tracking data already exists
 *   npm run db:demo -- --reset → wipes sessions/heartbeats first
 *
 * Requires the base seed (`npm run db:seed`).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HEARTBEAT_SECONDS = 30;
const DAYS = 35;

// Deterministic PRNG so the demo looks the same on every machine.
let state = 20261116;
function random(): number {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

const SOURCES: Record<string, readonly { url: string; title: string }[]> = {
  CODING: [
    { url: "http://localhost:5173/", title: "Vite + React" },
    { url: "https://github.com/vercel/next.js/pulls", title: "Pull requests · vercel/next.js" },
    { url: "https://github.com/prisma/prisma/issues", title: "Issues · prisma/prisma" },
    { url: "https://codepen.io/pen", title: "CodePen" }
  ],
  BROWSING: [
    { url: "https://stackoverflow.com/questions/tagged/typescript", title: "Newest 'typescript' Questions" },
    { url: "https://developer.mozilla.org/en-US/docs/Web/API/EventSource", title: "EventSource - Web APIs | MDN" },
    { url: "https://www.npmjs.com/package/zod", title: "zod - npm" }
  ],
  COMM: [
    { url: "https://app.slack.com/client/T000/C000", title: "Slack | #dev" },
    { url: "https://mail.google.com/mail/u/0/#inbox", title: "Inbox - Gmail" },
    { url: "https://discord.com/channels/@me", title: "Discord" }
  ],
  MEDIA: [
    { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "YouTube" },
    { url: "https://open.spotify.com/playlist/lofi", title: "Spotify – Lofi beats" }
  ],
  OTHER: [
    { url: "https://www.notion.so/workspace/roadmap", title: "Roadmap – Notion" },
    { url: "https://www.figma.com/file/abc/design", title: "Design – Figma" }
  ],
  // Time in other apps (VS Code, Figma desktop...): the extension sends this pseudo-address.
  OUTSIDE_CHROME: [{ url: "chrono://outside.chrome", title: "" }],
  LEARNING: [
    { url: "https://www.udemy.com/course/advanced-typescript/", title: "Advanced TypeScript | Udemy" }
  ]
};

const WEIGHTS: [string, number][] = [
  ["CODING", 34],
  ["OUTSIDE_CHROME", 22],
  ["BROWSING", 15],
  ["COMM", 14],
  ["MEDIA", 8],
  ["LEARNING", 8],
  ["OTHER", 7]
];

function weightedCategory(): string {
  const total = WEIGHTS.reduce((acc, [, weight]) => acc + weight, 0);
  let roll = random() * total;
  for (const [name, weight] of WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return name;
  }
  return "CODING";
}

interface Block {
  category: string;
  start: Date;
  seconds: number;
  isIdle: boolean;
}

function planDay(day: Date, isToday: boolean): Block[] {
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  if (weekend && random() < 0.55) return [];

  const blocks: Block[] = [];
  const workSlots = weekend ? [[between(10, 14), between(1, 3)]] : [[between(8, 9), between(3, 4)], [between(13, 14), between(3, 5)]];
  if (!weekend && random() < 0.4) workSlots.push([between(20, 21), between(1, 2)]);

  for (const [hour, length] of workSlots) {
    let cursor = new Date(day);
    cursor.setHours(hour, between(0, 40), 0, 0);
    const end = new Date(cursor.getTime() + length * 3600 * 1000);
    while (cursor < end) {
      const idle = random() < 0.08;
      const seconds = idle ? between(6, 15) * 60 : between(4, 50) * 60;
      blocks.push({ category: idle ? "IDLE" : weightedCategory(), start: new Date(cursor), seconds, isIdle: idle });
      cursor = new Date(cursor.getTime() + seconds * 1000);
    }
  }

  if (isToday) {
    const now = Date.now();
    return blocks
      .filter((block) => block.start.getTime() < now - 60000)
      .map((block) => ({ ...block, seconds: Math.min(block.seconds, Math.floor((now - block.start.getTime()) / 1000) - 60) }))
      .filter((block) => block.seconds >= HEARTBEAT_SECONDS);
  }
  return blocks;
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const existing = await prisma.session.count();
  if (existing > 0 && !reset) {
    console.error(`✗ ${existing} sessions already exist. Re-run with "npm run db:demo -- --reset" to wipe them and generate demo data.`);
    process.exit(1);
  }
  if (reset) {
    await prisma.heartbeat.deleteMany();
    await prisma.session.deleteMany();
  }

  const learning = await prisma.category.upsert({
    where: { name: "LEARNING" },
    update: {},
    create: { name: "LEARNING", color: "pink", order: 10, productivity: "PRODUCTIVE" }
  });
  if (!(await prisma.rule.findFirst({ where: { pattern: "*.udemy.com" } }))) {
    const order = await prisma.rule.count();
    await prisma.rule.create({ data: { pattern: "*.udemy.com", categoryId: learning.id, order } });
  }

  const categories = new Map((await prisma.category.findMany()).map((c) => [c.name, c.id]));
  const missing = ["CODING", "BROWSING", "COMM", "MEDIA", "OTHER", "IDLE", "OUTSIDE_CHROME"].filter((name) => !categories.has(name));
  if (missing.length > 0) {
    console.error(`✗ missing categories ${missing.join(", ")}. Run "npm run db:seed" first.`);
    process.exit(1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let sessionCount = 0;
  let heartbeatCount = 0;

  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const blocks = planDay(day, offset === 0);

    for (const block of blocks) {
      const categoryId = categories.get(block.category) as string;
      const beats = Math.max(1, Math.floor(block.seconds / HEARTBEAT_SECONDS));
      const source = pick(SOURCES[block.category] ?? SOURCES.OTHER);
      const session = await prisma.session.create({
        data: {
          categoryId,
          startedAt: block.start,
          endedAt: new Date(block.start.getTime() + block.seconds * 1000),
          durationSeconds: block.seconds,
          isIdle: block.isIdle,
          heartbeatCount: beats
        }
      });
      // Music in a background tab during some focus sessions.
      const music = !block.isIdle && block.category === "CODING" && random() < 0.35 ? "open.spotify.com" : null;
      await prisma.heartbeat.createMany({
        data: Array.from({ length: beats }, (_, index) => ({
          url: block.isIdle ? source.url : index % 7 === 6 ? pick(SOURCES[block.category] ?? SOURCES.OTHER).url : source.url,
          title: "",
          categoryId,
          sessionId: session.id,
          isIdle: block.isIdle,
          idleSeconds: block.isIdle ? 300 + index * HEARTBEAT_SECONDS : 0,
          backgroundAudio: music,
          timestamp: new Date(block.start.getTime() + index * HEARTBEAT_SECONDS * 1000)
        }))
      });
      sessionCount += 1;
      heartbeatCount += beats;
    }
  }

  console.log(`✓ demo data: ${sessionCount} sessions, ${heartbeatCount} heartbeats over ${DAYS} days`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
