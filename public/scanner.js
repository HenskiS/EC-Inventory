class BarcodeScannerApp {
    constructor() {
        this.scannedItems = [];
        this.currentBarcode = null;
        this.selectedProduct = null;
        this.isScanning = false;
        this.searchTimeout = null;

        this.initializeElements();
        this.bindEvents();
        this.loadScannedItems();
    }

    initializeElements() {
        this.scannerContainer = document.getElementById('scanner-container');
        this.scannerStatusText = document.getElementById('scanner-status-text');
        this.startScannerBtn = document.getElementById('start-scanner-btn');
        this.stopScannerBtn = document.getElementById('stop-scanner-btn');

        this.manualSearchInput = document.getElementById('manual-search-input');
        this.manualSearchResults = document.getElementById('manual-search-results');
        this.linkBarcodeSection = document.getElementById('link-barcode-section');
        this.currentBarcodeSpan = document.getElementById('current-barcode');
        this.selectedProductInfo = document.getElementById('selected-product-info');
        this.linkBarcodeBtn = document.getElementById('link-barcode-btn');

        this.manualEntrySection = document.getElementById('manual-entry-section');
        this.manualEntryBarcodeSpan = document.getElementById('manual-entry-barcode');
        this.manualBrand = document.getElementById('manual-brand');
        this.manualName = document.getElementById('manual-name');
        this.addManualEntryBtn = document.getElementById('add-manual-entry-btn');

        this.scannedItemsList = document.getElementById('scanned-items-list');
        this.scannedCount = document.getElementById('scanned-count');
        this.foundCount = document.getElementById('found-count');
        this.notFoundCount = document.getElementById('not-found-count');

        this.printScansBtn = document.getElementById('print-scans-btn');
        this.exportCsvBtn = document.getElementById('export-csv-btn');
        this.clearAllBtn = document.getElementById('clear-all-btn');
        this.backToMainBtn = document.getElementById('back-to-main-btn');
        this.notification = document.getElementById('notification');
    }

    bindEvents() {
        this.startScannerBtn.addEventListener('click', () => this.startScanner());
        this.stopScannerBtn.addEventListener('click', () => this.stopScanner());
        this.manualSearchInput.addEventListener('input', (e) => this.handleManualSearch(e.target.value));
        this.linkBarcodeBtn.addEventListener('click', () => this.linkBarcodeToProduct());
        this.addManualEntryBtn.addEventListener('click', () => this.addManualEntry());
        this.printScansBtn.addEventListener('click', () => {
            window.location.href = 'print-scans.html';
        });
        this.exportCsvBtn.addEventListener('click', () => this.exportToCSV());
        this.clearAllBtn.addEventListener('click', () => this.clearAllScans());
        this.backToMainBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    async startScanner() {
        try {
            // Check if camera is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showNotification('Camera not available on this device', 'error');
                return;
            }

            this.isScanning = true;
            this.startScannerBtn.classList.add('hidden');
            this.stopScannerBtn.classList.remove('hidden');
            this.scannerStatusText.textContent = 'Initializing camera...';

            // Add scanning target overlay
            const targetOverlay = document.createElement('div');
            targetOverlay.className = 'scanner-target';
            this.scannerContainer.appendChild(targetOverlay);

            // Initialize Quagga2
            await new Promise((resolve, reject) => {
                Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: this.scannerContainer,
                        constraints: {
                            width: { min: 640, ideal: 1280, max: 1920 },
                            height: { min: 480, ideal: 720, max: 1080 },
                            facingMode: "environment",
                            aspectRatio: { min: 1, max: 2 }
                        },
                        area: { // Define scanning area (center 70% width, 40% height)
                            top: "30%",
                            right: "15%",
                            left: "15%",
                            bottom: "30%"
                        }
                    },
                    decoder: {
                        readers: [
                            "code_128_reader",
                            "ean_reader",
                            "ean_8_reader",
                            "code_39_reader",
                            "code_39_vin_reader",
                            "codabar_reader",
                            "upc_reader",
                            "upc_e_reader",
                            "i2of5_reader"
                        ],
                        debug: {
                            drawBoundingBox: true,
                            showFrequency: false,
                            drawScanline: true,
                            showPattern: false
                        }
                    },
                    locate: true,
                    locator: {
                        patchSize: "medium",
                        halfSample: true
                    },
                    frequency: 10
                }, (err) => {
                    if (err) {
                        console.error(err);
                        this.showNotification('Error starting camera: ' + err.message, 'error');
                        this.isScanning = false;
                        this.startScannerBtn.classList.remove('hidden');
                        this.stopScannerBtn.classList.add('hidden');
                        this.scannerStatusText.textContent = 'Failed to start';
                        reject(err);
                        return;
                    }
                    console.log("Quagga2 initialization finished");
                    Quagga.start();
                    this.scannerStatusText.textContent = 'Scanning... Position barcode in view';
                    resolve();
                });
            });

            // Set up barcode detection with vote-based filtering
            const detectedCodes = {};
            const VOTE_THRESHOLD = 5; // Need 5 votes for same code
            const VOTE_WINDOW = 2000; // 2 second window

            Quagga.onDetected((data) => {
                if (!this.isScanning) return;

                const code = data.codeResult.code;
                const now = Date.now();

                console.log(`Detected: ${code}`);

                // Initialize or update vote count for this code
                if (!detectedCodes[code]) {
                    detectedCodes[code] = { count: 1, firstSeen: now };
                } else {
                    detectedCodes[code].count++;
                }

                // Clean up old codes outside the window
                for (const c in detectedCodes) {
                    if (now - detectedCodes[c].firstSeen > VOTE_WINDOW) {
                        delete detectedCodes[c];
                    }
                }

                // Check if this code has enough votes
                if (detectedCodes[code].count >= VOTE_THRESHOLD) {
                    console.log(`Confirmed barcode: ${code} (${detectedCodes[code].count} detections)`);
                    this.handleBarcodeDetected(code);

                    // Clear all votes after successful scan
                    for (const c in detectedCodes) {
                        delete detectedCodes[c];
                    }
                }
            });

        } catch (error) {
            console.error('Error starting barcode scanner:', error);
            this.showNotification('Error starting camera', 'error');
            this.isScanning = false;
        }
    }

    stopScanner() {
        try {
            if (this.isScanning) {
                Quagga.stop();
                this.isScanning = false;
                this.scannerContainer.innerHTML = '';
                this.startScannerBtn.classList.remove('hidden');
                this.stopScannerBtn.classList.add('hidden');
                this.scannerStatusText.textContent = 'Scanner stopped';
            }
        } catch (error) {
            console.error('Error stopping barcode scanner:', error);
        }
    }

    async handleBarcodeDetected(barcode) {
        // Avoid duplicate rapid scans
        if (this.currentBarcode === barcode) {
            return;
        }

        console.log('Processing barcode:', barcode);
        this.currentBarcode = barcode;
        this.scannerStatusText.textContent = `Scanned: ${barcode} - Looking up...`;

        // Look up in inventory
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(barcode)}`);
            const results = await response.json();

            if (results && results.length > 0) {
                // Found in inventory
                const product = results[0];
                this.addScannedItem(barcode, product, true);
                this.showNotification(`Found: ${product.name}`);
                this.scannerStatusText.textContent = `Found: ${product.name} - Ready for next scan`;
            } else {
                // Not found - pause scanner and show manual options
                this.stopScanner();
                this.pendingBarcode = barcode; // Store for manual linking
                this.showNotification(`Barcode ${barcode} not found - link or enter manually`, 'error');
                this.scannerStatusText.textContent = `Barcode ${barcode} not found - use options below`;
                this.showManualLinkUI(barcode);
                this.showManualEntryUI(barcode);
            }
        } catch (error) {
            console.error('Error looking up barcode:', error);
            this.showNotification('Error looking up barcode', 'error');
            this.scannerStatusText.textContent = 'Error - Ready for next scan';
        }

        // Reset current barcode after a delay to allow re-scanning
        setTimeout(() => {
            this.currentBarcode = null;
        }, 2000);
    }

    showManualLinkUI(barcode) {
        this.currentBarcodeSpan.textContent = barcode;
        this.linkBarcodeSection.classList.remove('hidden');
        this.manualSearchInput.focus();
    }

    showManualEntryUI(barcode) {
        this.manualEntryBarcodeSpan.textContent = barcode;
        this.manualEntrySection.classList.remove('hidden');
    }

    handleManualSearch(query) {
        clearTimeout(this.searchTimeout);

        if (query.length < 2) {
            this.manualSearchResults.innerHTML = '';
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const results = await response.json();
                this.displayManualSearchResults(results);
            } catch (error) {
                console.error('Error searching:', error);
                this.showNotification('Error searching products', 'error');
            }
        }, 300);
    }

    displayManualSearchResults(results) {
        if (results.length === 0) {
            this.manualSearchResults.innerHTML = '<p style="color: #718096; padding: 10px;">No results found</p>';
            return;
        }

        this.manualSearchResults.innerHTML = results.map(item => `
            <div class="manual-result-item" data-item='${JSON.stringify(item)}'>
                <div class="result-name">${item.name}</div>
                <div class="result-details">
                    <span>${item.brand_name}</span>
                    <span>SKU: ${item.sku}</span>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        this.manualSearchResults.querySelectorAll('.manual-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemData = JSON.parse(item.dataset.item);
                this.selectProductForLinking(itemData);
            });
        });
    }

    selectProductForLinking(product) {
        this.selectedProduct = product;
        this.selectedProductInfo.innerHTML = `
            <div class="selected-product">
                <strong>${product.name}</strong>
                <div class="result-details">
                    <span>${product.brand_name}</span>
                    <span>SKU: ${product.sku}</span>
                    <span>$${product.price.toFixed(2)}</span>
                </div>
            </div>
        `;
    }

    linkBarcodeToProduct() {
        if (!this.selectedProduct) {
            this.showNotification('Please select a product first', 'error');
            return;
        }

        if (!this.pendingBarcode) {
            this.showNotification('No barcode to link', 'error');
            return;
        }

        // Add to scanned items with the manually linked barcode
        this.addScannedItem(this.pendingBarcode, this.selectedProduct, false);
        this.showNotification(`Linked barcode ${this.pendingBarcode} to ${this.selectedProduct.name}`);

        // Clear manual linking UI
        this.linkBarcodeSection.classList.add('hidden');
        this.manualEntrySection.classList.add('hidden');
        this.manualSearchInput.value = '';
        this.manualSearchResults.innerHTML = '';
        this.manualBrand.value = '';
        this.manualName.value = '';
        this.selectedProduct = null;
        this.pendingBarcode = null;
        this.scannerStatusText.textContent = 'Ready for next scan';
    }

    addManualEntry() {
        if (!this.pendingBarcode) {
            this.showNotification('No barcode to add', 'error');
            return;
        }

        const brand = this.manualBrand.value.trim();
        const name = this.manualName.value.trim();

        if (!brand || !name) {
            this.showNotification('Please enter both brand and product name', 'error');
            return;
        }

        // Create a product object with manual entry data
        const manualProduct = {
            name: name,
            brand_name: brand,
            brand_code: '',
            sku: '',
            price: null,
            stock: null
        };

        // Add to scanned items
        this.addScannedItem(this.pendingBarcode, manualProduct, false);
        this.showNotification(`Added manual entry for barcode ${this.pendingBarcode}`);

        // Clear UI
        this.linkBarcodeSection.classList.add('hidden');
        this.manualEntrySection.classList.add('hidden');
        this.manualSearchInput.value = '';
        this.manualSearchResults.innerHTML = '';
        this.manualBrand.value = '';
        this.manualName.value = '';
        this.selectedProduct = null;
        this.pendingBarcode = null;
        this.scannerStatusText.textContent = 'Ready for next scan';
    }

    async addScannedItem(barcode, product, found) {
        // Check if already scanned
        const existing = this.scannedItems.find(item => item.barcode === barcode);
        if (existing) {
            this.showNotification('This barcode was already scanned', 'error');
            return;
        }

        // Create item with product data, but preserve the scanned barcode
        const scannedItem = {
            ...product,
            barcode: barcode, // Override with scanned barcode (product.barcode might be blank)
            found: found,
            timestamp: new Date().toISOString()
        };

        // Save to database
        try {
            const response = await fetch('/api/barcode-scans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    barcode: barcode,
                    found: found,
                    inventory_id: product.id || null,
                    manual_brand: !found && !product.id ? product.brand_name : null,
                    manual_name: !found && !product.id ? product.name : null,
                    sku: product.sku || null,
                    brand_name: product.brand_name || null,
                    brand_code: product.brand_code || null,
                    price: product.price || null,
                    stock: product.stock || null,
                    name: product.name || null
                })
            });

            if (response.ok) {
                const result = await response.json();
                scannedItem.id = result.id; // Store the database ID
            }
        } catch (error) {
            console.error('Error saving scan to database:', error);
            // Continue anyway - we'll still show it in the UI
        }

        this.scannedItems.unshift(scannedItem); // Add to beginning of array
        this.updateDisplay();
    }

    async loadScannedItems() {
        try {
            const response = await fetch('/api/barcode-scans');
            if (response.ok) {
                const scans = await response.json();
                this.scannedItems = scans.map(scan => ({
                    id: scan.id,
                    barcode: scan.barcode,
                    found: scan.found,
                    timestamp: scan.scanned_at,
                    sku: scan.sku,
                    brand_name: scan.manual_brand || scan.brand_name,
                    brand_code: scan.brand_code,
                    price: scan.price,
                    stock: scan.stock,
                    name: scan.manual_name || scan.name
                }));
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Error loading scanned items:', error);
            this.updateDisplay();
        }
    }

    updateDisplay() {
        const totalCount = this.scannedItems.length;
        const foundItems = this.scannedItems.filter(item => item.found).length;
        const notFoundItems = totalCount - foundItems;

        this.scannedCount.textContent = totalCount;
        this.foundCount.textContent = foundItems;
        this.notFoundCount.textContent = notFoundItems;

        if (this.scannedItems.length === 0) {
            this.scannedItemsList.innerHTML = '<p style="color: #718096; padding: 20px; text-align: center;">No items scanned yet</p>';
            return;
        }

        this.scannedItemsList.innerHTML = this.scannedItems.map((item, index) => `
            <div class="scanned-item ${item.found ? 'found' : 'not-found'}">
                <div class="scanned-item-header">
                    <span class="status-badge ${item.found ? 'badge-success' : 'badge-error'}">
                        ${item.found ? '✓ Found' : '✗ Not Found'}
                    </span>
                    <button class="remove-scanned-btn" onclick="scannerApp.removeScannedItem(${index})" title="Remove">✕</button>
                </div>
                <div class="scanned-item-body">
                    <div class="scanned-barcode">Barcode: <strong>${item.barcode}</strong></div>
                    ${item.name ? `
                        <div class="scanned-product-name">${item.name}</div>
                        <div class="scanned-details">
                            <span>Brand: ${item.brand_name || 'N/A'}</span>
                            <span>SKU: ${item.sku || 'N/A'}</span>
                            <span>Price: $${item.price ? item.price.toFixed(2) : 'N/A'}</span>
                            <span>Stock: ${item.stock !== undefined ? item.stock : 'N/A'}</span>
                        </div>
                    ` : '<div class="no-product-info">Product information not available</div>'}
                </div>
            </div>
        `).join('');
    }

    async removeScannedItem(index) {
        if (confirm('Remove this item from the list?')) {
            const item = this.scannedItems[index];

            // Delete from database if it has an ID
            if (item.id) {
                try {
                    await fetch(`/api/barcode-scans/${item.id}`, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.error('Error deleting scan from database:', error);
                }
            }

            this.scannedItems.splice(index, 1);
            this.updateDisplay();
            this.showNotification('Item removed');
        }
    }

    exportToCSV() {
        if (this.scannedItems.length === 0) {
            this.showNotification('No items to export', 'error');
            return;
        }

        // CSV headers
        const headers = ['Barcode', 'Found', 'SKU', 'Brand Name', 'Brand Code', 'Price', 'Stock', 'Product Name'];

        // CSV rows
        const rows = this.scannedItems.map(item => [
            item.barcode || '',
            item.found ? 'Yes' : 'No',
            item.sku || '',
            item.brand_name || '',
            item.brand_code || '',
            item.price !== undefined ? item.price.toFixed(2) : '',
            item.stock !== undefined ? item.stock : '',
            item.name || ''
        ]);

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => {
                // Escape cells that contain commas or quotes
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(','))
        ].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.setAttribute('href', url);
        link.setAttribute('download', `barcode-scan-${timestamp}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification(`Exported ${this.scannedItems.length} items to CSV`);
    }

    async clearAllScans() {
        if (this.scannedItems.length === 0) {
            this.showNotification('No scans to clear', 'error');
            return;
        }

        if (!confirm(`Clear all ${this.scannedItems.length} scanned items? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch('/api/barcode-scans', {
                method: 'DELETE'
            });

            if (response.ok) {
                this.scannedItems = [];
                this.updateDisplay();
                this.showNotification('All scans cleared');
            } else {
                throw new Error('Failed to clear scans');
            }
        } catch (error) {
            console.error('Error clearing scans:', error);
            this.showNotification('Error clearing scans', 'error');
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
    window.scannerApp = new BarcodeScannerApp();
});
