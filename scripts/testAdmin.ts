export {};

const baseUrl = process.env.KYRON_BASE_URL ?? "http://localhost:3000";

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
  const res = await rawFetch(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok || !res.setCookie) {
    throw new Error(`Login ${email} failed: HTTP ${res.status}`);
  }
  return res.setCookie;
}

async function main() {
  console.log(`Base URL: ${baseUrl}\n`);

  const admin = await login("admin@example.com", "admin123");
  const smith = await login("dr.smith@example.com", "password123");

  console.log("1. RBAC: non-admin and anonymous are blocked");
  const providerHit = await rawFetch("/api/admin/providers", { cookie: smith });
  assert(providerHit.status === 403, `provider gets 403 on admin route (got ${providerHit.status})`);
  const anonHit = await rawFetch("/api/admin/providers");
  assert(anonHit.status === 401, `anonymous gets 401 on admin route (got ${anonHit.status})`);

  console.log("2. Provider roster: list and create");
  const list = await expectOk<{ providers: { id: string }[] }>(
    "list providers",
    "/api/admin/providers",
    { cookie: admin },
  );
  assert(list.providers.length >= 3, "seeded providers are listed");

  const newEmail = `dr.new${Date.now()}@example.com`;
  const created = await expectOk<{
    user: { id: string; email: string };
    temporaryPassword?: string;
  }>("create provider", "/api/admin/providers", {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ email: newEmail, fullName: "Dr. New" }),
  });
  assert(!!created.temporaryPassword, "server returned a temporary password");
  const newProviderId = created.user.id;

  const dupe = await rawFetch("/api/admin/providers", {
    method: "POST",
    cookie: admin,
    body: JSON.stringify({ email: newEmail, fullName: "Dr. Dupe" }),
  });
  assert(dupe.status === 409, `duplicate email returns 409 (got ${dupe.status})`);

  console.log("3. New provider can log in with the temporary password");
  const newProviderCookie = await login(newEmail, created.temporaryPassword!);
  const beforeDeactivate = await rawFetch("/api/provider/templates", {
    cookie: newProviderCookie,
  });
  assert(beforeDeactivate.status === 200, "new provider session works before deactivation");

  console.log("4. Deactivation revokes the active session immediately");
  await expectOk("deactivate provider", `/api/admin/providers/${newProviderId}/deactivate`, {
    method: "PATCH",
    cookie: admin,
  });
  const afterDeactivate = await rawFetch("/api/provider/templates", {
    cookie: newProviderCookie,
  });
  assert(afterDeactivate.status === 401, `revoked session is rejected (got ${afterDeactivate.status})`);
  const inactiveLogin = await rawFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: newEmail, password: created.temporaryPassword }),
  });
  assert(inactiveLogin.status === 403, `inactive login returns 403 (got ${inactiveLogin.status})`);

  console.log("5. Reactivation restores access");
  await expectOk("reactivate provider", `/api/admin/providers/${newProviderId}/reactivate`, {
    method: "PATCH",
    cookie: admin,
  });
  const reactivated = await login(newEmail, created.temporaryPassword!);
  const afterReactivate = await rawFetch("/api/provider/templates", { cookie: reactivated });
  assert(afterReactivate.status === 200, "reactivated provider can log in again");

  console.log("6. Template CRUD");
  const tpl = await expectOk<{ template: { id: string; promptText: string } }>(
    "create template",
    "/api/admin/templates",
    {
      method: "POST",
      cookie: admin,
      body: JSON.stringify({
        name: `Admin Test Template ${Date.now()}`,
        description: "Created by the admin test.",
        promptText: "Original prompt text.",
      }),
    },
  );
  const templateId = tpl.template.id;

  const updated = await expectOk<{ template: { promptText: string } }>(
    "update template",
    `/api/admin/templates/${templateId}`,
    {
      method: "PATCH",
      cookie: admin,
      body: JSON.stringify({ promptText: "Updated prompt text." }),
    },
  );
  assert(updated.template.promptText === "Updated prompt text.", "template prompt updated");

  const providerTemplates = await expectOk<{ templates: { id: string }[] }>(
    "provider templates (active)",
    "/api/provider/templates",
    { cookie: smith },
  );
  assert(
    providerTemplates.templates.some((t) => t.id === templateId),
    "active template appears in provider dropdown",
  );

  console.log("7. Immediate template integration: archive blocks next generation");
  const encounter = await expectOk<{ encounter: { id: string } }>(
    "create encounter",
    "/api/provider/encounters",
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        patient: {
          firstName: "Admin",
          lastName: `Gate${Date.now()}`,
          dateOfBirth: "1980-02-02",
        },
        transcript: "Patient presents with a persistent cough and mild fever for several days.",
        templateId,
      }),
    },
  );

  await expectOk("archive template", `/api/admin/templates/${templateId}`, {
    method: "DELETE",
    cookie: admin,
  });

  const afterArchive = await expectOk<{ templates: { id: string }[] }>(
    "provider templates after archive",
    "/api/provider/templates",
    { cookie: smith },
  );
  assert(
    !afterArchive.templates.some((t) => t.id === templateId),
    "archived template is gone from provider dropdown",
  );

  const generate = await rawFetch<{ error: string }>(
    `/api/provider/encounters/${encounter.encounter.id}/generate`,
    {
      method: "POST",
      cookie: smith,
      body: JSON.stringify({
        transcript: "Patient presents with a persistent cough and mild fever for several days.",
        templateId,
      }),
    },
  );
  assert(generate.status === 409, `generation with archived template returns 409 (got ${generate.status})`);
  assert(generate.data.error === "TEMPLATE_UNAVAILABLE", "error code is TEMPLATE_UNAVAILABLE");

  console.log("8. Admin encounters list with filters");
  const adminEncounters = await expectOk<{ encounters: { provider: { id: string } }[] }>(
    "admin encounters",
    "/api/admin/encounters",
    { cookie: admin },
  );
  assert(adminEncounters.encounters.length >= 1, "admin sees encounters across providers");

  console.log("\nAll admin gates passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
