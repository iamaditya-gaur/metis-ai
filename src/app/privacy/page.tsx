export const metadata = { title: "Privacy policy — Metis AI" };

const UPDATED = "July 17, 2026";

export default function PrivacyPage() {
  return (
    <main
      style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.7 }}
    >
      <h1>Privacy policy</h1>
      <p>Last updated: {UPDATED}</p>

      <h2>What Metis AI does</h2>
      <p>
        Metis AI generates plain-language performance reports from Meta ad
        accounts that you explicitly connect. We only ever request read-only
        access (<code>ads_read</code>). We cannot create, edit, pause, or
        spend on your campaigns.
      </p>

      <h2>Data we store</h2>
      <ul>
        <li>Your account email and login credentials (managed by Supabase Auth).</li>
        <li>
          Meta access tokens you grant us, encrypted at rest with AES-256-GCM.
          Plaintext tokens are never written to the database or to logs.
        </li>
        <li>
          Report runs: the metrics snapshot, the generated report text, and
          quality-check scores, linked to your account.
        </li>
        <li>Writing samples you upload to teach the tool your tone.</li>
      </ul>

      <h2>Data we do not store</h2>
      <ul>
        <li>
          We do not store your Facebook password — the connection uses
          Meta&apos;s own login.
        </li>
        <li>We do not sell or share any data with third parties.</li>
        <li>
          Ad metrics are fetched on demand for each report and are not
          warehoused beyond the run record.
        </li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Removing a connection in the app deletes its stored token immediately.
        Removing the Metis AI app from your Facebook settings triggers
        Meta&apos;s data-deletion callback, which deletes every token tied to
        your Facebook account immediately. For full account deletion, email{" "}
        <a href="mailto:support@metis-ai.app">support@metis-ai.app</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:support@metis-ai.app">support@metis-ai.app</a>
      </p>
    </main>
  );
}
