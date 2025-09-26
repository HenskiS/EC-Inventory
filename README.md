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
- Password protection for staff access
- Real-time inventory search (brand, name, SKU, barcode)
- Shopping cart with adjustable discount rate (default 40%)
- Order completion and local storage
- Export completed orders for CRE reconciliation
- Mobile-optimized interface for iPad use in humidor
