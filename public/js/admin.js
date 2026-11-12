/**
 * Tayyaba Organics Admin Dashboard JavaScript (Pakistan)
 * Handles administrative authentication, analytics stats in PKR (Rs.),
 * Product CRUD & image uploads, COD order fulfillment across Pakistan, reviews, and inquiries.
 */

let authToken = localStorage.getItem('tayyaba_organics_admin_token') || '';
let adminProducts = [];
let adminOrders = [];

// Helper to format PKR
function formatPKR(amount) {
  return 'Rs. ' + Math.round(amount).toLocaleString('en-PK');
}

// DOM References
const loginModal = document.getElementById('login-modal');
const adminApp = document.getElementById('admin-dashboard-app');
const adminLoginForm = document.getElementById('admin-login-form');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');

// Toast Notification
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
// AUTHENTICATION
// -------------------------------------------------------------
function checkAuth() {
  if (authToken) {
    loginModal.classList.add('hidden');
    adminApp.classList.remove('hidden');
    loadAllDashboardData();
  } else {
    loginModal.classList.remove('hidden');
    adminApp.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username').value.trim();
  const passwordInput = document.getElementById('login-password').value.trim();
  const loginBtn = document.getElementById('login-btn');

  loginBtn.disabled = true;
  loginBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });
    const data = await res.json();

    if (data.success) {
      authToken = data.token;
      localStorage.setItem('tayyaba_organics_admin_token', authToken);
      document.getElementById('admin-user-display').textContent = data.username;
      showToast('Welcome back, Tayyaba Organics Admin!');
      checkAuth();
    } else {
      showToast(data.error || 'Invalid credentials', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication service', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> <span>Sign In to Dashboard</span>`;
  }
}

function handleLogout() {
  authToken = '';
  localStorage.removeItem('tayyaba_organics_admin_token');
  showToast('Logged out successfully');
  checkAuth();
}

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------
function switchTab(tabId) {
  // Update button highlights
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.className = 'admin-tab-btn py-3 border-b-2 border-adminGreen-800 text-adminGreen-800 flex items-center gap-2';
    } else {
      btn.className = 'admin-tab-btn py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 flex items-center gap-2';
    }
  });

  // Switch pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.add('hidden');
  });
  const activePane = document.getElementById(tabId);
  if (activePane) activePane.classList.remove('hidden');

  // Refresh data on tab switch
  if (tabId === 'tab-products') loadProducts();
  if (tabId === 'tab-orders') loadOrders();
  if (tabId === 'tab-reviews') loadReviews();
  if (tabId === 'tab-inquiries') loadInquiries();
  if (tabId === 'tab-settings') loadSettings();
  if (tabId === 'tab-dashboard') loadStats();
}

// -------------------------------------------------------------
// DATA LOADING
// -------------------------------------------------------------
async function loadAllDashboardData() {
  await Promise.all([
    loadStats(),
    loadProducts(),
    loadOrders(),
    loadReviews(),
    loadInquiries(),
    loadSettings()
  ]);
}

// -------------------------------------------------------------
// AUDIO CHIME & NOTIFICATIONS
// -------------------------------------------------------------
let lastKnownOrdersCount = null;

