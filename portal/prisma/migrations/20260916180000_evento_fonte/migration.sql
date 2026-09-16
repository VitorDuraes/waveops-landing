-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "fonte" TEXT;

-- CreateIndex
CREATE INDEX "eventos_fonte_idx" ON "eventos"("fonte");

