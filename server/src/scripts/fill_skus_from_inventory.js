const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cangku-guanli';

(async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('[fill_skus] connected to mongodb');

    const products = await Product.find();
    let updatedCount = 0;

    for (const p of products) {
      // 只处理 has_sku=true 且 skus 为空/不足 的商品
      if (!p.has_sku) continue;

      const skuSetExisting = new Set((p.skus || []).map(s => s.sku_code));

      // 从库存记录中收集 sku_code
      const invRecords = await Inventory.find({ product_code: p.product_code });
      const skuSetFromInv = new Set();
      invRecords.forEach(inv => {
        (inv.locations || []).forEach(loc => {
          (loc.skus || []).forEach(sku => {
            if (sku && sku.sku_code) skuSetFromInv.add(sku.sku_code);
          });
        });
      });

      // 新增 SKU = 库存中有但商品中没有
      const toAdd = [...skuSetFromInv].filter(code => !skuSetExisting.has(code));
      if (toAdd.length === 0) continue;

      const parse = (code) => {
        const parts = code.split('-');
        return { color: parts[1] || '默认颜色', size: parts[2] || '默认尺码' };
      };

      toAdd.forEach(code => {
        const { color, size } = parse(code);
        p.skus.push({
          sku_code: code,
          sku_color: color,
          sku_size: size,
          stock_quantity: 0
        });
      });

      await p.save();
      updatedCount += 1;
      console.log(`[fill_skus] updated product ${p.product_code} added ${toAdd.length} skus`);
    }

    console.log(`[fill_skus] done. updated ${updatedCount} products`);
    process.exit(0);
  } catch (e) {
    console.error('[fill_skus] error:', e);
    process.exit(1);
  }
})(); 