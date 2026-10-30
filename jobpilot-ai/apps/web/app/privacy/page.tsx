import { Legal, SUPPORT_EMAIL } from '@/components/legal';
export const metadata = { title: 'Privacy Policy — JobPilot AI' };

export default function Privacy() {
  return (
    <Legal title="Privacy Policy" updated="30 October 2026">
      <p>JobPilot AI ("we", "the service") helps you search for jobs, tailor applications and send job-application emails from your own Gmail account. This policy explains what data we handle and why.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><b>Account details:</b> your name, email address and profile picture from your Google account when you choose "Continue with Google", or the details you enter when you register.</li>
        <li><b>Content you give us:</b> resumes and files you upload, job preferences, saved jobs, application notes, email drafts, and the list of recipient email addresses you add for outreach.</li>
        <li><b>Gmail access:</b> if you connect Gmail, we receive an access token that lets the service send emails on your behalf. We store the token encrypted.</li>
      </ul>

      <h2>How we use Google user data</h2>
      <p>JobPilot AI's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      <ul>
        <li>We use the <code>gmail.send</code> permission <b>only</b> to send the emails that you write or approve, with the attachments you choose, from your own Gmail address.</li>
        <li>We do not read, scan or store the contents of your inbox unless you explicitly enable inbox features that request additional permission, and then only to show you your own replies.</li>
        <li>We do not sell Google user data, use it for advertising, or transfer it to third parties except as needed to provide the feature you asked for, to comply with law, or with your consent.</li>
        <li>No person at JobPilot AI reads your emails, except with your permission for support, or where required for security or legal reasons.</li>
      </ul>

      <h2>AI processing</h2>
      <p>To draft emails or analyse a resume, the relevant text (for example your resume text and a job description) is sent to our AI model providers. It is used to produce your result and is not used by us to train models.</p>

      <h2>Sharing</h2>
      <p>Emails you send go to the recipients you choose. We use infrastructure and AI providers to run the service, and they process data only on our instructions. We do not sell personal data.</p>

      <h2>Retention and deletion</h2>
      <p>We keep your data while your account is active. You can disconnect Gmail at any time in Settings, which deletes the stored token; you can also revoke access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. To delete your account and data, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will delete it within 30 days.</p>

      <h2>Security</h2>
      <p>Data is transmitted over HTTPS, tokens are stored encrypted, and access to production systems is restricted. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Responsible sending</h2>
      <p>The service limits how many emails you can send per day and spaces them out. You are responsible for emailing only recipients who may reasonably expect to hear from you, and for honouring requests to stop.</p>

      <h2>Contact</h2>
      <p>Questions about this policy: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </Legal>
  );
}
