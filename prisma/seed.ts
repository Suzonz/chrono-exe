/**
 * Base seed: default settings, categories, categorization rules and ignore list.
 * Idempotent — safe to run several times, never overwrites user edits.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "CODING", color: "violet", productivity: "PRODUCTIVE", dailyLimitSeconds: null },
  { name: "BROWSING", color: "cyan", productivity: "NEUTRAL", dailyLimitSeconds: null },
  { name: "COMM", color: "green", productivity: "NEUTRAL", dailyLimitSeconds: null },
  { name: "MEDIA", color: "amber", productivity: "DISTRACTING", dailyLimitSeconds: 3600 },
  { name: "OTHER", color: "indigo", productivity: "NEUTRAL", dailyLimitSeconds: null },
  { name: "OUTSIDE_CHROME", color: "teal", productivity: "NEUTRAL", dailyLimitSeconds: null },
  { name: "IDLE", color: "slate", productivity: "NEUTRAL", dailyLimitSeconds: null }
] as const;

const RULES: { pattern: string; category: string }[] = [
  { pattern: "localhost:*", category: "CODING" },
  { pattern: "127.0.0.1:*", category: "CODING" },
  { pattern: "*.github.com", category: "CODING" },
  { pattern: "*.gitlab.com", category: "CODING" },
  { pattern: "*.vercel.com", category: "CODING" },
  { pattern: "*.codepen.io", category: "CODING" },
  { pattern: "*.stackblitz.com", category: "CODING" },
  { pattern: "*.stackoverflow.com", category: "BROWSING" },
  { pattern: "developer.mozilla.org", category: "BROWSING" },
  { pattern: "*.npmjs.com", category: "BROWSING" },
  { pattern: "*.wikipedia.org", category: "BROWSING" },
  { pattern: "*.slack.com", category: "COMM" },
  { pattern: "mail.google.com", category: "COMM" },
  { pattern: "*.discord.com", category: "COMM" },
  { pattern: "teams.microsoft.com", category: "COMM" },
  { pattern: "outlook.*", category: "COMM" },
  { pattern: "*.youtube.com", category: "MEDIA" },
  { pattern: "*.twitch.tv", category: "MEDIA" },
  { pattern: "*.netflix.com", category: "MEDIA" },
  { pattern: "open.spotify.com", category: "MEDIA" },
  // Broad patterns last: rules are evaluated top to bottom.
  { pattern: "*.google.*", category: "BROWSING" }
];

const IGNORE = ["localhost:3000"];

async function main(): Promise<void> {
  if (!(await prisma.settings.findFirst())) {
    await prisma.settings.create({ data: { dailyGoalSeconds: 14400, inactivityDelaySeconds: 300 } });
  }

  for (const [order, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { isDefault: true },
      create: { ...category, order, isDefault: true }
    });
  }

  const ids = new Map((await prisma.category.findMany()).map((c) => [c.name, c.id]));
  const existing = new Set((await prisma.rule.findMany()).map((rule) => rule.pattern));
  let order = await prisma.rule.count();
  for (const rule of RULES) {
    const categoryId = ids.get(rule.category);
    if (!categoryId || existing.has(rule.pattern)) continue;
    await prisma.rule.create({ data: { pattern: rule.pattern, categoryId, order: order++ } });
  }

  for (const pattern of IGNORE) {
    await prisma.ignorePattern.upsert({ where: { pattern }, update: {}, create: { pattern } });
  }

  console.log("✓ seed complete: settings, categories, rules, ignore list");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
