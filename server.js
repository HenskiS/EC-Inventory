const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('inventory.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Create inventory table
    db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_code TEXT,
            brand_name TEXT,
            name TEXT,
            sku TEXT,
            barcode TEXT,
            price REAL,
            stock INTEGER
        )
    `, (err) => {
        if (err) {
            console.error('Error creating inventory table:', err.message);
        } else {
            console.log('Inventory table ready');
        }
    });

    // Create orders table for persistence
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            items TEXT,
            total REAL,
            cash_total REAL,
            discount_rate REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed BOOLEAN DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('Error creating orders table:', err.message);
        } else {
            console.log('Orders table ready');
        }
    });
}

// Get unique brands for filter dropdown
app.get('/api/brands', (req, res) => {
    const sql = 'SELECT DISTINCT brand_name FROM inventory WHERE brand_name != "" ORDER BY brand_name';

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            const brands = rows.map(row => row.brand_name);
            res.json(brands);
        }
    });
});

// Search inventory endpoint - searches all fields with multiple terms and filters
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    const brandFilter = req.query.brand || '';
    const skuFilter = req.query.sku || '';
    const minPrice = parseFloat(req.query.min_price) || null;
    const maxPrice = parseFloat(req.query.max_price) || null;

    // Build WHERE conditions
    const conditions = [];
    const params = [];

    // Text search terms
    if (query.trim()) {
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        if (searchTerms.length > 0) {
            const termConditions = searchTerms.map(() =>
                `(LOWER(brand_code) LIKE ? OR LOWER(brand_name) LIKE ? OR LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(barcode) LIKE ?)`
            );
            conditions.push(`(${termConditions.join(' AND ')})`);

            searchTerms.forEach(term => {
                const wildcardTerm = `%${term}%`;
                params.push(wildcardTerm, wildcardTerm, wildcardTerm, wildcardTerm, wildcardTerm);
            });
        }
    }

    // Brand filter
    if (brandFilter.trim()) {
        conditions.push('brand_name = ?');
        params.push(brandFilter);
    }

    // SKU filter
    if (skuFilter.trim()) {
        conditions.push('LOWER(sku) LIKE ?');
        params.push(`%${skuFilter.toLowerCase()}%`);
    }

    // Price filters
    if (minPrice !== null) {
        conditions.push('price >= ?');
        params.push(minPrice);
    }

    if (maxPrice !== null) {
        conditions.push('price <= ?');
        params.push(maxPrice);
    }

    // Special case for cache refresh - return all inventory
    if (req.query.cache === 'true') {
        const sql = 'SELECT * FROM inventory ORDER BY brand_code, name';
        db.all(sql, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
        return;
    }

    // If no conditions and no query, return empty (unless there are filters)
    if (conditions.length === 0 && !query.trim()) {
        return res.json([]);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT * FROM inventory
        ${whereClause}
        ORDER BY brand_code, name
        LIMIT 100
    `;

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Save order endpoint
app.post('/api/orders', (req, res) => {
    const { items, total, cash_total, discount_rate } = req.body;

    const sql = `
        INSERT INTO orders (items, total, cash_total, discount_rate)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [JSON.stringify(items), total, cash_total, discount_rate], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ id: this.lastID });
        }
    });
});

// Get saved orders
app.get('/api/orders', (req, res) => {
    const sql = 'SELECT * FROM orders WHERE completed = 0 ORDER BY created_at DESC';

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            // Parse items JSON for each order
            const orders = rows.map(order => ({
                ...order,
                items: JSON.parse(order.items)
            }));
            res.json(orders);
        }
    });
});

// Mark order as completed
app.put('/api/orders/:id/complete', (req, res) => {
    const sql = 'UPDATE orders SET completed = 1 WHERE id = ?';

    db.run(sql, [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// Delete order
app.delete('/api/orders/:id', (req, res) => {
    const sql = 'DELETE FROM orders WHERE id = ?';

    db.run(sql, [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed');
        process.exit(0);
    });
});