export {};

const baseUrl = process.env.KYRON_BASE_URL ?? "http://localhost:3000";

function getCookie(headers: Headers): string {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) throw new Error("Login did not return a session cookie.");
  return setCookie.split(";")[0];
}

interface RawResult<T> {
  status: number;
  ok: boolean;
  data: T;
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
  return { status: res.status, ok: res.ok, data: data as T };
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
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email} failed: HTTP ${res.status}`);
  return getCookie(res.headers);
}

interface DraftPayload {
  transcript: string | null;
  selectedTemplateId: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: string;
  lastSavedAt: string;
}

async function main() {
  console.log(`Base URL: ${baseUrl}\n`);

  const smith = await login("dr.smith@example.com", "password123");
  const lee = await login("dr.lee@example.com", "password123");

  const templates = await expectOk<{ templates: { id: string }[] }>(
    "list templates",
    "/api/provider/templates",
    { cookie: smith },
  );
  const templateId = templates.templates[0]?.id;
  if (!templateId) throw new Error("No active template available.");

  const created = await expectOk<{ encounter: { id: string } }>(
    "create encounter",
    "/api/provider/encounters",
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        patient: {
          firstName: "Draft",
          lastName: `Tester${Date.now()}`,
          dateOfBirth: "1990-07-21",
        },
        transcript: "Initial transcript.",
        templateId,
      }),
    },
  );
  const encounterId = created.encounter.id;
  console.log(`Encounter: ${encounterId}\n`);

  console.log("1. Restore-on-load returns hydrated draft");
  const initial = await expectOk<{
    encounterStatus: string;
    patient: { firstName: string };
    draft: DraftPayload;
  }>("get draft", `/api/provider/encounters/${encounterId}/draft`, { cookie: smith });
  assert(initial.draft.transcript === "Initial transcript.", "transcript hydrated");
  assert(initial.draft.status === "IN_PROGRESS", "draft status IN_PROGRESS");
  assert(initial.patient.firstName === "Draft", "patient hydrated");
  const firstSavedAt = new Date(initial.draft.lastSavedAt).getTime();

  console.log("2. Autosave persists workspace state");
  const patched = await expectOk<{ draft: DraftPayload }>(
    "patch draft",
    `/api/provider/encounters/${encounterId}/draft`,
    {
      method: "PATCH",
      cookie: smith,
      body: JSON.stringify({
        transcript: "Edited transcript with more detail.",
        subjective: "S draft",
        objective: "O draft",
        assessment: "A draft",
        plan: "P draft",
        status: "GENERATED",
      }),
    },
  );
  assert(patched.draft.subjective === "S draft", "subjective autosaved");
  assert(patched.draft.status === "GENERATED", "status advanced to GENERATED");
  assert(
    new Date(patched.draft.lastSavedAt).getTime() >= firstSavedAt,
    "lastSavedAt advanced",
  );

  console.log("3. Re-fetch restores persisted state (refresh / cross-device)");
  const restored = await expectOk<{ draft: DraftPayload }>(
    "get draft again",
    `/api/provider/encounters/${encounterId}/draft`,
    { cookie: smith },
  );
  assert(
    restored.draft.transcript === "Edited transcript with more detail.",
    "edited transcript persisted",
  );
  assert(restored.draft.assessment === "A draft", "assessment persisted");
  assert(restored.draft.status === "GENERATED", "status persisted");

  console.log("4. Transcript change mirrored onto the encounter");
  const enc = await expectOk<{ encounter: { transcript: string } }>(
    "load encounter",
    `/api/provider/encounters/${encounterId}`,
    { cookie: smith },
  );
  assert(
    enc.encounter.transcript === "Edited transcript with more detail.",
    "encounter transcript mirrors draft",
  );

  console.log("5. Ownership: another provider cannot read or autosave (404)");
  const foreignGet = await rawFetch(
    `/api/provider/encounters/${encounterId}/draft`,
    { cookie: lee },
  );
  assert(foreignGet.status === 404, `foreign GET 404 (got ${foreignGet.status})`);
  const foreignPatch = await rawFetch(
    `/api/provider/encounters/${encounterId}/draft`,
    {
      method: "PATCH",
      cookie: lee,
      body: JSON.stringify({ transcript: "intruder" }),
    },
  );
  assert(foreignPatch.status === 404, `foreign PATCH 404 (got ${foreignPatch.status})`);

  console.log("6. After finalization, autosave is rejected (409 DRAFT_FINALIZED)");
  await expectOk(
    "finalize via save-note",
    `/api/provider/encounters/${encounterId}/save-note`,
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        subjective: "S final",
        objective: "O final",
        assessment: "A final",
        plan: "P final",
      }),
    },
  );
  const afterFinalize = await rawFetch<{ error: string }>(
    `/api/provider/encounters/${encounterId}/draft`,
    {
      method: "PATCH",
      cookie: smith,
      body: JSON.stringify({ subjective: "should be rejected" }),
    },
  );
  assert(afterFinalize.status === 409, `finalized autosave 409 (got ${afterFinalize.status})`);
  assert(afterFinalize.data.error === "DRAFT_FINALIZED", "error code is DRAFT_FINALIZED");

  console.log("\nAll draft persistence gates passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
