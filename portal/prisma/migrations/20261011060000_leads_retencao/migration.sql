CREATE TABLE "leads_retencao" (
    "lead_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "justificativa" TEXT,
    "registrada_em" TIMESTAMP(3),
    "revisar_em" TIMESTAMP(3),
    "por" TEXT,
    CONSTRAINT "leads_retencao_pkey" PRIMARY KEY ("lead_id"),
    CONSTRAINT "leads_retencao_versao_check" CHECK ("versao" >= 0),
    CONSTRAINT "leads_retencao_metadados_check" CHECK (
      ("justificativa" IS NULL AND "registrada_em" IS NULL AND "revisar_em" IS NULL AND "por" IS NULL)
      OR
      ("justificativa" IS NOT NULL AND "registrada_em" IS NOT NULL AND "revisar_em" IS NOT NULL AND "por" IS NOT NULL
       AND "versao" > 0 AND char_length("justificativa") BETWEEN 20 AND 500
       AND char_length("por") BETWEEN 1 AND 254
       AND "revisar_em" > "registrada_em"
       AND "revisar_em" <= "registrada_em" + INTERVAL '30 days')
    )
);

CREATE INDEX "leads_retencao_revisar_em_idx" ON "leads_retencao"("revisar_em");
ALTER TABLE "leads_retencao" ADD CONSTRAINT "leads_retencao_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
