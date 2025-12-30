---
title: 'Example: Shopping Cart'
description: Complete e-commerce shopping cart with quantity updates, discount codes, and checkout flow
keywords: example, shopping cart, e-commerce, checkout, pricing, inventory, persistence
---

# Example: Shopping Cart

Build a complete e-commerce shopping cart with quantity updates, discount codes, and checkout flow.

## Overview

This example demonstrates:

- 🛒 Cart item management
- 💰 Real-time price calculation
- 🎫 Discount code system
- 📦 Inventory tracking
- ✅ Multi-step checkout
- 💾 Cart persistence
- 🔄 Undo cart changes
- 📊 Order history

## Complete Implementation

### Type Definitions

```typescript
import { chronicle, ChronicleProxy } from '@arcmantle/chronicle';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
  category: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  addedAt: number;
}

interface DiscountCode {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase?: number;
  expiresAt?: number;
}

interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface CartState {
  items: Map<string, CartItem>;
  discountCode: DiscountCode | null;
  shippingInfo: ShippingInfo | null;
  checkoutStep: 'cart' | 'shipping' | 'payment' | 'complete';
  savedForLater: Set<string>;
}
```

### State Setup

```typescript
// Sample products
const products: Map<string, Product> = new Map([
  ['prod-1', { id: 'prod-1', name: 'Laptop', price: 999, image: '/laptop.jpg', stock: 10, category: 'Electronics' }],
  ['prod-2', { id: 'prod-2', name: 'Mouse', price: 29, image: '/mouse.jpg', stock: 50, category: 'Accessories' }],
  ['prod-3', { id: 'prod-3', name: 'Keyboard', price: 79, image: '/keyboard.jpg', stock: 30, category: 'Accessories' }],
  ['prod-4', { id: 'prod-4', name: 'Monitor', price: 299, image: '/monitor.jpg', stock: 15, category: 'Electronics' }],
]);

// Available discount codes
const discountCodes: Map<string, DiscountCode> = new Map([
  ['SAVE10', { code: 'SAVE10', type: 'percentage', value: 10 }],
  ['WELCOME20', { code: 'WELCOME20', type: 'fixed', value: 20, minPurchase: 100 }],
  ['FREESHIP', { code: 'FREESHIP', type: 'fixed', value: 15 }],
]);

// Create cart state
const cart = chronicle<CartState>({
  items: new Map(),
  discountCode: null,
  shippingInfo: null,
  checkoutStep: 'cart',
  savedForLater: new Set(),
}, {
  maxHistory: 50,
});

// Load from localStorage
const savedCart = localStorage.getItem('shopping-cart');
if (savedCart) {
  const data = JSON.parse(savedCart);
  cart.items = new Map(data.items);
  cart.discountCode = data.discountCode;
}
```

### Cart Operations

```typescript
// Add item to cart
function addToCart(productId: string, quantity = 1): boolean {
  const product = products.get(productId);
  if (!product) return false;

  const existingItem = cart.items.get(productId);
  const currentQty = existingItem?.quantity || 0;

  // Check stock
  if (currentQty + quantity > product.stock) {
    return false; // Not enough stock
  }

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.set(productId, {
      productId,
      quantity,
      addedAt: Date.now(),
    });
  }

  return true;
}

// Remove item from cart
function removeFromCart(productId: string): void {
  cart.items.delete(productId);
}

// Update item quantity
function updateQuantity(productId: string, quantity: number): boolean {
  if (quantity <= 0) {
    removeFromCart(productId);
    return true;
  }

  const product = products.get(productId);
  if (!product || quantity > product.stock) {
    return false;
  }

  const item = cart.items.get(productId);
  if (item) {
    item.quantity = quantity;
    return true;
  }

  return false;
}

// Clear entire cart
function clearCart(): void {
  chronicle.batch(cart, () => {
    cart.items.clear();
    cart.discountCode = null;
    cart.checkoutStep = 'cart';
  });
}

// Save item for later
function saveForLater(productId: string): void {
  const item = cart.items.get(productId);
  if (item) {
    cart.savedForLater.add(productId);
    removeFromCart(productId);
  }
}

// Move saved item back to cart
function moveToCart(productId: string): void {
  if (cart.savedForLater.has(productId)) {
    cart.savedForLater.delete(productId);
    addToCart(productId, 1);
  }
}
```

### Price Calculations

```typescript
// Get cart subtotal
function getSubtotal(): number {
  let total = 0;

  cart.items.forEach((item) => {
    const product = products.get(item.productId);
    if (product) {
      total += product.price * item.quantity;
    }
  });

  return total;
}

// Calculate discount amount
function getDiscountAmount(): number {
  if (!cart.discountCode) return 0;

  const subtotal = getSubtotal();
  const discount = cart.discountCode;

  // Check minimum purchase requirement
  if (discount.minPurchase && subtotal < discount.minPurchase) {
    return 0;
  }

  // Check expiration
  if (discount.expiresAt && Date.now() > discount.expiresAt) {
    return 0;
  }

  if (discount.type === 'percentage') {
    return subtotal * (discount.value / 100);
  } else {
    return discount.value;
  }
}

// Calculate shipping cost
function getShippingCost(): number {
  const subtotal = getSubtotal();

  // Free shipping over $100
  if (subtotal >= 100) return 0;

  // Flat rate shipping
  return 15;
}

// Get cart total
function getTotal(): number {
  const subtotal = getSubtotal();
  const discount = getDiscountAmount();
  const shipping = getShippingCost();

  return Math.max(0, subtotal - discount + shipping);
}

// Get savings information
function getSavings() {
  return {
    subtotal: getSubtotal(),
    discount: getDiscountAmount(),
    shipping: getShippingCost(),
    total: getTotal(),
    saved: getDiscountAmount(),
  };
}
```

