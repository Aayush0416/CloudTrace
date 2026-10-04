import nodemailer from "nodemailer";
import { config } from "../config";

const s = config.smtp;
const transport = s.host
  ? nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    })
  : null;
export const mailConfigured = !!transport;

/** Returns true if the email was handed to an SMTP server. Without SMTP the message is printed to the console (development). */
export async function sendMail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  if (!transport) {
    console.log(
      `\n[email not configured] To: ${to}\nSubject: ${subject}\n${text}\n`,
    );
    return false;
  }
  try {
    await transport.sendMail({ from: s.from, to, subject, text });
    return true;
  } catch (err) {
    console.error("Email delivery failed:", err);
    return false;
  }
}
