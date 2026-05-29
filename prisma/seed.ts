import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const BCRYPT_COST_FACTOR = 12;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const demoUsers = [
  {
    email: "dr.smith@example.com",
    fullName: "Dr. Smith",
    role: "PROVIDER" as const,
    password: "password123",
  },
  {
    email: "dr.lee@example.com",
    fullName: "Dr. Lee",
    role: "PROVIDER" as const,
    password: "password123",
  },
  {
    email: "dr.johnson@example.com",
    fullName: "Dr. Johnson",
    role: "PROVIDER" as const,
    password: "password123",
  },
  {
    email: "admin@example.com",
    fullName: "System Admin",
    role: "ADMIN" as const,
    password: "admin123",
  },
];

async function main() {
  for (const user of demoUsers) {
    const email = user.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_COST_FACTOR);

    await prisma.user.upsert({
      where: { email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        status: "ACTIVE",
      },
      create: {
        email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        status: "ACTIVE",
      },
    });

    console.log(`Seeded ${user.role}: ${email}`);
  }
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
