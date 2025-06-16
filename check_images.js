const { MongoClient } = require('mongodb');

async function checkProductImages() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('cangku-guanli');
    const collection = db.collection('products');
    
    const product = await collection.findOne({ product_code: '129092' });
    
    if (product) {
      console.log('Product 129092 found:');
      console.log('Main image:', product.image_path);
      console.log('\nSKUs:');
      
      if (product.skus && product.skus.length > 0) {
        product.skus.forEach((sku, index) => {
          console.log(`${index + 1}. SKU: ${sku.sku_code}`);
          console.log(`   Color: ${sku.sku_color}`);
          console.log(`   Size: ${sku.sku_size}`);
          console.log(`   Image: ${sku.image_path || 'No image'}`);
          console.log('');
        });
      } else {
        console.log('No SKUs found');
      }
    } else {
      console.log('Product 129092 not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkProductImages(); 