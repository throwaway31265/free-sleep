-- CreateTable
CREATE TABLE "sleep_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "side" TEXT NOT NULL,
    "entered_bed_at" INTEGER NOT NULL,
    "left_bed_at" INTEGER NOT NULL,
    "sleep_period_seconds" INTEGER NOT NULL,
    "times_exited_bed" INTEGER NOT NULL,
    "present_intervals" TEXT NOT NULL,
    "not_present_intervals" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "side" TEXT NOT NULL,
    "period_start" INTEGER NOT NULL,
    "heart_rate" REAL,
    "hrv" REAL,
    "breathing_rate" REAL
);

-- CreateIndex
CREATE INDEX "sleep_records_side_entered_bed_at_idx" ON "sleep_records"("side", "entered_bed_at");

-- CreateIndex
CREATE UNIQUE INDEX "sleep_records_side_entered_bed_at_key" ON "sleep_records"("side", "entered_bed_at");

-- CreateIndex
CREATE INDEX "vitals_side_period_start_idx" ON "vitals"("side", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "vitals_side_period_start_key" ON "vitals"("side", "period_start");