### Discount Codes

```typescript
// Apply discount code
function applyDiscountCode(code: string): { success: boolean; message: string } {
  const discount = discountCodes.get(code.toUpperCase());

  if (!discount) {
    return { success: false, message: 'Invalid discount code' };
  }

  // Check expiration
  if (discount.expiresAt && Date.now() > discount.expiresAt) {
    return { success: false, message: 'This code has expired' };
  }

  // Check minimum purchase
  if (discount.minPurchase && getSubtotal() < discount.minPurchase) {
    return {
      success: false,
      message: `Minimum purchase of $${discount.minPurchase} required`,
    };
  }

  cart.discountCode = discount;
  return { success: true, message: 'Discount applied!' };
}

// Remove discount code
function removeDiscountCode(): void {
  cart.discountCode = null;
}
```

### Checkout Flow

```typescript
// Validate cart for checkout
function validateCart(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (cart.items.size === 0) {
    errors.push('Cart is empty');
  }

  // Check stock availability
  cart.items.forEach((item) => {
    const product = products.get(item.productId);
    if (!product) {
      errors.push(`Product ${item.productId} not found`);
    } else if (item.quantity > product.stock) {
      errors.push(`${product.name}: Only ${product.stock} in stock`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Move to next checkout step
function nextCheckoutStep(): boolean {
  const steps: CartState['checkoutStep'][] = ['cart', 'shipping', 'payment', 'complete'];
  const currentIndex = steps.indexOf(cart.checkoutStep);

  if (currentIndex < steps.length - 1) {
    // Validate before proceeding
    if (cart.checkoutStep === 'cart') {
      const validation = validateCart();
      if (!validation.valid) return false;
    }

    if (cart.checkoutStep === 'shipping') {
      if (!cart.shippingInfo) return false;
    }

    cart.checkoutStep = steps[currentIndex + 1];
    return true;
  }

  return false;
}

// Go back in checkout
function previousCheckoutStep(): void {
  const steps: CartState['checkoutStep'][] = ['cart', 'shipping', 'payment', 'complete'];
  const currentIndex = steps.indexOf(cart.checkoutStep);

  if (currentIndex > 0) {
    cart.checkoutStep = steps[currentIndex - 1];
  }
}

// Update shipping info
function updateShippingInfo(info: ShippingInfo): void {
  cart.shippingInfo = info;
}

// Complete purchase
async function completePurchase(paymentInfo: any): Promise<boolean> {
  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Deduct from inventory
    chronicle.batch(cart, () => {
      cart.items.forEach((item) => {
        const product = products.get(item.productId);
        if (product) {
          product.stock -= item.quantity;
        }
      });

      cart.checkoutStep = 'complete';
    });

    // Save order to history
    saveOrder();

    return true;
  } catch (error) {
    return false;
  }
}
```

### Persistence

```typescript
// Auto-save cart to localStorage
chronicle.on(cart, '', () => {
  const data = {
    items: Array.from(cart.items.entries()),
    discountCode: cart.discountCode,
  };
  localStorage.setItem('shopping-cart', JSON.stringify(data));
}, { mode: 'down', debounceMs: 500 });

// Save completed order
function saveOrder(): void {
  const order = {
    id: crypto.randomUUID(),
    items: Array.from(cart.items.entries()),
    total: getTotal(),
    discountCode: cart.discountCode,
    shippingInfo: cart.shippingInfo,
    timestamp: Date.now(),
  };

  const orders = JSON.parse(localStorage.getItem('order-history') || '[]');
  orders.push(order);
  localStorage.setItem('order-history', JSON.stringify(orders));

  // Clear cart after order
  clearCart();
}

// Get order history
function getOrderHistory() {
  return JSON.parse(localStorage.getItem('order-history') || '[]');
}
```

## UI Integration

### React Example

