#!/usr/bin/env node
// Demo data for local QA: platform admin, team accounts and organisations in every review state.
//
//   DEMO_PASSWORD=<12+ chars> [DEMO_MFA_SECRET=<base32> MFA_ENCRYPTION_KEY=<base64 32 bytes>] npm run db:seed-demo
//
// Every account uses DEMO_PASSWORD. With DEMO_MFA_SECRET the platform admin also has two-step
// verification on (the super-admin panel requires it). Idempotent; never runs in production.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") throw new Error("seed-demo never runs in production.");
const password = process.env.DEMO_PASSWORD ?? "";
if (password.length < 12) throw new Error("Set DEMO_PASSWORD (at least 12 characters).");

function encryptMfaSecret(secret) {
  const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be base64 for a 32-byte key.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);
const now = new Date();

async function user(email, name, extra = {}) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, emailVerified: now, passwordHash, ...extra },
    update: { name, emailVerified: now, passwordHash, ...extra },
  });
}

const mfa = process.env.DEMO_MFA_SECRET ? { mfaSecretEncrypted: encryptMfaSecret(process.env.DEMO_MFA_SECRET), mfaEnabledAt: now } : {};
const admin = await user("admin@demo.test", "Asha Platform", { isSuperAdmin: true, ...mfa });
const owner = await user("owner@demo.test", "Rahul Menon");
const treasurer = await user("treasurer@demo.test", "Fathima Nair");
const applicant = await user("applicant@demo.test", "Joseph Varghese");

const base = { country: "IN", timezone: "Asia/Kolkata", currency: "INR", stateCode: "KL" };
const organisations = [
  {
    slug: "kochi-runners", name: "Kochi Runners Club", kind: "Sports club", status: "ACTIVE", city: "Kochi",
    description: "Weekly group runs, coaching and race-day support for runners of every pace across Kochi.",
    contactEmail: "hello@kochirunners.demo.test", team: [[owner, "OWNER"], [treasurer, "TREASURER"]],
    reviews: [["SUBMITTED", owner, null], ["APPROVED", admin, null]],
  },
  {
    slug: "malabar-alumni", name: "Malabar Alumni Association", kind: "Alumni association", status: "PENDING_REVIEW", city: "Kozhikode",
    description: "Alumni of Malabar colleges keeping in touch through annual meets, mentoring and scholarships.",
    contactEmail: "office@malabaralumni.demo.test", team: [[applicant, "OWNER"]],
    reviews: [["SUBMITTED", applicant, null]],
  },
  {
    slug: "thrissur-chess", name: "Thrissur Chess Circle", kind: "Club", status: "CHANGES_REQUESTED", city: "Thrissur",
    description: "Rated tournaments and weekend coaching for young chess players in Thrissur district.",
    contactEmail: "play@thrissurchess.demo.test", team: [[applicant, "OWNER"]],
    reviews: [["SUBMITTED", applicant, null], ["CHANGES_REQUESTED", admin, "Please add your full address and a contact phone number."]],
  },
  {
    slug: "coastal-kayakers", name: "Coastal Kayakers", kind: "Sports club", status: "SUSPENDED", city: "Alappuzha",
    description: "Backwater kayaking trips and safety training for members around Alappuzha.",
    contactEmail: "paddle@coastalkayakers.demo.test", team: [[owner, "OWNER"]],
    reviews: [["SUBMITTED", owner, null], ["APPROVED", admin, null], ["SUSPENDED", admin, "Suspended while we confirm the club's insurance cover."]],
  },
];

for (const { team, reviews, ...data } of organisations) {
  const existing = await prisma.organisation.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (existing) continue;
  const org = await prisma.organisation.create({ data: { ...base, ...data } });
  for (const [member, role] of team) await prisma.teamMember.create({ data: { organisationId: org.id, userId: member.id, role } });
  let at = Date.now() - reviews.length * 3_600_000;
  for (const [action, actor, reason] of reviews) {
    await prisma.organisationReview.create({ data: { organisationId: org.id, action, actorUserId: actor.id, reason, createdAt: new Date((at += 3_600_000)) } });
  }
}

await prisma.$disconnect();
console.log(`seed-demo: ${organisations.length} organisations and 4 accounts (admin, owner, treasurer, applicant @demo.test) ready.`);
