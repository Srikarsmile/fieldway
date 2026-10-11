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

const isDuplicateField = (key) =>
  ["name", "full name", "email", "email address", "subject", "topic", "message", "your message"].includes(
    key.toLowerCase()
  );

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
    .filter(([key]) => !["company"].includes(key.toLowerCase()))
    .map(([key, value]) => [cleanText(key, 80), cleanText(value, MAX_FIELD_LENGTH)])
    .filter(([key]) => !isDuplicateField(key))
    .filter(([, value]) => value);

  const subject = `[Friends of Fieldway] ${topic}`;
  const replyHref = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Re: ${subject}`)}`;
  const text = [
    "New website enquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Topic: ${topic}`,
    "",
    "Message:",
    message,
    "",
    `Reply: ${email}`,
    "",
    "Sent from friendsoffieldway.org",
    ...(readableFields.length
      ? ["", "Additional details:", ...readableFields.map(([key, value]) => `${key}: ${value}`)]
      : []),
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

  const additionalDetails = rows
    ? `
      <h2 style="font-size:16px;margin:24px 0 8px;color:#263F2C;">Additional details</h2>
      <table role="presentation" style="border-collapse:collapse;width:100%;background:#ffffff;border:1px solid #e7e4de;border-radius:10px;overflow:hidden;">
        ${rows}
      </table>
    `
    : "";

  const html = `
    <div style="margin:0;padding:0;background:#f7f4ec;">
      <div style="font-family:Arial,sans-serif;color:#2E2A2F;line-height:1.5;max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#263F2C;border-radius:14px 14px 0 0;padding:22px 24px;">
          <p style="margin:0 0 6px;color:#D4A752;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;">Friends of Fieldway</p>
          <h1 style="font-size:24px;line-height:1.25;margin:0;color:#ffffff;">New website enquiry</h1>
        </div>
        <div style="background:#ffffff;border:1px solid #e7e4de;border-top:0;border-radius:0 0 14px 14px;padding:24px;">
          <p style="margin:0 0 20px;color:#5f5a52;">A new message has been submitted from ${escapeHtml(formName)}.</p>
          <table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 20px;">
            <tr>
              <th align="left" style="width:120px;padding:10px 0;border-bottom:1px solid #e7e4de;color:#263F2C;">Name</th>
              <td style="padding:10px 0;border-bottom:1px solid #e7e4de;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <th align="left" style="width:120px;padding:10px 0;border-bottom:1px solid #e7e4de;color:#263F2C;">Email</th>
              <td style="padding:10px 0;border-bottom:1px solid #e7e4de;"><a href="mailto:${escapeHtml(email)}" style="color:#2f6f47;">${escapeHtml(
                email
              )}</a></td>
            </tr>
            <tr>
              <th align="left" style="width:120px;padding:10px 0;border-bottom:1px solid #e7e4de;color:#263F2C;">Topic</th>
              <td style="padding:10px 0;border-bottom:1px solid #e7e4de;">${escapeHtml(topic)}</td>
            </tr>
          </table>
          <h2 style="font-size:16px;margin:0 0 8px;color:#263F2C;">Message</h2>
          <div style="background:#f7f4ec;border-left:4px solid #D4A752;border-radius:8px;padding:16px 18px;margin:0 0 22px;">
            ${escapeHtml(message).replace(/\n/g, "<br>")}
          </div>
          <a href="${escapeHtml(replyHref)}" style="display:inline-block;background:#2f6f47;color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 20px;">Reply to ${escapeHtml(
            name
          )}</a>
          ${additionalDetails}
          <p style="margin:24px 0 0;color:#7b746b;font-size:12px;">Sent from friendsoffieldway.org</p>
        </div>
      </div>
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
