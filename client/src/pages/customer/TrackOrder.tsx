import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Timeline from '../../components/Timeline';
import Chip from '../../components/Chip';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { createRestaurantIcon, createCustomerIcon, createPartnerIcon } from '../../utils/mapIcons';
import { orderService } from '../../services/orderService';
import { usePolling } from '../../hooks/usePolling';
import { useSocket } from '../../contexts/SocketContext';
import { Order } from '../../types';
import {
  ACTIVE_ORDER_STATUSES,
  CUSTOMER_SIMPLE_STEPS,
  customerSimpleStageIndex,
  statusLabel,
  toCustomerSimpleStage,
} from '../../utils/status';

function statusChip(status: Order['status']) {
  switch (status) {
    case 'delivered':
      return <Chip type="delivered">Delivered</Chip>;
    case 'picked_up':
    case 'in_transit':
      return <Chip type="transit">Picked Up</Chip>;
    case 'pending':
      return <Chip type="pending">Order Placed</Chip>;
    case 'confirmed':
    case 'preparing':
    case 'ready':
      return <Chip type="pending">Restaurant Accepted</Chip>;
    default:
      return <Chip type="pending">{statusLabel(status)}</Chip>;
  }
}

export default function TrackOrder() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const { orderUpdate, partnerLocation, joinTracking } = useSocket();

  usePolling(
    () => orderService.list(),
    6000,
    (data) => setOrders(data.filter((o) => o.status !== 'cancelled')),
  );

  useEffect(() => {
    if (!orderUpdate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrders((prev) =>
      prev
        .map((o) =>
          o.id === orderUpdate.order_id
            ? { ...o, status: orderUpdate.status as Order['status'], partner_id: orderUpdate.partner_id ?? o.partner_id }
            : o
        )
        .filter((o) => o.status !== 'cancelled')
    );
  }, [orderUpdate]);

  const activeOrder = useMemo(
    () =>
      orders.find((o) => ACTIVE_ORDER_STATUSES.includes(o.status)) ||
      orders.find((o) => o.status === 'delivered') ||
      null,
    [orders],
  );

  useEffect(() => {
    if (activeOrder) {
      joinTracking(activeOrder.id);
    }
  }, [activeOrder, joinTracking]);

  const stageIndex = activeOrder ? customerSimpleStageIndex(activeOrder.status) : -1;
  const stageLabel = activeOrder
    ? CUSTOMER_SIMPLE_STEPS[stageIndex]?.label || 'Order in progress'
    : '';
  const progressPct = activeOrder
    ? Math.max(0, Math.round((stageIndex / (CUSTOMER_SIMPLE_STEPS.length - 1)) * 100))
    : 0;

  const livePartnerPoint = useMemo(() => {
    if (activeOrder?.status !== 'in_transit' || !partnerLocation) return null;
    if (activeOrder.partner_id && partnerLocation.partner_id !== activeOrder.partner_id) return null;
    return { lat: partnerLocation.lat, lng: partnerLocation.lng };
  }, [activeOrder, partnerLocation]);

  const timelineItems = useMemo(() => {
    if (!activeOrder) return [];

    const stage = toCustomerSimpleStage(activeOrder.status);

    return CUSTOMER_SIMPLE_STEPS.map((step, index) => {
      const itemStatus = index < stageIndex ? 'done' : index === stageIndex ? 'active' : 'pending';
      return {
        icon: itemStatus === 'done' ? '✓' : itemStatus === 'active' ? '•' : '○',
        title: step.label,
        time: index === stageIndex ? `Current: ${step.label}` : index < stageIndex ? 'Completed' : 'Pending',
        status: itemStatus,
        titleColor: step.key === stage ? 'var(--amber)' : undefined,
      } as const;
    });
  }, [activeOrder, stageIndex]);

  return (
    <>
      <TopBar
        title="Track Order"
        subtitle={activeOrder ? `Order #${activeOrder.order_number}` : 'No active order to track'}
      >
        <button className="btn btn-ghost" onClick={() => navigate('/customer/order')}>
          Order More
        </button>
      </TopBar>

      <div className="content customer-track-page">
        {!activeOrder ? (
          <section className="customer-track-empty">
            <div className="customer-track-empty-icon">🛵</div>
            <h2>No order in progress</h2>
            <p>Place an order and you will see accepted, picked-up, and delivered updates here.</p>
            <button className="btn btn-primary" onClick={() => navigate('/customer/order')}>
              Order Food
            </button>
          </section>
        ) : (
          <>
            <section className="customer-track-hero">
              <div>
                <div className="customer-track-hero-kicker">Live order progress</div>
                <div className="customer-track-hero-title">
                  {activeOrder.items?.[0]?.food_item_name || 'Your order is being prepared'}
                </div>
                <div className="customer-track-hero-meta">
                  {stageLabel} · ETA {activeOrder.eta_minutes} min
                </div>
              </div>
              <div className="customer-track-hero-right">
                {statusChip(activeOrder.status)}
                <div className="customer-track-eta">{activeOrder.eta_minutes}m</div>
              </div>
              <div className="customer-track-progress">
                <div className="customer-track-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </section>

            {livePartnerPoint && (
              <section className="customer-track-map-section">
                <div className="customer-track-map-header">
                  <span>🛵 Your delivery partner is on the way</span>
                  <span className="live-dot" />
                </div>
                <div className="map-container" style={{ height: 200, borderRadius: 12, overflow: 'hidden' }}>
                  <MapContainer
                    center={[livePartnerPoint.lat, livePartnerPoint.lng]}
                    zoom={14}
                    className="map-real"
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {activeOrder.restaurant_lat && activeOrder.restaurant_lng && (
                      <Marker
                        position={[activeOrder.restaurant_lat, activeOrder.restaurant_lng]}
                        icon={createRestaurantIcon()}
                      >
                        <Popup>Restaurant</Popup>
                      </Marker>
                    )}
                    {activeOrder.customer_lat && activeOrder.customer_lng && (
                      <Marker
                        position={[activeOrder.customer_lat, activeOrder.customer_lng]}
                        icon={createCustomerIcon()}
                      >
                        <Popup>Your Location</Popup>
                      </Marker>
                    )}
                    <Marker
                      position={[livePartnerPoint.lat, livePartnerPoint.lng]}
                      icon={createPartnerIcon('busy')}
                    >
                      <Popup>Delivery Partner</Popup>
                    </Marker>
                    {activeOrder.restaurant_lat && activeOrder.restaurant_lng && (
                      <Polyline
                        positions={[
                          [livePartnerPoint.lat, livePartnerPoint.lng],
                          [activeOrder.customer_lat ?? livePartnerPoint.lat, activeOrder.customer_lng ?? livePartnerPoint.lng],
                        ]}
                        pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '6 6' }}
                      />
                    )}
                  </MapContainer>
                </div>
              </section>
            )}

            <div className="customer-track-layout">
              <section className="customer-track-card">
                <div className="customer-track-card-head">
                  <h3>Delivery Timeline</h3>
                  <span>{progressPct}% complete</span>
                </div>
                <Timeline items={timelineItems} />
              </section>

              <section className="customer-track-card">
                <div className="customer-track-card-head">
                  <h3>Order Details</h3>
                  {statusChip(activeOrder.status)}
                </div>

                <div className="customer-track-items">
                  {(activeOrder.items || []).map((item) => (
                    <div key={item.id} className="customer-track-item-row">
                      <div className="customer-track-item-emoji">
                        {item.food_item_emoji || '🍽️'}
                      </div>
                      <div>
                        <div className="customer-track-item-name">
                          {item.food_item_name || `Item #${item.food_item_id}`}
                        </div>
                        <div className="customer-track-item-meta">x{item.quantity} · ₹{item.unit_price}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="customer-track-divider" />

                <div className="customer-track-meta-row">
                  <span>Delivery Address</span>
                  <strong>{activeOrder.customer_address || '-'}</strong>
                </div>
                {activeOrder.customer_landmark && (
                  <div className="customer-track-meta-row">
                    <span>Landmark</span>
                    <strong>{activeOrder.customer_landmark}</strong>
                  </div>
                )}
                <div className="customer-track-meta-row">
                  <span>Total Paid</span>
                  <strong>₹{activeOrder.total_amount}</strong>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
