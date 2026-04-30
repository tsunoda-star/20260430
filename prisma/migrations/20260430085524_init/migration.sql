-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'editor', 'reviewer', 'viewer');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'in_progress', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "AssessmentItemStatus" AS ENUM ('open', 'in_progress', 'done', 'not_applicable');

-- CreateEnum
CREATE TYPE "AssessmentGuidelineSource" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "AiChatRating" AS ENUM ('good', 'bad');

-- CreateTable
CREATE TABLE "guidelines" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "issuer" VARCHAR(128) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "domain_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_url" TEXT,
    "effective_date" DATE,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guideline_versions" (
    "id" BIGSERIAL NOT NULL,
    "guideline_id" BIGINT NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "schema_hash" VARCHAR(64) NOT NULL,
    "released_at" DATE NOT NULL,
    "changelog" TEXT,

    CONSTRAINT "guideline_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_items" (
    "id" BIGSERIAL NOT NULL,
    "guideline_version_id" BIGINT NOT NULL,
    "category" VARCHAR(128) NOT NULL,
    "sub_category" VARCHAR(128),
    "control_code" VARCHAR(64),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" SMALLINT NOT NULL,
    "applies_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalized_key" VARCHAR(64) NOT NULL,
    "source_excerpt" TEXT,
    "references" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "external_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(32) NOT NULL DEFAULT 'starter',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "external_id" VARCHAR(64) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "industry" VARCHAR(64),
    "size" VARCHAR(16),
    "inferred_data" JSONB NOT NULL DEFAULT '{}',
    "inference_confidence" SMALLINT,
    "user_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "company_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'in_progress',
    "guideline_version_snapshot" JSONB NOT NULL,
    "baseline_applied" BOOLEAN NOT NULL DEFAULT true,
    "selection_rationale" TEXT,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_guidelines" (
    "assessment_id" BIGINT NOT NULL,
    "guideline_version_id" BIGINT NOT NULL,
    "added_by" "AssessmentGuidelineSource" NOT NULL,

    CONSTRAINT "assessment_guidelines_pkey" PRIMARY KEY ("assessment_id","guideline_version_id")
);

-- CreateTable
CREATE TABLE "assessment_items" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "assessment_id" BIGINT NOT NULL,
    "control_item_id" BIGINT NOT NULL,
    "status" "AssessmentItemStatus" NOT NULL DEFAULT 'open',
    "note" TEXT,
    "assignee_id" BIGINT,
    "due_date" DATE,
    "evidence_url" TEXT,
    "evidence_text" TEXT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chats" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "assessment_item_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "prompt_version" VARCHAR(32) NOT NULL,
    "rating" "AiChatRating",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "action" VARCHAR(64) NOT NULL,
    "resource_type" VARCHAR(32) NOT NULL,
    "resource_id" BIGINT,
    "before_value" JSONB,
    "after_value" JSONB,
    "ip_address" INET,
    "ts" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guidelines_code_key" ON "guidelines"("code");

-- CreateIndex
CREATE INDEX "guideline_versions_guideline_id_idx" ON "guideline_versions"("guideline_id");

-- CreateIndex
CREATE UNIQUE INDEX "guideline_versions_guideline_id_version_key" ON "guideline_versions"("guideline_id", "version");

-- CreateIndex
CREATE INDEX "idx_control_items_norm_key" ON "control_items"("normalized_key");

-- CreateIndex
CREATE INDEX "idx_control_items_priority" ON "control_items"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_external_id_key" ON "tenants"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_external_id_key" ON "users"("external_id");

-- CreateIndex
CREATE INDEX "idx_users_tenant" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "idx_companies_tenant" ON "companies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_domain_key" ON "companies"("tenant_id", "domain");

-- CreateIndex
CREATE INDEX "idx_assessments_tenant" ON "assessments"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_ai_assessment" ON "assessment_items"("assessment_id", "status");

-- CreateIndex
CREATE INDEX "idx_ai_assignee" ON "assessment_items"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_items_assessment_id_control_item_id_key" ON "assessment_items"("assessment_id", "control_item_id");

-- CreateIndex
CREATE INDEX "idx_ai_chats_item" ON "ai_chats"("assessment_item_id");

-- CreateIndex
CREATE INDEX "idx_audit_tenant_ts" ON "audit_logs"("tenant_id", "ts" DESC);

-- AddForeignKey
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_guideline_id_fkey" FOREIGN KEY ("guideline_id") REFERENCES "guidelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_items" ADD CONSTRAINT "control_items_guideline_version_id_fkey" FOREIGN KEY ("guideline_version_id") REFERENCES "guideline_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_guidelines" ADD CONSTRAINT "assessment_guidelines_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_guidelines" ADD CONSTRAINT "assessment_guidelines_guideline_version_id_fkey" FOREIGN KEY ("guideline_version_id") REFERENCES "guideline_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_control_item_id_fkey" FOREIGN KEY ("control_item_id") REFERENCES "control_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_assessment_item_id_fkey" FOREIGN KEY ("assessment_item_id") REFERENCES "assessment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
