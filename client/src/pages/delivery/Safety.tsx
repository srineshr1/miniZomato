import { useState } from 'react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import { useSocket } from '../../contexts/SocketContext';
import { usePolling } from '../../hooks/usePolling';
import { deliveryService } from '../../services/deliveryService';
import { safetyService } from '../../services/adminService';

export default function Safety() {
  const { isConnected } = useSocket();
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);
  const [speedUpdatedAt, setSpeedUpdatedAt] = useState<string>('—');
  const [helmetDetected, setHelmetDetected] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const speedLimit = 60;
  const isOver = speed > speedLimit;
  const offset = 377 - (377 * Math.min(speed / 100, 1));

  usePolling(
    () => deliveryService.me(),
    15000,
    (partner) => {
      setPartnerId(partner.id);
      setHelmetDetected(partner.helmet_detected);
      setCameraActive(partner.camera_active);
    },
  );

  usePolling(
    async () => {
      if (!partnerId) return null;
      const [speedData, helmetData] = await Promise.all([
        safetyService.getSpeed(partnerId),
        safetyService.checkHelmet(partnerId),
      ]);
      return { speedData, helmetData };
    },
    5000,
    (data) => {
      if (!data) return;
      setSpeed(Math.round(data.speedData.speed_kmh || 0));
      setSpeedUpdatedAt(new Date(data.speedData.timestamp).toLocaleTimeString());
      setHelmetDetected(Boolean(data.helmetData.helmet_detected));
      setCameraActive(Boolean(data.helmetData.camera_active));
    },
  );

  return (
    <>
      <TopBar title="Safety Monitor" subtitle="Speed, helmet detection & delivery cam">
        <div className={`status-pill ${isConnected ? 'online' : 'warning'}`}><div className="dot" /> {isConnected ? 'Connected' : 'Reconnecting'}</div>
      </TopBar>
      <div className="content">
        <div className="two-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel title="Live Speed" action={<div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>LIMIT: {speedLimit} KM/H</div>}>
              <div className="speed-gauge">
                <div className="gauge-circle">
                  <svg className="gauge-svg" viewBox="0 0 120 120">
                    <circle className="gauge-track" cx="60" cy="60" r="50" />
                    <circle
                      className={`gauge-fill ${isOver ? 'danger' : ''}`}
                      cx="60" cy="60" r="50"
                      strokeDasharray={377}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <div className="gauge-center">
                    <div className="gauge-value" style={{ color: isOver ? 'var(--red)' : 'var(--text)' }}>{speed}</div>
                    <div className="gauge-unit">km/h</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isOver ? 'var(--red)' : 'var(--green)' }}>
                  {isOver ? '⚠ OVER LIMIT' : '✓ WITHIN LIMIT'}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  Last update: {speedUpdatedAt}
                </div>
              </div>
            </Panel>

            <Panel title="Helmet Detection">
              <div style={{ padding: 20 }}>
                <div className={`helmet-card ${helmetDetected ? '' : 'violation'}`}>
                  <div style={{ fontSize: 36 }}>⛑️</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: helmetDetected ? 'var(--green)' : 'var(--red)' }}>
                      {helmetDetected ? 'HELMET DETECTED' : 'HELMET NOT DETECTED'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>Continuous monitoring active</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginTop: 4 }}>
                      Last checked: {speedUpdatedAt}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)' }}>
                  Camera status: <span style={{ color: cameraActive ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{cameraActive ? 'Active' : 'Offline'}</span>
                </div>
              </div>
            </Panel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel title="Journey Camera" action={<span className="chip danger">● REC</span>}>
              <div style={{ padding: 16 }}>
                <div className="camera-feed">
                  <div className="camera-icon">📷</div>
                  <div className="camera-rec"><div className="rec-dot" /> {cameraActive ? 'RECORDING' : 'OFFLINE'}</div>
                  <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                    {cameraActive ? 'MOTION DETECTED ● ACTIVE' : 'CAMERA FEED NOT AVAILABLE'}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>Camera Status</span>
                    <span style={{ color: cameraActive ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>{cameraActive ? 'ACTIVE' : 'OFFLINE'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>Motion Detection</span>
                    <span style={{ color: cameraActive ? 'var(--green)' : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{cameraActive ? 'ACTIVE' : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>Tampering Detected</span>
                    <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>NONE</span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Violation History">
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>{isOver || !helmetDetected ? '⚠️' : '🏆'}</div>
                {isOver || !helmetDetected
                  ? 'Safety event detected. Slow down and ensure helmet is worn.'
                  : 'No live safety events detected.'}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
