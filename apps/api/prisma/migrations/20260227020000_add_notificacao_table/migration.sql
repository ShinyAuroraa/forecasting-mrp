-- CreateEnum
CREATE TYPE "tipo_alerta" AS ENUM ('STOCKOUT', 'URGENT_PURCHASE', 'CAPACITY_OVERLOAD', 'FORECAST_DEVIATION', 'STORAGE_FULL', 'PIPELINE_FAILURE');

-- CreateEnum
CREATE TYPE "severidade_alerta" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateTable
CREATE TABLE "notificacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_alerta" NOT NULL,
    "severidade" "severidade_alerta" NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensagem" TEXT NOT NULL,
    "entity_id" TEXT,
    "entity_type" VARCHAR(50),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "acknowledged_at" TIMESTAMPTZ,
    "acknowledged_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "idx_notificacao_tipo_severidade" ON "notificacao"("tipo", "severidade");

-- CreateIndex
CREATE INDEX "idx_notificacao_acknowledged" ON "notificacao"("acknowledged_at");

-- CreateIndex
CREATE INDEX "idx_notificacao_created" ON "notificacao"("created_at");
