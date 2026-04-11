interface TimelineItemProps {
  icon: string;
  title: string;
  time: string;
  status: 'done' | 'active' | 'pending';
  titleColor?: string;
}

export default function Timeline({ items }: { items: TimelineItemProps[] }) {
  return (
    <div className="tracking-timeline">
      {items.map((item, i) => (
        <div key={i} className="timeline-item">
          <div className={`timeline-dot ${item.status}`}>{item.icon}</div>
          <div className="timeline-content">
            <div className="timeline-title" style={item.titleColor ? { color: item.titleColor } : undefined}>
              {item.title}
            </div>
            <div className="timeline-time" style={item.status === 'pending' ? { color: 'var(--text3)' } : undefined}>
              {item.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}