// Builds the pg adapter config, enabling TLS for remote databases.
//
// Managed Postgres (AWS RDS, etc.) requires SSL and rejects plaintext
// connections ("no pg_hba.conf entry ... no encryption"). The node-postgres
// driver does not negotiate TLS unless told to, so we enable it for any
// non-local host. Local Docker Postgres has no TLS and stays plaintext.
export interface PgPoolConfig {
  connectionString: string;
  ssl?: { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

// Bound the pool explicitly rather than relying on the pg default. A single
// next start process serves the app; capping connections keeps the process
// well under RDS max_connections and makes scaling behaviour predictable.
const MAX_POOL_CONNECTIONS = 10;
const POOL_LIMITS = {
  max: MAX_POOL_CONNECTIONS,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

export function pgPoolConfig(connectionString: string | undefined): PgPoolConfig {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  const sslDisabled = /sslmode=disable/.test(connectionString);

  if (isLocal || sslDisabled) {
    return { connectionString, ...POOL_LIMITS };
  }

  // RDS presents an AWS-managed certificate. Within the private VPC the
  // connection is encrypted; local CA verification is not enforced.
  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
    ...POOL_LIMITS,
  };
}