```typescript
import { useEffect, useState } from 'react';

function ShoppingCart() {
  const [, forceUpdate] = useState({});
  const [discountInput, setDiscountInput] = useState('');

  useEffect(() => {
    const unsubscribe = chronicle.on(cart, '', () => {
      forceUpdate({});
    }, { mode: 'down' });

    return unsubscribe;
  }, []);

  const savings = getSavings();
  const validation = validateCart();

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({cart.items.size} items)</h2>

      {/* Cart Items */}
      <div className="cart-items">
        {Array.from(cart.items.entries()).map(([productId, item]) => {
          const product = products.get(productId);
          if (!product) return null;

          return (
            <div key={productId} className="cart-item">
              <img src={product.image} alt={product.name} />

              <div className="item-details">
                <h3>{product.name}</h3>
                <p className="price">${product.price.toFixed(2)}</p>
                {item.quantity > product.stock && (
                  <p className="error">Only {product.stock} in stock</p>
                )}
              </div>

              <div className="quantity-controls">
                <button
                  onClick={() => updateQuantity(productId, item.quantity - 1)}
                >
                  -
                </button>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(productId, parseInt(e.target.value) || 0)}
                  min={1}
                  max={product.stock}
                />
                <button
                  onClick={() => updateQuantity(productId, item.quantity + 1)}
                  disabled={item.quantity >= product.stock}
                >
                  +
                </button>
              </div>

              <div className="item-total">
                ${(product.price * item.quantity).toFixed(2)}
              </div>

              <div className="item-actions">
                <button onClick={() => saveForLater(productId)}>
                  Save for later
                </button>
                <button onClick={() => removeFromCart(productId)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saved for Later */}
      {cart.savedForLater.size > 0 && (
        <div className="saved-items">
          <h3>Saved for Later</h3>
          {Array.from(cart.savedForLater).map((productId) => {
            const product = products.get(productId);
            if (!product) return null;

            return (
              <div key={productId} className="saved-item">
                <span>{product.name}</span>
                <button onClick={() => moveToCart(productId)}>
                  Move to cart
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Discount Code */}
      <div className="discount-section">
        {cart.discountCode ? (
          <div className="active-discount">
            <span>Discount: {cart.discountCode.code}</span>
            <button onClick={removeDiscountCode}>Remove</button>
          </div>
        ) : (
          <div className="discount-input">
            <input
              type="text"
              placeholder="Enter discount code"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
            />
            <button
              onClick={() => {
                const result = applyDiscountCode(discountInput);
                if (result.success) {
                  setDiscountInput('');
                }
                alert(result.message);
              }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>${savings.subtotal.toFixed(2)}</span>
        </div>

        {savings.discount > 0 && (
          <div className="summary-row discount">
            <span>Discount:</span>
            <span>-${savings.discount.toFixed(2)}</span>
          </div>
        )}

        <div className="summary-row">
          <span>Shipping:</span>
          <span>{savings.shipping === 0 ? 'FREE' : `$${savings.shipping.toFixed(2)}`}</span>
        </div>

        <div className="summary-row total">
          <span>Total:</span>
          <span>${savings.total.toFixed(2)}</span>
        </div>

        {savings.saved > 0 && (
          <div className="savings-badge">
            You saved ${savings.saved.toFixed(2)}!
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="cart-actions">
        <button
          onClick={() => chronicle.undo(cart)}
          disabled={!chronicle.canUndo(cart)}
        >
          Undo Last Change
        </button>

        <button onClick={clearCart} disabled={cart.items.size === 0}>
          Clear Cart
        </button>

        <button
          onClick={nextCheckoutStep}
          disabled={!validation.valid}
          className="checkout-button"
        >
          Proceed to Checkout
        </button>
      </div>

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="errors">
          {validation.errors.map((error, i) => (
            <p key={i} className="error">{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Key Features Demonstrated

### 1. Real-time Price Updates

Prices update automatically when quantities or discounts change:

```typescript
chronicle.on(cart, '', () => {
  updatePriceDisplay(getSavings());
}, { mode: 'down', debounceMs: 100 });
```

### 2. Inventory Management

Stock levels update and validate:

```typescript
addToCart('prod-1', 5); // ✓ Works if stock available
addToCart('prod-1', 100); // ✗ Fails if exceeds stock
```

### 3. Undo Cart Changes

Accidentally removed an item?

```typescript
removeFromCart('prod-1');
chronicle.undo(cart); // Item restored!
```

## Testing

```typescript
describe('Shopping Cart', () => {
  beforeEach(() => {
    clearCart();
  });

  it('should add items to cart', () => {
    expect(addToCart('prod-1', 2)).toBe(true);
    expect(cart.items.get('prod-1')?.quantity).toBe(2);
  });

  it('should calculate total correctly', () => {
    addToCart('prod-1', 1); // $999
    addToCart('prod-2', 2); // $58
    expect(getSubtotal()).toBe(1057);
  });

  it('should apply discount codes', () => {
    addToCart('prod-1', 1);
    const result = applyDiscountCode('SAVE10');
    expect(result.success).toBe(true);
    expect(getDiscountAmount()).toBe(99.9); // 10% of 999
  });

  it('should validate stock limits', () => {
    expect(addToCart('prod-1', 1000)).toBe(false);
  });
});
```

## Next Steps

- [Best Practices](../best-practices) - State management patterns
- [Performance](../performance) - Optimize for scale
- [TypeScript](../typescript) - Type-safe cart operations

## Related Guides

- [History & Time-Travel](../history) - Undo cart changes
- [Snapshots](../snapshots) - Save cart state
- [Listeners](../listeners) - React to cart updates
