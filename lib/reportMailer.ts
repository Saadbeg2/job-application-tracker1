import nodemailer from "nodemailer";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function smtpConfig() {
  const provider = process.env.EMAIL_PROVIDER?.trim()?.toLowerCase() || "smtp";
  if (provider !== "smtp") {
    throw new Error("Unsupported EMAIL_PROVIDER. Set EMAIL_PROVIDER=smtp.");
  }

  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT?.trim() || "465");
  const secureRaw = process.env.SMTP_SECURE?.trim()?.toLowerCase() || "true";
  const secure = secureRaw === "true";

  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASS");
  const fromEmail = requiredEnv("REPORT_FROM_EMAIL");
  const fromName = process.env.REPORT_FROM_NAME?.trim() || "Job Application Tracker";

  return { host, port, secure, user, pass, fromEmail, fromName };
}

export async function sendReportEmail(to: string, subject: string, text: string) {
  const { host, port, secure, user, pass, fromEmail, fromName } = smtpConfig();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "unknown smtp error";
    if (message.includes("invalid login") || message.includes("auth") || message.includes("username") || message.includes("password")) {
      throw new Error("SMTP authentication failed. Verify SMTP_USER and SMTP_PASS (Gmail App Password).");
    }
    throw new Error("Failed to send email via SMTP.");
  }
}
