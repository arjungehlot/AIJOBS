import { Legal, SUPPORT_EMAIL } from '@/components/legal';
export const metadata = { title: 'Terms of Service — JobPilot AI' };

export default function Terms() {
  return (
    <Legal title="Terms of Service" updated="30 October 2026">
      <p>By creating an account or using JobPilot AI you agree to these terms.</p>
      <h2>The service</h2>
      <p>JobPilot AI helps you find jobs, prepare applications and send job-application emails from your own email account. AI-written content is a draft; you are responsible for reviewing what you send.</p>
      <h2>Your account</h2>
      <p>You must provide accurate information and keep your login secure. You are responsible for activity under your account.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not send spam, bulk unsolicited marketing, or misleading or abusive messages.</li>
        <li>Only email people who may reasonably expect job-related contact, and stop when asked.</li>
        <li>Do not misrepresent your qualifications or identity, and do not try to bypass sending limits or security.</li>
        <li>Follow Google's terms for your Gmail account.</li>
      </ul>
      <p>We may limit or suspend accounts that break these rules.</p>
      <h2>Your content</h2>
      <p>You keep ownership of your resumes and content. You give us permission to process them to provide the service, as described in our <a href="/privacy">Privacy Policy</a>.</p>
      <h2>No guarantees</h2>
      <p>We do not guarantee interviews, replies or job offers. The service is provided "as is", and to the extent allowed by law we are not liable for indirect losses.</p>
      <h2>Ending use</h2>
      <p>You can stop using the service and disconnect Gmail at any time. Contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to delete your account.</p>
    </Legal>
  );
}
