-- CreateTable
CREATE TABLE "water_level_readings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "raw_level" REAL NOT NULL,
    "calibrated_empty" REAL NOT NULL,
    "calibrated_full" REAL NOT NULL,
    "is_priming" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "leak_alerts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "raw_level_start" REAL NOT NULL,
    "raw_level_end" REAL NOT NULL,
    "hours_tracked" REAL NOT NULL,
    "rate_of_change" REAL NOT NULL,
    "dismissed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "water_level_readings_timestamp_idx" ON "water_level_readings"("timestamp");

-- CreateIndex
CREATE INDEX "leak_alerts_timestamp_idx" ON "leak_alerts"("timestamp");
