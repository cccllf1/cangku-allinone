const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Location = require('../models/Location');
const auth = require('../middleware/auth'); // 导入认证中间件

// 入库接口
router.post('/', auth, async (req, res) => {
  console.log('=== 入库API调用开始 ===');
  console.log('接收数据:', JSON.stringify(req.body, null, 2));

  try {
    // 提取参数，严格按照API文档规范
    const { 
      sku_code,           // 必填：SKU编码
      location_code,      // 必填：库位编码  
      inbound_quantity,   // 必填：入库数量
      batch_number,       // 可选：批次号
      operator_id,        // 可选：操作员ID
      notes,              // 可选：备注
      is_urgent           // 可选：是否紧急
    } = req.body;

    // === 严格字段校验：禁止 camelCase ===
    const invalidKeys = Object.keys(req.body).filter(k => /[A-Z]/.test(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ 
        success: false,
        error_code: 'INVALID_NAMING',
        error_message: `请求参数必须使用 snake_case 命名，违规字段: ${invalidKeys.join(', ')}` 
      });
    }

    // 验证必要参数
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

    if (!inbound_quantity || typeof inbound_quantity !== 'number' || inbound_quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        error_code: 'INVALID_QUANTITY',
        error_message: 'inbound_quantity必须是大于0的数字'
      });
    }

    console.log('=== 参数验证通过 ===');

    // 从SKU编码解析商品信息
    let baseProductCode = sku_code;
    if (sku_code.includes('-')) {
      baseProductCode = sku_code.split('-')[0];
    }

    console.log('解析商品编码:', baseProductCode);

    // 查找商品
    const product = await Product.findOne({ product_code: baseProductCode });
    if (!product) {
      return res.status(404).json({
        success: false,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: `商品不存在，请先创建商品：${baseProductCode}`
      });
    }

    console.log('找到商品:', {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name
    });

    // 查找或创建库位
    let location = await Location.findOne({ location_code: location_code });
    if (!location) {
      location = await Location.create({
        location_code: location_code,
        location_name: location_code === '无货位' ? '无货位' : location_code
      });
      console.log('自动创建库位:', location.location_code);
    }

    // === 处理SKU信息 ===
    console.log('=== 开始处理SKU信息 ===');
    console.log('查找SKU:', sku_code);
    
    let skuInfo = null;
    
    // 在product.skus中查找SKU
    if (product.skus && Array.isArray(product.skus)) {
      console.log('产品现有SKU列表:', product.skus.map(s => ({
        sku_code: s.sku_code,
        sku_color: s.sku_color,
        sku_size: s.sku_size
      })));
      
      skuInfo = product.skus.find(sku => sku.sku_code === sku_code);
      
      if (skuInfo) {
        console.log('找到现有SKU:', {
          sku_code: skuInfo.sku_code,
          sku_color: skuInfo.sku_color,
          sku_size: skuInfo.sku_size
        });
      } else {
        console.log('SKU不存在，尝试自动创建');
        
        // 从SKU编码解析颜色和尺寸
        const parts = sku_code.split('-');
        if (parts.length >= 3) {
          const parsed_color = parts[1];
          const parsed_size = parts[2];
          
          skuInfo = {
            sku_code: sku_code,
            sku_color: parsed_color,
            sku_size: parsed_size
          };
          
          // 添加到产品SKU列表
          product.skus.push(skuInfo);
          product.has_sku = true;
          await product.save();
          
          console.log('成功创建新SKU:', skuInfo);
        } else {
          console.log('SKU编码格式错误，无法解析:', sku_code);
          return res.status(400).json({
            success: false,
            error_code: 'INVALID_SKU_CODE',
            error_message: `SKU编码格式错误，应为：商品编码-颜色-尺寸，实际：${sku_code}`
          });
        }
      }
    } else {
      console.log('产品没有SKU列表，初始化并创建新SKU');
      
      const parts = sku_code.split('-');
      if (parts.length >= 3) {
        const parsed_color = parts[1];
        const parsed_size = parts[2];
        
        skuInfo = {
          sku_code: sku_code,
          sku_color: parsed_color,
          sku_size: parsed_size
        };
        
        product.skus = [skuInfo];
        product.has_sku = true;
        await product.save();
        
        console.log('初始化SKU列表并创建新SKU:', skuInfo);
      } else {
        return res.status(400).json({
          success: false,
          error_code: 'INVALID_SKU_CODE',
          error_message: `SKU编码格式错误，应为：商品编码-颜色-尺寸，实际：${sku_code}`
        });
      }
    }

    // === 处理库存更新 ===
    console.log('=== 开始处理库存更新 ===');
    
    // 查找库存记录
    let inventory = await Inventory.findOne({ product_id: product._id });
    if (!inventory) {
      // 创建新库存记录
      inventory = await Inventory.create({
        product_id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        unit: product.unit || '件',
        stock_quantity: 0,
        locations: []
      });
      console.log('创建新库存记录');
    }

    // 确保数量为数字
    const numericQuantity = Number(inbound_quantity);
    
    // 查找库位库存记录
    let locationIndex = inventory.locations.findIndex(
      loc => loc.location_code === location_code
    );
    
    if (locationIndex >= 0) {
      console.log('更新现有库位库存');
      
      // 确保SKU数组存在
      if (!inventory.locations[locationIndex].skus) {
        inventory.locations[locationIndex].skus = [];
      }
      
      // 查找SKU库存记录
      let skuIndex = inventory.locations[locationIndex].skus.findIndex(
        s => s.sku_code === sku_code
      );
      
      if (skuIndex >= 0) {
        // 更新现有SKU库存，同时确保color和size字段正确
        const currentStock = Number(inventory.locations[locationIndex].skus[skuIndex].stock_quantity) || 0;
        inventory.locations[locationIndex].skus[skuIndex].stock_quantity = currentStock + numericQuantity;
        inventory.locations[locationIndex].skus[skuIndex].sku_color = skuInfo.sku_color;
        inventory.locations[locationIndex].skus[skuIndex].sku_size = skuInfo.sku_size;
        console.log(`更新SKU库存: ${currentStock} + ${numericQuantity} = ${currentStock + numericQuantity}`);
        console.log(`同时更新SKU字段: color=${skuInfo.sku_color}, size=${skuInfo.sku_size}`);
      } else {
        // 添加新SKU库存记录
        inventory.locations[locationIndex].skus.push({
          sku_code: sku_code,
          sku_color: skuInfo.sku_color,
          sku_size: skuInfo.sku_size,
          stock_quantity: numericQuantity
        });
        console.log(`添加新SKU库存: ${numericQuantity}`);
      }
      
      // 重新计算库位总数量
      inventory.locations[locationIndex].stock_quantity = 
        inventory.locations[locationIndex].skus.reduce(
          (sum, sku) => sum + (Number(sku.stock_quantity) || 0), 0
        );
        
    } else {
      console.log('添加新库位库存记录');
      
      // 添加新库位记录
      inventory.locations.push({
        location_id: location._id,
        location_code: location_code,
        location_name: location.location_name,
        stock_quantity: numericQuantity,
        skus: [{
          sku_code: sku_code,
          sku_color: skuInfo.sku_color,
          sku_size: skuInfo.sku_size,
          stock_quantity: numericQuantity
        }]
      });
    }
    
    // 重新计算总库存数量
    inventory.stock_quantity = inventory.locations.reduce(
      (sum, loc) => sum + (Number(loc.stock_quantity) || 0), 0
    );
    
    // 保存库存更新
    await inventory.save();
    console.log('库存更新完成，总库存:', inventory.stock_quantity);

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

    // === 计算返回数据 ===
    console.log('=== 计算响应数据 ===');
    
    // 计算SKU在当前库位的数量
    let sku_location_quantity = 0;
    const currentLocation = inventory.locations.find(
      loc => loc.location_code === location_code
    );
    
    if (currentLocation && currentLocation.skus) {
      const currentSku = currentLocation.skus.find(
        s => s.sku_code === sku_code
      );
      if (currentSku) {
        sku_location_quantity = Number(currentSku.stock_quantity) || 0;
      }
    }
    
    // 计算SKU在所有库位的总数量
    let sku_total_quantity = 0;
    inventory.locations.forEach(loc => {
      if (loc.skus) {
        const sku = loc.skus.find(s => s.sku_code === sku_code);
        if (sku) {
          sku_total_quantity += Number(sku.stock_quantity) || 0;
        }
      }
    });

    console.log('计算结果:', {
      sku_location_quantity,
      sku_total_quantity,
      inbound_quantity: numericQuantity
    });

    // 返回标准响应格式
    const responseData = {
      success: true,
      inventory: {
        product_code: product.product_code,
        product_name: product.product_name,
        location_code: location_code,
        inbound_quantity: numericQuantity,
        sku_code: sku_code,
        sku_color: skuInfo.sku_color,
        sku_size: skuInfo.sku_size,
        sku_location_quantity: sku_location_quantity,
        sku_total_quantity: sku_total_quantity
      }
    };

    console.log('=== 入库API调用完成 ===');
    console.log('返回数据:', JSON.stringify(responseData, null, 2));

    res.status(201).json(responseData);

  } catch (error) {
    console.error('=== 入库API调用失败 ===');
    console.error('错误详情:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '入库失败'
    });
  }
});

module.exports = router; 