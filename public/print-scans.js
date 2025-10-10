// Fetch and display barcode scans for printing
let allScans = [];

// Load scans on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadScans();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('back-to-scanner-btn')?.addEventListener('click', () => {
        window.location.href = 'scanner.html';
    });

    document.getElementById('back-to-scanner-btn-2')?.addEventListener('click', () => {
        window.location.href = 'scanner.html';
    });

    document.getElementById('print-btn')?.addEventListener('click', () => {
        window.print();
    });
}

async function loadScans() {
    const loading = document.getElementById('loading');
    const noData = document.getElementById('no-data');
    const manualSection = document.getElementById('manual-entries-section');
    const skuSection = document.getElementById('sku-entries-section');

    try {
        const response = await fetch('/api/barcode-scans');
        if (!response.ok) throw new Error('Failed to fetch scans');

        allScans = await response.json();

        // Separate into two categories:
        // 1. Manual entries - Products not found in inventory (no inventory_id, has manual brand/name)
        // 2. SKU entries - Products found in inventory but barcode needs updating (has inventory_id and sku)

        const pureManualEntries = allScans.filter(scan =>
            !scan.inventory_id && scan.manual_brand && scan.manual_name
        );

        const skuEntries = allScans.filter(scan =>
            scan.inventory_id && scan.sku
        );

        // Remove duplicates by barcode for each section
        const uniqueManualEntries = removeDuplicatesByBarcode(pureManualEntries);
        const uniqueSkuEntries = removeDuplicatesByBarcode(skuEntries);

        loading.classList.add('hidden');

        if (uniqueManualEntries.length === 0 && uniqueSkuEntries.length === 0) {
            noData.classList.remove('hidden');
        } else {
            if (uniqueManualEntries.length > 0) {
                displayManualEntries(uniqueManualEntries);
                manualSection.classList.remove('hidden');
            }

            if (uniqueSkuEntries.length > 0) {
                displaySkuEntries(uniqueSkuEntries);
                skuSection.classList.remove('hidden');
            }
        }

    } catch (error) {
        console.error('Error loading scans:', error);
        loading.innerHTML = '<p class="error">Error loading scans. Please try again.</p>';
    }
}

function removeDuplicatesByBarcode(scans) {
    const seen = new Set();
    return scans.filter(scan => {
        if (seen.has(scan.barcode)) {
            return false;
        }
        seen.add(scan.barcode);
        return true;
    });
}

function displayManualEntries(entries) {
    const tbody = document.getElementById('manual-entries-body');
    const countSpan = document.getElementById('manual-count');

    countSpan.textContent = entries.length;
    tbody.innerHTML = '';

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="barcode-text">${escapeHtml(entry.barcode || '')}</td>
            <td class="barcode-image-cell">
                <img src="https://barcodeapi.org/api/auto/${encodeURIComponent(entry.barcode)}"
                     alt="Barcode ${escapeHtml(entry.barcode)}"
                     class="barcode-img"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <span class="barcode-error" style="display:none;">Unable to generate barcode</span>
            </td>
            <td>${escapeHtml(entry.manual_brand || '')}</td>
            <td>${escapeHtml(entry.manual_name || '')}</td>
        `;
        tbody.appendChild(row);
    });
}

function displaySkuEntries(entries) {
    const tbody = document.getElementById('sku-entries-body');
    const countSpan = document.getElementById('sku-count');

    countSpan.textContent = entries.length;
    tbody.innerHTML = '';

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="sku-text">${escapeHtml(entry.sku || '')}</td>
            <td class="barcode-text">${escapeHtml(entry.barcode || '')}</td>
            <td class="barcode-image-cell">
                <img src="https://barcodeapi.org/api/auto/${encodeURIComponent(entry.barcode)}"
                     alt="Barcode ${escapeHtml(entry.barcode)}"
                     class="barcode-img"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <span class="barcode-error" style="display:none;">Unable to generate barcode</span>
            </td>
            <td>${escapeHtml(entry.brand_name || '')}</td>
            <td>${escapeHtml(entry.name || '')}</td>
            <td>${entry.price ? '$' + parseFloat(entry.price).toFixed(2) : ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
