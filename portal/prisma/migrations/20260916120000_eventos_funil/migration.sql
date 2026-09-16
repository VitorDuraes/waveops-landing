-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "visitor_id" TEXT;

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "path" TEXT,
    "referrer_host" TEXT,
    "props" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_nome_created_at_idx" ON "eventos"("nome", "created_at");

-- CreateIndex
CREATE INDEX "eventos_visitor_id_idx" ON "eventos"("visitor_id");

-- CreateIndex
CREATE INDEX "customers_visitor_id_idx" ON "customers"("visitor_id");

