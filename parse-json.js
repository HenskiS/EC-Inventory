const fs = require('fs');

// Read the JSON file
const data = JSON.parse(fs.readFileSync('./data/barcode-scans.json', 'utf8'));

// Filter for found: false
const notFound = data.filter(item => item.found === false);

// Separate into manual entries and sku entries
const manualEntries = notFound.filter(item => 
  item.manual_brand !== null || item.manual_name !== null
);

const skuEntries = notFound.filter(item => 
  item.manual_brand === null && item.manual_name === null
);

// Create CSV 1: Manual entries
const csv1Headers = 'barcode,manual_brand,manual_name\n';
const csv1Rows = manualEntries.map(item => 
  `${item.barcode},${item.manual_brand || ''},${item.manual_name || ''}`
).join('\n');
const csv1 = csv1Headers + csv1Rows;

// Create CSV 2: SKU entries
const csv2Headers = 'barcode,sku\n';
const csv2Rows = skuEntries.map(item => 
  `${item.barcode},${item.sku || ''}`
).join('\n');
const csv2 = csv2Headers + csv2Rows;

// Write the CSV files
fs.writeFileSync('./data/manual-entries.csv', csv1);
fs.writeFileSync('./data/sku-entries.csv', csv2);

console.log(`Created manual-entries.csv with ${manualEntries.length} records`);
console.log(`Created sku-entries.csv with ${skuEntries.length} records`);