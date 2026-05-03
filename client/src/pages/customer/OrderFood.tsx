import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Chip from '../../components/Chip';
import LocationPicker from '../../components/LocationPicker';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { usePolling } from '../../hooks/usePolling';
import { orderService } from '../../services/orderService';
import { FoodItem, Order } from '../../types';
import { restaurantService, RestaurantWithMenu } from '../../services/restaurantService';
import { GeoPoint, isPointWithinRadius } from '../../utils/fleetSimulation';
import {
  ACTIVE_ORDER_STATUSES,
  CUSTOMER_SIMPLE_STEPS,
  toCustomerSimpleStage,
} from '../../utils/status';

const AREA_CENTER: GeoPoint = { lat: 17.4369, lng: 78.4001 };
const AREA_RADIUS_M = 5 * 1000;
const NEARBY_RADIUS_KM = 3;

function orderStatusChip(status: Order['status']) {
  switch (status) {
    case 'delivered': return <Chip type="delivered">Delivered</Chip>;
    case 'picked_up': case 'in_transit': return <Chip type="transit">Picked Up</Chip>;
    case 'pending': return <Chip type="pending">Order Placed</Chip>;
    default: return <Chip type="pending">Restaurant Accepted</Chip>;
  }
}

interface FoodItemWithMeta extends FoodItem {
  _restaurant_name: string;
  _restaurant_rating: string;
  _dist_m?: number;
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    biryani: '🍛', pizza: '🍕', burgers: '🍔', noodles: '🍜',
    ice_cream: '🍦', healthy: '🥗', drinks: '🥤', default: '🍽️',
  };
  return map[category.toLowerCase()] || map.default;
}

