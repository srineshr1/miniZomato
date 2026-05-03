import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import LocationPicker from '../../components/LocationPicker';
import { useCart } from '../../contexts/CartContext';
import { orderService } from '../../services/orderService';
import { GeoPoint } from '../../utils/fleetSimulation';

const DELIVERY_FEE = 30;

export default function Cart() {
  const navigate = useNavigate();
  const { items, total, count, updateQuantity, clearCart } = useCart();
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!userLocation) {
      setError('Set a delivery location first.');
      return;
    }
    setOrdering(true);
    setError('');
    try {
      await orderService.create({
        items: items.map((ci) => ({ food_item_id: ci.food_item.id, quantity: ci.quantity })),
        customer_lat: userLocation.lat,
        customer_lng: userLocation.lng,
      });
      clearCart();
      navigate('/customer/track');
    } catch {
      setError('Failed to place order. Try again.');
    } finally {
      setOrdering(false);
    }
  };

  if (items.length === 0) {
    return (
      <>
        <TopBar title="Cart" />
        <div className="content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
          <div style={{ fontSize: 56 }}>🧺</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>Cart is empty</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>Add dishes from the menu to place an order.</div>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/customer/order')}>
            Browse Menu
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Your Cart" subtitle={`${count} item${count !== 1 ? 's' : ''}`} />
      <div className="content cart-page">

        {/* Items */}
        <div className="cart-section">
          <div className="cart-section-title">Order Items</div>
          {items.map((line) => (
            <div key={line.food_item.id} className="cart-item-row">
              <div className="cart-item-emoji">{line.food_item.emoji}</div>
              <div className="cart-item-info">
                <div className="cart-item-name">{line.food_item.name}</div>
                <div className="cart-item-restaurant">{line.food_item.restaurant_name}</div>
                <div className="cart-item-price">₹{(line.food_item.price * line.quantity).toFixed(0)}</div>
              </div>
              <div className="customer-qty-stepper small">
                <button onClick={() => updateQuantity(line.food_item.id, line.quantity - 1)}>-</button>
                <span>{line.quantity}</span>
                <button onClick={() => updateQuantity(line.food_item.id, line.quantity + 1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Delivery location */}
        <div className="cart-section">
          <div className="cart-section-title">Delivery Location</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <LocationPicker
              userLocation={userLocation}
              onLocationSelect={(pt) => { setUserLocation(pt); setError(''); }}
              compact
            />
            {userLocation && (
              <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>✓ Set</span>
            )}
          </div>
          {!userLocation && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Tap above to pin your delivery location on the map.</div>
          )}
        </div>

        {/* Bill summary */}
        <div className="cart-section cart-bill">
          <div className="cart-section-title">Bill Summary</div>
          <div className="cart-bill-row">
            <span>Subtotal</span>
            <span>₹{total.toFixed(0)}</span>
          </div>
          <div className="cart-bill-row">
            <span>Delivery fee</span>
            <span>₹{DELIVERY_FEE}</span>
          </div>
          <div className="cart-bill-divider" />
          <div className="cart-bill-row cart-bill-total">
            <span>Total Payable</span>
            <span>₹{(total + DELIVERY_FEE).toFixed(0)}</span>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 0' }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, letterSpacing: 1 }}
          onClick={handlePlaceOrder}
          disabled={ordering}
        >
          {ordering ? 'Placing Order...' : `Place Order · ₹${(total + DELIVERY_FEE).toFixed(0)}`}
        </button>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--red)' }}
          onClick={() => { clearCart(); navigate('/customer/order'); }}
          disabled={ordering}
        >
          Clear Cart
        </button>

      </div>
    </>
  );
}
