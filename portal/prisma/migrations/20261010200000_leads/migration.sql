-- CreateEnum
CREATE TYPE "LeadTipo" AS ENUM ('contato', 'interesse');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('novo', 'atendido');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tipo" "LeadTipo" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'novo',
    "id_envio" TEXT NOT NULL,
    "nome" TEXT,
    "empresa" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "canal_retorno" TEXT,
    "melhor_horario" TEXT,
    "dor" TEXT,
    "procura" TEXT,
    "mensagem" TEXT,
    "finalidade" TEXT,
    "politica_versao" TEXT NOT NULL,
    "ciencia_texto_versao" TEXT,
    "marketing_aceito" BOOLEAN NOT NULL DEFAULT false,
    "marketing_texto_versao" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "referrer" TEXT,
    "landing_url" TEXT,
    "primeira_fonte" TEXT,
    "pagina" TEXT,
    "visitor_id" TEXT,
    "enviado_em" TIMESTAMP(3),
    "preenchido_em_ms" INTEGER,
    "atendido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alvo_id" TEXT NOT NULL,
    "por" TEXT NOT NULL,
    "detalhe" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_id_envio_key" ON "leads"("id_envio");

-- CreateIndex
CREATE INDEX "leads_tipo_created_at_idx" ON "leads"("tipo", "created_at");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_telefone_idx" ON "leads"("telefone");

-- CreateIndex
CREATE INDEX "auditoria_alvo_id_idx" ON "auditoria"("alvo_id");

-- CreateIndex
CREATE INDEX "auditoria_created_at_idx" ON "auditoria"("created_at");

