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
    // 提取参数，新的必填参数设计
    const { 
      sku_code,           // 必填：SKU编码
      location_code,      // 必填：库位编码  
      inbound_quantity,   // 必填：入库数量
      batch_number,       // 可选：批次号
      operator_id,        // 可选：操作员ID
      notes,              // 可选：备注
      is_urgent,          // 可选：是否紧急
      // 保留兼容性参数（但不再使用）
      product_id, 
      product_code,
      location_id,
      sku_color,
      sku_size
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

    if (!inbound_quantity || typeof inbound_quantity !== 'number' || inbound_quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        error_code: 'INVALID_QUANTITY',
        error_message: 'inbound_quantity必须是大于0的数字'
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
        error_message: `商品不存在，请先创建商品：${baseProductCode}`
      });
    }

    // 找到库位信息（使用必填的location_code）
    let location = await Location.findOne({ location_code: location_code });
    
    // 如果库位不存在，自动创建
    if (!location) {
      location = await Location.create({
        location_code: location_code,
        location_name: location_code === '无货位' ? '无货位' : location_code
      });
      console.log('自动创建库位:', location);
    }

    if (!location) {
      return res.status(404).json({ 
        success: false,
        error_code: 'LOCATION_NOT_FOUND',
        error_message: '找不到指定的库位'
      });
    }

    // 处理SKU信息
    let skuInfo = null;
    
    if (sku_code) {
      // 查找产品中是否已有该SKU
      if (product.skus && Array.isArray(product.skus)) {
        skuInfo = product.skus.find(sku => sku.sku_code === sku_code);
      }
      
      // 如果没有找到SKU，但有颜色和尺码信息，尝试自动创建SKU
      if (!skuInfo) {
        const final_sku_color = sku_color || '';
        const final_sku_size = sku_size || '';
        
        // 从SKU编码解析颜色和尺码
        if (!final_sku_color || !final_sku_size) {
          const parts = sku_code.split('-');
          if (parts.length >= 3) {
            const parsed_color = parts[1];
            const parsed_size = parts[2];
            
            // 创建新的SKU
            skuInfo = {
              sku_code: sku_code,
              color: final_sku_color || parsed_color,
              size: final_sku_size || parsed_size
            };
            
            // 添加到产品SKU列表
            if (!product.skus) {
              product.skus = [];
            }
            
            // 检查SKU是否已存在（避免重复）
            const existingSku = product.skus.find(s => 
              s.sku_code === sku_code || 
              (s.color === skuInfo.color && s.size === skuInfo.size)
            );
            
            if (!existingSku) {
              product.skus.push(skuInfo);
              product.has_sku = true;
              await product.save();
              console.log('自动创建并保存新SKU:', skuInfo);
            } else {
              skuInfo = existingSku;
            }
          }
        } else {
          // 使用提供的颜色和尺码创建SKU
          // 如果编码不是标准格式，创建规范格式的SKU编码
          let standardSkuCode = sku_code;
          if (!standardSkuCode.startsWith(product.code)) {
            standardSkuCode = `${product.code}-${final_sku_color}-${final_sku_size}`;
          }
          
          skuInfo = {
            sku_code: standardSkuCode,
            color: final_sku_color,
            size: final_sku_size
          };
          
          // 添加到产品SKU列表
          if (!product.skus) {
            product.skus = [];
          }
          
          // 检查SKU是否已存在（避免重复）
          const existingSku = product.skus.find(s => 
            s.sku_code === standardSkuCode || 
            (s.color === final_sku_color && s.size === final_sku_size)
          );
          
          if (!existingSku) {
            product.skus.push(skuInfo);
            product.has_sku = true;
            await product.save();
            console.log('使用颜色和尺码创建并保存新SKU:', skuInfo);
          } else {
            skuInfo = existingSku;
          }
        }
      }
    }

    // 查找商品库存
    let inventory = await Inventory.findOne({ product_id: product._id });
    if (!inventory) {
      inventory = await Inventory.findOne({ _id: product._id });
    }
    
    // 处理数量，确保是数字
    const final_inbound_quantity = inbound_quantity;
    const numericQuantity = Number(final_inbound_quantity) || 1;

    const prodCode = product.product_code;

    if (inventory) {
      // 更新现有库存
      // 更新库位明细
      if (!Array.isArray(inventory.locations)) {
        inventory.locations = [];
      }
      
      // 查找该库位的库存记录
      const locationIndex = inventory.locations.findIndex(
        loc => loc.location_code === location.location_code
      );
      
      if (locationIndex >= 0) {
        // 如果有SKU信息，更新SKU库存
        if (skuInfo) {
          if (!inventory.locations[locationIndex].skus) {
            inventory.locations[locationIndex].skus = [];
          }
          
          const skuIndex = inventory.locations[locationIndex].skus.findIndex(
            s => s.sku_code === skuInfo.sku_code
          );
          
          if (skuIndex >= 0) {
            inventory.locations[locationIndex].skus[skuIndex].stock_quantity += numericQuantity;
          } else {
            inventory.locations[locationIndex].skus.push({
              sku_code: skuInfo.sku_code,
              color: skuInfo.color,
              size: skuInfo.size,
              stock_quantity: numericQuantity
            });
          }
          
          // 更新库位总数量
          inventory.locations[locationIndex].stock_quantity = 
            inventory.locations[locationIndex].skus.reduce(
              (sum, sku) => sum + (sku.stock_quantity || 0), 0
            );
        } else {
          // 未指定SKU，更新主产品库存
          inventory.locations[locationIndex].stock_quantity += numericQuantity;
          
          // 如果产品有SKU但未指定入库哪个SKU，创建默认SKU
          if (product.has_sku) {
            if (!inventory.locations[locationIndex].skus) {
              inventory.locations[locationIndex].skus = [];
            }
            
            const defaultSkuCode = `${prodCode}-DEFAULT`;
            let defaultSkuIndex = inventory.locations[locationIndex].skus.findIndex(
              s => s.sku_code === defaultSkuCode
            );
            
            if (defaultSkuIndex >= 0) {
              inventory.locations[locationIndex].skus[defaultSkuIndex].stock_quantity += numericQuantity;
            } else {
              inventory.locations[locationIndex].skus.push({
                sku_code: defaultSkuCode,
                color: '默认',
                size: '默认',
                stock_quantity: numericQuantity
              });
            }
          }
        }
      } else {
        // 添加新库位记录
        const newLocation = {
          location_id: location._id,
          location_code: location.location_code,
          location_name: location.location_name,
          stock_quantity: numericQuantity,
          skus: []
        };
        
        // 如果有SKU信息，添加SKU库存
        if (skuInfo) {
          newLocation.skus.push({
            sku_code: skuInfo.sku_code,
            color: skuInfo.color,
            size: skuInfo.size,
            stock_quantity: numericQuantity
          });
        } else if (product.has_sku) {
          // 如果产品有SKU但未指定入库哪个SKU，创建默认SKU
          newLocation.skus.push({
            sku_code: `${prodCode}-DEFAULT`,
            color: '默认',
            size: '默认',
            stock_quantity: numericQuantity
          });
        }
        
        inventory.locations.push(newLocation);
      }
      
      // 更新总库存数量
      inventory.stock_quantity = inventory.locations.reduce(
        (sum, loc) => sum + (loc.stock_quantity || 0), 0
      );
      
      await inventory.save();
      console.log('更新库存成功:', inventory);
    } else {
      // 创建新库存记录
      const newInventory = {
        product_id: product._id,
        product_code: prodCode,
        product_name: product.name,
        unit: product.unit || '件',
        stock_quantity: numericQuantity,
        locations: [{
          location_id: location._id,
          location_code: location.location_code,
          location_name: location.location_name,
          stock_quantity: numericQuantity,
          skus: []
        }]
      };
      
      // 如果有SKU信息，添加SKU库存
      if (skuInfo) {
        newInventory.locations[0].skus.push({
          sku_code: skuInfo.sku_code,
          color: skuInfo.color,
          size: skuInfo.size,
          stock_quantity: numericQuantity
        });
      } else if (product.has_sku) {
        // 如果产品有SKU但未指定入库哪个SKU，创建默认SKU
        newInventory.locations[0].skus.push({
          sku_code: `${prodCode}-DEFAULT`,
          color: '默认',
          size: '默认',
          stock_quantity: numericQuantity
        });
      }
      
      inventory = await Inventory.create(newInventory);
      console.log('创建库存成功:', inventory);
    }

    // 计算SKU在当前库位的数量
    let sku_location_quantity = 0;
    let sku_total_quantity = 0;
    
    if (skuInfo) {
      // 找到当前库位的库存记录
      const currentLocation = inventory.locations.find(
        loc => loc.location_code === location.location_code
      );
      
      if (currentLocation && currentLocation.skus) {
        const currentSku = currentLocation.skus.find(
          s => s.sku_code === skuInfo.sku_code
        );
        if (currentSku) {
          sku_location_quantity = currentSku.stock_quantity;
        }
      }
      
      // 计算SKU在所有库位的总数量
      inventory.locations.forEach(loc => {
        if (loc.skus) {
          const sku = loc.skus.find(s => s.sku_code === skuInfo.sku_code);
          if (sku) {
            sku_total_quantity += sku.stock_quantity;
          }
        }
      });
    }

    res.status(201).json({
      success: true,
      inventory: {
        product_code: prodCode,
        product_name: product.product_name || product.name,
        location_code: location.location_code,
        inbound_quantity: numericQuantity,
        sku_code: skuInfo ? skuInfo.sku_code : null,
        sku_color: skuInfo ? skuInfo.color : null,
        sku_size: skuInfo ? skuInfo.size : null,
        sku_location_quantity: sku_location_quantity,
        sku_total_quantity: sku_total_quantity
      }
    });
  } catch (error) {
    console.error('入库失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '入库失败'
    });
  }
});

module.exports = router; 