/**
 * Tayyaba Organics Storefront JavaScript (Pakistan)
 * Clean, lightweight, and focused on 3 core products: Hair Oil, Shampoo, and Hair Mask.
 * Cash on Delivery (COD) across Pakistan in PKR (Rs.).
 */

// Global State
let allProducts = [];
let cart = [];

// Free Delivery threshold & standard courier fee in Pakistan
const FREE_SHIPPING_THRESHOLD = 2500.0;
const STANDARD_DELIVERY_FEE = 200.0;

// DOM Elements Cache
const productsGrid = document.getElementById('products-grid');
const reviewsGrid = document.getElementById('reviews-grid');
const cartBadge = document.getElementById('cart-badge');
const cartDrawer = document.getElementById('cart-drawer');
const cartBackdrop = document.getElementById('cart-backdrop');
const cartPanel = document.getElementById('cart-panel');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartEmptyState = document.getElementById('cart-empty-state');
const cartFooter = document.getElementById('cart-footer');
const cartSubtotalEl = document.getElementById('cart-subtotal');
const cartDeliveryFeeEl = document.getElementById('cart-delivery-fee');
const cartTotalEl = document.getElementById('cart-total');
const cartCountTitle = document.getElementById('cart-count-title');
const freeShippingProgress = document.getElementById('free-shipping-progress');
const freeShippingText = document.getElementById('free-shipping-text');

// Checkout Elements
const checkoutModal = document.getElementById('checkout-modal');
const checkoutBackdrop = document.getElementById('checkout-backdrop');
const checkoutFormContainer = document.getElementById('checkout-form-container');
const checkoutSuccessContainer = document.getElementById('checkout-success-container');
const codOrderForm = document.getElementById('cod-order-form');
const checkoutItemsSummary = document.getElementById('checkout-items-summary');
const checkoutTotalPayable = document.getElementById('checkout-total-payable');

// Quick View & Review Elements
const quickviewModal = document.getElementById('quickview-modal');
const quickviewBackdrop = document.getElementById('quickview-backdrop');
const quickviewContent = document.getElementById('quickview-content');
const reviewModal = document.getElementById('review-modal');
const reviewBackdrop = document.getElementById('review-backdrop');
const submitReviewForm = document.getElementById('submit-review-form');

