const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');

const db = new sqlite3.Database('inventory.db');

function initializeDatabase(callback) {
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
    `, callback);
}

function importCSV(filename) {
    console.log(`Starting CSV import from ${filename}...`);

    // Ensure table exists first
    initializeDatabase((err) => {
        if (err) {
            console.error('Error creating table:', err.message);
            return;
        }

            // Clear existing data
            db.run('DELETE FROM inventory', (err) => {
                if (err) {
                    console.error('Error clearing inventory:', err);
                    return;
                }
                console.log('Cleared existing inventory data');

                let count = 0;

                fs.createReadStream(filename)
                    .pipe(csv({
                        headers: ['Brand_Code', 'Brand_Name', 'Name', 'SKU', 'Barcode', 'Price', 'Stock'],
                        skipEmptyLines: true,
                        stripBOM: true
                    }))
                    .on('data', (row) => {
                        // Insert row into database
                        const sql = `
                            INSERT INTO inventory (brand_code, brand_name, name, sku, barcode, price, stock)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `;

                        db.run(sql, [
                            row.Brand_Code || '',
                            row.Brand_Name || '',
                            row.Name || '',
                            row.SKU || '',
                            row.Barcode || '',
                            parseFloat(row.Price) || 0,
                            parseInt(row.Stock) || 0
                        ], (err) => {
                            if (err) {
                                console.error('Error inserting row:', err);
                            } else {
                                count++;
                            }
                        });
                    })
                    .on('end', () => {
                        console.log(`CSV import completed. Imported ${count} products.`);
                        db.close();
                    })
                    .on('error', (err) => {
                        console.error('Error reading CSV:', err);
                        db.close();
                    });
            });
        });
}

// Run import if CSV file is provided as argument
const csvFile = process.argv[2];
if (csvFile) {
    if (fs.existsSync(csvFile)) {
        importCSV(csvFile);
    } else {
        console.error(`CSV file not found: ${csvFile}`);
        console.log('Usage: node import-csv.js <path-to-csv-file>');
        process.exit(1);
    }
} else {
    console.log('Usage: node import-csv.js <path-to-csv-file>');
    console.log('Example: node import-csv.js inventory.csv');
}