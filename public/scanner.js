class BarcodeScannerApp {
    constructor() {
        this.scannedItems = [];
        this.currentBarcode = null;
        this.selectedProduct = null;
        this.isScanning = false;
        this.searchTimeout = null;

        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
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

        this.scannedItemsList = document.getElementById('scanned-items-list');
        this.scannedCount = document.getElementById('scanned-count');
        this.foundCount = document.getElementById('found-count');
        this.notFoundCount = document.getElementById('not-found-count');

        this.exportCsvBtn = document.getElementById('export-csv-btn');
        this.backToMainBtn = document.getElementById('back-to-main-btn');
        this.notification = document.getElementById('notification');
    }

    bindEvents() {
        this.startScannerBtn.addEventListener('click', () => this.startScanner());
        this.stopScannerBtn.addEventListener('click', () => this.stopScanner());
        this.manualSearchInput.addEventListener('input', (e) => this.handleManualSearch(e.target.value));
        this.linkBarcodeBtn.addEventListener('click', () => this.linkBarcodeToProduct());
        this.exportCsvBtn.addEventListener('click', () => this.exportToCSV());
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

            // Set up barcode detection with confidence filtering
            let lastDetectedCode = null;
            let detectionCount = 0;
            const REQUIRED_DETECTIONS = 2;
            const CONFIDENCE_THRESHOLD = 0.5;

            Quagga.onDetected((data) => {
                if (!this.isScanning) return;

                const code = data.codeResult.code;
                const confidence = data.codeResult.confidence || 0;

                console.log(`Detected: ${code}, Confidence: ${confidence.toFixed(2)}`);

                // Require minimum confidence
                if (confidence < CONFIDENCE_THRESHOLD) {
                    return;
                }

                // Count consecutive detections of the same code
                if (code === lastDetectedCode) {
                    detectionCount++;
                } else {
                    lastDetectedCode = code;
                    detectionCount = 1;
                }

                // Only accept after multiple consistent detections
                if (detectionCount >= REQUIRED_DETECTIONS) {
                    console.log(`Confirmed barcode: ${code}`);
                    this.handleBarcodeDetected(code);
                    lastDetectedCode = null;
                    detectionCount = 0;
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
                // Not found - need manual linking
                this.showNotification(`Barcode ${barcode} not found - please search manually`, 'error');
                this.scannerStatusText.textContent = `Barcode ${barcode} not found - search manually below`;
                this.showManualLinkUI(barcode);
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
        if (!this.selectedProduct || !this.currentBarcode) {
            this.showNotification('Please select a product first', 'error');
            return;
        }

        // Add to scanned items with the manually linked barcode
        this.addScannedItem(this.currentBarcode, this.selectedProduct, false);
        this.showNotification(`Linked barcode ${this.currentBarcode} to ${this.selectedProduct.name}`);

        // Clear manual linking UI
        this.linkBarcodeSection.classList.add('hidden');
        this.manualSearchInput.value = '';
        this.manualSearchResults.innerHTML = '';
        this.selectedProduct = null;
        this.scannerStatusText.textContent = 'Ready for next scan';
    }

    addScannedItem(barcode, product, found) {
        // Check if already scanned
        const existing = this.scannedItems.find(item => item.barcode === barcode);
        if (existing) {
            this.showNotification('This barcode was already scanned', 'error');
            return;
        }

        const scannedItem = {
            barcode: barcode,
            found: found,
            timestamp: new Date().toISOString(),
            ...product
        };

        this.scannedItems.unshift(scannedItem); // Add to beginning of array
        this.updateDisplay();
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

    removeScannedItem(index) {
        if (confirm('Remove this item from the list?')) {
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
