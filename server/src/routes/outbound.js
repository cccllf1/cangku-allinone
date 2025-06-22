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
    // 提取参数，新的必填参数设计
    const { 
      sku_code,           // 必填：SKU编码
      location_code,      // 必填：库位编码  
      outbound_quantity,  // 必填：出库数量
      batch_number,       // 可选：批次号
      operator_id,        // 可选：操作员ID
      notes,              // 可选：备注
      is_urgent           // 可选：是否紧急
    } = req.body;

    // === 严格字段校验：禁止 camelCase ===
    if (Object.keys(req.body).some(k => /[A-Z]/.test(k))) {
      return res.status(400).json({ 
        success: false,
        error_code: 'INVALID_NAMING',
        error_message: '请求参数必须使用 snake_case 命名' 
      });
    }

    // 验证必要参数（新的三必填设计）
    if (!sku_code) {
      return res.status(400).json({ 
        success: false,
        error_code: 'MISSING_SKU_CODE',
        error_message: 'sku_code字段为必填，必须提供SKU编码' 
      });
    }

    if (!location_code) {
      return res.status(400).json({ 
        success: false,
        error_code: 'MISSING_LOCATION_CODE',
        error_message: 'location_code字段为必填，必须提供库位编码'
      });
    }

    if (!outbound_quantity || typeof outbound_quantity !== 'number' || outbound_quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        error_code: 'INVALID_QUANTITY',
        error_message: 'outbound_quantity必须是大于0的数字'
      });
    }

    // 从SKU编码解析商品信息
    let product = null;
    let baseProductCode = sku_code;
    
    // 解析SKU编码获取基础商品编码
    if (sku_code.includes('-')) {
      baseProductCode = sku_code.split('-')[0];
    }

    // 查找商品
    product = await Product.findOne({ product_code: baseProductCode });

    if (!product) {
      // 商品不存在，返回错误
      return res.status(404).json({
        success: false,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: `商品不存在：${baseProductCode}`
      });
    }
    
    // 特殊处理"无货位"
    const SPECIAL_NO_LOCATION_CODE = "无货位";
    let location = null;
    
    if (location_code === SPECIAL_NO_LOCATION_CODE) {
      // "无货位"是特殊库位，不需要在Location表中存在
      location = {
        location_code: SPECIAL_NO_LOCATION_CODE,
        location_name: "无货位",
        _id: null
      };
    } else {
      // 普通库位需要在Location表中查找
      location = await Location.findOne({ location_code: location_code });
      
      if (!location) {
        return res.status(404).json({ 
          success: false,
          error_code: 'LOCATION_NOT_FOUND',
          error_message: '找不到指定的库位'
        });
      }
    }
    
    const prodCode = product.product_code;
    // 查找库存记录
    let inventory = await Inventory.findOne({ product_id: product._id });
    if (!inventory) {
      return res.status(404).json({ 
        success: false,
        error_code: 'INVENTORY_NOT_FOUND',
        error_message: '未找到该商品的库存记录'
      });
    }
    
    // 查找指定库位的库存
    const locationIndex = inventory.locations.findIndex(loc => 
      loc.location_code === location.location_code
    );
    
    if (locationIndex === -1) {
      return res.status(404).json({ 
        success: false,
        error_code: 'LOCATION_INVENTORY_NOT_FOUND',
        error_message: '该商品在指定库位没有库存'
      });
    }
    
    // 处理数量，确保是数字
    const numericQuantity = Number(outbound_quantity);
    
    // 处理SKU出库（使用必填的sku_code）
    // 查找SKU库存
    const skuIndex = inventory.locations[locationIndex].skus.findIndex(
      s => s.sku_code === sku_code
    );
    
    if (skuIndex === -1) {
      return res.status(404).json({ 
        success: false,
        error_code: 'SKU_NOT_FOUND',
        error_message: '该SKU在指定库位没有库存'
      });
    }
    
    const currentSkuQuantity = inventory.locations[locationIndex].skus[skuIndex].stock_quantity || 0;
    
    if (currentSkuQuantity < numericQuantity) {
      return res.status(400).json({ 
        success: false,
        error_code: 'INSUFFICIENT_STOCK',
        error_message: `SKU库存不足，当前库存: ${currentSkuQuantity}, 需要: ${numericQuantity}` 
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
    
    // === 同步更新Product模型中的SKU库存数据 ===
    console.log('=== 开始同步更新Product模型 ===');
    
    // 计算该SKU在所有库位的总数量
    let productSkuTotalQuantity = 0;
    inventory.locations.forEach(loc => {
      if (loc.skus) {
        const sku = loc.skus.find(s => s.sku_code === sku_code);
        if (sku) {
          productSkuTotalQuantity += Number(sku.stock_quantity) || 0;
        }
      }
    });
    
    // 更新Product模型中对应SKU的stock_quantity
    if (product.skus && Array.isArray(product.skus)) {
      const productSkuIndex = product.skus.findIndex(s => s.sku_code === sku_code);
      if (productSkuIndex >= 0) {
        product.skus[productSkuIndex].stock_quantity = productSkuTotalQuantity;
        console.log(`更新Product模型中SKU库存: ${sku_code} -> ${productSkuTotalQuantity}`);
      }
      
      await product.save();
      console.log('Product模型同步更新完成');
    }
    
    // 计算SKU在当前库位的数量和总数量
    let sku_location_quantity = 0;
    let sku_total_quantity = 0;
    
    // 找到当前库位的库存记录
    const currentLocation = inventory.locations.find(
      loc => loc.location_code === location.location_code
    );
    
    if (currentLocation && currentLocation.skus) {
      const currentSku = currentLocation.skus.find(
        s => s.sku_code === sku_code
      );
      if (currentSku) {
        sku_location_quantity = currentSku.stock_quantity;
      }
    }
    
    // 计算SKU在所有库位的总数量
    inventory.locations.forEach(loc => {
      if (loc.skus) {
        const sku = loc.skus.find(s => s.sku_code === sku_code);
        if (sku) {
          sku_total_quantity += sku.stock_quantity;
        }
      }
    });

    // 解析SKU信息
    let sku_color = null;
    let sku_size = null;
    if (sku_code.includes('-')) {
      const parts = sku_code.split('-');
      if (parts.length >= 3) {
        sku_color = parts[1];
        sku_size = parts[2];
      }
    }

    res.status(200).json({
      success: true,
      inventory: {
        product_code: prodCode,
        product_name: product.product_name || product.name,
        location_code: location.location_code,
        outbound_quantity: numericQuantity,
        sku_code: sku_code,
        sku_color: sku_color,
        sku_size: sku_size,
        sku_location_quantity: sku_location_quantity,
        sku_total_quantity: sku_total_quantity
      }
    });
    
  } catch (error) {
    console.error('出库失败:', error);
    res.status(500).json({
      success: false,
      error_code: 'OUTBOUND_FAILED',
      error_message: error.message
    });
  }
});

module.exports = router; 