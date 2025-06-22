const mongoose = require('mongoose');
const Product = require('../models/Product');
const dotenv = require('dotenv');

dotenv.config({ path: '../../.env' }); // 确保能从根目录加载.env文件

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin_user:your_strong_password@localhost:8612/warehouse_db?authSource=admin';

const migrateExternalCodes = async () => {
  try {
    console.log('正在连接到 MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB 连接成功');

    const products = await Product.find({ "skus.external_codes.0": { "$exists": true } });
    console.log(`找到 ${products.length} 个可能需要迁移的商品...`);

    let migratedCount = 0;
    for (const product of products) {
      let productModified = false;
      const skuCodeToExternalCodesMap = new Map();

      // 1. 从旧的 skus 数组中提取所有外部条码
      if (product.skus && product.skus.length > 0) {
        product.skus.forEach(sku => {
          if (sku.sku_code && sku.external_codes && sku.external_codes.length > 0) {
            skuCodeToExternalCodesMap.set(sku.sku_code, sku.external_codes);
          }
        });
      }
      
      if (skuCodeToExternalCodesMap.size === 0) {
        continue; // 此商品没有需要迁移的外部条码
      }

      // 2. 将提取的外部条码写入新的 colors.sizes 结构中
      if (product.colors && product.colors.length > 0) {
        for (const color of product.colors) {
          if (color.sizes && color.sizes.length > 0) {
            for (const size of color.sizes) {
              if (skuCodeToExternalCodesMap.has(size.sku_code)) {
                const externalCodes = skuCodeToExternalCodesMap.get(size.sku_code);
                // 避免重复迁移
                if (!size.external_codes || size.external_codes.length === 0) {
                   size.external_codes = externalCodes;
                   productModified = true;
                }
              }
            }
          }
        }
      }
      
      // 3. 如果有修改，则保存商品
      if (productModified) {
        await product.save();
        migratedCount++;
        console.log(`  -> 已成功迁移商品: ${product.product_code}`);
      }
    }

    console.log(`🎉 数据迁移完成！总共迁移了 ${migratedCount} 个商品的外部条码。`);

  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB 连接已断开');
  }
};

migrateExternalCodes(); 