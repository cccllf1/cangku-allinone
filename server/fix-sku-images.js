const mongoose = require('mongoose');

// 连接MongoDB
mongoose.connect('mongodb://admin_user:your_strong_password@192.168.11.252:8612/cangku-guanli?authSource=admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('已连接到MongoDB');
  
  try {
    // 获取产品
    const Product = mongoose.model('Product', new mongoose.Schema({
      product_code: String,
      skus: [{
        sku_code: String,
        color: String,
        size: String,
        image: String
      }]
    }));

    // 定义颜色和对应的图片
    const colorImages = {
      '黄色': '/uploads/product-1749841722103-775515245.jpg',
      '绿色': '/uploads/product-1749841306157-531759750.jpg',
      '粉色': '/uploads/product-1749840987553-173148288.jpg',
      '蓝色': '/uploads/product-1749840987553-173148288.jpg',
      '黑色': '/uploads/product-1749841306157-531759750.jpg',
      '卡其色': '/uploads/product-1749841722103-775515245.jpg'
    };

    // 查找产品
    const product = await Product.findOne({ product_code: '129092' });
    if (!product) {
      console.log('未找到产品129092');
      return;
    }

    // 更新每个SKU的图片
    product.skus.forEach(sku => {
      const color = sku.sku_code.split('-')[1];
      if (colorImages[color]) {
        sku.image = colorImages[color];
      }
    });

    // 保存更新
    await product.save();
    console.log('已成功更新SKU图片');

  } catch (error) {
    console.error('更新失败:', error);
  } finally {
    mongoose.disconnect();
    console.log('已断开MongoDB连接');
  }
}); 