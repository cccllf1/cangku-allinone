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
      quantity, stock_quantity,
      skuCode, sku_code, sku_color, skuColor, sku_size, skuSize
    } = req.body;
    
    // 验证必要参数
    if ((!product_id && !productId && !productCode && !product_code) || 
        (!location_id && !locationId && !locationCode && !location_code) || 
        !quantity) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    console.log('查找商品，参数:', { 
      product_id, productId, productCode, product_code,
      location_id, locationId, locationCode, location_code,
      skuCode, sku_code
    });
    
    // 查找商品
    let product = null;
    let final_sku_code = sku_code || skuCode || null;
    
    // 首先尝试按ID查找
    if (product_id || productId) {
      const id = product_id || productId;
      console.log(`尝试通过ID查找商品: ${id}`);
      try {
        product = await Product.findById(id);
        if (product) {
          console.log(`通过ID ${id} 找到商品:`, product.code);
        }
      } catch (err) {
        console.error(`通过ID查找商品失败: ${err.message}`);
      }
    }
    
    // 如果按ID没找到，尝试按编码查找
    if (!product && (productCode || product_code)) {
      let final_product_code = product_code || productCode;
      console.log(`尝试通过编码查找商品: ${final_product_code}`);
      
      // 判断是否是SKU编码（包含-符号）
      if (final_product_code && final_product_code.includes('-')) {
        const baseProdCode = final_product_code.split('-')[0];
        
        // 如果未设置SKU编码，使用完整编码作为SKU编码
        if (!final_sku_code) {
          final_sku_code = final_product_code;
        }
        
        // 使用基础编码查找产品
        final_product_code = baseProdCode;
      }
      
      try {
        product = await Product.findOne({ product_code: final_product_code });
        if (product) {
          console.log(`通过编码 ${final_product_code} 找到商品`);
        } else {
          console.log(`通过编码 ${final_product_code} 在商品表中未找到，尝试从库存中查找`);
          // 尝试从库存查找
          const inventoryItem = await Inventory.findOne({ product_code: final_product_code });
          if (inventoryItem) {
            // 从库存获取信息，创建临时产品对象
            product = {
              _id: inventoryItem.product_id,
              code: inventoryItem.product_code,
              name: inventoryItem.product_name || final_product_code
            };
            console.log('从库存中找到商品信息:', product);
          }
        }
      } catch (err) {
        console.error(`通过编码查找商品失败: ${err.message}`);
      }
    }
    
    if (!product) {
      console.log('未找到商品，所有尝试均失败');
      return res.status(404).json({ message: '未找到该商品' });
    }
    
    // 查找库位 - 优先使用locationCode/location_code
    let location = null;
    if (locationCode || location_code) {
      const final_location_code = location_code || locationCode;
      location = await Location.findOne({ location_code: final_location_code });
    } else if (location_id || locationId) {
      const id = location_id || locationId;
      location = await Location.findById(id);
    }
    
    if (!location) {
      return res.status(404).json({ message: '未找到该库位' });
    }
    
    const prodCode = product.product_code || product.code;
    // 查找库存记录
    let inventory = await Inventory.findOne({ product_id: product._id });
    if (!inventory) {
      return res.status(404).json({ message: '未找到该商品的库存记录' });
    }
    
    // 查找指定库位的库存
    const locationIndex = inventory.locations.findIndex(loc => 
      loc.location_code === location.location_code
    );
    
    if (locationIndex === -1) {
      return res.status(404).json({ message: '该商品在指定库位没有库存' });
    }
    
    // 处理数量，确保是数字
    const final_stock_quantity = stock_quantity || quantity;
    const numericQuantity = Number(final_stock_quantity);
    
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ message: '出库数量必须是大于0的数字' });
    }
    
    // 处理SKU出库
    if (final_sku_code) {
      // 查找SKU库存
      const skuIndex = inventory.locations[locationIndex].skus.findIndex(
        s => s.sku_code === final_sku_code
      );
      
      if (skuIndex === -1) {
        return res.status(404).json({ message: '该SKU在指定库位没有库存' });
      }
      
      const currentSkuQuantity = inventory.locations[locationIndex].skus[skuIndex].stock_quantity || 0;
      
      if (currentSkuQuantity < numericQuantity) {
        return res.status(400).json({ 
          message: `SKU库存不足，当前库存: ${currentSkuQuantity}, 需要: ${numericQuantity}` 
        });
      }
      
      // 更新SKU库存
      inventory.locations[locationIndex].skus[skuIndex].stock_quantity -= numericQuantity;
      
      // 如果SKU库存为0，考虑是否需要删除该SKU记录
      if (inventory.locations[locationIndex].skus[skuIndex].stock_quantity === 0) {
        inventory.locations[locationIndex].skus.splice(skuIndex, 1);
      }
      
      // 更新库位总库存
      inventory.locations[locationIndex].stock_quantity = 
        inventory.locations[locationIndex].skus.reduce(
          (sum, sku) => sum + (sku.stock_quantity || 0), 0
        );
      
    } else {
      // 处理非SKU出库
      const currentLocationQuantity = inventory.locations[locationIndex].stock_quantity || 0;
      
      if (currentLocationQuantity < numericQuantity) {
        return res.status(400).json({ 
          message: `库存不足，当前库存: ${currentLocationQuantity}, 需要: ${numericQuantity}` 
        });
      }
      
      // 更新库位库存
      inventory.locations[locationIndex].stock_quantity -= numericQuantity;
    }
    
    // 如果库位库存为0，考虑是否需要删除该库位记录
    if (inventory.locations[locationIndex].stock_quantity === 0) {
      inventory.locations.splice(locationIndex, 1);
    }
    
    // 更新总库存
    inventory.stock_quantity = inventory.locations.reduce(
      (sum, loc) => sum + (loc.stock_quantity || 0), 0
    );
    
    // 保存更新
    await inventory.save();
    
    // 返回更新后的库存信息
    res.json({
      success: true,
      data: {
        inventory_id: inventory._id,
        product_id: product._id,
        product_code: prodCode,
        product_name: product.name,
        location_id: location._id,
        location_code: location.location_code,
        stock_quantity: numericQuantity,
        remaining_quantity: inventory.stock_quantity,
        sku_code: final_sku_code,
        sku_color: sku_color || skuColor,
        sku_size: sku_size || skuSize
      },
      error_code: null,
      error_message: null
    });
    
  } catch (error) {
    console.error('出库失败:', error);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'OUTBOUND_FAILED',
      error_message: error.message
    });
  }
});

module.exports = router; 