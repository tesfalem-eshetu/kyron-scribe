-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'FINALIZED', 'ERROR');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('IN_PROGRESS', 'GENERATED', 'FINALIZED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PatientContextSummaryEventAction" AS ENUM ('UPDATED', 'SKIPPED_NOT_MEANINGFUL', 'FAILED');

-- CreateEnum
CREATE TYPE "PatientVisitSummaryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "normalizedFirstName" TEXT NOT NULL,
    "normalizedLastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "EncounterStatus" NOT NULL DEFAULT 'DRAFT',
    "transcript" TEXT,
    "templateNameSnapshot" TEXT,
    "templatePromptSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterDraft" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "transcript" TEXT,
    "selectedTemplateId" TEXT,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promptText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteVersion" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "subjective" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "fullText" TEXT,
    "savedByUserId" TEXT NOT NULL,
    "saveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Icd10Code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "synonyms" TEXT[],
    "searchableText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Icd10Code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientContextSummary" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "sourceNoteVersionId" TEXT,
    "priorEncounterCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientContextSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientContextSummaryEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "noteVersionId" TEXT NOT NULL,
    "action" "PatientContextSummaryEventAction" NOT NULL,
    "reason" TEXT,
    "meaningfulChanges" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientContextSummaryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientVisitSummary" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "noteVersionId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "followUpText" TEXT,
    "status" "PatientVisitSummaryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PatientVisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Patient_lastName_dateOfBirth_idx" ON "Patient"("lastName", "dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_normalizedFirstName_normalizedLastName_dateOfBirth_key" ON "Patient"("normalizedFirstName", "normalizedLastName", "dateOfBirth");

-- CreateIndex
CREATE INDEX "Encounter_providerId_idx" ON "Encounter"("providerId");

-- CreateIndex
CREATE INDEX "Encounter_patientId_idx" ON "Encounter"("patientId");

-- CreateIndex
CREATE INDEX "Encounter_templateId_idx" ON "Encounter"("templateId");

-- CreateIndex
CREATE INDEX "Encounter_status_idx" ON "Encounter"("status");

-- CreateIndex
CREATE INDEX "Encounter_createdAt_idx" ON "Encounter"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterDraft_encounterId_key" ON "EncounterDraft"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterDraft_providerId_idx" ON "EncounterDraft"("providerId");

-- CreateIndex
CREATE INDEX "EncounterDraft_status_idx" ON "EncounterDraft"("status");

-- CreateIndex
CREATE INDEX "EncounterDraft_updatedAt_idx" ON "EncounterDraft"("updatedAt");

-- CreateIndex
CREATE INDEX "Template_isActive_idx" ON "Template"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Note_encounterId_key" ON "Note"("encounterId");

-- CreateIndex
CREATE INDEX "NoteVersion_noteId_idx" ON "NoteVersion"("noteId");

-- CreateIndex
CREATE INDEX "NoteVersion_savedByUserId_idx" ON "NoteVersion"("savedByUserId");

-- CreateIndex
CREATE INDEX "NoteVersion_createdAt_idx" ON "NoteVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoteVersion_noteId_versionNumber_key" ON "NoteVersion"("noteId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Icd10Code_code_key" ON "Icd10Code"("code");

-- CreateIndex
CREATE INDEX "Icd10Code_category_idx" ON "Icd10Code"("category");

-- CreateIndex
CREATE INDEX "Icd10Code_isActive_idx" ON "Icd10Code"("isActive");

-- CreateIndex
CREATE INDEX "PatientContextSummary_patientId_idx" ON "PatientContextSummary"("patientId");

-- CreateIndex
CREATE INDEX "PatientContextSummary_providerId_idx" ON "PatientContextSummary"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientContextSummary_patientId_providerId_key" ON "PatientContextSummary"("patientId", "providerId");

-- CreateIndex
CREATE INDEX "PatientContextSummaryEvent_patientId_idx" ON "PatientContextSummaryEvent"("patientId");

-- CreateIndex
CREATE INDEX "PatientContextSummaryEvent_providerId_idx" ON "PatientContextSummaryEvent"("providerId");

-- CreateIndex
CREATE INDEX "PatientContextSummaryEvent_noteVersionId_idx" ON "PatientContextSummaryEvent"("noteVersionId");

-- CreateIndex
CREATE INDEX "PatientContextSummaryEvent_createdAt_idx" ON "PatientContextSummaryEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientVisitSummary_encounterId_key" ON "PatientVisitSummary"("encounterId");

-- CreateIndex
CREATE INDEX "PatientVisitSummary_patientId_idx" ON "PatientVisitSummary"("patientId");

-- CreateIndex
CREATE INDEX "PatientVisitSummary_encounterId_idx" ON "PatientVisitSummary"("encounterId");

-- CreateIndex
CREATE INDEX "PatientVisitSummary_providerId_idx" ON "PatientVisitSummary"("providerId");

-- CreateIndex
CREATE INDEX "PatientVisitSummary_status_idx" ON "PatientVisitSummary"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterDraft" ADD CONSTRAINT "EncounterDraft_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterDraft" ADD CONSTRAINT "EncounterDraft_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_savedByUserId_fkey" FOREIGN KEY ("savedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientContextSummary" ADD CONSTRAINT "PatientContextSummary_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientContextSummary" ADD CONSTRAINT "PatientContextSummary_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientContextSummaryEvent" ADD CONSTRAINT "PatientContextSummaryEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientContextSummaryEvent" ADD CONSTRAINT "PatientContextSummaryEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientContextSummaryEvent" ADD CONSTRAINT "PatientContextSummaryEvent_noteVersionId_fkey" FOREIGN KEY ("noteVersionId") REFERENCES "NoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisitSummary" ADD CONSTRAINT "PatientVisitSummary_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisitSummary" ADD CONSTRAINT "PatientVisitSummary_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisitSummary" ADD CONSTRAINT "PatientVisitSummary_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisitSummary" ADD CONSTRAINT "PatientVisitSummary_noteVersionId_fkey" FOREIGN KEY ("noteVersionId") REFERENCES "NoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
