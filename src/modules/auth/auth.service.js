const { randomUUID } = require("crypto");
const prisma = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { hashPassword, comparePassword } = require("../../utils/password");
const { signAccessToken, signRefreshToken, verifyRefreshToken, expiryFromNow } = require("../../utils/jwt");
const { sanitizeUser } = require("../../utils/serialize");
const { sendMail } = require("../../utils/mailer");
const notificationsService = require("../notifications/notifications.service");
const env = require("../../config/env");

async function notifyAdminsOfNewUser(user) {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      notificationsService.create(admin.id, {
        title: "New customer",
        body: `${user.name} (${user.email}) just signed up as a ${user.role}.`,
      })
    )
  );
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: expiryFromNow(env.jwt.refreshExpiresIn),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Guest checkout: reuses an existing guest account for this email, or provisions a new
 * passwordless one. If the email already belongs to a real (registered) account, the caller
 * must log in instead — a guest order is never silently attached to somebody else's account.
 */
async function findOrCreateGuestUser({ email, name }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.isGuest) {
      throw ApiError.conflict("An account already exists for this email. Please log in to continue.");
    }
    return existing;
  }
  const passwordHash = await hashPassword(randomUUID());
  return prisma.user.create({ data: { name, email, passwordHash, role: "customer", isGuest: true } });
}

async function register({ name, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict("An account with this email already exists.");

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  if (role === "seller") {
    await prisma.store.create({
      data: { name: `${name}'s Store`, ownerId: user.id },
    });
  }

  await requestEmailVerification(user.id).catch(() => {}); // best-effort — never block registration on email delivery
  await notifyAdminsOfNewUser(user).catch(() => {}); // best-effort — never block registration on notification delivery

  const tokens = await issueTokenPair(user);
  return { user: sanitizeUser(user), ...tokens };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized("Invalid email or password.");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password.");

  if (user.status === "suspended") throw ApiError.forbidden("This account has been suspended.");

  const tokens = await issueTokenPair(user);
  return { user: sanitizeUser(user), ...tokens };
}

async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token.");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token is no longer valid.");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized("User no longer exists.");

  // Rotate: revoke the used refresh token and issue a brand new pair.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const tokens = await issueTokenPair(user);

  return { user: sanitizeUser(user), ...tokens };
}

async function logout({ refreshToken }) {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revoked: false },
    data: { revoked: true },
  });
}

async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");
  return sanitizeUser(user);
}

// ---------- Password reset ----------

async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always respond the same way whether or not the email exists, to avoid leaking account existence.
  if (!user) return { requested: true };

  const token = randomUUID();
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  await sendMail({
    to: user.email,
    subject: "Reset your Veluntra password",
    text: `Use this code to reset your password: ${token}\nThis code expires in 1 hour.`,
    critical: true,
  });

  return { requested: true };
}

async function resetPassword(token, newPassword) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
  ]);

  return { reset: true };
}

// ---------- Email verification ----------

async function requestEmailVerification(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");
  if (user.emailVerifiedAt) return { alreadyVerified: true };

  const token = randomUUID();
  await prisma.emailVerificationToken.create({
    data: { token, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  await sendMail({
    to: user.email,
    subject: "Verify your Veluntra email address",
    text: `Use this code to verify your email: ${token}\nThis code expires in 24 hours.`,
    critical: true,
  });

  return { requested: true };
}

async function verifyEmail(token) {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("This verification link is invalid or has expired.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return { verified: true };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
  findOrCreateGuestUser,
};
