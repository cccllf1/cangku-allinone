const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Location = require('../models/Location');
const auth = require('../middleware/auth'); // 导入认证中间件

// 入库接口
router.post('/', auth, async (req, res) => {
  console.log('入库接收数据:', req.body);

  try {
    // 提取参数，支持多种参数格式
    const { 
      // 兼容多种命名格式
      product_id, productId, productCode, product_code, 
      location_id, locationId, locationCode, location_code,
      quantity, 
      batch_number, batchNumber,
      notes
    } = req.body;

    // 验证必要参数
    if ((!product_id && !productId && !productCode && !product_code) || !quantity) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        message: '商品ID或编码和数量是必须的' 
      });
    }

    // 找到商品信息
    let product = null;
    if (product_id || productId) {
      // 按ID查找
      const id = product_id || productId;
      product = await Product.findById(id);
    } else {
      // 按编码查找
      const code = productCode || product_code;
      product = await Product.findOne({ code });
    }

    if (!product) {
      // 如果商品不存在且有编码，自动创建
      if (productCode || product_code) {
        const code = productCode || product_code;
        product = await Product.create({
          code,
          name: code,
          unit: '件'
        });
        console.log('自动创建商品:', product);
      } else {
        return res.status(404).json({ 
          error: '商品不存在', 
          message: '找不到指定的商品' 
        });
      }
    }

    // 找到库位信息
    let location = null;
    if (location_id || locationId) {
      // 按ID查找
      const id = location_id || locationId;
      location = await Location.findById(id);
    } else if (locationCode || location_code) {
      // 按编码查找
      const code = locationCode || location_code;
      location = await Location.findOne({ code });
      
      // 如果库位不存在且有编码，自动创建
      if (!location && (locationCode || location_code)) {
        const code = locationCode || location_code;
        location = await Location.create({
          code,
          name: code
        });
        console.log('自动创建库位:', location);
      }
    } else {
      // 使用默认库位
      location = await Location.findOne({ code: 'DEFAULT' });
      
      // 如果默认库位不存在，创建它
      if (!location) {
        location = await Location.create({
          code: 'DEFAULT',
          name: '默认库位'
        });
        console.log('创建默认库位:', location);
      }
    }

    if (!location) {
      return res.status(404).json({ 
        error: '库位不存在', 
        message: '找不到指定的库位' 
      });
    }

    // 查找商品库存
    let inventory = await Inventory.findOne({ product_id: product._id });
    
    // 处理数量，确保是数字
    const numericQuantity = Number(quantity) || 1;

    if (inventory) {
      // 更新现有库存
      inventory.quantity = (inventory.quantity || 0) + numericQuantity;
      
      // 更新库位明细
      if (!Array.isArray(inventory.locations)) {
        inventory.locations = [];
      }
      
      // 查找该库位的库存记录
      const locationIndex = inventory.locations.findIndex(
        loc => loc.location_id && loc.location_id.toString() === location._id.toString()
      );
      
      if (locationIndex >= 0) {
        // 更新库位数量
        inventory.locations[locationIndex].quantity += numericQuantity;
      } else {
        // 添加新库位记录
        inventory.locations.push({
          location_id: location._id,
          locationCode: location.code,
          locationName: location.name,
          quantity: numericQuantity
        });
      }
      
      await inventory.save();
      console.log('更新库存成功:', inventory);
    } else {
      // 创建新库存记录
      inventory = await Inventory.create({
        product_id: product._id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit || '件',
        quantity: numericQuantity,
        locations: [{
          location_id: location._id,
          locationCode: location.code,
          locationName: location.name,
          quantity: numericQuantity
        }]
      });
      console.log('创建库存成功:', inventory);
    }

    res.status(201).json({
      success: true,
      inventory: {
        id: inventory._id,
        product_id: product._id,
        productCode: product.code,
        productName: product.name,
        location_id: location._id,
        locationCode: location.code,
        quantity: numericQuantity,
        total: inventory.quantity
      }
    });
  } catch (error) {
    console.error('入库处理错误:', error);
    res.status(500).json({ 
      error: '入库失败', 
      message: error.message || '服务器内部错误'
    });
  }
});

module.exports = router; 