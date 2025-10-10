# Cash Discount iPad App Project Summary

## **Project Goal:**
Build a mobile web app for iPad to replace manual cash discount calculations at a cigar store. Staff need to walk around the humidor, search inventory, build carts with automatic 40% cash discounts, and track sales for later inventory reconciliation.

## **Stack:**
Express for server
SQLite for server
Whatever for local
JS, HTML, and CSS for frontend

## **Data Source:**
Successfully created CSV export with these columns:
- **Brand_Code** (DAVIDOFF, LAAURORA, etc.)
- **Brand_Name** (full descriptions from Departments table)
- **Name** (product description combining ItemName + ItemName_Extra)
- **SKU** (ItemNum - internal item codes)
- **Barcode** (UPC codes for potential scanning)
- **Price** (retail price for discount calculation)
- **Stock** (current inventory levels)

## **App Requirements Confirmed:**
- Real-time inventory search (brand, name, SKU, barcode)
- Shopping cart with adjustable discount rate (default 40%)
- Order completion and local storage
- Export completed orders for CRE reconciliation
- Mobile-optimized interface for iPad use in humidor

## **SQL for getting CSV:**
```
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