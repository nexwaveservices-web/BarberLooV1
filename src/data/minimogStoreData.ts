export interface StoreCategory {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

export interface StoreProduct {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  badge?: 'Sale' | 'New' | 'Hot' | null;
  description: string;
  inStock: boolean;
  colors?: { name: string; hex: string }[];
  sizes?: string[];
}

export interface CartItem {
  product: StoreProduct;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export const STORE_CATEGORIES: StoreCategory[] = [
  {
    id: 'mens-fashion',
    name: "Men's Fashion",
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop&q=80',
    itemCount: 42,
  },
  {
    id: 'womens-fashion',
    name: "Women's Fashion",
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop&q=80',
    itemCount: 68,
  },
  {
    id: 'footwear',
    name: 'Footwear',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop&q=80',
    itemCount: 35,
  },
  {
    id: 'watches',
    name: 'Watches',
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&auto=format&fit=crop&q=80',
    itemCount: 24,
  },
  {
    id: 'bags',
    name: 'Bags',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=80',
    itemCount: 29,
  },
  {
    id: 'accessories',
    name: 'Accessories',
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format&fit=crop&q=80',
    itemCount: 54,
  },
  {
    id: 'home-living',
    name: 'Home & Living',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=80',
    itemCount: 38,
  },
  {
    id: 'beauty-care',
    name: 'Beauty & Care',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80',
    itemCount: 47,
  },
];

export const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: 'urban-backpack',
    title: 'Urban Backpack',
    category: 'bags',
    price: 59.0,
    originalPrice: 79.0,
    rating: 5,
    reviewCount: 128,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
    badge: 'Sale',
    description: 'Minimalist water-resistant daily backpack crafted with durable canvas, padded laptop compartment, and ergonomic shoulder straps.',
    inStock: true,
    colors: [
      { name: 'Matte Black', hex: '#1C1C1E' },
      { name: 'Olive Green', hex: '#3E4E3A' },
      { name: 'Slate Gray', hex: '#63666A' },
    ],
    sizes: ['15L Standard', '20L Pro'],
  },
  {
    id: 'minimal-white-sneakers',
    title: 'Minimal White Sneakers',
    category: 'footwear',
    price: 79.0,
    rating: 5,
    reviewCount: 96,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
    badge: null,
    description: 'Clean low-profile silhouette with premium leather finish, cushioned memory foam insole, and flexible rubber cupsole.',
    inStock: true,
    colors: [
      { name: 'Off White', hex: '#F4F1EA' },
      { name: 'Classic Tan', hex: '#C2A382' },
      { name: 'Pure White', hex: '#FFFFFF' },
    ],
    sizes: ['US 8', 'US 9', 'US 10', 'US 11'],
  },
  {
    id: 'classic-brown-watch',
    title: 'Classic Brown Watch',
    category: 'watches',
    price: 129.0,
    rating: 5,
    reviewCount: 64,
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
    badge: 'New',
    description: 'Precision Japanese quartz movement housed in brushed bronze casing with genuine vegetable-tanned leather strap.',
    inStock: true,
    colors: [
      { name: 'Tobacco Brown', hex: '#6F4E37' },
      { name: 'Midnight Black', hex: '#111113' },
    ],
    sizes: ['40mm Case', '42mm Case'],
  },
  {
    id: 'polarized-sunglasses',
    title: 'Polarized Sunglasses',
    category: 'accessories',
    price: 49.0,
    rating: 5,
    reviewCount: 82,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80',
    badge: null,
    description: '100% UV400 protective polarized lenses in timeless square tortoiseshell frames for glare reduction and crystal clarity.',
    inStock: true,
    colors: [
      { name: 'Dark Tortoise', hex: '#4A3525' },
      { name: 'Onyx Black', hex: '#1A1A1A' },
    ],
    sizes: ['Standard Fit'],
  },
  {
    id: 'hydrating-face-serum',
    title: 'Hydrating Face Serum',
    category: 'beauty-care',
    price: 24.0,
    originalPrice: 34.0,
    rating: 5,
    reviewCount: 45,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80',
    badge: 'Sale',
    description: 'Botanical hyaluronic acid and niacinamide complex formulated to deeply replenish skin moisture barrier and revive glow.',
    inStock: true,
    sizes: ['30ml / 1.0 fl oz', '50ml / 1.7 fl oz'],
  },
  {
    id: 'linen-overshirt-olive',
    title: 'Linen Workshirt in Olive',
    category: 'mens-fashion',
    price: 65.0,
    originalPrice: 85.0,
    rating: 5,
    reviewCount: 78,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
    badge: 'Sale',
    description: 'Pre-washed breathable European linen designed with reinforced chest pockets and horn buttons for effortless layering.',
    inStock: true,
    colors: [
      { name: 'Olive Drab', hex: '#556B2F' },
      { name: 'Oatmeal', hex: '#E3DAC9' },
      { name: 'Navy', hex: '#000080' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'leather-essential-tote',
    title: 'Minimalist Leather Tote',
    category: 'womens-fashion',
    price: 110.0,
    rating: 5,
    reviewCount: 52,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
    badge: 'New',
    description: 'Buttery soft full-grain Italian leather spacious day tote featuring interior brass key leash and magnetic snap closure.',
    inStock: true,
    colors: [
      { name: 'Camel Tan', hex: '#C19A6B' },
      { name: 'Ebony', hex: '#1C1C1C' },
    ],
    sizes: ['One Size'],
  },
  {
    id: 'ceramic-potted-monstera',
    title: 'Ceramic Planter & Plant',
    category: 'home-living',
    price: 38.0,
    rating: 5,
    reviewCount: 39,
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80',
    badge: null,
    description: 'Hand-thrown matte cream ceramic planter paired with healthy lush indoor foliage designed to purify living spaces.',
    inStock: true,
    sizes: ['6-inch Pot', '8-inch Pot'],
  },
];

export const INITIAL_CART: CartItem[] = [
  {
    product: STORE_PRODUCTS[0], // Urban Backpack ($59.00)
    quantity: 1,
    selectedColor: 'Matte Black',
    selectedSize: '20L Pro',
  },
  {
    product: STORE_PRODUCTS[1], // Minimal White Sneakers ($79.00)
    quantity: 1,
    selectedColor: 'Off White',
    selectedSize: 'US 9',
  },
];
