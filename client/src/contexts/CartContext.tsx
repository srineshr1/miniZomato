/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, FoodItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (food: FoodItem) => void;
  removeItem: (foodId: number) => void;
  updateQuantity: (foodId: number, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (food: FoodItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.food_item.id === food.id);
      if (existing) {
        return prev.map((i) => i.food_item.id === food.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { food_item: food, quantity: 1 }];
    });
  };

  const removeItem = (foodId: number) => setItems((prev) => prev.filter((i) => i.food_item.id !== foodId));
  const updateQuantity = (foodId: number, qty: number) => {
    if (qty <= 0) { removeItem(foodId); return; }
    setItems((prev) => prev.map((i) => i.food_item.id === foodId ? { ...i, quantity: qty } : i));
  };
  const clearCart = () => setItems([]);
  const total = items.reduce((sum, i) => sum + i.food_item.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
};
