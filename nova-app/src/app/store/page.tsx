'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CustomerSupportWidget } from '@/components/CustomerSupportWidget';

interface Product {
  id: string;
  name: string;
  tagline: string;
  category: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  badge?: string;
  icon: string;
}

const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Sony WH-1000XM4 Wireless Headphones',
    tagline: 'Industry-leading noise cancellation with 30-hour battery life.',
    category: 'Audio',
    price: 19990,
    originalPrice: 24990,
    rating: 4.8,
    reviewsCount: 1420,
    badge: 'Best Seller',
    icon: '🎧',
  },
  {
    id: 'prod-2',
    name: 'Kindle Paperwhite 16GB (Waterproof)',
    tagline: 'Now with a 6.8" display and adjustable warm light.',
    category: 'E-Readers',
    price: 14999,
    originalPrice: 16999,
    rating: 4.7,
    reviewsCount: 890,
    icon: '📖',
  },
  {
    id: 'prod-3',
    name: 'Nike Air Max Pulse Shoes',
    tagline: 'Point-loaded Air cushioning for high-rebound everyday comfort.',
    category: 'Footwear',
    price: 13995,
    originalPrice: 15995,
    rating: 4.6,
    reviewsCount: 310,
    icon: '👟',
  },
  {
    id: 'prod-4',
    name: 'Boat Airdopes 441 TWS Earbuds',
    tagline: 'IWP technology, IPX7 water resistance, and crystal clear bass.',
    category: 'Audio',
    price: 1299,
    originalPrice: 2999,
    rating: 4.3,
    reviewsCount: 5400,
    badge: 'Price Match Eligible',
    icon: '🎵',
  },
  {
    id: 'prod-5',
    name: 'Philips Air Fryer HD9200 (4.1L)',
    tagline: 'Rapid Air technology for up to 90% less fat cooking.',
    category: 'Home Appliances',
    price: 4999,
    originalPrice: 7995,
    rating: 4.5,
    reviewsCount: 2100,
    icon: '🍳',
  },
  {
    id: 'prod-6',
    name: 'Samsung Galaxy Buds2 Pro',
    tagline: 'Seamless 24-bit Hi-Fi sound and intelligent ANC.',
    category: 'Audio',
    price: 9999,
    originalPrice: 17999,
    rating: 4.7,
    reviewsCount: 1840,
    icon: '✨',
  },
];

const RECENT_ORDERS = [
  {
    orderId: 'ORD-78923',
    item: 'Sony WH-1000XM4 Headband Replacement / Item',
    customer: 'Priya Chauhan',
    amount: 350,
    date: 'Oct 12, 2026',
    status: 'Delivered (Defect Reported)',
    actionLabel: 'Report Defect & Refund (₹350)',
    icon: '🎧',
  },
  {
    orderId: 'ORD-45612',
    item: 'Kindle Paperwhite (Cracked Screen)',
    customer: 'Ananya Krishnan',
    amount: 14999,
    date: 'Oct 11, 2026',
    status: 'Delivered (Damaged)',
    actionLabel: 'Request Free Replacement',
    icon: '📖',
  },
  {
    orderId: 'ORD-34521',
    item: 'Nike Air Max Pulse Shoes',
    customer: 'Karthik Menon',
    amount: 13995,
    date: 'Oct 08, 2026',
    status: 'In Transit (5 Days Overdue)',
    actionLabel: 'Check Tracking Status',
    icon: '👟',
  },
  {
    orderId: 'ORD-11203',
    item: 'Boat Airdopes 441',
    customer: 'Meera Pillai',
    amount: 1299,
    date: 'Oct 14, 2026',
    status: 'Delivered',
    actionLabel: 'Claim Price Match Difference',
    icon: '🎵',
  },
];

