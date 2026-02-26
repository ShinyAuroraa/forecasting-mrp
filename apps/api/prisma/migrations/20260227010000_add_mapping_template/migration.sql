-- CreateEnum
CREATE TYPE "TipoFonte" AS ENUM ('CSV', 'XLSX', 'API', 'DB');

-- CreateTable
CREATE TABLE "mapping_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "tipo_fonte" "TipoFonte" NOT NULL,
    "colunas" JSONB NOT NULL,
    "validation_rules" JSONB,
    "last_used_at" TIMESTAMPTZ,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mapping_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_mapping_template_tipo_ativo" ON "mapping_template"("tipo_fonte", "ativo");