// Helper to format PKR
function formatPKR(amount) {
  return 'Rs. ' + Math.round(amount).toLocaleString('en-PK');
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' 
    ? '<i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>' 
    : '<i class="fa-solid fa-circle-exclamation text-rose-400 text-lg"></i>';

  toast.innerHTML = `
    ${icon}
    <div class="flex-1 text-sm font-medium">${message}</div>
    <button class="text-white/60 hover:text-white text-xs ml-2" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// -------------------------------------------------------------
// CART MANAGEMENT
// -------------------------------------------------------------
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('tayyaba_organics_cart');
    cart = saved ? JSON.parse(saved) : [];
  } catch (e) {
    cart = [];
  }
  updateCartUI();
}

function saveCartToStorage() {
  try {
    localStorage.setItem('tayyaba_organics_cart', JSON.stringify(cart));
  } catch (e) {
    console.error('Failed to save cart:', e);
  }
  updateCartUI();
}

function addToCart(productId, quantity = 1, showDrawer = true) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      quantity: quantity
    });
  }

  saveCartToStorage();
  showToast(`Added <strong>${product.name}</strong> to cart!`);

  cartBadge.classList.add('cart-badge-bounce');
  setTimeout(() => cartBadge.classList.remove('cart-badge-bounce'), 400);

  if (showDrawer) {
    openCart();
  }
}

function updateCartQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCartToStorage();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCartToStorage();
  showToast('Item removed from cart', 'error');
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartBadge.textContent = totalItems;
  cartCountTitle.textContent = `(${totalItems})`;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '';
    cartEmptyState.classList.remove('hidden');
    cartFooter.classList.add('hidden');
    return;
  }

  cartEmptyState.classList.add('hidden');
  cartFooter.classList.remove('hidden');

  let subtotal = 0;
  cartItemsContainer.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    return `
      <div class="flex items-center gap-3 pt-3 first:pt-0">
        <img src="${item.image}" alt="${item.name}" class="w-14 h-14 object-cover rounded-xl border border-slate-200">
        <div class="flex-1 min-w-0">
          <span class="text-[9px] uppercase font-bold text-emerald-800 tracking-wider">${item.category}</span>
          <h4 class="text-xs font-bold text-slate-800 truncate">${item.name}</h4>
          <p class="text-xs text-slate-500 font-semibold">${formatPKR(item.price)}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <div class="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 text-xs">
              <button onclick="updateCartQuantity(${item.id}, -1)" class="px-2 py-0.5 text-slate-600 hover:text-black hover:bg-slate-200 rounded-l-lg">-</button>
              <span class="px-2 font-bold text-slate-800">${item.quantity}</span>
              <button onclick="updateCartQuantity(${item.id}, 1)" class="px-2 py-0.5 text-slate-600 hover:text-black hover:bg-slate-200 rounded-r-lg">+</button>
            </div>
            <button onclick="removeFromCart(${item.id})" class="text-[10px] text-rose-500 hover:text-rose-700 ml-1.5">
              <i class="fa-regular fa-trash-can"></i> Remove
            </button>
          </div>
        </div>
        <div class="text-right">
          <p class="text-xs font-bold text-slate-900">${formatPKR(itemTotal)}</p>
        </div>
      </div>
    `;
  }).join('');

  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0.0 : STANDARD_DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;

  cartSubtotalEl.textContent = formatPKR(subtotal);
  if (deliveryFee === 0) {
    cartDeliveryFeeEl.innerHTML = `<span class="text-emerald-700 font-bold uppercase text-[9px] bg-emerald-100 px-2 py-0.5 rounded">FREE (Pakistan-wide)</span>`;
  } else {
    cartDeliveryFeeEl.textContent = formatPKR(deliveryFee);
  }
  cartTotalEl.textContent = formatPKR(grandTotal);

  const progressPercent = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  freeShippingProgress.style.width = `${progressPercent}%`;
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    freeShippingText.innerHTML = `🎉 <strong>Congratulations!</strong> You unlocked FREE Cash on Delivery across Pakistan!`;
  } else {
    const diff = FREE_SHIPPING_THRESHOLD - subtotal;
    freeShippingText.innerHTML = `Add <strong>${formatPKR(diff)}</strong> more for <strong>FREE Delivery!</strong>`;
  }
}

function openCart() {
  cartDrawer.classList.remove('hidden');
  setTimeout(() => {
    cartBackdrop.classList.remove('opacity-0');
    cartPanel.classList.remove('translate-x-full');
  }, 10);
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartBackdrop.classList.add('opacity-0');
  cartPanel.classList.add('translate-x-full');
  setTimeout(() => {
    cartDrawer.classList.add('hidden');
    document.body.style.overflow = '';
  }, 300);
}

// -------------------------------------------------------------
// PRODUCTS FETCH & RENDER (3 Core Products)
// -------------------------------------------------------------
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      allProducts = data.products;
      populateProductSelectDropdown(allProducts);
      renderProductsGrid(allProducts);
    } else {
      productsGrid.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500">Failed to load products.</div>`;
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    productsGrid.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500">Error connecting to server.</div>`;
  }
}

