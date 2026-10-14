import { fence, untrustedDirective } from '../prompt-fence';

/*
 * The one prompt that reads a mail (ADR 0071). The mail is outside text, so
 * its subject, sender and words go inside the fence (ADR 0022) and the
 * directive in the system prompt. Links arrive as numbered markers in the
 * text; the list below the text gives the model just enough of each address
 * (host and path, never the tracking query) to tell a job's link from
 * "unsubscribe" or "see all jobs". Pure.
 */

/** Room for a full digest's answer: thirty listings at about a hundred tokens each. */
export const GMAIL_MAX_TOKENS = 3500;
const LINK_SHOWN_CHARS = 80;

const SYSTEM = `You read ONE email that may advertise jobs (a job-alert digest from a job site, a recruiter's note) and list the jobs in it.

${untrustedDirective()}

Reply with ONLY JSON: {"listings": [{"title": string, "company": string|null, "location": string|null, "salary_min": number|null, "salary_max": number|null, "workplace": "remote"|"hybrid"|"onsite"|null, "link": integer|null}]}.
Rules:
- One entry per distinct job the email advertises. An email that advertises no job (a receipt, a newsletter, a message about something else) returns an empty list: {"listings": []}.
- title: the role as written, without the company or marketing words.
- company: the hiring company's name as the email gives it; null when it names none. A job board or a recruiting agency's own name is not the hiring company.
- location: as written ("Remote (US)", "Austin, TX"); null when not stated.
- salary_min / salary_max: yearly amounts as plain integers, only when the email states them per year; null otherwise. Convert nothing.
- workplace: "remote", "hybrid" or "onsite" only when the email states the arrangement.
- link: the number n of the marker [#n] that belongs to THIS job in the text (the link on its title, or on its "view job" / "apply" button), as an integer; null when none belongs to it. A link that is not about one job (unsubscribe, "see all jobs", settings, help) is never a job's link.
- Never invent or guess a fact the email does not contain.`;

/** A link as the model needs to see it: where it goes, without the tracking query. */
function shown(address: string): string {
  try {
    const url = new URL(address);
    return `${url.host}${url.pathname}`.slice(0, LINK_SHOWN_CHARS);
  } catch {
    return address.slice(0, LINK_SHOWN_CHARS);
  }
}

export interface MailForPrompt {
  subject: string;
  fromName: string;
  text: string;
  links: readonly string[];
}

export function buildGmailExtractPrompt(mail: MailForPrompt): { system: string; user: string } {
  const links = mail.links.map((address, i) => `[#${i + 1}] ${shown(address)}`).join('\n');
  const body = [`Subject: ${mail.subject}`, `From: ${mail.fromName}`, '', mail.text, '', 'LINKS', links].join('\n');
  return { system: SYSTEM, user: fence('EMAIL', body) };
}
