import { useSocket } from '../contexts/SocketContext';

export default function Toast() {
  const { notifications, removeNotification } = useSocket();

  if (notifications.length === 0) return null;

  return (
    <>
      {notifications.map((n) => (
        <div key={n.id} className="notif-toast" onClick={() => removeNotification(n.id)}>
          <div className="notif-icon">{n.icon}</div>
          <div>
            <div className="notif-title">{n.title}</div>
            <div className="notif-body">{n.body}</div>
          </div>
        </div>
      ))}
    </>
  );
}