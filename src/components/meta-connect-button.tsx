export function MetaConnectButton({ label = "Connect with Meta" }: { label?: string }) {
  // Plain anchor: the whole flow is server-side redirects; no JS needed.
  return (
    <a className="product-button" href="/api/meta/oauth/start">
      {label}
    </a>
  );
}