export default function StorefrontPage() {
  const router = useRouter();
  const [cartCount, setCartCount] = useState(2);
  const [activeCategory, setActiveCategory] = useState('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredProducts =
    activeCategory === 'All'
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#221B14] font-sans antialiased selection:bg-amber-100">
      {/* JUDGE DEMO BAR */}
      <div className="bg-[#1E1812] text-amber-100 text-xs py-2 px-4 border-b border-amber-900/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono">
              Judge Showcase Demo
            </span>
            <span>
              Customer Storefront connected in real time to <strong>Nova Autonomous AI Agent</strong>.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
            >
              <span>Open Nova Agent Command Center</span>
              <span>➔</span>
            </Link>
          </div>
        </div>
      </div>

      {/* STORE HEADER */}
      <header className="sticky top-0 z-30 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#EBE3D7]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/store" className="flex items-center gap-2.5">
              <span className="text-2xl">⚡</span>
              <div>
                <span className="font-serif text-xl font-bold tracking-tight text-[#1E1812]">
                  Aura Electronics
                </span>
                <span className="text-[10px] block font-mono text-amber-700 tracking-wider uppercase font-semibold">
                  Protected by Nova Agent
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm text-stone-600 font-medium">
              <button
                onClick={() => setActiveCategory('All')}
                className={`transition-colors hover:text-stone-900 ${activeCategory === 'All' ? 'text-amber-800 font-semibold' : ''}`}
              >
                All Products
              </button>
              <button
                onClick={() => setActiveCategory('Audio')}
                className={`transition-colors hover:text-stone-900 ${activeCategory === 'Audio' ? 'text-amber-800 font-semibold' : ''}`}
              >
                Audio
              </button>
              <button
                onClick={() => setActiveCategory('E-Readers')}
                className={`transition-colors hover:text-stone-900 ${activeCategory === 'E-Readers' ? 'text-amber-800 font-semibold' : ''}`}
              >
                E-Readers
              </button>
              <button
                onClick={() => setActiveCategory('Home Appliances')}
                className={`transition-colors hover:text-stone-900 ${activeCategory === 'Home Appliances' ? 'text-amber-800 font-semibold' : ''}`}
              >
                Appliances
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-[#F2ECE0] px-3 py-1.5 rounded-full text-xs text-stone-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>24/7 AI Support Active</span>
            </div>
            <Link
              href="/store/cart"
              className="relative p-2 rounded-full hover:bg-stone-200/60 transition-colors text-stone-700"
              title="View Cart"
            >
              <span className="text-xl">🛍️</span>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-amber-600 text-white font-mono text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-12">
        <div className="bg-gradient-to-br from-[#F5EFE6] via-[#FAF5EE] to-[#EFE7DA] border border-[#E8DFC9] rounded-3xl p-8 md:p-12 shadow-sm relative overflow-hidden">
          <div className="max-w-2xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold text-amber-900">
              <span>🛡️ Autonomous Safety Guardrails Active</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1E1812] leading-[1.15]">
              Premium Tech, Guaranteed With Instant AI Resolutions.
            </h1>
            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
              Experience seamless shopping backed by <strong>Nova</strong>: our autonomous AI support specialist. Get instant refunds for defective goods, real-time replacement dispatch, and zero-hallucination policy enforcement.
            </p>
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <a
                href="#recent-orders"
                className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-all hover:shadow-lg active:scale-95"
              >
                View Your Orders & Returns ➔
              </a>
              <Link
                href="/"
                target="_blank"
                className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-semibold text-xs sm:text-sm transition-all"
              >
                Inspect Nova Agent Console ↗
              </Link>
            </div>
          </div>

          <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
            <div className="w-80 h-80 rounded-full bg-gradient-to-tr from-amber-200/50 to-orange-200/30 blur-2xl absolute"></div>
            <div className="relative text-[120px] select-none text-center">
              🎧
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO ORDERS: "MY RECENT PURCHASES" */}
      <section id="recent-orders" className="max-w-7xl mx-auto px-6 py-6">
        <div className="border border-[#EADBCC] bg-[#FEFDFB] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1E1812]">
                  Customer Account: Priya Chauhan
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Click any action below to test Nova&rsquo;s automated resolution and safety guardrails live in the customer widget.
              </p>
            </div>
            <span className="text-xs font-mono bg-stone-100 text-stone-600 px-3 py-1 rounded-full border border-stone-200">
              Customer ID: #CUST-9921
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RECENT_ORDERS.map((order) => (
              <div
                key={order.orderId}
                className="border border-[#EBE3D7] bg-white rounded-xl p-4.5 hover:border-amber-600/40 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-xl">
                      {order.icon}
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-800">
                        {order.orderId}
                      </span>
                      <h4 className="text-sm font-semibold text-stone-900 leading-tight">
                        {order.item}
                      </h4>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-stone-900">
                    ₹{order.amount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
                  <span>Purchased: {order.date}</span>
                  <span className="text-amber-700 font-medium">{order.status}</span>
                </div>

                <div className="pt-1">
                  <div className="text-[11px] text-stone-500 mb-1.5 flex items-center gap-1">
                    <span>💡 Tap to test Nova AI response:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-stone-700 flex items-center justify-between">
                    <span className="font-medium text-amber-900">{order.actionLabel}</span>
                    <span className="text-[11px] font-mono text-amber-700 underline font-semibold">
                      Open in Widget ➔
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS CATALOG */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#1E1812]">Featured Products</h2>
            <p className="text-xs text-stone-500 mt-0.5">Every purchase is protected with Nova autonomous returns.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="border border-[#EBE3D7] bg-white rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="h-44 rounded-xl bg-gradient-to-tr from-stone-50 to-stone-100 flex items-center justify-center text-6xl relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                  <span>{p.icon}</span>
                  {p.badge && (
                    <span className="absolute top-3 left-3 bg-amber-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      {p.badge}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-semibold">
                    {p.category}
                  </span>
                  <h3 className="font-semibold text-base text-stone-900 mt-0.5">
                    {p.name}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                    {p.tagline}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <span>★</span>
                  <span className="font-bold">{p.rating}</span>
                  <span className="text-stone-400">({p.reviewsCount} reviews)</span>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-stone-100 flex items-center justify-between">
                <div>
                  <div className="font-mono text-lg font-bold text-stone-900">
                    ₹{p.price.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-stone-400 line-through">
                    ₹{p.originalPrice.toLocaleString('en-IN')}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCartCount((c) => c + 1);
                    showToast(`Added ${p.name.slice(0, 20)}... to cart!`);
                    setTimeout(() => router.push('/store/cart'), 1200);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TOAST POPUP */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1E1812] text-white text-xs px-4 py-2.5 rounded-full shadow-lg border border-amber-500/30 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#EBE3D7] bg-[#F7F3EC] mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-stone-500 flex-wrap gap-4">
          <div>
            <strong>Aura Electronics</strong> · Sample E-Commerce Storefront connected to Nova AI Agent
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-amber-800 font-medium underline">
              Nova Agent Console
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-stone-800">
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* LIVE NOVA CUSTOMER SUPPORT FLOATING WIDGET */}
      <CustomerSupportWidget />
    </div>
  );
}
