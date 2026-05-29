# Kyron Scribe 12:23

AI clinical scribe platform. A provider enters a visit transcript, picks a
template, and the app streams a structured SOAP note with grounded ICD-10
codes (semantic search over a local catalog + OpenAI generation).

Stack: Next.js (App Router) + TypeScript, Prisma 7 on PostgreSQL with pgvector,
OpenAI (embeddings + streaming generation), deployed on AWS (EC2 + nginx + RDS)
via Terraform.

- Live: https://kyronscribe.online
- Repo: https://github.com/tesfalem-eshetu/kyron-scribe

## Test accounts

Seeded by `prisma/seed.ts`:

- Provider: `dr.smith@example.com` / `password123`
- Provider: `dr.lee@example.com` / `password123`
- Provider: `dr.johnson@example.com` / `password123`
- Admin: `admin@example.com` / `admin123`

## Prerequisites

- Node.js 22.13+ (the project pins pnpm via the `packageManager` field)
- pnpm (via `corepack enable`)
- Docker (for local Postgres + pgvector)
- An OpenAI API key

## Local development

1. Start the local database (Postgres 16 + pgvector on port 5433):

```bash
docker compose up -d
```

2. Create your env file and fill in `OPENAI_API_KEY`:

```bash
cp .env.example .env
```

The default `DATABASE_URL` already matches `docker-compose.yml`.

3. Install dependencies:

```bash
pnpm install
```

4. Apply migrations, seed base data, and generate ICD-10 embeddings:

```bash
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm run embed:icd10
```

5. Run the dev server:

```bash
pnpm dev
```

Open http://localhost:3000

## Common commands

```bash
pnpm dev                     # start dev server
pnpm build                   # production build
pnpm start                   # run the production build
pnpm lint                    # lint

pnpm exec prisma migrate dev # create/apply a migration locally
pnpm exec prisma db seed     # seed users, templates, ICD-10 codes (idempotent)
pnpm run embed:icd10         # generate embeddings for ICD-10 codes (idempotent)

# End-to-end streaming test (login -> create encounter -> stream SOAP note)
pnpm run test:generate-stream                       # against http://localhost:3000
KYRON_BASE_URL=https://kyronscribe.online pnpm run test:generate-stream
```

## Project layout

- `src/app` - Next.js routes and API endpoints
- `src/lib` - auth, prisma client, AI provider, ICD-10 search, errors
- `prisma` - schema, migrations, seed
- `scripts` - one-off scripts (embeddings, stream test)
- `infra/terraform` - AWS infrastructure as code
- `deploy` - nginx config, systemd unit, server deploy scripts

## Deployment (AWS)

Infrastructure is managed by Terraform in `infra/terraform`. The app runs on an
EC2 host behind nginx (TLS via Let's Encrypt); PostgreSQL is a private RDS
instance reachable only from the app. Config and secrets live in SSM Parameter
Store under `/kyron-scribe` and are read by the instance IAM role.

### One-time prerequisites on your machine

```bash
brew install awscli terraform gh
brew install --cask session-manager-plugin
aws configure        # access key, secret, region us-east-1, output json
```

### Provision infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # set domain_name and region
terraform init
terraform plan
terraform apply
```

After apply, note the `app_public_ip` output and point your domain's DNS A
record (`@`, and optionally `www`) at it. Then set the OpenAI key (kept out of
Terraform state):

```bash
aws ssm put-parameter --region us-east-1 \
  --name /kyron-scribe/OPENAI_API_KEY \
  --type SecureString --overwrite --value "sk-..."
```

### Deploy the app to the server

Connect to the instance (no SSH key needed; uses SSM Session Manager):

```bash
aws ssm start-session --target <instance_id> --region us-east-1
```

The current instance id is in the Terraform output (`instance_id`). On the
server, clone once, then run the deploy script:

```bash
sudo git clone https://github.com/tesfalem-eshetu/kyron-scribe.git /opt/kyron-scribe
sudo chown -R kyron:kyron /opt/kyron-scribe
sudo bash /opt/kyron-scribe/deploy/scripts/deploy.sh
```

`deploy.sh` writes `.env` from SSM, installs deps, runs migrations, seeds data,
builds embeddings, builds Next.js, starts the systemd service, and configures
nginx + TLS. It is idempotent and safe to re-run.

## Redeploying after code changes

Push to `main`, then on the server:

```bash
sudo -u kyron git -C /opt/kyron-scribe pull
sudo bash /opt/kyron-scribe/deploy/scripts/deploy.sh
```

## Operating the server

Run these on the instance (after `aws ssm start-session`):

```bash
sudo systemctl status kyron-scribe      # service status
sudo systemctl restart kyron-scribe     # restart the app
sudo journalctl -u kyron-scribe -f      # tail app logs
sudo nginx -t && sudo systemctl reload nginx   # validate + reload nginx
```

Health check from anywhere:

```bash
curl https://kyronscribe.online/api/health     # {"status":"ok","db":"connected"}
```

## Cost control

The running stack (EC2 + RDS + Elastic IP) costs roughly $25-40/month. To stop
charges when not in use:

```bash
cd infra/terraform
terraform destroy
```

To bring it back later, run `terraform apply` again, re-point DNS to the new
IP, reset the OpenAI key in SSM, then re-run the clone + `deploy.sh` steps.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (TLS auto-enabled for non-local hosts) |
| `NODE_ENV` | `development`, `test`, or `production` |
| `SESSION_COOKIE_NAME` | Name of the HTTP-only session cookie |
| `SESSION_TTL_HOURS` | Session lifetime in hours |
| `OPENAI_API_KEY` | OpenAI key for embeddings and generation |
| `OPENAI_EMBEDDING_MODEL` | Embedding model (tied to the `vector(1536)` column) |
| `OPENAI_SOAP_GENERATION_MODEL` | Model for streaming SOAP generation |
| `OPENAI_PROBLEM_EXTRACT_MODEL` | Model for structured clinical-problem extraction |