function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Handled silently
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (data.success) {
      const stats = data.stats;

      // Detect newly arrived orders
      if (lastKnownOrdersCount !== null && stats.total_orders > lastKnownOrdersCount) {
        const diff = stats.total_orders - lastKnownOrdersCount;
        playOrderChime();
        showToast(`🔔 ${diff} New COD Order(s) Received! Total Orders: ${stats.total_orders}`, 'success');

        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🔔 Tayyaba Organic — New Order Received!', {
              body: `You received ${diff} new Cash on Delivery order(s). Check your dashboard for customer details.`
            });
          } catch (e) {}
        }
      }
      lastKnownOrdersCount = stats.total_orders;

      document.getElementById('stat-revenue').textContent = formatPKR(stats.total_revenue);
      document.getElementById('stat-orders').textContent = stats.total_orders;
      document.getElementById('stat-pending').textContent = stats.pending_orders;
      document.getElementById('stat-products').textContent = stats.total_products;
      document.getElementById('stat-low-stock').textContent = `${stats.low_stock_products} low in stock`;

      document.getElementById('tab-count-products').textContent = stats.total_products;
      document.getElementById('tab-count-orders').textContent = stats.total_orders;
      document.getElementById('tab-count-reviews').textContent = stats.total_reviews;

      // Recent orders preview in Dashboard
      renderRecentOrders(stats.recent_orders);
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('dashboard-recent-orders-tbody');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">No orders placed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="py-3 font-mono font-bold text-slate-900">${o.order_number}</td>
      <td class="py-3 font-semibold text-slate-800">${o.customer_name}</td>
      <td class="py-3 text-slate-500">${o.city}</td>
      <td class="py-3 font-bold text-slate-900">${formatPKR(o.total_amount)}</td>
      <td class="py-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(o.status)}">
          ${o.status}
        </span>
      </td>
    </tr>
  `).join('');
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'bg-amber-100 text-amber-800';
    case 'Confirmed': return 'bg-blue-100 text-blue-800';
    case 'Shipped': return 'bg-purple-100 text-purple-800';
    case 'Delivered': return 'bg-emerald-100 text-emerald-800';
    case 'Cancelled': return 'bg-rose-100 text-rose-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

// -------------------------------------------------------------
// PRODUCT MANAGEMENT (CRUD)
// -------------------------------------------------------------
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      adminProducts = data.products;
      renderAdminProducts(adminProducts);
      document.getElementById('tab-count-products').textContent = adminProducts.length;
    }
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderAdminProducts(products) {
  const tbody = document.getElementById('admin-products-table-body');
  if (!products || products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No products uploaded yet. Click "Add New Product" above to upload your first hair oil or shampoo.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr class="hover:bg-slate-50/80 transition-colors">
      <td class="p-4 flex items-center gap-3">
        <img src="${p.image}" alt="${p.name}" class="w-12 h-12 object-cover rounded-xl border border-slate-200">
        <div>
          <h4 class="font-bold text-slate-900 text-xs sm:text-sm">${p.name}</h4>
          ${p.badge ? `<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">${p.badge}</span>` : ''}
        </div>
      </td>
      <td class="p-4">
        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">${p.category}</span>
      </td>
      <td class="p-4">
        <span class="font-bold text-slate-900 text-sm">${formatPKR(p.price)}</span>
        ${p.original_price ? `<span class="text-slate-400 line-through text-xs ml-1">${formatPKR(p.original_price)}</span>` : ''}
      </td>
      <td class="p-4">
        <span class="px-2 py-1 rounded text-xs font-bold ${p.stock <= 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}">
          ${p.stock} in stock
        </span>
      </td>
      <td class="p-4">
        <div class="flex items-center gap-1 text-amber-400">
          <i class="fa-solid fa-star text-xs"></i>
          <span class="text-slate-700 font-bold text-xs">${p.rating}</span>
        </div>
      </td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct(${p.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors">
          <i class="fa-regular fa-pen-to-square"></i> Edit
        </button>
        <button onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors">
          <i class="fa-regular fa-trash-can"></i> Delete
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddProductModal() {
  document.getElementById('product-modal-title').textContent = 'Add New Tayyaba Organics Product';
  document.getElementById('prod-id').value = '';
  productForm.reset();
  document.getElementById('prod-image-preview').src = 'https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80';
  document.getElementById('prod-image-url').value = 'https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80';
  productModal.classList.remove('hidden');
}

function editProduct(productId) {
  const p = adminProducts.find(item => item.id === productId);
  if (!p) return;

  document.getElementById('product-modal-title').textContent = 'Edit Hair Product';
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-orig-price').value = p.original_price || '';
  document.getElementById('prod-stock').value = p.stock;
  document.getElementById('prod-image-url').value = p.image;
  document.getElementById('prod-image-preview').src = p.image;
  document.getElementById('prod-badge').value = p.badge || '';
  document.getElementById('prod-featured').checked = p.is_featured === 1;
  document.getElementById('prod-desc').value = p.description || '';
  document.getElementById('prod-ingredients').value = p.ingredients || '';
  document.getElementById('prod-benefits').value = p.benefits || '';
  document.getElementById('prod-how-to-use').value = p.how_to_use || '';

  productModal.classList.remove('hidden');
}

function closeProductModal() {
  productModal.classList.add('hidden');
}

async function handleProductSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('save-product-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

  const prodId = document.getElementById('prod-id').value;
  const isEdit = Boolean(prodId);

  const payload = {
    name: document.getElementById('prod-name').value.trim(),
    category: document.getElementById('prod-category').value,
    price: parseFloat(document.getElementById('prod-price').value),
    original_price: document.getElementById('prod-orig-price').value ? parseFloat(document.getElementById('prod-orig-price').value) : null,
    stock: parseInt(document.getElementById('prod-stock').value, 10),
    image: document.getElementById('prod-image-url').value.trim(),
    badge: document.getElementById('prod-badge').value.trim(),
    is_featured: document.getElementById('prod-featured').checked,
    description: document.getElementById('prod-desc').value.trim(),
    ingredients: document.getElementById('prod-ingredients').value.trim(),
    benefits: document.getElementById('prod-benefits').value.trim(),
    how_to_use: document.getElementById('prod-how-to-use').value.trim()
  };

  const endpoint = isEdit ? `/api/products/${prodId}` : '/api/products';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(isEdit ? 'Product updated successfully!' : 'Product added successfully!');
      closeProductModal();
      loadProducts();
      loadStats();
    } else {
      showToast(data.error || 'Failed to save product', 'error');
    }
  } catch (err) {
    showToast('Network error while saving product', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Product';
  }
}

async function deleteProduct(productId, productName) {
  if (!confirm(`Are you sure you want to permanently delete "${productName}" from the catalog?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Product deleted from catalog');
      loadProducts();
      loadStats();
    } else {
      showToast(data.error || 'Failed to delete product', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting product', 'error');
  }
}

// -------------------------------------------------------------
// IMAGE UPLOAD HANDLER
// -------------------------------------------------------------
function setupImageUpload() {
  const fileInput = document.getElementById('prod-image-file');
  const urlInput = document.getElementById('prod-image-url');
  const previewImg = document.getElementById('prod-image-preview');

  urlInput.addEventListener('input', (e) => {
    if (e.target.value.trim()) {
      previewImg.src = e.target.value.trim();
    }
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Uploading product image...');
    const reader = new FileReader();
    reader.onload = async function() {
      const base64Data = reader.result;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64Data,
            file_name: file.name
          })
        });
        const data = await res.json();
        if (data.success) {
          urlInput.value = data.url;
          previewImg.src = data.url;
          showToast('Image uploaded successfully!');
        } else {
          showToast(data.error || 'Upload failed', 'error');
        }
      } catch (err) {
        showToast('Image upload failed', 'error');
      }
    };
    reader.readAsDataURL(file);
  });
}

// -------------------------------------------------------------
// COD ORDERS MANAGEMENT
// -------------------------------------------------------------
async function loadOrders() {
  const filter = document.getElementById('order-status-filter').value;
  const url = filter && filter !== 'all' ? `/api/orders?status=${filter}` : '/api/orders';

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      adminOrders = data.orders;
      renderAdminOrders(adminOrders);
      document.getElementById('tab-count-orders').textContent = adminOrders.length;
    }
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

function renderAdminOrders(orders) {
  const tbody = document.getElementById('admin-orders-table-body');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">No Cash on Delivery orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let cleanPhone = o.customer_phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.startsWith('03')) {
      cleanPhone = '92' + cleanPhone.substring(1);
    }
    const whatsappLink = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(`Salam ${o.customer_name}! Regarding your Tayyaba Organics order #${o.order_number} for ${formatPKR(o.total_amount)} (Cash on Delivery)...`)}`;

    const itemsSummary = o.items.map(item => `
      <div class="text-[11px] text-slate-600 truncate max-w-[220px]">
        • <strong>${item.quantity}x</strong> ${item.name}
      </div>
    `).join('');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-4 font-mono font-bold text-slate-900">
          ${o.order_number}
          <div class="text-[10px] text-slate-400 font-sans font-normal mt-0.5">${o.created_at ? o.created_at.split(' ')[0] : 'Today'}</div>
        </td>

        <td class="p-4">
          <div class="font-bold text-slate-900 text-xs sm:text-sm">${o.customer_name}</div>
          <div class="flex items-center gap-2 mt-1">
            <a href="tel:${cleanPhone}" class="text-[11px] text-slate-600 hover:text-adminGreen-800 flex items-center gap-1 font-semibold">
              <i class="fa-solid fa-phone text-[10px]"></i> ${o.customer_phone}
            </a>
            <a href="${whatsappLink}" target="_blank" class="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1" title="Chat on WhatsApp">
              <i class="fa-brands fa-whatsapp text-xs"></i>
            </a>
          </div>
          ${o.customer_email ? `<div class="text-[10px] text-slate-400 truncate max-w-[150px]">${o.customer_email}</div>` : ''}
        </td>

        <td class="p-4 max-w-[200px]">
          <div class="text-xs text-slate-800 font-medium">${o.shipping_address}</div>
          <div class="text-[10px] text-slate-500 font-bold mt-0.5">${o.city} ${o.postal_code || ''}</div>
          ${o.order_notes ? `<div class="text-[10px] text-amber-800 bg-amber-50 p-1 rounded mt-1">Note: ${o.order_notes}</div>` : ''}
        </td>

        <td class="p-4">
          <div class="space-y-0.5">
            ${itemsSummary}
          </div>
        </td>

        <td class="p-4">
          <span class="font-bold text-slate-900 text-sm">${formatPKR(o.total_amount)}</span>
          <div class="text-[10px] text-emerald-700 font-semibold">💵 COD (PK)</div>
        </td>

        <td class="p-4">
          <select onchange="updateOrderStatus(${o.id}, this.value)" class="text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none ${getStatusBadgeClass(o.status)}">
            <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>

        <td class="p-4 text-right">
          <button onclick="deleteOrder(${o.id}, '${o.order_number}')" class="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Delete order record">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      loadStats();
    } else {
      showToast(data.error || 'Failed to update order status', 'error');
    }
  } catch (err) {
    showToast('Error updating order status', 'error');
  }
}

async function deleteOrder(orderId, orderNum) {
  if (!confirm(`Delete order ${orderNum}? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Order ${orderNum} deleted`);
      loadOrders();
      loadStats();
    }
  } catch (err) {
    showToast('Failed to delete order', 'error');
  }
}