function renderProductsGrid(products) {
  if (products.length === 0) {
    productsGrid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-sm">No products available.</div>`;
    return;
  }

  productsGrid.innerHTML = products.map(product => {
    const discountPercent = product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null;

    return `
      <div class="product-card bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col group shadow-sm hover:shadow-md transition-all">
        
        <!-- Product Image -->
        <div class="relative overflow-hidden aspect-[4/3] bg-slate-100 cursor-pointer" onclick="openQuickView(${product.id})">
          <img src="${product.image}" alt="${product.name}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
          ${product.badge ? `<span class="absolute top-3 left-3 bg-botanical-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">${product.badge}</span>` : ''}
          ${discountPercent ? `<span class="absolute top-3 right-3 bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Save ${discountPercent}%</span>` : ''}
        </div>

        <!-- Details -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs mb-2">
              <span class="font-bold uppercase tracking-wider text-emerald-800 text-[10px]">${product.category}</span>
              <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                <i class="fa-solid fa-leaf text-[9px]"></i> Pure By Nature
              </span>
            </div>

            <h3 class="font-serif-display font-bold text-slate-900 text-base mb-2 hover:text-botanical-800 cursor-pointer" onclick="openQuickView(${product.id})">
              ${product.name}
            </h3>

            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
              ${product.description || ''}
            </p>
          </div>

          <div>
            <div class="flex items-baseline gap-2 mb-4">
              <span class="text-lg font-bold text-botanical-900 font-serif-display">${formatPKR(product.price)}</span>
              ${product.original_price ? `<span class="text-xs text-slate-400 line-through">${formatPKR(product.original_price)}</span>` : ''}
              <span class="ml-auto text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                💵 COD in Pakistan
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button onclick="openQuickView(${product.id})" class="w-full py-2.5 px-3 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors">
                Details
              </button>
              <button onclick="addToCart(${product.id}, 1)" class="w-full py-2.5 px-3 bg-botanical-800 hover:bg-botanical-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-cart-plus text-xs"></i> Add to Cart
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// PRODUCT QUICK VIEW MODAL
// -------------------------------------------------------------
function openQuickView(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const discountPercent = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : null;

  quickviewContent.innerHTML = `
    <!-- Image -->
    <div class="rounded-xl overflow-hidden bg-slate-100 aspect-square">
      <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover">
    </div>

    <!-- Info & Actions -->
    <div class="flex flex-col justify-between">
      <div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          ${product.category}
        </span>
        <h3 class="font-serif-display text-xl font-bold text-slate-900 mt-2 mb-1.5">${product.name}</h3>
        
        <div class="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mb-3">
          <i class="fa-solid fa-leaf text-[10px]"></i> Pure By Nature &bull; Handmade
        </div>

        <div class="flex items-baseline gap-2.5 mb-4 pb-3 border-b border-slate-100">
          <span class="text-xl font-bold text-botanical-900 font-serif-display">${formatPKR(product.price)}</span>
          ${product.original_price ? `<span class="text-xs text-slate-400 line-through">${formatPKR(product.original_price)}</span>` : ''}
        </div>

        <div class="space-y-2.5 text-xs text-slate-600 mb-5">
          <p class="leading-relaxed text-slate-700">${product.description || ''}</p>
          ${product.benefits ? `<div class="p-2.5 bg-emerald-50 rounded-lg text-emerald-900 text-[11px]"><strong>🌿 Benefits:</strong> ${product.benefits}</div>` : ''}
          ${product.ingredients ? `<div class="text-[11px]"><strong class="text-slate-800">Ingredients:</strong> <span class="text-slate-500">${product.ingredients}</span></div>` : ''}
          ${product.how_to_use ? `<div class="text-[11px]"><strong class="text-slate-800">How to Use:</strong> <span class="text-slate-500">${product.how_to_use}</span></div>` : ''}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 space-y-2">
        <div class="flex items-center gap-2">
          <div class="inline-flex items-center border border-slate-300 rounded-lg bg-slate-50">
            <button id="qv-qty-minus" class="px-2.5 py-1.5 text-slate-600 font-bold">-</button>
            <span id="qv-qty-val" class="px-2.5 font-bold text-slate-800 text-xs">1</span>
            <button id="qv-qty-plus" class="px-2.5 py-1.5 text-slate-600 font-bold">+</button>
          </div>
          <button id="qv-add-to-cart-btn" class="flex-1 py-2.5 px-3 bg-botanical-800 hover:bg-botanical-700 text-white font-bold rounded-lg text-xs shadow transition-all flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-cart-shopping"></i> Add to Cart
          </button>
        </div>

        <button id="qv-cod-buy-now-btn" class="w-full py-2 bg-amberGold-500 hover:bg-amberGold-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5">
          <span>💵 Order via Cash on Delivery</span>
        </button>
      </div>
    </div>
  `;

  let qvQty = 1;
  const qvQtyVal = document.getElementById('qv-qty-val');
  document.getElementById('qv-qty-minus').addEventListener('click', () => {
    if (qvQty > 1) {
      qvQty--;
      qvQtyVal.textContent = qvQty;
    }
  });
  document.getElementById('qv-qty-plus').addEventListener('click', () => {
    qvQty++;
    qvQtyVal.textContent = qvQty;
  });

  document.getElementById('qv-add-to-cart-btn').addEventListener('click', () => {
    addToCart(product.id, qvQty, true);
    closeQuickView();
  });

  document.getElementById('qv-cod-buy-now-btn').addEventListener('click', () => {
    addToCart(product.id, qvQty, false);
    closeQuickView();
    openCheckoutModal();
  });

  quickviewModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeQuickView() {
  quickviewModal.classList.add('hidden');
  document.body.style.overflow = '';
}
window.closeQuickView = closeQuickView;
window.openQuickView = openQuickView;

// -------------------------------------------------------------
// REVIEWS FETCH & RENDER
// -------------------------------------------------------------
async function fetchReviews() {
  try {
    const res = await fetch('/api/reviews');
    const data = await res.json();
    if (data.success) {
      renderReviewsGrid(data.reviews);
    }
  } catch (err) {
    console.error('Failed to load reviews:', err);
  }
}

function renderReviewsGrid(reviews) {
  if (!reviews || reviews.length === 0) {
    reviewsGrid.innerHTML = `
      <div class="col-span-full text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
        <div class="w-10 h-10 mx-auto rounded-full bg-emerald-100/60 text-emerald-800 flex items-center justify-center text-base mb-2">
          <i class="fa-solid fa-leaf"></i>
        </div>
        <p class="font-bold text-slate-800 text-xs mb-1">No customer reviews yet</p>
        <p class="text-[11px] text-slate-500 max-w-sm mx-auto mb-3">Order via Cash on Delivery and be the first to share your experience with us!</p>
      </div>
    `;
    return;
  }

  reviewsGrid.innerHTML = reviews.map(r => {
    const stars = Array(5).fill(0).map((_, i) => 
      `<i class="fa-solid fa-star ${i < r.rating ? 'text-amber-400' : 'text-slate-200'}"></i>`
    ).join('');

    return `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex gap-1 text-[11px]">${stars}</div>
            <span class="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
              <i class="fa-solid fa-check"></i> Verified
            </span>
          </div>

          ${r.title ? `<h4 class="font-bold text-slate-800 text-xs mb-1.5">"${r.title}"</h4>` : ''}
          <p class="text-xs text-slate-600 leading-relaxed mb-3">
            ${r.comment}
          </p>
        </div>

        <div class="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
          <span class="font-bold text-slate-800 text-xs">${r.customer_name}</span>
          <span class="text-slate-400 text-[10px]">${r.created_at ? r.created_at.split(' ')[0] : 'Recent'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function populateProductSelectDropdown(products) {
  const select = document.getElementById('review-product-select');
  if (!select) return;
  select.innerHTML = '<option value="">General Tayyaba Organics Experience</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

// -------------------------------------------------------------
// CHECKOUT & CASH ON DELIVERY (COD) ORDER PLACEMENT
// -------------------------------------------------------------
function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('Your cart is empty. Please add products first.', 'error');
    return;
  }

  closeCart();

  let subtotal = 0;
  checkoutItemsSummary.innerHTML = cart.map(item => {
    const lineTotal = item.price * item.quantity;
    subtotal += lineTotal;
    return `
      <div class="flex justify-between items-center py-0.5">
        <span class="truncate max-w-[220px]"><strong>${item.quantity}x</strong> ${item.name}</span>
        <span class="font-semibold text-slate-800">${formatPKR(lineTotal)}</span>
      </div>
    `;
  }).join('');

  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0.0 : STANDARD_DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;

  checkoutTotalPayable.textContent = formatPKR(grandTotal);

  checkoutFormContainer.classList.remove('hidden');
  checkoutSuccessContainer.classList.add('hidden');

  checkoutModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  checkoutModal.classList.add('hidden');
  document.body.style.overflow = '';
}

async function handleCodOrderSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('confirm-order-btn') || document.getElementById('submit-cod-order-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...`;
  }

  const payload = {
    customer_name: document.getElementById('order-name').value.trim(),
    customer_phone: document.getElementById('order-phone').value.trim(),
    shipping_address: document.getElementById('order-address').value.trim(),
    city: document.getElementById('order-city').value.trim(),
    order_notes: (document.getElementById('order-notes') ? document.getElementById('order-notes').value.trim() : ''),
    items: cart
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      cart = [];
      saveCartToStorage();

      const numEl = document.getElementById('success-order-num');
      if (numEl) numEl.textContent = `#${data.order.order_number}`;

      const nameEl = document.getElementById('success-customer-name');
      if (nameEl) nameEl.textContent = data.order.customer_name;

      const totalEl = document.getElementById('success-order-total');
      if (totalEl) totalEl.textContent = formatPKR(data.order.total_amount);

      checkoutFormContainer.classList.add('hidden');
      checkoutSuccessContainer.classList.remove('hidden');
      showToast('🎉 Order placed successfully with Cash on Delivery!');
    } else {
      showToast(data.error || 'Failed to place order', 'error');
    }
  } catch (err) {
    console.error('Order placement error:', err);
    showToast('Network error while placing order.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Confirm Order (Pay on Delivery)</span>`;
    }
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadCartFromStorage();
  fetchProducts();
  fetchReviews();

  // Mobile Menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
    document.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }

  // Cart Drawer open/close
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);

  const closeCartBtn = document.getElementById('close-cart-btn');
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);

  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

  const startShopBtn = document.getElementById('cart-start-shopping-btn');
  if (startShopBtn) {
    startShopBtn.addEventListener('click', () => {
      closeCart();
      window.location.hash = '#products';
    });
  }

  // Checkout Modal
  const checkoutBtn = document.getElementById('cart-checkout-btn') || document.getElementById('open-checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckoutModal);

  const closeCheckoutBtn = document.getElementById('close-checkout-modal-btn');
  if (closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckoutModal);

  if (checkoutBackdrop) checkoutBackdrop.addEventListener('click', closeCheckoutModal);

  if (codOrderForm) codOrderForm.addEventListener('submit', handleCodOrderSubmit);

  const continueBtn = document.getElementById('success-continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      closeCheckoutModal();
      window.location.hash = '#products';
    });
  }

  // Quick View Close
  const closeQvBtn = document.getElementById('close-quickview-btn');
  if (closeQvBtn) closeQvBtn.addEventListener('click', closeQuickView);

  if (quickviewBackdrop) quickviewBackdrop.addEventListener('click', closeQuickView);

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeQuickView();
      closeCart();
      closeCheckoutModal();
    }
  });

  // Review Modal
  const openReviewModalBtn = document.getElementById('open-review-modal-btn');
  const closeReviewModalBtn = document.getElementById('close-review-modal-btn');
  openReviewModalBtn.addEventListener('click', () => {
    reviewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
  closeReviewModalBtn.addEventListener('click', () => {
    reviewModal.classList.add('hidden');
    document.body.style.overflow = '';
  });
  reviewBackdrop.addEventListener('click', () => {
    reviewModal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  // Star Rating Picker in Review Modal
  const starOptions = document.querySelectorAll('.star-opt');
  const ratingInput = document.getElementById('review-rating-value');
  starOptions.forEach(star => {
    star.addEventListener('click', () => {
      const selectedRating = parseInt(star.dataset.rating, 10);
      ratingInput.value = selectedRating;
      starOptions.forEach(s => {
        const r = parseInt(s.dataset.rating, 10);
        if (r <= selectedRating) {
          s.classList.remove('text-slate-300');
          s.classList.add('text-amber-400');
        } else {
          s.classList.remove('text-amber-400');
          s.classList.add('text-slate-300');
        }
      });
    });
  });

  // Submit Review Form
  submitReviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-review-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

    const payload = {
      customer_name: document.getElementById('review-name').value.trim(),
      rating: parseInt(ratingInput.value, 10),
      product_id: document.getElementById('review-product-select').value || null,
      comment: document.getElementById('review-comment').value.trim()
    };

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thank you! Your review has been submitted.');
        submitReviewForm.reset();
        reviewModal.classList.add('hidden');
        document.body.style.overflow = '';
        fetchReviews();
        fetchProducts();
      } else {
        showToast(data.error || 'Failed to submit review', 'error');
      }
    } catch (err) {
      showToast('Network error while submitting review', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Review';
    }
  });

  // Contact Form Submission
  const contactForm = document.getElementById('contact-form');
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('contact-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;

    const payload = {
      name: document.getElementById('contact-name').value.trim(),
      phone: document.getElementById('contact-phone').value.trim(),
      email: document.getElementById('contact-email') ? document.getElementById('contact-email').value.trim() : '',
      subject: 'Storefront Inquiry',
      message: document.getElementById('contact-message').value.trim()
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        contactForm.reset();
      } else {
        showToast(data.error || 'Failed to send message', 'error');
      }
    } catch (err) {
      showToast('Network error while sending message', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-regular fa-paper-plane"></i> <span>Send Message</span>`;
    }
  });

});
