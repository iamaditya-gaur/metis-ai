type PageProps = { searchParams: Promise<{ code?: string }> };

export const metadata = { title: "Data deletion — Metis AI" };

export default async function DataDeletionPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.7 }}>
      <h1>Data deletion</h1>
      <p>
        Deletion requests from Meta are processed immediately: every stored
        Meta access token tied to the requesting Facebook account is deleted
        at the moment the request arrives. There is no queue and no retention
        period for tokens.
      </p>
      {code ? (
        <p>
          Your confirmation code: <code>{code}</code>. The deletion tied to
          this code has already completed.
        </p>
      ) : null}
      <p>
        To also delete your Metis account and report history, email{" "}
        <a href="mailto:support@metis-ai.app">support@metis-ai.app</a> from
        your account email.
      </p>
    </main>
  );
}
