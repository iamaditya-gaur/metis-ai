type EmptyStateProps = {
  title: string;
  copy: string;
};

export function EmptyState({ title, copy }: EmptyStateProps) {
  return (
    <div className="product-empty">
      <strong className="product-empty-title">{title}</strong>
      <p className="product-empty-copy">{copy}</p>
    </div>
  );
}
