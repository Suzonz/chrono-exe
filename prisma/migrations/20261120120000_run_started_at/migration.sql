-- The stopwatch is now computed from recorded sessions since `runStartedAt`
-- (the last play, kept across pauses). The accumulated counter is no longer needed.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyGoalSeconds" INTEGER NOT NULL DEFAULT 14400,
    "inactivityDelaySeconds" INTEGER NOT NULL DEFAULT 300,
    "trackingState" TEXT NOT NULL DEFAULT 'STOPPED',
    "runStartedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("id", "dailyGoalSeconds", "inactivityDelaySeconds", "trackingState", "runStartedAt", "updatedAt")
SELECT "id", "dailyGoalSeconds", "inactivityDelaySeconds", "trackingState", "runStartedAt", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
