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
      quantity,
      // SKU相关参数
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
    let finalSkuCode = skuCode || sku_code || null;
    
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
      let code = productCode || product_code;
      console.log(`尝试通过编码查找商品: ${code}`);
      
      // 判断是否是SKU编码（包含-符号）
      if (code && code.includes('-')) {
        const baseProdCode = code.split('-')[0];
        
        // 如果未设置SKU编码，使用完整编码作为SKU编码
        if (!finalSkuCode) {
          finalSkuCode = code;
        }
        
        // 使用基础编码查找产品
        code = baseProdCode;
      }
      
      try {
      product = await Product.findOne({ code });
        if (product) {
          console.log(`通过编码 ${code} 找到商品`);
        } else {
          console.log(`通过编码 ${code} 在商品表中未找到，尝试从库存中查找`);
          // 尝试从库存查找
          const inventoryItem = await Inventory.findOne({ productCode: code });
          if (inventoryItem) {
            // 从库存获取信息，创建临时产品对象
            product = {
              _id: inventoryItem.product_id,
              code: inventoryItem.productCode,
              name: inventoryItem.productName || code
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
      // 按编码查找
      const code = locationCode || location_code;
      console.log(`尝试查找库位编码: ${code}`);
      location = await Location.findOne({ code });
      
      if (!location) {
        console.log(`未找到库位编码: ${code}`);
        return res.status(404).json({ message: `未找到库位: ${code}` });
      }
      console.log(`找到库位: ${location.code}`);
    } else if (location_id || locationId) {
      // 按ID查找
      const id = location_id || locationId;
      console.log(`尝试查找库位ID: ${id}`);
      location = await Location.findById(id);
    
    if (!location) {
        console.log(`未找到库位ID: ${id}`);
        return res.status(404).json({ message: `未找到库位ID: ${id}` });
      }
      console.log(`找到库位: ${location.code}`);
    }
    
    // 查找库存
    console.log(`查找商品库存, 编码: ${product.code}, ID: ${product._id}`);
    let inventory = null;
    // 方法1: 通过商品编码查询
    try {
      inventory = await Inventory.findOne({ productCode: product.code });
    } catch (err) {}
    // 方法2: 通过商品ID查询
    if (!inventory && product._id) {
      try {
        inventory = await Inventory.findOne({ product_id: product._id });
      } catch (err) {}
    }
    // 新增：方法3，兼容直接传库存id
    if (!inventory && product._id) {
      try {
        inventory = await Inventory.findOne({ _id: product._id });
      } catch (err) {}
    }
    if (!inventory) {
      return res.status(404).json({ message: '未找到该商品库存' });
    }
    
    // 检查特定库位的库存
    console.log(`查找库位 ${location.code} 在库存中的记录`);
    const locationIndex = inventory.locations.findIndex(
      loc => loc.locationCode === location.code
    );
    
    if (locationIndex === -1) {
      console.log(`商品在库位 ${location.code} 中没有库存`);
      return res.status(400).json({ message: `商品在库位 ${location.code} 中没有库存` });
    }
    
    // 处理SKU出库
    let skuInfo = null;
    
    // 如果提供了SKU编码，查找特定SKU
    if (finalSkuCode) {
      console.log(`查找SKU: ${finalSkuCode}`);
      
      // 确保库位有skus数组
      if (!inventory.locations[locationIndex].skus) {
        inventory.locations[locationIndex].skus = [];
      }
      
      // 查找SKU库存记录
      const skuIndex = inventory.locations[locationIndex].skus.findIndex(
        s => s.code === finalSkuCode
      );
      
      if (skuIndex >= 0) {
        // 找到指定的SKU
        skuInfo = inventory.locations[locationIndex].skus[skuIndex];
        console.log(`找到SKU库存: ${finalSkuCode}, 当前库存: ${skuInfo.quantity}`);
        
        // 检查库存是否足够
        if (skuInfo.quantity < Number(quantity)) {
          console.log(`SKU库存不足: 当前${skuInfo.quantity}, 需要${quantity}`);
          return res.status(400).json({ 
            message: `SKU ${finalSkuCode} 在库位 ${location.code} 中库存不足，当前库存: ${skuInfo.quantity}` 
          });
        }
        
        // 更新SKU库存
        inventory.locations[locationIndex].skus[skuIndex].quantity -= Number(quantity);
        console.log(`更新后SKU库存: ${inventory.locations[locationIndex].skus[skuIndex].quantity}`);
        
        // 如果SKU库存为0，移除该SKU
        if (inventory.locations[locationIndex].skus[skuIndex].quantity <= 0) {
          console.log(`SKU ${finalSkuCode} 库存为0，移除该SKU记录`);
          inventory.locations[locationIndex].skus.splice(skuIndex, 1);
        }
      } else {
        // 没有找到指定的SKU，尝试通过颜色和尺码查找
        const finalColor = sku_color || skuColor;
        const finalSize = sku_size || skuSize;
        
        if (finalColor && finalSize) {
          // 查找匹配颜色和尺码的SKU
          const colorSizeIndex = inventory.locations[locationIndex].skus.findIndex(
            s => s.color === finalColor && s.size === finalSize
          );
          
          if (colorSizeIndex >= 0) {
            skuInfo = inventory.locations[locationIndex].skus[colorSizeIndex];
            console.log(`通过颜色和尺码找到SKU: ${skuInfo.code}, 当前库存: ${skuInfo.quantity}`);
            
            // 检查库存是否足够
            if (skuInfo.quantity < Number(quantity)) {
              console.log(`SKU库存不足: 当前${skuInfo.quantity}, 需要${quantity}`);
              return res.status(400).json({ 
                message: `SKU ${skuInfo.code} 在库位 ${location.code} 中库存不足，当前库存: ${skuInfo.quantity}` 
              });
            }
            
            // 更新SKU库存
            inventory.locations[locationIndex].skus[colorSizeIndex].quantity -= Number(quantity);
            console.log(`更新后SKU库存: ${inventory.locations[locationIndex].skus[colorSizeIndex].quantity}`);
            
            // 如果SKU库存为0，移除该SKU
            if (inventory.locations[locationIndex].skus[colorSizeIndex].quantity <= 0) {
              console.log(`SKU ${skuInfo.code} 库存为0，移除该SKU记录`);
              inventory.locations[locationIndex].skus.splice(colorSizeIndex, 1);
            }
          } else {
            console.log(`未找到颜色为 ${finalColor} 尺码为 ${finalSize} 的SKU库存`);
            return res.status(404).json({ 
              message: `未找到颜色为 ${finalColor} 尺码为 ${finalSize} 的SKU库存` 
            });
          }
        } else {
          console.log(`未找到SKU: ${finalSkuCode}, 且未提供颜色和尺码信息`);
          return res.status(404).json({ message: `未找到SKU: ${finalSkuCode}` });
        }
    }
    
      // 更新库位总量
      const totalLocationQuantity = inventory.locations[locationIndex].skus.reduce(
        (sum, sku) => sum + sku.quantity, 0
      );
      inventory.locations[locationIndex].quantity = totalLocationQuantity;
    } else {
      // 没有指定SKU，检查库位总库存并更新
      const currentQuantity = inventory.locations[locationIndex].quantity;
      console.log(`当前库存: ${currentQuantity}, 请求出库: ${quantity}`);
      
      if (currentQuantity < Number(quantity)) {
        console.log(`库存不足: 当前${currentQuantity}, 需要${quantity}`);
        return res.status(400).json({ 
          message: `库位 ${location.code} 中库存不足，当前库存: ${currentQuantity}` 
        });
      }
      
      // 更新库位库存
    inventory.locations[locationIndex].quantity -= Number(quantity);
      console.log(`更新后库存: ${inventory.locations[locationIndex].quantity}`);
      
      // 如果有SKU，需要更新SKU库存
      if (inventory.locations[locationIndex].skus && inventory.locations[locationIndex].skus.length > 0) {
        // 按比例或从默认SKU中扣减
        const defaultSkuIndex = inventory.locations[locationIndex].skus.findIndex(
          s => s.code === `${product.code}-DEFAULT` || s.color === '默认'
        );
        
        if (defaultSkuIndex >= 0) {
          // 从默认SKU中扣减
          inventory.locations[locationIndex].skus[defaultSkuIndex].quantity -= Number(quantity);
          
          // 如果默认SKU库存为0，移除该SKU
          if (inventory.locations[locationIndex].skus[defaultSkuIndex].quantity <= 0) {
            inventory.locations[locationIndex].skus.splice(defaultSkuIndex, 1);
          }
        } else {
          // 从最大库存的SKU中扣减
          let maxSkuIndex = 0;
          let maxQuantity = 0;
          
          inventory.locations[locationIndex].skus.forEach((sku, index) => {
            if (sku.quantity > maxQuantity) {
              maxQuantity = sku.quantity;
              maxSkuIndex = index;
            }
          });
          
          // 检查是否有足够库存
          if (maxQuantity < Number(quantity)) {
            console.log(`最大SKU库存不足: ${maxQuantity}`);
            return res.status(400).json({ 
              message: `请指定具体的SKU进行出库，没有单个SKU有足够库存完成此操作` 
            });
          }
          
          // 从最大库存的SKU中扣减
          inventory.locations[locationIndex].skus[maxSkuIndex].quantity -= Number(quantity);
          
          // 如果SKU库存为0，移除该SKU
          if (inventory.locations[locationIndex].skus[maxSkuIndex].quantity <= 0) {
            inventory.locations[locationIndex].skus.splice(maxSkuIndex, 1);
          }
        }
      }
    }
    
    // 如果该库位库存为0，移除该库位
    if (inventory.locations[locationIndex].quantity <= 0) {
      console.log(`库位 ${location.code} 库存为0，移除该库位记录`);
      inventory.locations.splice(locationIndex, 1);
    }
    
    // 更新总库存
    inventory.quantity = inventory.locations.reduce((sum, loc) => sum + loc.quantity, 0);
    console.log(`更新后总库存: ${inventory.quantity}`);
    
    await inventory.save();
    console.log(`出库成功: 商品=${product.code}, 库位=${location.code}, 数量=${quantity}${skuInfo ? ', SKU=' + skuInfo.code : ''}`);
    
    // 返回完整的库存信息以及SKU详情
    res.json({
      success: true,
      inventory: {
        _id: inventory._id,
        productCode: inventory.productCode,
        productName: inventory.productName,
        quantity: inventory.quantity,
        sku: skuInfo ? {
          code: skuInfo.code,
          color: skuInfo.color,
          size: skuInfo.size
        } : null
      }
    });
  } catch (error) {
    console.error('出库失败:', error);
    res.status(500).json({ message: '出库失败: ' + error.message });
  }
});

module.exports = router; 