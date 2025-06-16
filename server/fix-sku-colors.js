const { MongoClient } = require('mongodb');

const colorImageMap = {
  '黄色': '/uploads/product-1749841722103-775515245.jpg',
  '绿色': '/uploads/product-1749841306157-531759750.jpg',
  '粉色': '/uploads/product-1749840987553-173148288.jpg',
  '蓝色': '/uploads/product-1749840987553-173148288.jpg',
  '黑色': '/uploads/product-1749841306157-531759750.jpg',
  '卡其色': '/uploads/product-1749841722103-775515245.jpg'
};

async function updateSkuImages() {
  const uri = 'mongodb://192.168.11.252:8612';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('cangku-guanli');
    const products = db.collection('products');

    // Find the product with product_code 129092
    const product = await products.findOne({ product_code: "129092" });
    
    if (!product) {
      console.log('Product not found');
      return;
    }

    // Update each SKU's image path based on color
    const updatedSkus = product.skus.map(sku => {
      const color = sku.specifications.find(spec => spec.name === '颜色')?.value;
      if (color && colorImageMap[color]) {
        return {
          ...sku,
          image_path: colorImageMap[color]
        };
      }
      return sku;
    });

    // Update the product with new SKU data
    const result = await products.updateOne(
      { product_code: "129092" },
      { $set: { skus: updatedSkus } }
    );

    console.log('Update result:', result);
    console.log('SKUs updated successfully');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateSkuImages().catch(console.error); 