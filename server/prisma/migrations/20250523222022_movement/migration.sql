-- CreateTable
CREATE TABLE "movement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "total_movement" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "movement_side_timestamp_idx" ON "movement"("side", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "movement_side_timestamp_key" ON "movement"("side", "timestamp");
