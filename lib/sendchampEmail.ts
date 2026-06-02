import "server-only";

type SendEmailInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string;
};

export async function sendSendchampEmail(input: SendEmailInput) {
  const apiKey = process.env.SENDCHAMP_API_KEY;
  const fromEmail = process.env.SENDCHAMP_EMAIL_FROM;
  const fromName = process.env.SENDCHAMP_EMAIL_FROM_NAME || "IET REQGEN";

  if (!apiKey) {
    throw new Error("SENDCHAMP_API_KEY is not configured.");
  }

  if (!fromEmail) {
    throw new Error("SENDCHAMP_EMAIL_FROM is not configured.");
  }

  const toEmail = input.toEmail.trim().toLowerCase();

  if (!toEmail || !toEmail.includes("@")) {
    throw new Error("Valid recipient email is required.");
  }

  const subject = input.subject.trim();

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  const text = input.text.trim();

  if (!text) {
    throw new Error("Email body is required.");
  }

  const response = await fetch("https://api.sendchamp.com/api/v1/email/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      subject,
      to: [
        {
          email: toEmail,
          name: input.toName || toEmail,
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      message_body: {
        type: input.html ? "text/html" : "text/plain",
        value: input.html || text,
      },
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Sendchamp email failed with status ${response.status}`
    );
  }

  return result;
}