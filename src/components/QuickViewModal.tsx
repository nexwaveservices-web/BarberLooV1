import React, { useState } from 'react';
import { X, Star, ShoppingBag, ShieldCheck, Truck, RefreshCw, Check } from 'lucide-react';
import { StoreProduct } from '../data/minimogStoreData';

interface QuickViewModalProps {
  product: StoreProduct | null;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, quantity: number, color?: string, size?: string) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>(
    product?.colors?.[0]?.name || ''
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    product?.sizes?.[0] || ''
  );

  if (!product) return null;

  const handleAdd = () => {
    onAddToCart(product, quantity, selectedColor, selectedSize);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden z-10 grid grid-cols-1 md:grid-cols-2 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-gray-800 bg-white/80 hover:bg-white rounded-full transition-colors shadow-xs"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Image */}
        <div className="relative bg-[#F9F8F6] p-8 flex items-center justify-center">
          {product.badge && (
            <span className="absolute top-4 left-4 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-[#2D6A4F] text-white">
              {product.badge}
            </span>
          )}
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-auto max-h-[380px] object-contain drop-shadow-sm"
          />
        </div>

        {/* Product Details */}
        <div className="p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[90vh]">
          <div>
            <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
              {product.category.replace('-', ' ')}
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              {product.title}
            </h2>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex text-amber-400">
                {[...Array(product.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <span className="text-xs text-gray-500 font-medium">
                ({product.reviewCount} customer reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-2xl font-bold text-gray-900">
                ${product.price.toFixed(2)}
              </span>
              {product.originalPrice && (
                <span className="text-base text-gray-400 line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
              {product.originalPrice && (
                <span className="text-xs font-semibold text-[#2D6A4F] bg-emerald-50 px-2 py-0.5 rounded">
                  Save ${(product.originalPrice - product.price).toFixed(2)}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              {product.description}
            </p>

            {/* Color Swatches */}
            {product.colors && product.colors.length > 0 && (
              <div className="mt-5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Color: <span className="font-normal text-gray-900">{selectedColor}</span>
                </label>
                <div className="flex items-center gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        selectedColor === c.name
                          ? 'ring-2 ring-[#2D6A4F] ring-offset-2 scale-110'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {selectedColor === c.name && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Options */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mt-5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Size / Option: <span className="font-normal text-gray-900">{selectedSize}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                        selectedSize === s
                          ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 mt-6 space-y-4">
            {/* Quantity and Add to Cart */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-300 rounded-md">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-gray-600 hover:text-gray-900"
                >
                  -
                </button>
                <span className="px-2 text-sm font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-gray-600 hover:text-gray-900"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 py-3 bg-[#2D6A4F] hover:bg-[#24543E] text-white text-sm font-semibold rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Cart · ${(product.price * quantity).toFixed(2)}</span>
              </button>
            </div>

            {/* Assurances */}
            <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Free Ship &gt; $50</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>30-Day Returns</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Authentic 100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
