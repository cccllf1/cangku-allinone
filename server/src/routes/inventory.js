const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Location = require('../models/Location');

// 获取所有库存，包含分库位明细
router.get('/', async (req, res) => {
  const inventory = await Inventory.find();
  // 保证 locations 字段存在且为数组
  const result = inventory.map(item => ({
    ...item.toObject(),
    locations: Array.isArray(item.locations) ? item.locations : []
  }));
  res.json(result);
});

// 获取指定库位的所有商品库存
router.get('/location/:locationCode', async (req, res) => {
  try {
    const { locationCode } = req.params;
    
    if (!locationCode) {
      return res.status(400).json({ message: '缺少库位编码' });
    }
    
    // 首先验证库位是否存在
    const location = await Location.findOne({ code: locationCode });
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    
    // 查找所有在该库位有库存的商品
    const inventoryItems = await Inventory.find({
      'locations.locationCode': locationCode,
      'locations.quantity': { $gt: 0 }
    });
    
    // 获取所有相关商品的详细信息
    const productIds = inventoryItems.map(item => item._id);
    const products = await Product.find({ _id: { $in: productIds } });
    
    // 创建产品ID到产品信息的映射
    const productMap = {};
    products.forEach(product => {
      productMap[product._id.toString()] = product;
    });
    
    // 整合库存和商品信息
    const items = [];
    for (const item of inventoryItems) {
      const product = productMap[item._id.toString()];
      if (!product) continue;
      
      // 找到指定库位的记录
      const locationData = item.locations.find(loc => loc.locationCode === locationCode);
      if (!locationData || locationData.quantity <= 0) continue;
      
      items.push({
        product_id: item._id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit || '件',
        quantity: locationData.quantity,
        image: product.image_path || product.image || '',
        sku_code: locationData.sku_code,
        sku_color: locationData.sku_color,
        sku_size: locationData.sku_size,
      });
    }
    
    res.json({
      locationCode,
      locationName: location.name,
      items
    });
    
  } catch (error) {
    console.error('获取库位库存失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 盘点调整库存数量
router.post('/adjust', async (req, res) => {
  try {
    const { productId, locationCode, quantity } = req.body;

    if (!productId || !locationCode || quantity === undefined) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: '无效的商品ID' });
    }

    // 查找商品库存记录
    const inventoryItem = await Inventory.findOne({ _id: productId });

    if (!inventoryItem) {
      return res.status(404).json({ message: '未找到对应的库存记录' });
    }

    // 查找对应的库位
    const locationIndex = inventoryItem.locations.findIndex(
      loc => loc.locationCode === locationCode
    );

    if (locationIndex === -1) {
      return res.status(404).json({ message: '未找到对应的库位' });
    }

    // 计算数量变化
    const oldQuantity = inventoryItem.locations[locationIndex].quantity;
    const quantityDifference = quantity - oldQuantity;
    
    // 更新库位数量
    inventoryItem.locations[locationIndex].quantity = quantity;
    
    // 更新总数量
    inventoryItem.quantity += quantityDifference;
    
    await inventoryItem.save();
    
    res.json({ 
      message: '库存盘点调整成功', 
      inventory: inventoryItem 
    });
  } catch (error) {
    console.error('库存盘点调整失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

module.exports = router; 