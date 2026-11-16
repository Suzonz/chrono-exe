-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "productivity" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "dailyLimitSeconds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "heartbeatCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Heartbeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "backgroundAudio" TEXT,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Heartbeat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Heartbeat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyGoalSeconds" INTEGER NOT NULL DEFAULT 14400,
    "inactivityDelaySeconds" INTEGER NOT NULL DEFAULT 300,
    "trackingState" TEXT NOT NULL DEFAULT 'STOPPED',
    "runStartedAt" DATETIME,
    "runAccumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IgnorePattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_order_idx" ON "Category"("order");

-- CreateIndex
CREATE INDEX "Rule_order_idx" ON "Rule"("order");

-- CreateIndex
CREATE INDEX "Rule_categoryId_idx" ON "Rule"("categoryId");

-- CreateIndex
CREATE INDEX "Session_startedAt_idx" ON "Session"("startedAt");

-- CreateIndex
CREATE INDEX "Session_categoryId_idx" ON "Session"("categoryId");

-- CreateIndex
CREATE INDEX "Session_isIdle_idx" ON "Session"("isIdle");

-- CreateIndex
CREATE INDEX "Heartbeat_timestamp_idx" ON "Heartbeat"("timestamp");

-- CreateIndex
CREATE INDEX "Heartbeat_sessionId_idx" ON "Heartbeat"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Heartbeat_sessionId_timestamp_key" ON "Heartbeat"("sessionId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "IgnorePattern_pattern_key" ON "IgnorePattern"("pattern");
