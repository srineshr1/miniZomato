export interface User {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'delivery' | 'admin';
  phone: string | null;
  avatar_initial: string;
  is_active: boolean;
}

export type UserRole = 'customer' | 'delivery' | 'admin';

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  phone: string | null;
  avatar_initial: string;
  is_active: boolean;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: UserRole;
  name: string;
}

export interface FoodItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  category: string;
  emoji: string;
  tag: string | null;
  is_available: boolean;
  is_priority: boolean;
  priority_reason: string | null;
  prep_time_minutes: number;
  restaurant_name: string | null;
  restaurant_area: string | null;
  image_gradient: string;
  rating?: number;
  image_url?: string;
}

export interface OrderItemOut {
  id: number;
  food_item_id: number;
  quantity: number;
  unit_price: number;
  food_item_name?: string;
  food_item_emoji?: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  partner_id: number | null;
  status: OrderStatus;
  priority: number;
  priority_reason: string | null;
  total_amount: number;
  delivery_fee: number;
  distance_km: number;
  eta_minutes: number;
  customer_address: string | null;
  customer_landmark: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  restaurant_lat: number | null;
  restaurant_lng: number | null;
  confirmed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  items: OrderItemOut[];
}

export interface DeliveryPartner {
  id: number;
  user_id: number;
  vehicle_number: string | null;
  current_lat: number | null;
  current_lng: number | null;
  status: 'online' | 'offline' | 'busy';
  safety_score: number;
  rating: number;
  total_deliveries: number;
  helmet_detected: boolean;
  camera_active: boolean;
}

export interface Violation {
  id: number;
  partner_id: number;
  partner_name?: string;
  type: 'speed' | 'helmet' | 'camera';
  severity: 'warning' | 'penalty' | 'review';
  detail: string | null;
  speed_recorded: number | null;
  speed_limit: number | null;
  offense_count: number;
  resolved: boolean;
  created_at: string;
}

export interface RouteStop {
  order_id: number;
  order_number: string;
  food_name: string;
  food_emoji: string;
  priority: number;
  priority_reason: string | null;
  stop_type: 'pickup' | 'dropoff';
  distance_km: number;
  lat: number | null;
  lng: number | null;
}

export interface OptimizedRoute {
  stops: RouteStop[];
  total_distance_km: number;
  estimated_minutes: number;
  algorithm: string;
}

export interface DashboardStats {
  total_orders: number;
  active_orders: number;
  active_partners: number;
  avg_delivery_minutes: number;
  violations_today: number;
  revenue_today: number;
  delivered_today: number;
}

export interface QRScanResult {
  success: boolean;
  order_number: string;
  customer_address: string;
  customer_landmark: string | null;
  scanned_at: string;
}

export interface QRSessionOut {
  id: number;
  order_id: number;
  token: string;
  status: 'pending' | 'scanned' | 'expired';
  address_revealed: boolean;
  scanned_at: string | null;
  expires_at: string;
}

export interface CartItem {
  food_item: FoodItem;
  quantity: number;
}
