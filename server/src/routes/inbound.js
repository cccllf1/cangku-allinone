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
      notes,
      // SKU相关参数
      skuCode, sku_code, sku_color, skuColor, sku_size, skuSize
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
      
      // 判断是否是SKU编码（包含-符号）
      if (code && code.includes('-')) {
        const baseProdCode = code.split('-')[0];
        product = await Product.findOne({ code: baseProdCode });
        
        // 如果通过基础编码找到了商品，设置SKU编码
        if (product && !skuCode && !sku_code) {
          req.body.skuCode = code;
        }
      } else {
      product = await Product.findOne({ code });
      }
    }

    if (!product) {
      // 如果商品不存在且有编码，自动创建
      if (productCode || product_code) {
        const code = productCode || product_code;
        // 检查SKU编码
        let baseCode = code;
        if (code.includes('-')) {
          baseCode = code.split('-')[0];
          // 如果未设置SKU编码，则使用完整编码作为SKU编码
          if (!skuCode && !sku_code) {
            req.body.skuCode = code;
          }
        }
        
        // 检查是否存在于库存系统中
        const inventoryItem = await Inventory.findOne({ productCode: baseCode });
        if (inventoryItem) {
          // 如果库存中有但商品表中没有，尝试查找商品ID
          product = await Product.findById(inventoryItem.product_id);
          
          // 如果仍然没找到，根据库存数据创建商品
          if (!product) {
            product = await Product.create({
              code: baseCode,
              name: inventoryItem.productName || baseCode,
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
          name: code === '无货位' ? '无货位' : code  // 特殊处理无货位的名称
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

    // 处理SKU信息
    const finalSkuCode = skuCode || sku_code || null;
    let skuInfo = null;
    
    if (finalSkuCode) {
      // 查找产品中是否已有该SKU
      if (product.skus && Array.isArray(product.skus)) {
        skuInfo = product.skus.find(sku => sku.code === finalSkuCode);
      }
      
      // 如果没有找到SKU，但有颜色和尺码信息，尝试自动创建SKU
      if (!skuInfo) {
        const finalColor = sku_color || skuColor || '';
        const finalSize = sku_size || skuSize || '';
        
        // 从SKU编码解析颜色和尺码
        if (!finalColor || !finalSize) {
          const parts = finalSkuCode.split('-');
          if (parts.length >= 3) {
            const parsedColor = parts[1];
            const parsedSize = parts[2];
            
            // 创建新的SKU
            skuInfo = {
              code: finalSkuCode,
              color: finalColor || parsedColor,
              size: finalSize || parsedSize
            };
            
            // 添加到产品SKU列表
            if (!product.skus) {
              product.skus = [];
            }
            
            // 检查SKU是否已存在（避免重复）
            const existingSku = product.skus.find(s => 
              s.code === finalSkuCode || 
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
          let standardSkuCode = finalSkuCode;
          if (!standardSkuCode.startsWith(product.code)) {
            standardSkuCode = `${product.code}-${finalColor}-${finalSize}`;
          }
          
          skuInfo = {
            code: standardSkuCode,
            color: finalColor,
            size: finalSize
          };
          
          // 添加到产品SKU列表
          if (!product.skus) {
            product.skus = [];
          }
          
          // 检查SKU是否已存在（避免重复）
          const existingSku = product.skus.find(s => 
            s.code === standardSkuCode || 
            (s.color === finalColor && s.size === finalSize)
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
    const numericQuantity = Number(quantity) || 1;

    if (inventory) {
      // 更新现有库存
      // 更新库位明细
      if (!Array.isArray(inventory.locations)) {
        inventory.locations = [];
      }
      
      // 查找该库位的库存记录
      const locationIndex = inventory.locations.findIndex(
        loc => loc.location_id && loc.location_id.toString() === location._id.toString()
      );
      
      if (locationIndex >= 0) {
        // 如果有SKU信息，更新SKU库存
        if (skuInfo) {
          if (!inventory.locations[locationIndex].skus) {
            inventory.locations[locationIndex].skus = [];
          }
          
          // 查找SKU库存记录
          const skuIndex = inventory.locations[locationIndex].skus.findIndex(
            s => s.code === skuInfo.code
          );
          
          if (skuIndex >= 0) {
            // 更新已有SKU库存
            inventory.locations[locationIndex].skus[skuIndex].quantity += numericQuantity;
          } else {
            // 添加新SKU库存记录
            inventory.locations[locationIndex].skus.push({
              code: skuInfo.code,
              color: skuInfo.color,
              size: skuInfo.size,
              quantity: numericQuantity
            });
          }
          
          // 更新库位总量
          const totalLocationQuantity = inventory.locations[locationIndex].skus.reduce(
            (sum, sku) => sum + sku.quantity, 0
          );
          inventory.locations[locationIndex].quantity = totalLocationQuantity;
        } else {
          // 未指定SKU，更新主产品库存
        inventory.locations[locationIndex].quantity += numericQuantity;
          
          // 如果产品有SKU但未指定入库哪个SKU，创建默认SKU
          if (product.has_sku) {
            if (!inventory.locations[locationIndex].skus) {
              inventory.locations[locationIndex].skus = [];
            }
            
            const defaultSkuCode = `${product.code}-DEFAULT`;
            let defaultSkuIndex = inventory.locations[locationIndex].skus.findIndex(
              s => s.code === defaultSkuCode
            );
            
            if (defaultSkuIndex >= 0) {
              inventory.locations[locationIndex].skus[defaultSkuIndex].quantity += numericQuantity;
            } else {
              inventory.locations[locationIndex].skus.push({
                code: defaultSkuCode,
                color: '默认',
                size: '默认',
                quantity: numericQuantity
              });
            }
          }
        }
      } else {
        // 添加新库位记录
        const newLocation = {
          location_id: location._id,
          locationCode: location.code,
          locationName: location.name,
          quantity: numericQuantity,
          skus: []
        };
        
        // 如果有SKU信息，添加SKU库存
        if (skuInfo) {
          newLocation.skus.push({
            code: skuInfo.code,
            color: skuInfo.color,
            size: skuInfo.size,
            quantity: numericQuantity
          });
        } else if (product.has_sku) {
          // 如果产品有SKU但未指定入库哪个SKU，创建默认SKU
          newLocation.skus.push({
            code: `${product.code}-DEFAULT`,
            color: '默认',
            size: '默认',
          quantity: numericQuantity
        });
        }
        
        inventory.locations.push(newLocation);
      }
      
      // 更新总库存数量
      inventory.quantity = inventory.locations.reduce(
        (sum, loc) => sum + loc.quantity, 0
      );
      
      await inventory.save();
      console.log('更新库存成功:', inventory);
    } else {
      // 创建新库存记录
      const newInventory = {
        product_id: product._id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit || '件',
        quantity: numericQuantity,
        locations: [{
          location_id: location._id,
          locationCode: location.code,
          locationName: location.name,
          quantity: numericQuantity,
          skus: []
        }]
      };
      
      // 如果有SKU信息，添加SKU库存
      if (skuInfo) {
        newInventory.locations[0].skus.push({
          code: skuInfo.code,
          color: skuInfo.color,
          size: skuInfo.size,
          quantity: numericQuantity
        });
      } else if (product.has_sku) {
        // 如果产品有SKU但未指定入库哪个SKU，创建默认SKU
        newInventory.locations[0].skus.push({
          code: `${product.code}-DEFAULT`,
          color: '默认',
          size: '默认',
          quantity: numericQuantity
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
        productCode: product.code,
        productName: product.name,
        location_id: location._id,
        locationCode: location.code,
        quantity: numericQuantity,
        total: inventory.quantity,
        skuCode: skuInfo ? skuInfo.code : null,
        skuColor: skuInfo ? skuInfo.color : null,
        skuSize: skuInfo ? skuInfo.size : null
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