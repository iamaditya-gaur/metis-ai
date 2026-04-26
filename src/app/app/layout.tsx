export default function ProductAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="product-root">{children}</div>;
}
