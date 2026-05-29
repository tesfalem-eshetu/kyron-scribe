const baseUrl = process.env.KYRON_BASE_URL ?? "http://localhost:3000";

const transcript =
  process.env.KYRON_TEST_TRANSCRIPT ??
  "Patient reports right knee pain after running for the last two weeks. Pain is worse going down stairs and improves with rest. No fever, no trauma, and no locking. Exam notes tenderness around the patellar tendon with full range of motion.";

function getCookie(headers: Headers): string {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) throw new Error("Login did not return a session cookie.");
  return setCookie.split(";")[0];
}

async function jsonFetch<T>(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.cookie ? { Cookie: init.cookie } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${path} failed with HTTP ${res.status}: ${await res.text()}`);
  }
  return { data: (await res.json()) as T, headers: res.headers };
}

async function main() {
  const login = await jsonFetch<{ user: { email: string } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "dr.smith@example.com",
      password: "password123",
    }),
  });
  const cookie = getCookie(login.headers);

  const templates = await jsonFetch<{
    templates: { id: string; name: string }[];
  }>("/api/provider/templates", { cookie });
  const template = templates.data.templates[0];
  if (!template) throw new Error("No active template found.");

  const encounter = await jsonFetch<{ encounter: { id: string } }>(
    "/api/provider/encounters",
    {
      method: "POST",
      cookie,
      body: JSON.stringify({
        patient: {
          firstName: "Stream",
          lastName: "Tester",
          dateOfBirth: "1985-01-15",
        },
        transcript,
        templateId: template.id,
      }),
    },
  );

  const res = await fetch(
    `${baseUrl}/api/provider/encounters/${encounter.data.encounter.id}/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ transcript, templateId: template.id }),
    },
  );
  if (!res.ok || !res.body) {
    throw new Error(`Generate failed with HTTP ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokenEvents = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      if (rawEvent.startsWith("event: token")) {
        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (dataLine) {
          tokenEvents += 1;
          process.stdout.write(JSON.parse(dataLine.slice(6)));
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }

  console.log(`\n\nToken events received: ${tokenEvents}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
