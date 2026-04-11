import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import Chip from '../../components/Chip';
import { orderService } from '../../services/orderService';
import { useAuth } from '../../contexts/AuthContext';
import { usePolling } from '../../hooks/usePolling';
import { Order } from '../../types';
import {
  ACTIVE_ORDER_STATUSES,
  customerSimpleStageIndex,
  CUSTOMER_SIMPLE_STEPS,
  statusLabel,
  toCustomerSimpleStage,
} from '../../utils/status';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  usePolling(
    () => orderService.list(),
    6000,
    (data) => setOrders(data.filter((o) => o.status !== 'cancelled')),
  );

  const activeOrder = orders.find((o) => ACTIVE_ORDER_STATUSES.includes(o.status)) || null;
  const activeStage = activeOrder ? toCustomerSimpleStage(activeOrder.status) : null;
  const activeStageIndex = activeOrder ? customerSimpleStageIndex(activeOrder.status) : -1;

  const statusChip = (status: Order['status']) => {
    switch (status) {
      case 'delivered':
        return <Chip type="delivered">Delivered</Chip>;
      case 'picked_up':
      case 'in_transit':
        return <Chip type="transit">Picked Up</Chip>;
      case 'pending':
      case 'confirmed':
      case 'preparing':
      case 'ready':
        return <Chip type="pending">Restaurant Accepted</Chip>;
      default:
        return <Chip type="pending">{statusLabel(status)}</Chip>;
    }
  };

  return (
    <>
      <TopBar title={`Hi, ${user?.name || 'Customer'}`} subtitle="Basic order updates only" />
      <div className="content">
        {!activeOrder ? (
          <Panel title="No Active Order">
            <div style={{ padding: 20 }}>
              <div style={{ color: 'var(--text2)', marginBottom: 14 }}>You do not have an active order right now.</div>
              <button className="btn btn-primary" onClick={() => navigate('/customer/order')}>Order Food</button>
            </div>
          </Panel>
        ) : (
          <div className="two-col">
            <Panel title="Current Order" action={statusChip(activeOrder.status)}>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                  ORDER #{activeOrder.order_number}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                  {activeOrder.items?.[0]?.food_item_name || 'Food Order'}
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14 }}>
                  ETA: {activeOrder.eta_minutes} min
                </div>
                <button className="btn btn-ghost" onClick={() => navigate('/customer/track')}>Open Tracking</button>
              </div>
            </Panel>

            <Panel title="Order Status">
              <div style={{ padding: 20 }}>
                <div className="checklist">
                  {CUSTOMER_SIMPLE_STEPS.map((step, index) => {
                    const state = index < activeStageIndex ? 'done' : index === activeStageIndex ? 'active' : 'pending';
                    return (
                      <div key={step.key} className={`checklist-item ${state}`}>
                        <div className="checklist-text">
                          <div className="checklist-title">{step.label}</div>
                          <div className="checklist-sub">
                            {index < activeStageIndex ? 'Completed' : index === activeStageIndex ? 'Current' : 'Pending'}
                          </div>
                        </div>
                        <div className="checklist-status">{step.key === activeStage ? 'Now' : index < activeStageIndex ? 'Done' : 'Next'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
