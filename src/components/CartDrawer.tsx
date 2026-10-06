import React, { useState } from 'react';
import { X, Plus, Minus, Trash2, ArrowRight, ShieldCheck, Tag, ShoppingBag, Check } from 'lucide-react';
import { CartItem } from '../data/minimogStoreData';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>('SPRING30');
  const [promoError, setPromoError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  if (!isOpen) return null;

  const rawSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const discountPercent = appliedPromo === 'SPRING30' ? 0.3 : appliedPromo ? 0.1 : 0;
  const discountAmount = rawSubtotal * discountPercent;
  const subtotalAfterDiscount = rawSubtotal - discountAmount;

  const freeShippingThreshold = 50.0;
  const shipping = subtotalAfterDiscount >= freeShippingThreshold || subtotalAfterDiscount === 0 ? 0 : 7.99;
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotalAfterDiscount);
  const freeShippingProgress = Math.min(
    100,
    (subtotalAfterDiscount / freeShippingThreshold) * 100
  );

  const total = subtotalAfterDiscount + shipping;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (code === 'SPRING30' || code === 'WELCOME10') {
      setAppliedPromo(code);
      setPromoCode('');
    } else {
      setPromoError('Invalid coupon code. Try SPRING30 for 30% off.');
    }
  };

  const handleStartCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      setCheckoutComplete(true);
      onCheckout();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#2D6A4F]" />
            <h2 className="font-semibold text-lg text-gray-900">
              Shopping Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Meter */}
        <div className="bg-[#F8F9FA] px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-gray-700">
            {amountToFreeShipping === 0 ? (
              <span className="text-[#2D6A4F] flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Congratulations! You got FREE Shipping!
              </span>
            ) : (
              <span>
                Add <strong className="text-gray-900">${amountToFreeShipping.toFixed(2)}</strong> more to get <strong className="text-[#2D6A4F]">FREE SHIPPING</strong>
              </span>
            )}
            <span className="text-gray-500">{Math.round(freeShippingProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#2D6A4F] h-full transition-all duration-500 rounded-full"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {checkoutComplete ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-100 text-[#2D6A4F] rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Order Confirmed!</h3>
              <p className="text-sm text-gray-600 mb-6">
                Thank you for your purchase. We have received your order and are preparing it for shipment.
              </p>
              <button
                onClick={() => {
                  setCheckoutComplete(false);
                  onClose();
                }}
                className="px-6 py-2.5 bg-[#2D6A4F] text-white rounded-md text-sm font-medium hover:bg-[#24543E] transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">Your cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">Discover our trending products and elevate your lifestyle.</p>
              <button
                onClick={onClose}
                className="mt-6 px-5 py-2.5 bg-[#2D6A4F] text-white rounded-md text-xs font-semibold uppercase tracking-wider hover:bg-[#24543E] transition-colors"
              >
                Shop Trending
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <img
                  src={item.product.image}
                  alt={item.product.title}
                  className="w-20 h-20 object-cover rounded-md bg-gray-50 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {item.product.title}
                    </h4>
                    <button
                      onClick={() => onRemoveItem(item.product.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.selectedColor || 'Standard'} {item.selectedSize ? `· ${item.selectedSize}` : ''}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-gray-200 rounded-md">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 text-xs font-semibold text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Summary */}
        {cart.length > 0 && !checkoutComplete && (
          <div className="p-5 border-t border-gray-100 bg-[#FAFAFA] space-y-3">
            {/* Promo code */}
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Promo Code (SPRING30)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-[#2D6A4F] bg-white uppercase font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-md hover:bg-gray-800 transition-colors"
              >
                Apply
              </button>
            </form>

            {appliedPromo && (
              <div className="flex items-center justify-between text-xs bg-emerald-50 text-[#2D6A4F] px-2.5 py-1 rounded border border-emerald-200">
                <span className="font-medium">Coupon {appliedPromo} applied (30% OFF)</span>
                <button
                  type="button"
                  onClick={() => setAppliedPromo(null)}
                  className="text-emerald-700 hover:underline font-bold text-xs"
                >
                  Remove
                </button>
              </div>
            )}

            {promoError && (
              <p className="text-xs text-red-600">{promoError}</p>
            )}

            {/* Price Calculations */}
            <div className="space-y-1.5 text-xs text-gray-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-gray-900 font-medium">${rawSubtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#2D6A4F]">
                  <span>Discount ({Math.round(discountPercent * 100)}%)</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span className="text-gray-900 font-medium">
                  {shipping === 0 ? <strong className="text-[#2D6A4F]">FREE</strong> : `$${shipping.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Action */}
            <button
              onClick={handleStartCheckout}
              disabled={isCheckingOut}
              className="w-full py-3 bg-[#2D6A4F] text-white text-sm font-semibold rounded-md shadow-sm hover:bg-[#24543E] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-75"
            >
              {isCheckingOut ? (
                <span>Processing Order...</span>
              ) : (
                <>
                  <span>Checkout Now · ${total.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
              <span>Guaranteed safe & secure checkout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
