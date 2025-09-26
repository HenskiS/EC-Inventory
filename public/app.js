class InventoryApp {
    constructor() {
        this.cart = [];
        this.currentView = 'search';
        this.searchTimeout = null;
        this.isOnline = navigator.onLine;
        this.inventoryCache = null;
        this.brandsCache = null;
        this.pendingOrders = JSON.parse(localStorage.getItem('pendingOrders') || '[]');

        this.initializeElements();
        this.bindEvents();
        this.updateCartDisplay();
        this.setupOfflineHandlers();
        this.loadBrands();
        this.loadInventoryCache();

        // Initialize clear button as hidden
        this.clearSearchBtn.classList.add('hidden');

        // Initialize discount controls
        this.handleDiscountToggle();
    }

    setupOfflineHandlers() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('Back online - syncing pending orders...');
            this.syncPendingOrders();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('You are now offline - orders will be saved locally', 'error');
        });
    }

    async loadInventoryCache() {
        // Try to load from cache first
        const cachedInventory = localStorage.getItem('inventoryCache');
        const cacheTimestamp = localStorage.getItem('inventoryCacheTimestamp');

        if (cachedInventory && cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp);
            // Use cache if less than 1 hour old
            if (cacheAge < 60 * 60 * 1000) {
                this.inventoryCache = JSON.parse(cachedInventory);
                console.log('Loaded inventory from cache');
            }
        }

        // If online, refresh cache
        if (this.isOnline) {
            try {
                const response = await fetch('/api/search?q=');
                if (response.ok) {
                    // Get all inventory by searching with empty query but with a special parameter
                    const allInventoryResponse = await fetch('/api/search?cache=true');
                    if (allInventoryResponse.ok) {
                        const allInventory = await allInventoryResponse.json();
                        this.inventoryCache = allInventory;
                        localStorage.setItem('inventoryCache', JSON.stringify(allInventory));
                        localStorage.setItem('inventoryCacheTimestamp', Date.now().toString());
                        console.log('Updated inventory cache');
                    }
                }
            } catch (error) {
                console.log('Failed to update inventory cache, using offline data');
            }
        }
    }

    async syncPendingOrders() {
        if (this.pendingOrders.length === 0) {
            return;
        }

        const ordersToSync = [...this.pendingOrders];
        let successCount = 0;

        for (const orderData of ordersToSync) {
            try {
                // Remove offline-specific fields
                const { offline_id, ...serverOrderData } = orderData;

                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serverOrderData)
                });

                if (response.ok) {
                    // Remove from pending orders
                    this.pendingOrders = this.pendingOrders.filter(o => o.offline_id !== offline_id);
                    successCount++;
                }
            } catch (error) {
                console.error('Error syncing order:', error);
                break; // Stop syncing if we hit an error
            }
        }

        // Update localStorage
        localStorage.setItem('pendingOrders', JSON.stringify(this.pendingOrders));

        if (successCount > 0) {
            this.showNotification(`Synced ${successCount} pending order(s)`);
        }

        if (this.pendingOrders.length > 0) {
            this.showNotification(`${this.pendingOrders.length} orders still pending`, 'error');
        }
    }

    initializeElements() {
        this.searchInput = document.getElementById('search-input');
        this.clearSearchBtn = document.getElementById('clear-search-btn');
        this.searchResults = document.getElementById('search-results-list');
        this.cartItems = document.getElementById('cart-items');

        // Filter elements
        this.brandFilter = document.getElementById('brand-filter');
        this.skuFilter = document.getElementById('sku-filter');
        this.priceMin = document.getElementById('price-min');
        this.priceMax = document.getElementById('price-max');
        this.clearFiltersBtn = document.getElementById('clear-filters-btn');

        // Discount elements
        this.discountEnabled = document.getElementById('discount-enabled');
        this.discountRate = document.getElementById('discount-rate');
        this.subtotal = document.getElementById('subtotal');
        this.discountAmount = document.getElementById('discount-amount');
        this.discountLabel = document.getElementById('discount-label');
        this.cashTotal = document.getElementById('cash-total');

        this.searchSection = document.getElementById('search-section');
        this.cartSection = document.getElementById('cart-section');
        this.ordersSection = document.getElementById('orders-section');

        this.notification = document.getElementById('notification');
    }

    bindEvents() {
        // Search
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.searchInput.addEventListener('keydown', (e) => this.handleSearchKeydown(e));
        this.clearSearchBtn.addEventListener('click', () => this.clearSearch());
        document.addEventListener('click', (e) => this.handleDocumentClick(e));

        // Filters
        this.brandFilter.addEventListener('change', () => this.handleFiltersChange());
        this.skuFilter.addEventListener('input', () => this.handleFiltersChange());
        this.skuFilter.addEventListener('keydown', (e) => this.handleFilterKeydown(e));
        this.priceMin.addEventListener('input', () => this.handleFiltersChange());
        this.priceMin.addEventListener('keydown', (e) => this.handleFilterKeydown(e));
        this.priceMax.addEventListener('input', () => this.handleFiltersChange());
        this.priceMax.addEventListener('keydown', (e) => this.handleFilterKeydown(e));
        this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());

        // Discount controls
        this.discountEnabled.addEventListener('change', () => this.handleDiscountToggle());
        this.discountRate.addEventListener('change', () => this.updateCartDisplay());

        // Navigation
        document.getElementById('new-order-btn').addEventListener('click', () => this.showSearch());
        document.getElementById('saved-orders-btn').addEventListener('click', () => this.showSavedOrders());
        document.getElementById('back-to-search-btn').addEventListener('click', () => this.showSearch());

        // Cart actions
        document.getElementById('save-order-btn').addEventListener('click', () => this.saveOrder());
        document.getElementById('clear-cart-btn').addEventListener('click', () => this.clearCart());
    }

    async loadBrands() {
        // Try to load from cache first
        const cachedBrands = localStorage.getItem('brandsCache');
        if (cachedBrands) {
            this.brandsCache = JSON.parse(cachedBrands);
            this.populateBrandsDropdown(this.brandsCache);
        }

        // If online, refresh brands cache
        if (this.isOnline) {
            try {
                const response = await fetch('/api/brands');
                if (response.ok) {
                    const brands = await response.json();
                    this.brandsCache = brands;
                    localStorage.setItem('brandsCache', JSON.stringify(brands));
                    this.populateBrandsDropdown(brands);
                }
            } catch (error) {
                console.error('Error loading brands:', error);
                // Use cached data if available
                if (this.brandsCache) {
                    this.populateBrandsDropdown(this.brandsCache);
                }
            }
        } else if (this.brandsCache) {
            this.populateBrandsDropdown(this.brandsCache);
        }
    }

    populateBrandsDropdown(brands) {
        // Clear existing options (keep "All Brands")
        this.brandFilter.innerHTML = '<option value="">All Brands</option>';

        // Add brand options
        brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            this.brandFilter.appendChild(option);
        });
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);

        // Show/hide clear button
        if (query.length > 0) {
            this.clearSearchBtn.classList.remove('hidden');
        } else {
            this.clearSearchBtn.classList.add('hidden');
        }

        this.searchTimeout = setTimeout(() => {
            this.performSearch();
        }, 300);
    }

    handleSearchKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.searchInput.blur(); // Hide keyboard on mobile
            this.performSearch(); // Trigger search immediately
        }
    }

    handleFilterKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur(); // Hide keyboard on mobile
            this.performSearch(); // Trigger search immediately
        }
    }

    handleFiltersChange() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch();
        }, 300);
    }

    clearSearch() {
        this.searchInput.value = '';
        this.clearSearchBtn.classList.add('hidden');
        this.performSearch();
        this.searchInput.focus();
    }

    clearFilters() {
        this.brandFilter.value = '';
        this.skuFilter.value = '';
        this.priceMin.value = '';
        this.priceMax.value = '';
        this.performSearch();
    }

    handleDiscountToggle() {
        const isEnabled = this.discountEnabled.checked;
        this.discountRate.disabled = !isEnabled;

        if (!isEnabled) {
            this.discountRate.value = 0;
        } else if (this.discountRate.value == 0) {
            this.discountRate.value = 40; // Default back to 40%
        }

        this.updateCartDisplay();
    }

    hasActiveFilters() {
        const query = this.searchInput.value.trim();
        const brand = this.brandFilter.value;
        const sku = this.skuFilter.value.trim();
        const minPrice = this.priceMin.value;
        const maxPrice = this.priceMax.value;

        return query.length >= 2 || brand || sku || minPrice || maxPrice;
    }

    async performSearch() {
        try {
            if (!this.hasActiveFilters()) {
                this.searchResults.innerHTML = '<p style="color: #718096; text-align: center; padding: 40px;">Type at least 2 characters or set filters to search...</p>';
                return;
            }

            let results = [];

            if (this.isOnline) {
                // Online search
                const params = new URLSearchParams();

                // Add search query
                const query = this.searchInput.value.trim();
                if (query) {
                    params.append('q', query);
                }

                // Add filters
                if (this.brandFilter.value) {
                    params.append('brand', this.brandFilter.value);
                }

                if (this.skuFilter.value.trim()) {
                    params.append('sku', this.skuFilter.value.trim());
                }

                if (this.priceMin.value) {
                    params.append('min_price', this.priceMin.value);
                }

                if (this.priceMax.value) {
                    params.append('max_price', this.priceMax.value);
                }

                const response = await fetch(`/api/search?${params.toString()}`);
                results = await response.json();
            } else {
                // Offline search using cached data
                results = this.searchOffline();
            }

            this.displaySearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            // Try offline search as fallback
            if (this.inventoryCache) {
                const results = this.searchOffline();
                this.displaySearchResults(results);
                this.showNotification('Using offline data', 'error');
            } else {
                this.showNotification('Search error occurred - no offline data available', 'error');
            }
        }
    }

    searchOffline() {
        if (!this.inventoryCache) {
            return [];
        }

        const query = this.searchInput.value.trim().toLowerCase();
        const brand = this.brandFilter.value;
        const sku = this.skuFilter.value.trim().toLowerCase();
        const minPrice = parseFloat(this.priceMin.value) || null;
        const maxPrice = parseFloat(this.priceMax.value) || null;

        let results = [...this.inventoryCache];

        // Text search
        if (query) {
            const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
            results = results.filter(item => {
                return searchTerms.every(term => {
                    return (
                        (item.brand_code && item.brand_code.toLowerCase().includes(term)) ||
                        (item.brand_name && item.brand_name.toLowerCase().includes(term)) ||
                        (item.name && item.name.toLowerCase().includes(term)) ||
                        (item.sku && item.sku.toLowerCase().includes(term)) ||
                        (item.barcode && item.barcode.toLowerCase().includes(term))
                    );
                });
            });
        }

        // Brand filter
        if (brand) {
            results = results.filter(item => item.brand_name === brand);
        }

        // SKU filter
        if (sku) {
            results = results.filter(item => item.sku && item.sku.toLowerCase().includes(sku));
        }

        // Price filters
        if (minPrice !== null) {
            results = results.filter(item => item.price >= minPrice);
        }

        if (maxPrice !== null) {
            results = results.filter(item => item.price <= maxPrice);
        }

        // Limit results
        return results.slice(0, 100);
    }

    displaySearchResults(results) {
        if (results.length === 0) {
            this.searchResults.innerHTML = '<p style="color: #718096; text-align: center; padding: 40px;">No results found</p>';
            return;
        }

        this.searchResults.innerHTML = results.map(item => `
            <div class="search-result-item" data-item='${JSON.stringify(item)}'>
                <div class="result-name">${item.name}</div>
                <div class="result-details">
                    <span>${item.brand_name}</span>
                    <span>SKU: ${item.sku}</span>
                    <span class="result-price">$${item.price.toFixed(2)}</span>
                    <span>Stock: ${item.stock}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers to results
        this.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemData = JSON.parse(item.dataset.item);
                this.addToCart(itemData);
                this.searchInput.value = '';
            });
        });
    }

    handleDocumentClick(e) {
        // Document click handling not needed for split view
    }

    addToCart(item) {
        const existingItem = this.cart.find(cartItem => cartItem.id === item.id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...item,
                quantity: 1
            });
        }

        this.updateCartDisplay();
        this.showNotification(`Added ${item.name} to cart`);
    }

    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.updateCartDisplay();
    }

    updateQuantity(itemId, change) {
        const item = this.cart.find(cartItem => cartItem.id === itemId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                this.removeFromCart(itemId);
            } else {
                this.updateCartDisplay();
            }
        }
    }

    updateCartDisplay() {
        const isDiscountEnabled = this.discountEnabled.checked;
        const discountPercent = isDiscountEnabled ? (parseInt(this.discountRate.value) || 0) : 0;

        this.discountLabel.textContent = `Cash Discount (${discountPercent}%):`;

        if (this.cart.length === 0) {
            this.cartItems.innerHTML = '<p style="color: #718096; text-align: center; padding: 40px;">Cart is empty</p>';
        } else {
            this.cartItems.innerHTML = this.cart.map(item => {
                const itemTotal = item.price * item.quantity;
                const itemCashTotal = itemTotal * (1 - discountPercent / 100);
                const showDiscount = discountPercent > 0;

                return `
                    <div class="cart-item">
                        <div class="item-info">
                            <div class="item-name">${item.name}</div>
                            <div class="item-details">${item.brand_name} - SKU: ${item.sku}</div>
                        </div>
                        <div class="item-quantity">
                            <button class="qty-btn" onclick="app.updateQuantity(${item.id}, -1)">-</button>
                            <span class="qty-display">${item.quantity}</span>
                            <button class="qty-btn" onclick="app.updateQuantity(${item.id}, 1)">+</button>
                        </div>
                        <div class="item-prices">
                            ${showDiscount ? `<div class="original-price">$${itemTotal.toFixed(2)}</div>` : ''}
                            <div class="${showDiscount ? 'cash-price' : 'regular-price'}">$${itemCashTotal.toFixed(2)}</div>
                        </div>
                        <button class="remove-btn" onclick="app.removeFromCart(${item.id})">Remove</button>
                    </div>
                `;
            }).join('');
        }

        // Update totals
        const subtotalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = subtotalAmount * (discountPercent / 100);
        const cashTotalAmount = subtotalAmount - discountAmount;

        this.subtotal.textContent = `$${subtotalAmount.toFixed(2)}`;
        this.discountAmount.textContent = `-$${discountAmount.toFixed(2)}`;
        this.cashTotal.textContent = `$${cashTotalAmount.toFixed(2)}`;

        // Update total labels based on discount state
        const finalTotalRow = document.querySelector('.final-total span:first-child');
        if (finalTotalRow) {
            finalTotalRow.textContent = discountPercent > 0 ? 'Cash Total:' : 'Total:';
        }
    }

    async saveOrder() {
        if (this.cart.length === 0) {
            this.showNotification('Cart is empty', 'error');
            return;
        }

        const discountPercent = parseInt(this.discountRate.value) || 0;
        const subtotalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const cashTotalAmount = subtotalAmount * (1 - discountPercent / 100);

        const orderData = {
            items: this.cart,
            total: subtotalAmount,
            cash_total: cashTotalAmount,
            discount_rate: discountPercent,
            created_at: new Date().toISOString()
        };

        if (this.isOnline) {
            try {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                });

                if (response.ok) {
                    this.showNotification('Order saved successfully');
                    this.clearCart();
                    return;
                }
            } catch (error) {
                console.error('Error saving order online:', error);
            }
        }

        // Save offline (either we're offline or online save failed)
        this.saveOrderOffline(orderData);
    }

    saveOrderOffline(orderData) {
        // Add unique ID for offline orders
        orderData.offline_id = 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        this.pendingOrders.push(orderData);
        localStorage.setItem('pendingOrders', JSON.stringify(this.pendingOrders));

        this.showNotification('Order saved offline - will sync when online', 'error');
        this.clearCart();
    }

    clearCart() {
        this.cart = [];
        this.updateCartDisplay();
    }

    showSearch() {
        this.currentView = 'search';
        this.searchSection.classList.remove('hidden');
        document.querySelector('.main-content').classList.remove('hidden');
        this.ordersSection.classList.add('hidden');
    }

    async showSavedOrders() {
        this.currentView = 'orders';
        this.searchSection.classList.add('hidden');
        document.querySelector('.main-content').classList.add('hidden');
        this.ordersSection.classList.remove('hidden');

        await this.loadSavedOrders();
    }

    async loadSavedOrders() {
        let serverOrders = [];

        if (this.isOnline) {
            try {
                const response = await fetch('/api/orders');
                if (response.ok) {
                    serverOrders = await response.json();
                }
            } catch (error) {
                console.error('Error loading orders:', error);
                this.showNotification('Error loading server orders - showing offline orders only', 'error');
            }
        }

        // Combine server orders and pending offline orders
        const allOrders = [
            ...serverOrders,
            ...this.pendingOrders.map(order => ({
                ...order,
                id: order.offline_id,
                is_pending: true
            }))
        ];

        // Sort by creation date (newest first)
        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        this.displaySavedOrders(allOrders);
    }

    displaySavedOrders(orders) {
        const ordersList = document.getElementById('saved-orders-list');

        if (orders.length === 0) {
            ordersList.innerHTML = '<p style="color: #718096; text-align: center; padding: 40px;">No saved orders</p>';
            return;
        }

        ordersList.innerHTML = orders.map(order => {
            const date = new Date(order.created_at).toLocaleString();
            const isPending = order.is_pending;
            const orderClass = isPending ? 'saved-order pending-order' : 'saved-order';

            return `
                <div class="${orderClass}">
                    <div class="order-header">
                        <div class="order-date">
                            ${date}
                            ${isPending ? '<span class="pending-badge">PENDING SYNC</span>' : ''}
                        </div>
                        <div class="order-total">Cash Total: $${order.cash_total.toFixed(2)}</div>
                    </div>
                    <div class="order-items">
                        ${order.items.map(item => `
                            <div class="order-item">
                                <span>${item.quantity}x ${item.name}</span>
                                <span>$${(item.price * item.quantity * (1 - order.discount_rate / 100)).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="order-actions">
                        <button class="btn-secondary btn-small" onclick="app.loadOrderToCart('${order.id}')">Load to Cart</button>
                        ${isPending ?
                            `<button class="btn-danger btn-small" onclick="app.deleteOfflineOrder('${order.id}')">Delete</button>` :
                            `<button class="btn-primary btn-small" onclick="app.completeOrder(${order.id})">Mark Complete</button>
                             <button class="btn-danger btn-small" onclick="app.deleteOrder(${order.id})">Delete</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadOrderToCart(orderId) {
        let order = null;

        // Check if it's a pending offline order
        if (orderId.startsWith('offline_')) {
            order = this.pendingOrders.find(o => o.offline_id === orderId);
        } else {
            // Load from server
            try {
                const response = await fetch('/api/orders');
                if (response.ok) {
                    const orders = await response.json();
                    order = orders.find(o => o.id === parseInt(orderId));
                }
            } catch (error) {
                console.error('Error loading order:', error);
                this.showNotification('Error loading order', 'error');
                return;
            }
        }

        if (order) {
            this.cart = order.items.map(item => ({...item}));
            this.discountRate.value = order.discount_rate;
            this.updateCartDisplay();
            this.showSearch();
            this.showNotification('Order loaded to cart');
        }
    }

    deleteOfflineOrder(offlineId) {
        if (!confirm('Are you sure you want to delete this pending order? This cannot be undone.')) {
            return;
        }

        this.pendingOrders = this.pendingOrders.filter(o => o.offline_id !== offlineId);
        localStorage.setItem('pendingOrders', JSON.stringify(this.pendingOrders));

        this.showNotification('Pending order deleted');
        this.loadSavedOrders();
    }

    async completeOrder(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}/complete`, {
                method: 'PUT'
            });

            if (response.ok) {
                this.showNotification('Order marked as complete');
                await this.loadSavedOrders();
            } else {
                throw new Error('Failed to complete order');
            }
        } catch (error) {
            console.error('Error completing order:', error);
            this.showNotification('Error completing order', 'error');
        }
    }

    async deleteOrder(orderId) {
        if (!confirm('Are you sure you want to delete this order? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification('Order deleted');
                await this.loadSavedOrders();
            } else {
                throw new Error('Failed to delete order');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            this.showNotification('Error deleting order', 'error');
        }
    }

    showNotification(message, type = 'success') {
        this.notification.textContent = message;
        this.notification.className = `notification ${type} show`;

        setTimeout(() => {
            this.notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new InventoryApp();
});