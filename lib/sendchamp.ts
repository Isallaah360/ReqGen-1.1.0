import "server-only";

type SendSmsInput = {
  to: string | string[];
  message: string;
  senderName?: string;
  route?: "dnd" | "non_dnd" | "international";
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

function cleanSmsMessage(message: string, senderName: string) {
  let cleaned = String(message || "").trim();

  const escapedSender = senderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  cleaned = cleaned.replace(
    new RegExp(`^${escapedSender}\\s*:\\s*`, "i"),
    ""
  );

  cleaned = cleaned.replace(/^IET\s+REQGEN\s*:\s*/i, "");
  cleaned = cleaned.replace(/^REQGEN\s*:\s*/i, "");

  return cleaned.trim();
}

export async function sendSendchampSms(input: SendSmsInput) {
  const apiKey = process.env.SENDCHAMP_API_KEY;
  const senderName =
    input.senderName || process.env.SENDCHAMP_SENDER_NAME || "IET REQGEN";

  const route =
    input.route ||
    (process.env.SENDCHAMP_ROUTE as "dnd" | "non_dnd" | "international") ||
    "dnd";

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

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `SendChamp SMS failed with status ${response.status}`
    );
  }

  return result;
}