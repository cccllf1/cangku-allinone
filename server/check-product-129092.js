const { MongoClient } = require('mongodb');

async function checkProduct129092() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('已连接到 MongoDB\n');
    
    const db = client.db('cangku-guanli');
    const collection = db.collection('products');
    
    // 查找产品129092
    const product = await collection.findOne({ product_code: '129092' });
    
    if (product) {
      console.log('=== 产品 129092 详细信息 ===');
      console.log('ID:', product._id);
      console.log('商品编码:', product.product_code);
      console.log('商品名称:', product.product_name);
      console.log('主图:', product.image_path);
      console.log('是否有SKU:', product.has_sku ? '是' : '否');
      
      if (product.skus && product.skus.length > 0) {
        console.log('\n=== SKU 信息 ===');
        console.log('SKU总数:', product.skus.length);
        
        // 按颜色分组SKU
        const colorGroups = {};
        product.skus.forEach(sku => {
          const color = sku.sku_color || '未知颜色';
          if (!colorGroups[color]) {
            colorGroups[color] = [];
          }
          colorGroups[color].push(sku);
        });
        
        // 打印每个颜色组的信息
        Object.entries(colorGroups).forEach(([color, skus]) => {
          console.log(`\n颜色: ${color}`);
          console.log('图片路径列表:');
          const uniqueImages = [...new Set(skus.map(sku => sku.image_path))];
          uniqueImages.forEach(img => console.log(`  - ${img || '无图片'}`));
          
          console.log('尺码列表:');
          skus.forEach(sku => {
            console.log(`  - ${sku.sku_size} (${sku.sku_code})`);
            console.log(`    图片: ${sku.image_path || '无图片'}`);
          });
        });
        
        // 检查是否所有SKU都有图片
        const skusWithoutImage = product.skus.filter(sku => !sku.image_path);
        if (skusWithoutImage.length > 0) {
          console.log('\n警告: 以下SKU没有图片:');
          skusWithoutImage.forEach(sku => {
            console.log(`- ${sku.sku_code} (${sku.sku_color} ${sku.sku_size})`);
          });
        }
        
        // 检查图片路径是否正确
        const uniqueImagePaths = [...new Set(product.skus.map(sku => sku.image_path).filter(Boolean))];
        console.log('\n=== 图片路径检查 ===');
        uniqueImagePaths.forEach(path => {
          console.log(`图片路径: ${path}`);
          if (!path.startsWith('/uploads/')) {
            console.log('警告: 图片路径不是以 /uploads/ 开头');
          }
          if (path.includes('undefined') || path.includes('null')) {
            console.log('警告: 图片路径包含 undefined 或 null');
          }
        });
      } else {
        console.log('\n该产品没有SKU信息');
      }
    } else {
      console.log('未找到产品129092');
    }
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await client.close();
    console.log('\n已断开与 MongoDB 的连接');
  }
}

checkProduct129092(); 