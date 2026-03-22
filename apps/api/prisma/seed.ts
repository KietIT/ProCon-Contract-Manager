import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ─── Organisations ──────────────────────────────────────
  const ownerOrg = await prisma.organisation.upsert({
    where: { slug: 'petrovietnam-pmc' },
    update: { name: 'PetroVietnam PMC', type: 'owner' },
    create: {
      name: 'PetroVietnam PMC',
      type: 'owner',
      slug: 'petrovietnam-pmc',
      settings: { approvalSlaHours: 24 },
    },
  });

  const epcOrg = await prisma.organisation.upsert({
    where: { slug: 'abc-epc-contractor' },
    update: { name: 'ABC EPC Contractor', type: 'epc_contractor' },
    create: {
      name: 'ABC EPC Contractor',
      type: 'epc_contractor',
      slug: 'abc-epc-contractor',
    },
  });

  // ─── Users ──────────────────────────────────────────────
  // Helper: find existing user by clerkId OR email (case-insensitive) to avoid unique constraint conflicts
  async function upsertUser(data: { email: string; name: string; role: string; clerkId: string; orgId: string }) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { clerkId: data.clerkId },
          { email: { equals: data.email, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { email: data.email, name: data.name, role: data.role, orgId: data.orgId, clerkId: data.clerkId },
      });
    }

    return prisma.user.create({ data });
  }

  const tarManager = await upsertUser({
    email: 'tvktarmanager@gmail.com',
    name: 'Procon Manager',
    role: 'tar_manager',
    clerkId: 'user_3B7IGf6P1A8quqRDFO4F5bZaZdy',
    orgId: ownerOrg.id,
  });

  const procurement = await upsertUser({
    email: 'tvkprocurement@gmail.com',
    name: 'Procurement',
    role: 'procurement',
    clerkId: 'user_3B7ILCLNeyrfGBiypchJwRN4jOK',
    orgId: ownerOrg.id,
  });

  const contractor = await upsertUser({
    email: 'tvkcontractor@gmail.com',
    name: 'Contractor',
    role: 'contractor',
    clerkId: 'user_3B7INGMeoT3ih7dilHE7OhYtN22',
    orgId: epcOrg.id,
  });

  // ─── Demo Project ───────────────────────────────────────
  const existingProjects = await prisma.project.findMany({
    where: { ownerOrgId: ownerOrg.id, name: 'Procon 2026 — Refinery Unit 5' },
  });

  let project;
  if (existingProjects.length > 0) {
    project = existingProjects[0];
  } else {
    project = await prisma.project.create({
      data: {
        ownerOrgId: ownerOrg.id,
        name: 'Procon 2026 — Refinery Unit 5',
        tarStartDate: new Date('2026-04-01'),
        tarEndDate: new Date('2026-06-30'),
        totalBudget: 5000000,
        status: 'active',
      },
    });
  }

  // ─── Summary ────────────────────────────────────────────
  console.log('Seed data created:');
  console.log(`  Owner Org:      ${ownerOrg.id} (${ownerOrg.name})`);
  console.log(`  EPC Org:        ${epcOrg.id} (${epcOrg.name})`);
  console.log(`  TAR Manager:    ${tarManager.id} (${tarManager.email})`);
  console.log(`  Procurement:    ${procurement.id} (${procurement.email})`);
  console.log(`  Contractor:     ${contractor.id} (${contractor.email})`);
  console.log(`  Project:        ${project.id} (${project.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
