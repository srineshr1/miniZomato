interface PanelProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function Panel({ title, action, children }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}