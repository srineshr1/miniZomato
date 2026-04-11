interface ChipProps {
  type: 'delivered' | 'transit' | 'pending' | 'danger';
  children: React.ReactNode;
}

export default function Chip({ type, children }: ChipProps) {
  return <span className={`chip ${type}`}>{children}</span>;
}