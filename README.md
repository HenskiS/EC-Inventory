# EC Inventory - Cash Discount & Barcode Scanner App

## **Project Overview:**
Mobile web app for iPad/desktop to manage cash discount calculations and barcode inventory scanning at a cigar store. Two main features:
1. **Cash Discount Calculator** - Build orders with automatic 40% discount
2. **Barcode Scanner** - Walk the humidor and scan products to verify inventory barcodes

## **Stack:**
- **Backend:** Express.js + SQLite
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Barcode Scanning:** Quagga2 (1D barcode reader)

## **Features:**

### Cash Discount Calculator
- Real-time inventory search (brand, name, SKU, barcode)
- Multiple filter options (brand dropdown, SKU, price range)
- Shopping cart with adjustable discount rate (default 40%)
- Order persistence with offline support
- Saved orders management
- Mobile-optimized interface for iPad

### Barcode Scanner
- Live camera barcode scanning with Quagga2
- Auto-lookup in inventory database
- Manual product search and barcode linking
- Manual entry for products not in inventory (brand + name/size)
- Running list of scanned items (found/not found)
- CSV export with full product data
- Database persistence (survives page refresh)
- Clear all functionality

## **Data Source:**
Inventory CSV export with these columns:
- **Brand_Code** (DAVIDOFF, LAAURORA, etc.)
- **Brand_Name** (full descriptions from Departments table)
- **Name** (product description combining ItemName + ItemName_Extra)
- **SKU** (ItemNum - internal item codes)
- **Barcode** (UPC codes for scanning)
- **Price** (retail price for discount calculation)
- **Stock** (current inventory levels)

## **Database Tables:**

### `inventory`
Main product database imported from CRE
- id, brand_code, brand_name, name, sku, barcode, price, stock

### `orders`
Saved discount calculator orders
- id, items (JSON), total, cash_total, discount_rate, created_at, completed

### `barcode_scans`
Persistent barcode scanner data
- id, barcode, found, inventory_id (FK), manual_brand, manual_name, sku, brand_name, brand_code, price, stock, name, scanned_at

## **Setup:**
1. Install dependencies: `npm install`
2. Import inventory CSV: `node import-csv.js path/to/inventory.csv`
3. Start server: `npm start`
4. Open browser: `http://localhost:3001`

## **Usage:**
- **Main App:** Cash discount calculator with search and cart
- **Barcode Scanner:** Click "Barcode Scanner" button in header

## **SQL for getting CSV from CRE:**
```sql
-- Export inventory with proper brand descriptions from Departments table
SELECT
    UPPER(LTRIM(RTRIM(i.Dept_ID))) as Brand_Code,
    ISNULL(UPPER(LTRIM(RTRIM(d.Description))), '') as Brand_Name,
    LTRIM(RTRIM(i.ItemName + ISNULL(' ' + i.ItemName_Extra, ''))) as Name,
    LTRIM(RTRIM(i.ItemNum)) as SKU,
    LTRIM(RTRIM(ISNULL(s.AltSKU, ''))) as Barcode,
    CAST(i.Price as DECIMAL(10,2)) as Price,
    CAST(i.In_Stock as DECIMAL(10,2)) as Stock
FROM Inventory i
LEFT JOIN Departments d ON i.Dept_ID = d.Dept_ID AND i.Store_ID = d.Store_ID
LEFT JOIN Inventory_SKUS s ON i.ItemNum = s.ItemNum AND i.Store_ID = s.Store_ID
ORDER BY i.Dept_ID, i.ItemName;
```