const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_TO_EMAIL = "roy@friendsoffieldway.org";
const DEFAULT_FROM_EMAIL = "Friends of Fieldway <website@send.friendsoffieldway.org>";
const MAX_FIELD_LENGTH = 2000;
const MAX_MESSAGE_LENGTH = 5000;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const cleanText = (value, maxLength = MAX_FIELD_LENGTH) =>
  String(value || "")
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, maxLength);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const parseBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const buildEmail = (payload) => {
  const formName = cleanText(payload.formName || "Website enquiry", 120);
  const name = cleanText(payload.name, 160);
  const email = cleanText(payload.email, 254).toLowerCase();
  const topic = cleanText(payload.subject || payload.interest || "General enquiry", 160);
  const message = cleanText(payload.message, MAX_MESSAGE_LENGTH);
  const fields = payload.fields && typeof payload.fields === "object" ? payload.fields : {};

  const readableFields = Object.entries(fields)
    .filter(([key]) => !["company"].includes(key))
    .map(([key, value]) => [cleanText(key, 80), cleanText(value, MAX_FIELD_LENGTH)])
    .filter(([, value]) => value);

  const subject = `[Friends of Fieldway] ${topic}`;
  const text = [
    `${formName}`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Topic: ${topic}`,
    "",
    "Message:",
    message,
    "",
    "Submitted fields:",
    ...readableFields.map(([key, value]) => `${key}: ${value}`),
  ].join("\n");

  const rows = readableFields
    .map(
      ([key, value]) =>
        `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e7e4de;">${escapeHtml(
          key
        )}</th><td style="padding:8px 12px;border-bottom:1px solid #e7e4de;">${escapeHtml(value).replace(
          /\n/g,
          "<br>"
        )}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#2E2A2F;line-height:1.5;">
      <h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(formName)}</h1>
      <p style="margin:0 0 16px;">A new website enquiry has been submitted.</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;">
        <tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e7e4de;">Name</th><td style="padding:8px 12px;border-bottom:1px solid #e7e4de;">${escapeHtml(
          name
        )}</td></tr>
        <tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e7e4de;">Email</th><td style="padding:8px 12px;border-bottom:1px solid #e7e4de;">${escapeHtml(
          email
        )}</td></tr>
        <tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e7e4de;">Topic</th><td style="padding:8px 12px;border-bottom:1px solid #e7e4de;">${escapeHtml(
          topic
        )}</td></tr>
        <tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e7e4de;">Message</th><td style="padding:8px 12px;border-bottom:1px solid #e7e4de;">${escapeHtml(
          message
        ).replace(/\n/g, "<br>")}</td></tr>
        ${rows}
      </table>
    </div>
  `;

  return { name, email, topic, message, subject, text, html };
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    sendJson(res, 500, { ok: false, error: "Email service is not configured" });
    return;
  }

  let payload;
  try {
    payload = await parseBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid request body" });
    return;
  }

  if (cleanText(payload.company)) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const email = buildEmail(payload);

  if (!email.name || !isValidEmail(email.email) || !email.topic || !email.message) {
    sendJson(res, 400, { ok: false, error: "Please complete all required fields" });
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: [process.env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL],
      reply_to: email.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend email failed", response.status, detail.slice(0, 500));
    sendJson(res, 502, { ok: false, error: "Email could not be sent" });
    return;
  }

  sendJson(res, 200, { ok: true });
};
