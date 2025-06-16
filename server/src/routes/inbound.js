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
      product_id, 
      product_code, 
      location_id, 
      location_code,
      stock_quantity,
      batch_number,
      notes,
      sku_code,
      sku_color,
      sku_size
    } = req.body;

    // === 严格字段校验：禁止 camelCase 及 quantity ===
    if (Object.keys(req.body).some(k => /[A-Z]/.test(k))) {
      return res.status(400).json({ message: '请求参数必须使用 snake_case 命名' });
    }

    // 验证必要参数
    const qtyProvided = (stock_quantity !== undefined && stock_quantity !== null);
    if (!product_id && !product_code) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        message: 'product_id或product_code字段为必填' 
      });
    }

    // 找到商品信息
    let product = null;
    if (product_id) {
      product = await Product.findById(product_id);
    } else {
      product = await Product.findOne({ product_code: product_code });
    }

    if (!product) {
      // 如果商品不存在且有编码，自动创建
      if (product_code) {
        // 检查SKU编码
        let baseCode = product_code;
        if (product_code.includes('-')) {
          baseCode = product_code.split('-')[0];
          // 如果未设置SKU编码，则使用完整编码作为SKU编码
          if (!sku_code) {
            req.body.sku_code = product_code;
          }
        }
        
        // 检查是否存在于库存系统中
        const inventoryItem = await Inventory.findOne({ product_code: baseCode });
        if (inventoryItem) {
          // 如果库存中有但商品表中没有，尝试查找商品ID
          product = await Product.findById(inventoryItem.product_id);
          
          // 如果仍然没找到，根据库存数据创建商品
          if (!product) {
            product = await Product.create({
              code: baseCode,
              name: inventoryItem.product_name || baseCode,
              unit: inventoryItem.unit || '件',
              has_sku: true,
              skus: []
            });
            console.log('根据库存数据创建商品:', product);
          }
        } else {
          // 完全新商品，创建
        product = await Product.create({
            code: baseCode,
            name: baseCode,
            unit: '件',
            has_sku: true,
            skus: []
        });
          console.log('自动创建新商品:', product);
        }
      } else {
        return res.status(404).json({ 
          error: '商品不存在', 
          message: '找不到指定的商品' 
        });
      }
    }

    // 找到库位信息
    let location = null;
    if (location_id) {
      location = await Location.findById(location_id);
    } else if (location_code) {
      // 按编码查找
      const final_location_code = location_code;
      location = await Location.findOne({ location_code: final_location_code });
      
      // 如果库位不存在且有编码，自动创建
      if (!location) {
        const codeVal = location_code;
        location = await Location.create({
          location_code: codeVal,
          location_name: codeVal === '无货位' ? '无货位' : codeVal  // 特殊处理无货位的名称
        });
        console.log('自动创建库位:', location);
      }
    } else {
      // 使用默认库位
      location = await Location.findOne({ location_code: 'DEFAULT' });
      
      // 如果默认库位不存在，创建它
      if (!location) {
        location = await Location.create({
          location_code: 'DEFAULT',
          location_name: '默认库位'
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
    const final_stock_quantity = stock_quantity;
    const numericQuantity = Number(final_stock_quantity) || 1;

    const prodCode = product.product_code || product.code;

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

    res.status(201).json({
      success: true,
      inventory: {
        id: inventory._id,
        product_id: product._id,
        product_code: prodCode,
        product_name: product.name,
        location_id: location._id,
        location_code: location.location_code,
        stock_quantity: numericQuantity,
        total: inventory.stock_quantity,
        sku_code: skuInfo ? skuInfo.sku_code : null,
        sku_color: skuInfo ? skuInfo.color : null,
        sku_size: skuInfo ? skuInfo.size : null
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