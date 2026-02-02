import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample store
  const store = await prisma.store.upsert({
    where: { code: 'WH01' },
    update: {},
    create: {
      name: 'Main Warehouse',
      code: 'WH01',
      address: '123 Warehouse St',
      timezone: 'Australia/Sydney',
    },
  });

  console.log('Created store:', store.name);

  // Create sample barcodes
  const sampleBarcodes = [
    { barcode: '9300675024235', sku: 'SKU001', description: 'Product A', category: 'Category 1' },
    { barcode: '9300675024242', sku: 'SKU002', description: 'Product B', category: 'Category 1' },
    { barcode: '9300675024259', sku: 'SKU003', description: 'Product C', category: 'Category 2' },
    { barcode: '9300675024266', sku: 'SKU004', description: 'Product D', category: 'Category 2' },
    { barcode: '9300675024273', sku: 'SKU005', description: 'Product E', category: 'Category 3' },
  ];

  for (const item of sampleBarcodes) {
    await prisma.barcodeMaster.upsert({
      where: { storeId_barcode: { storeId: store.id, barcode: item.barcode } },
      update: item,
      create: { storeId: store.id, ...item },
    });
  }

  console.log('Created', sampleBarcodes.length, 'sample barcodes');

  // Create sample stocktake
  const stocktake = await prisma.stocktake.upsert({
    where: { id: 'sample-stocktake-1' },
    update: {},
    create: {
      id: 'sample-stocktake-1',
      storeId: store.id,
      name: 'Test Stocktake',
      pin: '1234',
      status: 'ACTIVE',
      startedAt: new Date(),
      notes: 'Sample stocktake for testing',
    },
  });

  console.log('Created stocktake:', stocktake.name, '(PIN:', stocktake.pin, ')');

  // Create sample areas
  const areas = [
    { code: 'A1', name: 'Aisle 1', description: 'First aisle' },
    { code: 'A2', name: 'Aisle 2', description: 'Second aisle' },
    { code: 'A3', name: 'Aisle 3', description: 'Third aisle' },
    { code: 'BK', name: 'Back Room', description: 'Storage area' },
  ];

  for (let i = 0; i < areas.length; i++) {
    await prisma.stocktakeArea.upsert({
      where: { stocktakeId_code: { stocktakeId: stocktake.id, code: areas[i].code } },
      update: {},
      create: {
        stocktakeId: stocktake.id,
        ...areas[i],
        sortOrder: i,
      },
    });
  }

  console.log('Created', areas.length, 'areas');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
