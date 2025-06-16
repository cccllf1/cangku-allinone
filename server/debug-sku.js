const mongoose = require('mongoose');
const Inventory = require('./src/models/Inventory');

mongoose.connect('mongodb://admin_user:your_strong_password@192.168.11.252:8612/cangku-guanli?authSource=admin')
  .then(async () => {
    console.log('✅ 连接数据库成功');
    
    // 查找包含指定库位的库存记录
    const inv = await Inventory.findOne({ 'locations.location_code': '西8排1架6层4位' });
    if (!inv) {
      console.log('❌ 未找到库存记录');
      process.exit(1);
    }
    
    console.log('📦 找到库存记录');
    const location = inv.locations.find(l => l.location_code === '西8排1架6层4位');
    if (!location || !location.skus || !location.skus.length) {
      console.log('❌ 该库位无SKU数据');
      process.exit(1);
    }
    
    const sku = location.skus[0];
    console.log('🎯 第一个SKU的所有字段:', Object.keys(sku.toObject()));
    console.log('📋 SKU详细数据:');
    console.log(JSON.stringify(sku.toObject(), null, 2));
    
    process.exit();
  })
  .catch(err => { 
    console.error('❌ 错误:', err); 
    process.exit(1); 
  }); 