import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "PrivateFleet <onboarding@resend.dev>"
  );
}

export type DriverContactAdminEmail = {
  to: string[];
  driverEmail: string;
  driverId: string | null;
  driverDisplayName: string | null;
  message: string;
};

export async function sendDriverContactAdminEmail(
  payload: DriverContactAdminEmail,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      error:
        "Email is not configured yet. Ask an admin to set RESEND_API_KEY on the server.",
    };
  }

  if (payload.to.length === 0) {
    return {
      ok: false,
      error: "Admin has not configured a contact email yet.",
    };
  }

  const name = payload.driverDisplayName?.trim() || "Driver";
  const driverId = payload.driverId?.trim() || "—";
  const subject = `PrivateFleet: identity change request from ${name}`;
  const text = [
    "A driver requested help changing their name or work state.",
    "",
    `Driver name: ${name}`,
    `Driver ID: ${driverId}`,
    `Driver email: ${payload.driverEmail}`,
    "",
    "Message:",
    payload.message.trim(),
  ].join("\n");

  const html = `
    <p>A driver requested help changing their name or work state.</p>
    <ul>
      <li><strong>Driver name:</strong> ${escapeHtml(name)}</li>
      <li><strong>Driver ID:</strong> ${escapeHtml(driverId)}</li>
      <li><strong>Driver email:</strong> ${escapeHtml(payload.driverEmail)}</li>
    </ul>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(payload.message.trim()).replace(/\n/g, "<br />")}</p>
  `;

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: payload.to,
    replyTo: payload.driverEmail,
    subject,
    text,
    html,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
