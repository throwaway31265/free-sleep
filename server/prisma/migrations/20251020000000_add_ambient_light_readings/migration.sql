-- CreateTable
CREATE TABLE "ambient_light_readings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "lux" REAL NOT NULL
);

-- CreateIndex
CREATE INDEX "ambient_light_readings_timestamp_idx" ON "ambient_light_readings"("timestamp");
