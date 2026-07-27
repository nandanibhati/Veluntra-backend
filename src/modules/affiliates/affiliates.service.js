const { randomBytes } = require("crypto");
const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { toPlain } = require("../../utils/serialize");
const { parsePagination } = require("../../utils/pagination");

function randomCode(length = 6) {
  return randomBytes(length).toString("hex").slice(0, length).toUpperCase();
}

async function generateUniqueReferralCode(name) {
  const base = (name || "PARTNER").replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase() || "PARTNER";
  let candidate = `${base}${randomCode(4)}`;
  while (await prisma.affiliateProfile.findUnique({ where: { referralCode: candidate } })) {
    candidate = `${base}${randomCode(4)}`;
  }
  return candidate;
}

function summarize(profile) {
  const plain = toPlain(profile);
  const commissions = plain.commissions || [];
  plain.totals = {
    pending: commissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + Number(c.commissionAmount), 0),
    approved: commissions.filter((c) => c.status === "approved").reduce((sum, c) => sum + Number(c.commissionAmount), 0),
    paid: commissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + Number(c.commissionAmount), 0),
  };
  return plain;
}

/** Admin creates a profile after approving an affiliate partner application — a user can only
 * ever have one (unique userId), matching how dropshipper/wholesaler access is granted once. */
async function createProfile(userId, data) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");
  const existing = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (existing) throw ApiError.badRequest("This user already has an affiliate profile.");

  if (data.referralCode) {
    const taken = await prisma.affiliateProfile.findUnique({ where: { referralCode: data.referralCode } });
    if (taken) throw ApiError.badRequest("That referral code is already taken.");
  }
  const referralCode = data.referralCode || (await generateUniqueReferralCode(user.name));

  const profile = await prisma.affiliateProfile.create({
    data: {
      userId,
      referralCode,
      commissionRate: data.commissionRate ?? undefined,
    },
    include: { user: { select: { id: true, name: true, email: true } }, commissions: true },
  });
  return summarize(profile);
}

async function listProfiles(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 20 });
  const [items, total] = await Promise.all([
    prisma.affiliateProfile.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, commissions: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.affiliateProfile.count(),
  ]);
  return { items: items.map(summarize), page, limit, total };
}

async function getMyProfile(userId) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: { commissions: { orderBy: { createdAt: "desc" } } },
  });
  if (!profile) return null;
  return summarize(profile);
}

async function addCommission(affiliateProfileId, data) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { id: affiliateProfileId } });
  if (!profile) throw ApiError.notFound("Affiliate profile not found.");
  const commission = await prisma.affiliateCommission.create({
    data: {
      affiliateProfileId,
      description: data.description,
      saleAmount: data.saleAmount,
      commissionAmount: data.commissionAmount,
    },
  });
  return toPlain(commission);
}

async function setCommissionStatus(commissionId, status) {
  const commission = await prisma.affiliateCommission.findUnique({ where: { id: commissionId } });
  if (!commission) throw ApiError.notFound("Commission entry not found.");
  const updated = await prisma.affiliateCommission.update({ where: { id: commissionId }, data: { status } });
  return toPlain(updated);
}

module.exports = { createProfile, listProfiles, getMyProfile, addCommission, setCommissionStatus };
