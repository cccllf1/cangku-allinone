const axios = require('axios');

// 修复产品129092的SKU图片路径
async function fixSkuImages() {
  try {
    // 1. 获取产品数据
    console.log('正在获取产品129092的数据...');
    const response = await axios.get('http://localhost:3001/api/products/code/129092');
    const product = response.data.data;
    
    if (!product) {
      console.log('未找到产品129092');
      return;
    }
    
    console.log('找到产品129092，SKU数量:', product.skus.length);
    
    // 2. 定义每个颜色对应的图片路径
    const colorImages = {
      '黄色': '/uploads/product-1749841722103-775515245.jpg',
      '绿色': '/uploads/product-1749841306157-531759750.jpg', 
      '粉色': '/uploads/product-1749840987553-173148288.jpg',
      '蓝色': '/uploads/product-1749840987553-173148288.jpg',
      '黑色': '/uploads/product-1749841306157-531759750.jpg',
      '卡其色': '/uploads/product-1749841722103-775515245.jpg'
    };
    
    // 3. 更新每个SKU的图片路径
    let updatedCount = 0;
    product.skus.forEach(sku => {
      const color = sku.sku_color;
      if (colorImages[color]) {
        sku.image_path = colorImages[color];
        updatedCount++;
        console.log(`更新SKU: ${sku.sku_code} 颜色: ${color} 图片: ${colorImages[color]}`);
      }
    });
    
    // 4. 通过API更新产品
    console.log('正在保存更新...');
    const updateData = {
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit,
      description: product.description,
      has_sku: product.has_sku,
      skus: product.skus,
      image_path: product.image_path
    };
    
    const updateResponse = await axios.put(`http://localhost:3001/api/products/${product.product_id}`, updateData);
    
    console.log('修复完成！更新了', updatedCount, '个SKU的图片路径');
    console.log('API响应:', updateResponse.data.success ? '成功' : '失败');
    
  } catch (error) {
    console.error('修复失败:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
  }
}

// 执行修复
fixSkuImages(); 