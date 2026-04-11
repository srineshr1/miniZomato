import { OrderStatus } from '../types';

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'in_transit',
];

export const DELIVERY_ACTIVE_STATUSES: OrderStatus[] = [
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'in_transit',
];

export const CUSTOMER_PROGRESS_STEPS = [
  { status: 'pending' as OrderStatus, label: 'Order placed' },
  { status: 'confirmed' as OrderStatus, label: 'Confirmed' },
  { status: 'preparing' as OrderStatus, label: 'Preparing' },
  { status: 'ready' as OrderStatus, label: 'Ready for pickup' },
  { status: 'picked_up' as OrderStatus, label: 'Picked up' },
  { status: 'in_transit' as OrderStatus, label: 'On the way' },
  { status: 'delivered' as OrderStatus, label: 'Delivered' },
];

export const CUSTOMER_SIMPLE_STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'accepted', label: 'Restaurant Accepted' },
  { key: 'picked', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
] as const;

export type CustomerSimpleStage = (typeof CUSTOMER_SIMPLE_STEPS)[number]['key'];

export function toCustomerSimpleStage(status: OrderStatus): CustomerSimpleStage {
  switch (status) {
    case 'pending':
      return 'placed';
    case 'confirmed':
    case 'preparing':
    case 'ready':
      return 'accepted';
    case 'picked_up':
    case 'in_transit':
      return 'picked';
    case 'delivered':
      return 'delivered';
    default:
      return 'placed';
  }
}

export function customerSimpleStageIndex(status: OrderStatus): number {
  const stage = toCustomerSimpleStage(status);
  return CUSTOMER_SIMPLE_STEPS.findIndex((step) => step.key === stage);
}

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      return 'Ready';
    case 'picked_up':
      return 'Picked Up';
    case 'in_transit':
      return 'In Transit';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function orderProgressPercent(status: OrderStatus): number {
  const current = CUSTOMER_PROGRESS_STEPS.findIndex((step) => step.status === status);
  if (current === -1) return 0;
  return Math.round((current / (CUSTOMER_PROGRESS_STEPS.length - 1)) * 100);
}

export function isOrderTrackable(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}
