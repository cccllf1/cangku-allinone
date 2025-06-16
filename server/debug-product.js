const { MongoClient } = require('mongodb');

async function debugProduct() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('cangku-guanli');
    const collection = db.collection('products');
    
    // 查找产品129092
    const product = await collection.findOne({ product_code: '129092' });
    
    if (product) {
      console.log('\n=== Product 129092 Details ===');
      console.log('ID:', product._id);
      console.log('Code:', product.product_code);
      console.log('Name:', product.product_name);
      console.log('Main Image:', product.image_path);
      console.log('\nSKUs:');
      
      if (product.skus && product.skus.length > 0) {
        product.skus.forEach((sku, index) => {
          console.log(`\nSKU ${index + 1}:`);
          console.log('  Code:', sku.sku_code);
          console.log('  Color:', sku.sku_color);
          console.log('  Size:', sku.sku_size);
          console.log('  Image Path:', sku.image_path);
          // 检查所有可能的图片字段
          console.log('  All image fields:', {
            image_path: sku.image_path,
            image: sku.image,
            skuImage: sku.skuImage
          });
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
    console.log('\nDisconnected from MongoDB');
  }
}

debugProduct(); 