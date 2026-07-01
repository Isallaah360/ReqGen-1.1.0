import "server-only";

type SendSmsInput = {
  to: string | string[];
  message: string;
  senderName?: string;
  route?: "dnd" | "non_dnd" | "international";
};

type SendEmailRecipient = {
  email: string;
  name?: string | null;
};

type SendEmailInput = {
  to: string | SendEmailRecipient | Array<string | SendEmailRecipient>;
  subject: string;
  html?: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
};

type SendOtpInput = {
  code: string;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  appName?: string;
};

type SendApprovalNotificationInput = {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  requestNo: string;
  stage: string;
  appUrl?: string;
  registryReminderOnly?: boolean;
};

type ChannelResult = {
  channel: "sms" | "email";
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  result?: unknown;
  error?: string;
};

export function normalizeNigerianPhone(rawPhone: string | null | undefined) {
  const raw = String(rawPhone || "").trim();

  if (!raw) return null;

  let phone = raw.replace(/[^\d+]/g, "");

  if (phone.startsWith("+")) {
    phone = phone.slice(1);
  }

  if (phone.startsWith("0") && phone.length === 11) {
    phone = `234${phone.slice(1)}`;
  }

  if (phone.startsWith("234") && phone.length >= 13) {
    return phone;
  }

  return null;
}

export function normalizeEmail(rawEmail: string | null | undefined) {
  const email = String(rawEmail || "").trim().toLowerCase();

  if (!email) return null;

  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return ok ? email : null;
}

function cleanSmsMessage(message: string, senderName: string) {
  let cleaned = String(message || "").trim();

  const escapedSender = senderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  cleaned = cleaned.replace(new RegExp(`^${escapedSender}\\s*:\\s*`, "i"), "");
  cleaned = cleaned.replace(/^IET\s+REQGEN\s*:\s*/i, "");
  cleaned = cleaned.replace(/^REQGEN\s*:\s*/i, "");

  return cleaned.trim();
}

function plainTextToHtml(text: string) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return escaped.trim() ? escaped : "&nbsp;";
    })
    .join("<br />");
}

function normalizeEmailRecipients(
  to: SendEmailInput["to"]
): Array<{ email: string; name?: string }> {
  const rawRecipients = Array.isArray(to) ? to : [to];

  return rawRecipients
    .map((recipient) => {
      if (typeof recipient === "string") {
        const email = normalizeEmail(recipient);
        if (!email) return null;
        return { email };
      }

      const email = normalizeEmail(recipient.email);
      if (!email) return null;

      return {
        email,
        name: recipient.name ? String(recipient.name).trim() : undefined,
      };
    })
    .filter(Boolean) as Array<{ email: string; name?: string }>;
}

async function safeJson(response: Response) {
  const text = await response.text().catch(() => "");

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function sendSendchampSms(input: SendSmsInput) {
  const apiKey = process.env.SENDCHAMP_API_KEY;
  const senderName =
    input.senderName || process.env.SENDCHAMP_SENDER_NAME || "IET REQGEN";

  const route =
    input.route ||
    (process.env.SENDCHAMP_ROUTE as "dnd" | "non_dnd" | "international") ||
    "dnd";

  if (process.env.SENDCHAMP_SMS_ENABLED === "false") {
    return {
      skipped: true,
      channel: "sms",
      reason: "SENDCHAMP_SMS_ENABLED=false",
    };
  }

  if (!apiKey) {
    throw new Error("SENDCHAMP_API_KEY is not configured.");
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  const cleanRecipients = recipients
    .map((phone) => normalizeNigerianPhone(phone))
    .filter(Boolean) as string[];

  if (cleanRecipients.length === 0) {
    throw new Error("No valid recipient phone number supplied.");
  }

  const message = cleanSmsMessage(input.message, senderName);

  if (!message) {
    throw new Error("SMS message cannot be empty.");
  }

  const response = await fetch("https://api.sendchamp.com/api/v1/sms/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: cleanRecipients,
      message,
      sender_name: senderName,
      route,
    }),
  });

  const result = await safeJson(response);

  if (!response.ok) {
    throw new Error(
      (result as any)?.message ||
        (result as any)?.error ||
        `SendChamp SMS failed with status ${response.status}`
    );
  }

  return result;
}