// -------------------------------------------------------------
// REVIEWS MANAGEMENT
// -------------------------------------------------------------
async function loadReviews() {
  try {
    const res = await fetch('/api/reviews');
    const data = await res.json();
    if (data.success) {
      renderAdminReviews(data.reviews);
      document.getElementById('tab-count-reviews').textContent = data.reviews.length;
    }
  } catch (err) {
    console.error('Failed to load reviews:', err);
  }
}

function renderAdminReviews(reviews) {
  const tbody = document.getElementById('admin-reviews-table-body');
  if (!reviews || reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">No reviews found.</td></tr>`;
    return;
  }

  tbody.innerHTML = reviews.map(r => {
    const stars = Array(r.rating).fill('<i class="fa-solid fa-star text-amber-400 text-xs"></i>').join('');
    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-4 font-bold text-slate-900 text-xs">${r.customer_name}</td>
        <td class="p-4">
          <div class="flex gap-0.5">${stars}</div>
        </td>
        <td class="p-4 max-w-md">
          ${r.title ? `<p class="font-bold text-xs text-slate-800 mb-0.5">${r.title}</p>` : ''}
          <p class="text-xs text-slate-600">${r.comment}</p>
        </td>
        <td class="p-4 text-xs text-slate-400">${r.created_at ? r.created_at.split(' ')[0] : 'Recent'}</td>
        <td class="p-4 text-right">
          <button onclick="deleteReview(${r.id})" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors">
            <i class="fa-regular fa-trash-can"></i> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteReview(reviewId) {
  if (!confirm('Are you sure you want to delete this customer review?')) return;
  try {
    const res = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Review removed');
      loadReviews();
      loadStats();
    }
  } catch (err) {
    showToast('Failed to delete review', 'error');
  }
}

// -------------------------------------------------------------
// CONTACT INQUIRIES MANAGEMENT
// -------------------------------------------------------------
async function loadInquiries() {
  try {
    const res = await fetch('/api/contact');
    const data = await res.json();
    if (data.success) {
      renderAdminInquiries(data.inquiries);
      document.getElementById('tab-count-inquiries').textContent = data.inquiries.length;
    }
  } catch (err) {
    console.error('Failed to load inquiries:', err);
  }
}

function renderAdminInquiries(inquiries) {
  const tbody = document.getElementById('admin-inquiries-table-body');
  if (!inquiries || inquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No contact messages received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = inquiries.map(inq => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-4 font-bold text-slate-900 text-xs">${inq.name}</td>
      <td class="p-4 text-xs">
        <a href="mailto:${inq.email}" class="text-adminGreen-800 font-semibold hover:underline block">${inq.email}</a>
        ${inq.phone ? `<a href="tel:${inq.phone}" class="text-slate-500 hover:text-slate-800 mt-0.5 block">${inq.phone}</a>` : ''}
      </td>
      <td class="p-4 max-w-sm">
        <p class="font-bold text-slate-800 text-xs mb-1">${inq.subject || 'Inquiry'}</p>
        <p class="text-xs text-slate-600 whitespace-pre-wrap">${inq.message}</p>
      </td>
      <td class="p-4 text-xs text-slate-400">${inq.created_at ? inq.created_at.split(' ')[0] : 'Recent'}</td>
      <td class="p-4">
        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${inq.status === 'New' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${inq.status}
        </span>
      </td>
      <td class="p-4 text-right">
        ${inq.status === 'New' ? `
          <button onclick="updateInquiryStatus(${inq.id}, 'Replied')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">
            Mark Replied
          </button>
        ` : `
          <span class="text-xs text-slate-400">Resolved</span>
        `}
      </td>
    </tr>
  `).join('');
}

async function updateInquiryStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/contact/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Status updated');
      loadInquiries();
    }
  } catch (err) {
    showToast('Failed to update inquiry', 'error');
  }
}

// -------------------------------------------------------------
// STORE SETTINGS (DELIVERY FEE, FREE SHIPPING THRESHOLD, ANNOUNCEMENT)
// -------------------------------------------------------------
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      const feeInput = document.getElementById('setting-standard-fee');
      const threshInput = document.getElementById('setting-threshold');
      const announceInput = document.getElementById('setting-announcement');
      const waInput = document.getElementById('setting-whatsapp');

      if (feeInput && s.standard_delivery_fee !== undefined) feeInput.value = s.standard_delivery_fee;
      if (threshInput && s.free_shipping_threshold !== undefined) threshInput.value = s.free_shipping_threshold;
      if (announceInput && s.announcement_message !== undefined) announceInput.value = s.announcement_message;
      if (waInput && s.whatsapp_number !== undefined) waInput.value = s.whatsapp_number;

      updateSettingsLivePreview();
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
    showToast('Failed to load store settings', 'error');
  }
}

function updateSettingsLivePreview() {
  const announceInput = document.getElementById('setting-announcement');
  const threshInput = document.getElementById('setting-threshold');
  const feeInput = document.getElementById('setting-standard-fee');

  const previewBox = document.getElementById('preview-announcement-box');
  const previewThresh = document.getElementById('preview-threshold-text');
  const previewFee = document.getElementById('preview-fee-text');

  if (previewBox && announceInput) {
    previewBox.innerHTML = announceInput.value || '🌿 Tayyaba Organic • Pure By Nature • Free Delivery in Pakistan on orders above Rs. 2,000!';
  }
  if (previewThresh && threshInput) {
    previewThresh.textContent = formatPKR(parseFloat(threshInput.value) || 2000);
  }
  if (previewFee && feeInput) {
    previewFee.textContent = formatPKR(parseFloat(feeInput.value) || 200);
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('save-settings-btn');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Settings...`;

  const payload = {
    standard_delivery_fee: document.getElementById('setting-standard-fee').value.trim(),
    free_shipping_threshold: document.getElementById('setting-threshold').value.trim(),
    announcement_message: document.getElementById('setting-announcement').value.trim(),
    whatsapp_number: document.getElementById('setting-whatsapp').value.trim()
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Delivery and announcement settings saved successfully!');
      updateSettingsLivePreview();
    } else {
      showToast(data.error || 'Failed to update settings', 'error');
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
    showToast('Network error while saving settings', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>Save Store Settings</span>`;
  }
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // Tab switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Login Form
  adminLoginForm.addEventListener('submit', handleLogin);
  document.getElementById('admin-logout-btn').addEventListener('click', handleLogout);

  // Product Form & Image Upload
  productForm.addEventListener('submit', handleProductSubmit);
  setupImageUpload();

  // Store Settings Form & Listeners
  const settingsForm = document.getElementById('admin-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSettingsSubmit);
  }
  const refreshSettingsBtn = document.getElementById('refresh-settings-btn');
  if (refreshSettingsBtn) {
    refreshSettingsBtn.addEventListener('click', () => {
      loadSettings();
      showToast('Settings reloaded from database');
    });
  }
  ['setting-announcement', 'setting-threshold', 'setting-standard-fee'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateSettingsLivePreview);
    }
  });

  // Order filter
  document.getElementById('order-status-filter').addEventListener('change', () => {
    loadOrders();
  });

  // Close modals on backdrop click
  document.getElementById('product-modal-backdrop').addEventListener('click', closeProductModal);

  // Request browser notification permission for orders
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Poll for new incoming orders every 15 seconds while dashboard is open
  setInterval(() => {
    if (authToken || localStorage.getItem('tayyaba_organics_admin_token')) {
      loadStats();
    }
  }, 15000);
});
