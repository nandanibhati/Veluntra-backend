const nodemailer = require("nodemailer");
const settingsService = require("../modules/settings/settings.service");
const logger = require("../config/logger");

/**
 * Sends an email using the SMTP credentials configured in the admin
 * Settings dashboard. If SMTP hasn't been configured yet, the email is
 * logged to the console instead of failing the request — the feature
 * works end-to-end the moment an admin fills in real SMTP credentials,
 * with no code change required.
 *
 * `critical` marks account-security mail (password reset, email verification)
 * that must always send regardless of the admin's "Email notifications"
 * toggle — that toggle only controls non-essential mail (order/offer updates).
 */
async function sendMail({ to, subject, text, html, critical = false }) {
  const settings = await settingsService.getRawForInternalUse();

  if (!critical && settingsService.resolveFeatureFlags(settings).emailNotifications === false) {
    logger.info({ to, subject }, "[mailer] Email notifications are disabled in Settings — skipped sending");
    return { delivered: false, reason: "email_notifications_disabled" };
  }

  const smtp = settings.smtpConfig;

  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    logger.info({ to, subject }, "[mailer] SMTP not configured — would have sent");
    return { delivered: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: Boolean(smtp.secure),
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from: smtp.fromEmail || smtp.user,
    to,
    subject,
    text,
    html,
  });

  return { delivered: true };
}

module.exports = { sendMail };