export async function sendSendchampEmail(input: SendEmailInput) {
  const apiKey = process.env.SENDCHAMP_API_KEY;

  if (process.env.SENDCHAMP_EMAIL_ENABLED === "false") {
    return {
      skipped: true,
      channel: "email",
      reason: "SENDCHAMP_EMAIL_ENABLED=false",
    };
  }

  if (!apiKey) {
    throw new Error("SENDCHAMP_API_KEY is not configured.");
  }

  const recipients = normalizeEmailRecipients(input.to);

  if (recipients.length === 0) {
    throw new Error("No valid recipient email address supplied.");
  }

  const subject = String(input.subject || "").trim();

  if (!subject) {
    throw new Error("Email subject cannot be empty.");
  }

  const text = String(input.text || "").trim();
  const html = String(input.html || "").trim() || plainTextToHtml(text);

  if (!html && !text) {
    throw new Error("Email message cannot be empty.");
  }

  const fromEmail =
    input.fromEmail ||
    process.env.SENDCHAMP_EMAIL_FROM_EMAIL ||
    process.env.SENDCHAMP_FROM_EMAIL ||
    "";

  const fromName =
    input.fromName ||
    process.env.SENDCHAMP_EMAIL_FROM_NAME ||
    process.env.SENDCHAMP_FROM_NAME ||
    "IET ReqGen";

  const payload: any = {
    subject,
    to: recipients,
    message_body: {
      type: "html",
      value: html || plainTextToHtml(text),
    },
  };

  if (fromEmail) {
    payload.from = {
      email: fromEmail,
      name: fromName,
    };
  } else if (fromName) {
    payload.from = {
      name: fromName,
    };
  }

  const response = await fetch("https://api.sendchamp.com/api/v1/email/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await safeJson(response);

  if (!response.ok) {
    throw new Error(
      (result as any)?.message ||
        (result as any)?.error ||
        `SendChamp Email failed with status ${response.status}`
    );
  }

  return result;
}

export function buildOtpSmsMessage(code: string) {
  return `IET ReqGen OTP: Your verification code is ${code}. It expires shortly. Do not share it with anyone.`;
}

export function buildOtpEmailText(input: {
  code: string;
  name?: string | null;
  appName?: string;
}) {
  const name = String(input.name || "").trim() || "Staff";
  const appName = input.appName || "IET ReqGen";

  return `Dear ${name},

Your ${appName} verification code is:

${input.code}

This code expires shortly. Do not share it with anyone.

Thank you.
Islamic Education Trust`;
}

export function buildApprovalSmsMessage(input: SendApprovalNotificationInput) {
  if (input.registryReminderOnly) {
    return "IET ReqGen: DG has a pending approval awaiting attention. Please remind DG to review pending ReqGen approvals.";
  }

  const appUrl = input.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://req-gen-1-1-0.vercel.app";

  return `IET ReqGen: You have a pending approval.

Stage: ${input.stage}
Request No: ${input.requestNo}

Login: ${appUrl}`;
}

export function buildApprovalEmailText(input: SendApprovalNotificationInput) {
  const name = String(input.name || "").trim() || "Staff";
  const appUrl = input.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://req-gen-1-1-0.vercel.app";

  if (input.registryReminderOnly) {
    return `Dear ${name},

DG has a pending approval awaiting attention on IET ReqGen.

Please remind DG to review pending ReqGen approvals.

Thank you.
Islamic Education Trust`;
  }

  return `Dear ${name},

A request is awaiting your action on IET ReqGen.

Stage: ${input.stage}
Request No: ${input.requestNo}

Please log in to review and take action:
${appUrl}

Thank you.
Islamic Education Trust`;
}

export async function sendOtpBySms(input: SendOtpInput) {
  const phone = normalizeNigerianPhone(input.phone);

  if (!phone) {
    return {
      channel: "sms",
      ok: false,
      skipped: true,
      reason: "No valid phone number",
    } satisfies ChannelResult;
  }

  try {
    const result = await sendSendchampSms({
      to: phone,
      message: buildOtpSmsMessage(input.code),
    });

    return {
      channel: "sms",
      ok: true,
      result,
    } satisfies ChannelResult;
  } catch (e: any) {
    return {
      channel: "sms",
      ok: false,
      error: e?.message || "SMS OTP failed",
    } satisfies ChannelResult;
  }
}

export async function sendOtpByEmail(input: SendOtpInput) {
  const email = normalizeEmail(input.email);

  if (!email) {
    return {
      channel: "email",
      ok: false,
      skipped: true,
      reason: "No valid email address",
    } satisfies ChannelResult;
  }

  try {
    const text = buildOtpEmailText({
      code: input.code,
      name: input.name,
      appName: input.appName,
    });

    const result = await sendSendchampEmail({
      to: {
        email,
        name: input.name || undefined,
      },
      subject: "IET ReqGen Verification Code",
      text,
    });

    return {
      channel: "email",
      ok: true,
      result,
    } satisfies ChannelResult;
  } catch (e: any) {
    return {
      channel: "email",
      ok: false,
      error: e?.message || "Email OTP failed",
    } satisfies ChannelResult;
  }
}

export async function sendOtpBySmsAndEmail(input: SendOtpInput) {
  const [sms, email] = await Promise.all([sendOtpBySms(input), sendOtpByEmail(input)]);

  return {
    ok: sms.ok || email.ok,
    sms,
    email,
  };
}

export async function sendApprovalNotificationBySms(input: SendApprovalNotificationInput) {
  const phone = normalizeNigerianPhone(input.phone);

  if (!phone) {
    return {
      channel: "sms",
      ok: false,
      skipped: true,
      reason: "No valid phone number",
    } satisfies ChannelResult;
  }

  try {
    const result = await sendSendchampSms({
      to: phone,
      message: buildApprovalSmsMessage(input),
    });

    return {
      channel: "sms",
      ok: true,
      result,
    } satisfies ChannelResult;
  } catch (e: any) {
    return {
      channel: "sms",
      ok: false,
      error: e?.message || "Approval SMS failed",
    } satisfies ChannelResult;
  }
}

export async function sendApprovalNotificationByEmail(input: SendApprovalNotificationInput) {
  const email = normalizeEmail(input.email);

  if (!email) {
    return {
      channel: "email",
      ok: false,
      skipped: true,
      reason: "No valid email address",
    } satisfies ChannelResult;
  }

  try {
    const text = buildApprovalEmailText(input);

    const result = await sendSendchampEmail({
      to: {
        email,
        name: input.name || undefined,
      },
      subject: input.registryReminderOnly
        ? "DG Pending ReqGen Approval Reminder"
        : `Pending ReqGen Approval - ${input.requestNo}`,
      text,
    });

    return {
      channel: "email",
      ok: true,
      result,
    } satisfies ChannelResult;
  } catch (e: any) {
    return {
      channel: "email",
      ok: false,
      error: e?.message || "Approval Email failed",
    } satisfies ChannelResult;
  }
}

export async function sendApprovalNotificationBySmsAndEmail(
  input: SendApprovalNotificationInput
) {
  const [sms, email] = await Promise.all([
    sendApprovalNotificationBySms(input),
    sendApprovalNotificationByEmail(input),
  ]);

  return {
    ok: sms.ok || email.ok,
    sms,
    email,
  };
}