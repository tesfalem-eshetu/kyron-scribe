import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/lib/db/pgPoolConfig";

const baseUrl = process.env.KYRON_BASE_URL ?? "http://localhost:3000";

const adapter = new PrismaPg(pgPoolConfig(process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

interface RawResult<T> {
  status: number;
  ok: boolean;
  data: T;
  setCookie: string | null;
}

async function rawFetch<T>(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<RawResult<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.cookie ? { Cookie: init.cookie } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const setCookie = res.headers.get("set-cookie");
  return {
    status: res.status,
    ok: res.ok,
    data: data as T,
    setCookie: setCookie ? setCookie.split(";")[0] : null,
  };
}

async function expectOk<T>(
  label: string,
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<T> {
  const res = await rawFetch<T>(path, init);
  if (!res.ok) {
    throw new Error(`${label} failed: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok: ${message}`);
}

async function login(email: string, password: string): Promise<string> {
  const res = await rawFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok || !res.setCookie) throw new Error(`Login ${email} failed: HTTP ${res.status}`);
  return res.setCookie;
}

async function auditExists(action: string, entityId: string): Promise<boolean> {
  const row = await prisma.auditLog.findFirst({ where: { action, entityId } });
  return row !== null;
}

async function createEncounter(
  cookie: string,
  transcript: string,
  templateId: string,
  lastName: string,
): Promise<string> {
  const created = await expectOk<{ encounter: { id: string } }>(
    "create encounter",
    "/api/provider/encounters",
    {
      method: "POST",
      cookie,
      body: JSON.stringify({
        patient: { firstName: "Scenario", lastName, dateOfBirth: "1975-06-09" },
        transcript,
        templateId,
      }),
    },
  );
  return created.encounter.id;
}

async function scenario1(smith: string, templateId: string) {
  console.log("Scenario 1: non-clinical transcript refuses gracefully, draft preserved");
  const nonClinical = "Let's grab lunch.";
  const encounterId = await createEncounter(smith, nonClinical, templateId, `One${Date.now()}`);

  const generate = await rawFetch<{ error: string }>(
    `/api/provider/encounters/${encounterId}/generate`,
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({ transcript: nonClinical, templateId }),
    },
  );
  assert(generate.status === 422, `generation blocked with 422 (got ${generate.status})`);
  assert(
    generate.data.error === "INSUFFICIENT_CLINICAL_CONTENT",
    "error code is INSUFFICIENT_CLINICAL_CONTENT",
  );

  const draft = await expectOk<{ draft: { transcript: string; status: string }; encounterStatus: string }>(
    "load draft",
    `/api/provider/encounters/${encounterId}/draft`,
    { cookie: smith },
  );
  assert(draft.draft.transcript === nonClinical, "draft transcript preserved");
  assert(draft.draft.status === "IN_PROGRESS", "draft still IN_PROGRESS (no hallucinated note)");
  assert(draft.encounterStatus === "DRAFT", "encounter not advanced past DRAFT");
  assert(
    await auditExists("NOTE_GENERATION_BLOCKED_INSUFFICIENT_CONTENT", encounterId),
    "audit NOTE_GENERATION_BLOCKED_INSUFFICIENT_CONTENT written",
  );
}

async function scenario2(admin: string) {
  console.log("Scenario 2: deactivated provider blocked mid-work, draft preserved");

  const email = `dr.scenario${Date.now()}@example.com`;
  const created = await expectOk<{ user: { id: string }; temporaryPassword: string }>(
    "create provider",
    "/api/admin/providers",
    {
      method: "POST",
      cookie: admin,
      body: JSON.stringify({ email, fullName: "Dr. Scenario Two" }),
    },
  );
  const providerId = created.user.id;
  const providerCookie = await login(email, created.temporaryPassword);

  const templates = await expectOk<{ templates: { id: string }[] }>(
    "templates",
    "/api/provider/templates",
    { cookie: providerCookie },
  );
  const templateId = templates.templates[0].id;

  const encounterId = await createEncounter(
    providerCookie,
    "Working draft transcript in progress.",
    templateId,
    `Two${Date.now()}`,
  );
  await expectOk("autosave draft", `/api/provider/encounters/${encounterId}/draft`, {
    method: "PATCH",
    cookie: providerCookie,
    body: JSON.stringify({ subjective: "Draft work in progress." }),
  });

  await expectOk("deactivate provider", `/api/admin/providers/${providerId}/deactivate`, {
    method: "PATCH",
    cookie: admin,
  });

  const blocked = await rawFetch(`/api/provider/encounters/${encounterId}/draft`, {
    method: "PATCH",
    cookie: providerCookie,
    body: JSON.stringify({ subjective: "Should be blocked." }),
  });
  assert(
    blocked.status === 401 || blocked.status === 403,
    `next autosave blocked (got ${blocked.status})`,
  );

  const draft = await prisma.encounterDraft.findUnique({
    where: { encounterId },
    select: { subjective: true, transcript: true },
  });
  assert(draft?.subjective === "Draft work in progress.", "draft content preserved in RDS");
  assert(
    draft?.transcript === "Working draft transcript in progress.",
    "draft transcript preserved in RDS",
  );
}

async function scenario3(admin: string, smith: string) {
  console.log("Scenario 3: archived selected template blocks generation (409), draft preserved");

  const tpl = await expectOk<{ template: { id: string } }>(
    "create template",
    "/api/admin/templates",
    {
      method: "POST",
      cookie: admin,
      body: JSON.stringify({
        name: `Scenario Template ${Date.now()}`,
        promptText: "Document the visit as a focused SOAP note.",
      }),
    },
  );
  const templateId = tpl.template.id;

  const clinical =
    "Patient reports a sore throat and fever for two days with difficulty swallowing.";
  const encounterId = await createEncounter(smith, clinical, templateId, `Three${Date.now()}`);
  await expectOk("autosave draft", `/api/provider/encounters/${encounterId}/draft`, {
    method: "PATCH",
    cookie: smith,
    body: JSON.stringify({ subjective: "Sore throat and fever." }),
  });

  await expectOk("archive template", `/api/admin/templates/${templateId}`, {
    method: "DELETE",
    cookie: admin,
  });

  const generate = await rawFetch<{ error: string }>(
    `/api/provider/encounters/${encounterId}/generate`,
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({ transcript: clinical, templateId }),
    },
  );
  assert(generate.status === 409, `generation blocked with 409 (got ${generate.status})`);
  assert(generate.data.error === "TEMPLATE_UNAVAILABLE", "error code is TEMPLATE_UNAVAILABLE");

  const draft = await expectOk<{ draft: { subjective: string; transcript: string }; encounterStatus: string }>(
    "load draft",
    `/api/provider/encounters/${encounterId}/draft`,
    { cookie: smith },
  );
  assert(draft.draft.subjective === "Sore throat and fever.", "draft sections preserved");
  assert(draft.draft.transcript === clinical, "draft transcript preserved");
  assert(draft.encounterStatus === "DRAFT", "encounter not advanced past DRAFT");
  assert(
    await auditExists("NOTE_GENERATION_BLOCKED_TEMPLATE_UNAVAILABLE", encounterId),
    "audit NOTE_GENERATION_BLOCKED_TEMPLATE_UNAVAILABLE written",
  );
}

async function main() {
  console.log(`Base URL: ${baseUrl}\n`);

  const admin = await login("admin@example.com", "admin123");
  const smith = await login("dr.smith@example.com", "password123");

  const templates = await expectOk<{ templates: { id: string }[] }>(
    "templates",
    "/api/provider/templates",
    { cookie: smith },
  );
  const templateId = templates.templates[0]?.id;
  if (!templateId) throw new Error("No active template.");

  await scenario1(smith, templateId);
  await scenario2(admin);
  await scenario3(admin, smith);

  console.log("\nAll three non-happy-path scenarios passed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
