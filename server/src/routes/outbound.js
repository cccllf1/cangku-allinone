const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Location = require('../models/Location');
const auth = require('../middleware/auth'); // 导入认证中间件

// 出库接口
router.post('/', auth, async (req, res) => {
  console.log('出库接收数据:', req.body);
  
  try {
    // 提取参数，支持多种参数格式
    const { 
      product_id, productId, productCode, product_code, 
      location_id, locationId, locationCode, location_code,
      quantity 
    } = req.body;
    
    // 验证必要参数
    if ((!product_id && !productId && !productCode && !product_code) || 
        (!location_id && !locationId && !locationCode && !location_code) || 
        !quantity) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 查找商品
    let product = null;
    if (product_id || productId) {
      // 按ID查找
      const id = product_id || productId;
      product = await Product.findById(id);
    } else if (productCode || product_code) {
      // 按编码查找
      const code = productCode || product_code;
      product = await Product.findOne({ code });
    }
    
    if (!product) {
      return res.status(404).json({ message: '未找到该商品' });
    }
    
    // 查找库位
    let location = null;
    if (location_id || locationId) {
      // 按ID查找
      const id = location_id || locationId;
      location = await Location.findById(id);
    } else if (locationCode || location_code) {
      // 按编码查找
      const code = locationCode || location_code;
      location = await Location.findOne({ code });
    }
    
    if (!location) {
      return res.status(404).json({ message: '未找到该库位' });
    }
    
    // 查找库存
    let inventory = await Inventory.findOne({ productCode: product.code });
    if (!inventory) {
      return res.status(404).json({ message: '未找到该商品库存' });
    }
    
    // 检查特定库位的库存
    const locationIndex = inventory.locations.findIndex(
      loc => loc.locationCode === location.code
    );
    
    if (locationIndex === -1) {
      return res.status(400).json({ message: `商品在库位 ${location.code} 中没有库存` });
    }
    
    if (inventory.locations[locationIndex].quantity < quantity) {
      return res.status(400).json({ message: `库位 ${location.code} 中库存不足，当前库存: ${inventory.locations[locationIndex].quantity}` });
    }
    
    // 更新库存
    inventory.locations[locationIndex].quantity -= Number(quantity);
    if (inventory.locations[locationIndex].quantity <= 0) {
      // 如果该库位库存为0，移除该库位
      inventory.locations.splice(locationIndex, 1);
    }
    
    // 更新总库存
    inventory.quantity = inventory.locations.reduce((sum, loc) => sum + loc.quantity, 0);
    
    await inventory.save();
    console.log(`出库成功: 商品=${product.code}, 库位=${location.code}, 数量=${quantity}`);
    res.json(inventory);
  } catch (error) {
    console.error('出库失败:', error);
    res.status(500).json({ message: '出库失败: ' + error.message });
  }
});

module.exports = router; 