export default function OrderFood() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cartRef = useRef<HTMLElement | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<RestaurantWithMenu[]>([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<RestaurantWithMenu[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const { addItem, count, items: cartItems, clearCart, total, updateQuantity } = useCart();

  useEffect(() => {
    const saved = localStorage.getItem('userLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GeoPoint;
        if (parsed.lat && parsed.lng) {
          setUserLocation(parsed);
        }
      } catch {
        localStorage.removeItem('userLocation');
      }
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
      localStorage.setItem('userLocation', JSON.stringify(userLocation));
    } else {
      localStorage.removeItem('userLocation');
    }
  }, [userLocation]);

  usePolling(
    () => orderService.list(),
    7000,
    (data) => setOrders(data.filter((o) => o.status !== 'cancelled')),
  );

  useEffect(() => {
    setLoading(true);
    restaurantService.getZone({ radius_km: 5, limit: 500 }).then((data) => {
      setAllRestaurants(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    restaurantService.getNearby({
      lat: userLocation.lat,
      lng: userLocation.lng,
      radius_km: NEARBY_RADIUS_KM,
    }).then((data) => {
      setNearbyRestaurants(data);
    });
  }, [userLocation]);

  const activeOrder = useMemo(
    () => orders.find((o) => ACTIVE_ORDER_STATUSES.includes(o.status)) || null,
    [orders],
  );

  const activeOrderStageLabel = useMemo(() => {
    if (!activeOrder) return '';
    const stage = toCustomerSimpleStage(activeOrder.status);
    return CUSTOMER_SIMPLE_STEPS.find((s) => s.key === stage)?.label || 'Order in progress';
  }, [activeOrder]);

  const handleLocationSelect = (point: GeoPoint) => {
    if (!isPointWithinRadius(point, AREA_CENTER, AREA_RADIUS_M)) {
      return;
    }
    setUserLocation(point);
  };

  const displayRestaurants = userLocation ? nearbyRestaurants : allRestaurants;

  const flatItems = useMemo<FoodItemWithMeta[]>(() => {
    const items: FoodItemWithMeta[] = [];
    for (const r of displayRestaurants) {
      for (const item of r.food_items) {
        if (!item.is_available) continue;
        items.push({
          ...item,
          _restaurant_name: r.name,
          _restaurant_rating: r.rating || '3.5',
          _dist_m: r._dist_m,
        });
      }
    }
    return items;
  }, [displayRestaurants]);

  const filteredItems = useMemo(() => {
    let result = flatItems;
    if (category !== 'all') {
      result = result.filter((i) => i.category.toLowerCase() === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i._restaurant_name.toLowerCase().includes(q),
      );
    }
    return result;
  }, [flatItems, category, search]);

  const sortedItems = useMemo(() => {
    if (userLocation) {
      return [...filteredItems].sort((a, b) => (a._dist_m || 0) - (b._dist_m || 0));
    }
    return [...filteredItems].sort(
      (a, b) => parseFloat(b._restaurant_rating) - parseFloat(a._restaurant_rating),
    );
  }, [filteredItems, userLocation]);

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    if (!userLocation) {
      setOrderError('Please select a delivery location before placing your order.');
      return;
    }
    setOrdering(true);
    setOrderError('');
    try {
      await orderService.create({
        items: cartItems.map((ci) => ({ food_item_id: ci.food_item.id, quantity: ci.quantity })),
        customer_lat: userLocation.lat,
        customer_lng: userLocation.lng,
      });
      clearCart();
      navigate('/customer/track');
    } catch (e) {
      console.error(e);
      setOrderError('Could not place your order right now. Please try again.');
    } finally {
      setOrdering(false);
    }
  };

  const firstName = user?.name?.trim().split(' ')[0] || 'there';

  const restaurantCount = displayRestaurants.length;
  const itemCount = flatItems.length;

  return (
    <>
      <TopBar title={`Hey ${firstName}`} subtitle="Discover dishes from nearby kitchens">
        <LocationPicker
          userLocation={userLocation}
          onLocationSelect={handleLocationSelect}
          compact={true}
        />
        <button
          className="btn btn-ghost hide-mobile"
          onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          🛒 Cart ({count})
        </button>
        {activeOrder && (
          <button className="btn btn-primary" onClick={() => navigate('/customer/track')}>
            Track Order
          </button>
        )}
      </TopBar>

      <div className="content customer-home">
        <section className="customer-hero">
          <div className="customer-hero-kicker">Quick delivery</div>
          <h1 className="customer-hero-title">What are you craving right now?</h1>
          <p className="customer-hero-text">
            {userLocation
              ? `Showing dishes within ${NEARBY_RADIUS_KM}km of your location.`
              : 'Browse all dishes in your area — sorted by top rated.'}
          </p>

          <div className="customer-search">
            <span>🔎</span>
            <input
              placeholder="Search by dish or restaurant name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="customer-hero-stats">
            <div className="customer-hero-stat">
              <div className="customer-hero-stat-value">{itemCount}</div>
              <div className="customer-hero-stat-label">Dishes Available</div>
            </div>
            <div className="customer-hero-stat">
              <div className="customer-hero-stat-value">{restaurantCount}</div>
              <div className="customer-hero-stat-label">Restaurants</div>
            </div>
            <div className="customer-hero-stat">
              <div className="customer-hero-stat-value">{count}</div>
              <div className="customer-hero-stat-label">Items In Cart</div>
            </div>
          </div>
        </section>

        {activeOrder && (
          <section className="customer-active-order-banner">
            <div>
              <div className="customer-active-order-title">Your order is in progress</div>
              <div className="customer-active-order-meta">
                Order #{activeOrder.order_number} · {activeOrderStageLabel} · ETA {activeOrder.eta_minutes} min
              </div>
            </div>
            <div className="customer-active-order-actions">
              {orderStatusChip(activeOrder.status)}
              <button className="btn btn-primary" onClick={() => navigate('/customer/track')}>Open Tracking</button>
            </div>
          </section>
        )}

        <section className="customer-category-row">
          {[
            { key: 'all', label: 'All', emoji: '✨' },
            { key: 'biryani', label: 'Biryani', emoji: '🍛' },
            { key: 'pizza', label: 'Pizza', emoji: '🍕' },
            { key: 'burgers', label: 'Burgers', emoji: '🍔' },
            { key: 'noodles', label: 'Noodles', emoji: '🍜' },
            { key: 'ice_cream', label: 'Ice Cream', emoji: '🍦' },
            { key: 'healthy', label: 'Healthy', emoji: '🥗' },
            { key: 'drinks', label: 'Drinks', emoji: '🥤' },
          ].map((cat) => (
            <button
              key={cat.key}
              className={`category-chip ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </section>

        <div className="customer-home-layout">
          <section>
            {loading ? (
              <div className="customer-loading">Finding dishes for you...</div>
            ) : sortedItems.length === 0 ? (
              <div className="customer-empty-state">
                <div className="customer-empty-title">No dishes found</div>
                <div className="customer-empty-sub">Try a different search or category</div>
                <button className="btn btn-ghost" onClick={() => { setCategory('all'); setSearch(''); }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="customer-food-grid">
                {sortedItems.map((item) => {
                  const cartLine = cartItems.find((c) => c.food_item.id === item.id);
                  const qty = cartLine?.quantity || 0;
                  const distLabel =
                    item._dist_m != null
                      ? item._dist_m < 1000
                        ? `${Math.round(item._dist_m)}m`
                        : `${(item._dist_m / 1000).toFixed(1)}km`
                      : null;

                  return (
                    <div key={item.id} className="customer-food-card">
                      <div className="customer-food-image-wrap">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`customer-food-no-image ${item.image_url ? 'hidden' : ''}`}>
                          {item.emoji || getCategoryEmoji(item.category)}
                        </div>
                        <div className="customer-food-image-overlay" />
                        {item.rating != null && (
                          <div className="customer-food-rating-badge">
                            ⭐ {item.rating.toFixed(1)}
                          </div>
                        )}
                        {distLabel && (
                          <div className="customer-food-distance">{distLabel}</div>
                        )}
                        {item.tag && (
                          <div className="customer-food-tag">{item.tag}</div>
                        )}
                      </div>
                      <div className="customer-food-body">
                        <div className="customer-food-topline">
                          <span className="customer-food-restaurant">{item._restaurant_name}</span>
                          <span className="customer-food-time">{item.prep_time_minutes} min</span>
                        </div>
                        <div className="customer-food-name">{item.name}</div>
                        <div className="customer-food-description">{item.description || ''}</div>
                        <div className="customer-food-footer">
                          <div>
                            <div className="customer-food-price">₹{item.price}</div>
                            {item.category && (
                              <div className="customer-food-category">
                                {item.category.replace(/_/g, ' ')}
                              </div>
                            )}
                          </div>
                          <div className="customer-food-action">
                            {qty === 0 ? (
                              <button
                                className="btn-add small"
                                onClick={() => { addItem(item); setOrderError(''); }}
                              >
                                + Add
                              </button>
                            ) : (
                              <div className="customer-qty-stepper small">
                                <button onClick={() => updateQuantity(item.id, qty - 1)}>-</button>
                                <span>{qty}</span>
                                <button onClick={() => updateQuantity(item.id, qty + 1)}>+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="customer-cart-panel" ref={cartRef}>
            <div className="customer-cart-head">
              <h3>Your Cart</h3>
              <span>{count} item{count === 1 ? '' : 's'}</span>
            </div>

            {cartItems.length === 0 ? (
              <div className="customer-cart-empty">
                <div className="customer-cart-empty-icon">🧺</div>
                <div className="customer-cart-empty-title">Your cart is empty</div>
                <div className="customer-cart-empty-sub">Add dishes from nearby restaurants to place your order.</div>
              </div>
            ) : (
              <>
                <div className="customer-cart-lines">
                  {cartItems.map((line) => (
                    <div key={line.food_item.id} className="customer-cart-line">
                      <div>
                        <div className="customer-cart-line-name">
                          {line.food_item.emoji} {line.food_item.name}
                        </div>
                        <div className="customer-cart-line-price">₹{line.food_item.price} each</div>
                      </div>
                      <div className="customer-qty-stepper small">
                        <button onClick={() => updateQuantity(line.food_item.id, line.quantity - 1)}>-</button>
                        <span>{line.quantity}</span>
                        <button onClick={() => updateQuantity(line.food_item.id, line.quantity + 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {orderError && <div className="customer-order-error">{orderError}</div>}

                <div className="customer-cart-total-row">
                  <span>Total Payable</span>
                  <strong>₹{total.toFixed(0)}</strong>
                </div>

                <button
                  className="btn btn-primary customer-place-order"
                  onClick={handlePlaceOrder}
                  disabled={ordering}
                >
                  {ordering ? 'Placing Order...' : 'Place Order'}
                </button>
                <button
                  className="btn btn-ghost customer-clear-cart"
                  onClick={() => { clearCart(); setOrderError(''); }}
                  disabled={ordering}
                >
                  Clear Cart
                </button>

                <div className="customer-cart-note">After placing your order, updates continue in Track Order.</div>
              </>
            )}
          </aside>
        </div>
      </div>

      {count > 0 && (
        <div
          className="cart-float-bar"
          onClick={() => navigate('/customer/cart')}
        >
          <div className="cart-float-count">{count} item{count !== 1 ? 's' : ''}</div>
          <div className="cart-float-label">View Cart</div>
          <div className="cart-float-total">₹{total.toFixed(0)} →</div>
        </div>
      )}
    </>
  );
}
