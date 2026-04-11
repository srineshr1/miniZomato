import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import Timeline from '../../components/Timeline';
import { qrService } from '../../services/qrService';
import { orderService } from '../../services/orderService';
import { usePolling } from '../../hooks/usePolling';
import { Order } from '../../types';
import { extractErrorMessage } from '../../utils/errors';

export default function QRScanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ order_number: string; customer_address: string; customer_landmark: string | null } | null>(null);

  usePolling(
    () => orderService.list(),
    6000,
    (data) => setOrders(data),
  );

  const queryOrderId = Number(searchParams.get('order'));
  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId), [orders, selectedOrderId]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);

  useEffect(() => {
    if (readyOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    if (selectedOrderId && readyOrders.some((order) => order.id === selectedOrderId)) return;

    if (queryOrderId && readyOrders.some((order) => order.id === queryOrderId)) {
      setSelectedOrderId(queryOrderId);
      return;
    }

    setSelectedOrderId(readyOrders[0].id);
  }, [queryOrderId, readyOrders, selectedOrderId]);

  useEffect(() => {
    if (selectedOrder) {
      setError('');
    }
  }, [selectedOrder]);

  const scanDisabled = scanning || !token.trim();
  const selectedOrderLabel = selectedOrder
    ? `#${selectedOrder.order_number} - ${selectedOrder.items?.[0]?.food_item_name || 'Order'}`
    : '';

  const submitScan = async () => {
    if (!token.trim()) {
      setError('Enter a QR token to continue.');
      return;
    }

    setScanning(true);
    setError('');
    try {
      const data = await qrService.scan(token.trim());
      setResult(data);
      setScanned(true);
      const refreshed = await orderService.list();
      setOrders(refreshed);
    } catch (e) {
      setError(extractErrorMessage(e, 'Scan failed. Please verify token and try again.'));
    } finally {
      setScanning(false);
    }
  };

  const scannedOrder = result ? orders.find((o) => o.order_number === result.order_number) : null;

  return (
    <>
      <TopBar title="QR Scanner" subtitle="Scan to unlock customer address" />
      <div className="content">
        <div className="two-col" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Panel title="Scan Order QR">
            <div className="qr-scanner">
              <div className="qr-frame">
                <div className="qr-inner">
                  <div style={{ fontSize: 80 }}>⬛</div>
                  {scanning && <div className="qr-scan-line" />}
                </div>
                <div className="qr-corner tr" />
                <div className="qr-corner bl" />
              </div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
                  {scanning ? 'SCANNING...' : 'SCAN PICKUP QR'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {scanning ? 'Processing...' : 'Enter token from restaurant pickup QR'}
                </div>
              </div>

              <div className="field" style={{ width: '100%', maxWidth: 340, marginBottom: 12 }}>
                <label>Ready Order</label>
                <select
                  value={selectedOrderId ?? ''}
                  onChange={(e) => setSelectedOrderId(e.target.value ? Number(e.target.value) : null)}
                  disabled={readyOrders.length === 0}
                >
                  {readyOrders.length === 0 ? (
                    <option value="">No ready orders</option>
                  ) : (
                    readyOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        #{order.order_number} - {order.items?.[0]?.food_item_name || 'Order'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="field" style={{ width: '100%', maxWidth: 340, marginBottom: 12 }}>
                <label>QR Token</label>
                <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste scanned token" />
              </div>

              {selectedOrderLabel && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                  Selected: {selectedOrderLabel}
                </div>
              )}

              <button className="btn btn-primary" onClick={submitScan} disabled={scanDisabled}>
                {scanning ? 'Scanning...' : 'Submit Scan'}
              </button>

              {!selectedOrder && <div style={{ color: 'var(--text3)', marginTop: 10, fontSize: 12 }}>No READY orders available to scan.</div>}

              {error && <div style={{ color: 'var(--red)', marginTop: 10, fontSize: 12 }}>{error}</div>}

              <div style={{ marginTop: 16, width: '100%', maxWidth: 360, fontSize: 12, color: 'var(--text2)' }}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Ready orders:</div>
                {readyOrders.length === 0 ? (
                  <div style={{ color: 'var(--text3)' }}>No orders in READY state right now.</div>
                ) : (
                  readyOrders.map((order) => (
                    <div key={order.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      #{order.order_number} · {order.items?.[0]?.food_item_name || 'Order'}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          {scanned && result ? (
            <Panel title="✓ QR Scanned!">
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="address-unlocked">
                  <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 6 }}>ADDRESS UNLOCKED</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{result.customer_address}</div>
                  {result.customer_landmark && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
                      LANDMARK: {result.customer_landmark}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                  <div>ORDER ID: {result.order_number}</div>
                  <div>CUSTOMER: *** masked ***</div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate(scannedOrder ? `/delivery/nav?order=${scannedOrder.id}` : '/delivery/nav')}
                >
                  Start Navigation
                </button>
              </div>
            </Panel>
          ) : (
            <Panel title="Privacy System">
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="address-hidden">
                  <div style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>ADDRESS HIDDEN</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Exact address revealed only after QR scan at pickup location</div>
                </div>
                <Timeline items={[
                  { icon: '✓', title: 'Order Accepted', time: '', status: 'done' },
                  { icon: '📷', title: 'Scan QR at Pickup', time: '', status: 'active', titleColor: 'var(--amber)' },
                  { icon: '🔓', title: 'Address Unlocked', time: '', status: 'pending' },
                ]} />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
