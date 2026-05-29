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
  init: RequestInit & { cookie?: string },
  path: string,
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

interface VersionPayload {
  id: string;
  versionNumber: number;
  subjective: string;
  saveReason: string | null;
}

async function main() {
  console.log(`Base URL: ${baseUrl}\n`);

  const smith = await login("dr.smith@example.com", "password123");
  const lee = await login("dr.lee@example.com", "password123");

  const templates = await expectOk<{ templates: { id: string }[] }>(
    "list templates",
    { cookie: smith },
    "/api/provider/templates",
  );
  const templateId = templates.templates[0]?.id;
  if (!templateId) throw new Error("No active template available.");

  const created = await expectOk<{ encounter: { id: string } }>(
    "create encounter",
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        patient: {
          firstName: "Version",
          lastName: `Tester${Date.now()}`,
          dateOfBirth: "1979-04-02",
        },
        transcript: "Versioning gate test encounter.",
        templateId,
      }),
    },
    "/api/provider/encounters",
  );
  const encounterId = created.encounter.id;
  console.log(`Encounter: ${encounterId}\n`);

  console.log("1. First save creates version 1");
  const v1 = await expectOk<{ versionNumber: number; version: VersionPayload }>(
    "save v1",
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        subjective: "S1 original",
        objective: "O1",
        assessment: "A1",
        plan: "P1",
        saveReason: "initial finalize",
      }),
    },
    `/api/provider/encounters/${encounterId}/save-note`,
  );
  assert(v1.versionNumber === 1, "first save is version 1");

  console.log("2. Second save creates immutable version 2");
  const v2 = await expectOk<{ versionNumber: number; version: VersionPayload }>(
    "save v2",
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        subjective: "S2 edited",
        objective: "O2",
        assessment: "A2",
        plan: "P2",
        baseVersionNumber: 1,
      }),
    },
    `/api/provider/encounters/${encounterId}/save-note`,
  );
  assert(v2.versionNumber === 2, "second save is version 2");

  console.log("3. Stale baseVersionNumber is rejected (409 VERSION_CONFLICT)");
  const conflict = await rawFetch<{ error: string }>(
    `/api/provider/encounters/${encounterId}/save-note`,
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        subjective: "S stale",
        objective: "O",
        assessment: "A",
        plan: "P",
        baseVersionNumber: 1,
      }),
    },
  );
  assert(conflict.status === 409, `stale save returns 409 (got ${conflict.status})`);
  assert(conflict.data.error === "VERSION_CONFLICT", "error code is VERSION_CONFLICT");

  console.log("4. Latest note points at version 2");
  const latest = await expectOk<{
    note: { currentVersionId: string; currentVersion: VersionPayload };
  }>("get latest note", { cookie: smith }, `/api/provider/encounters/${encounterId}/note`);
  assert(latest.note.currentVersion.versionNumber === 2, "latest is version 2");
  assert(
    latest.note.currentVersionId === latest.note.currentVersion.id,
    "currentVersionId tracks the latest version",
  );

  console.log("5. History lists both versions, newest first");
  const history = await expectOk<{ versions: VersionPayload[] }>(
    "list versions",
    { cookie: smith },
    `/api/provider/encounters/${encounterId}/note/versions`,
  );
  assert(history.versions.length === 2, "two versions in history");
  assert(
    history.versions[0].versionNumber === 2 && history.versions[1].versionNumber === 1,
    "history ordered newest first",
  );

  console.log("6. Version 1 is intact and read-only");
  const readV1 = await expectOk<{ version: VersionPayload }>(
    "read version 1",
    { cookie: smith },
    `/api/provider/encounters/${encounterId}/note/versions/${v1.version.id}`,
  );
  assert(readV1.version.subjective === "S1 original", "version 1 content unchanged");
  assert(readV1.version.saveReason === "initial finalize", "version 1 saveReason preserved");

  console.log("7. Encounter is FINALIZED");
  const enc = await expectOk<{ encounter: { status: string; draft: { status: string } } }>(
    "load encounter",
    { cookie: smith },
    `/api/provider/encounters/${encounterId}`,
  );
  assert(enc.encounter.status === "FINALIZED", "encounter status FINALIZED");
  assert(enc.encounter.draft?.status === "FINALIZED", "draft status FINALIZED");

  console.log("8. Ownership: another provider cannot read the note (404)");
  const foreign = await rawFetch(
    `/api/provider/encounters/${encounterId}/note`,
    { cookie: lee },
  );
  assert(foreign.status === 404, `foreign provider gets 404 (got ${foreign.status})`);

  const foreignSave = await rawFetch(
    `/api/provider/encounters/${encounterId}/save-note`,
    {
      method: "POST",
      cookie: lee,
      body: JSON.stringify({ subjective: "x", objective: "", assessment: "", plan: "" }),
    },
  );
  assert(foreignSave.status === 404, `foreign provider save gets 404 (got ${foreignSave.status})`);

  console.log("\nAll save/versioning gates passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
