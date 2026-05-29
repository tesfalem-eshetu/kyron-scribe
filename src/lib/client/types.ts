// Shared client-side DTOs mirroring the API response shapes. Kept in one place
// so screens and components stay in sync with the backend contracts.

export type Role = "PROVIDER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type EncounterStatus =
  | "DRAFT"
  | "GENERATING"
  | "GENERATED"
  | "FINALIZED"
  | "ERROR";

export type DraftStatus =
  | "IN_PROGRESS"
  | "GENERATED"
  | "FINALIZED"
  | "ABANDONED";

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
}

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface TemplateRef {
  id: string;
  name: string;
}

export interface EncounterListItem {
  id: string;
  status: EncounterStatus;
  createdAt: string;
  patient: PatientSummary;
  template: TemplateRef | null;
  draft: { status: DraftStatus; lastSavedAt: string | null } | null;
}

export interface AdminEncounterItem {
  id: string;
  status: EncounterStatus;
  createdAt: string;
  updatedAt: string;
  patient: PatientSummary;
  provider: { id: string; fullName: string; email: string };
  template: TemplateRef | null;
  draft: { status: DraftStatus } | null;
  note: { id: string; currentVersionId: string | null } | null;
}

export interface NoteSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface EncounterDraftResponse {
  encounterId: string;
  encounterStatus: EncounterStatus;
  patient: PatientSummary;
  template: TemplateRef | null;
  draft: {
    transcript: string | null;
    selectedTemplateId: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    status: DraftStatus;
    lastSavedAt: string | null;
  };
}

export interface ProviderTemplate {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminTemplate {
  id: string;
  name: string;
  description: string | null;
  promptText: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderRosterItem {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  createdAt: string;
  _count: { encounters: number };
}

export interface Icd10Result {
  id: string;
  code: string;
  description: string;
  category: string | null;
  score: number;
}

export interface ExtractedProblem {
  phrase: string;
  evidence: string;
}

export interface Icd10Candidate {
  code: string;
  description: string;
  category: string | null;
  score: number;
  sourceProblem: string;
}

export interface NoteVersion {
  id: string;
  versionNumber: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  fullText: string;
  saveReason: string | null;
  savedByUserId: string;
  createdAt: string;
}
