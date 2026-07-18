export const metadata = { title: "Terms of service — Metis AI" };

export default function TermsPage() {
  return (
    <main
      style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.7 }}
    >
      <h1>Terms of service</h1>
      <p>Last updated: July 17, 2026</p>
      <ul>
        <li>
          Metis AI provides reporting on ad accounts you connect. You must
          have the right to access those accounts.
        </li>
        <li>
          Reports are AI-generated summaries of your data. Verify numbers
          before sharing externally; you are responsible for what you send to
          your clients.
        </li>
        <li>
          We may suspend accounts that abuse the service or Meta&apos;s
          platform terms.
        </li>
        <li>
          The service is provided as-is, without warranty. Liability is
          limited to the amount you paid us in the last 12 months.
        </li>
      </ul>
    </main>
  );
}
