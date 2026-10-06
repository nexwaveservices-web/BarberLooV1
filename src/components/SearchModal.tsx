import React, { useState } from 'react';
import { X, Search as SearchIcon, ArrowRight, Star } from 'lucide-react';
import { STORE_PRODUCTS, StoreProduct } from '../data/minimogStoreData';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: StoreProduct) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const results = query.trim()
    ? STORE_PRODUCTS.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
      )
    : STORE_PRODUCTS.slice(0, 4);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-20 p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Search Input Bar */}
        <div className="relative flex items-center p-4 border-b border-gray-100">
          <SearchIcon className="w-5 h-5 text-gray-400 ml-2" />
          <input
            type="text"
            autoFocus
            placeholder="Search products, categories, styles (e.g. backpack, sneakers, watch)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2 text-base text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Results */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {query.trim() ? `Search Results (${results.length})` : 'Popular Searches'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  onSelectProduct(product);
                  onClose();
                }}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/20 cursor-pointer transition-all group"
              >
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-14 h-14 object-cover rounded-md bg-gray-50 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-[#2D6A4F] transition-colors">
                    {product.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-gray-900">
                      ${product.price.toFixed(2)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-[11px] text-gray-400 line-through">
                        ${product.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 mt-0.5">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span className="text-[10px] text-gray-500 font-medium">
                      {product.rating}.0 ({product.reviewCount})
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#2D6A4F] group-hover:translate-x-0.5 transition-all mr-1" />
              </div>
            ))}
          </div>

          {results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No products matched "{query}".</p>
              <p className="text-xs text-gray-400 mt-1">Try searching for "backpack", "sneakers", "watch", or "sunglasses".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
