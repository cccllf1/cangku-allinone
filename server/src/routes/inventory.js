const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Location = require('../models/Location');

const SPECIAL_NO_LOCATION_CODE = "无货位"; // 定义特殊无货位编码

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
    let queryLocationName = locationCode; // 用于最终返回的库位名称

    if (!locationCode) {
      return res.status(400).json({ message: '缺少库位编码' });
    }

    if (locationCode !== SPECIAL_NO_LOCATION_CODE) {
      // 对于普通库位，验证库位是否存在
      const location = await Location.findOne({ code: locationCode });
      if (!location) {
        return res.status(404).json({ message: `库位 ${locationCode} 不存在` });
      }
      queryLocationName = location.name; // 使用数据库中的真实名称
    } else {
      // 如果是特殊"无货位"编码，则设置其显示名称
      queryLocationName = SPECIAL_NO_LOCATION_CODE;
    }
    
    // 查找所有在该库位有库存的商品
    // $elemMatch 用于确保 locations 数组中至少有一个元素同时匹配 locationCode 和 quantity > 0
    const inventoryItems = await Inventory.find({
      locations: {
        $elemMatch: {
          locationCode: locationCode,
          quantity: { $gt: 0 }
        }
      }
    }).populate('product_id'); // 直接 populate product_id 以获取产品信息
        
    const items = [];
    for (const invItem of inventoryItems) {
      // 找到指定库位的记录 (可能一个产品在多个库位，但我们只关心当前 locationCode)
      const locationData = invItem.locations.find(loc => loc.locationCode === locationCode && loc.quantity > 0);
      
      if (locationData) {
        const product = invItem.product_id; // 已经是 populate 后的 Product 对象

        if (locationData.skus && locationData.skus.length > 0) {
          for (const sku of locationData.skus) {
            if (sku.quantity && sku.quantity > 0) {
              items.push({
                inventoryId: invItem._id, // Inventory document ID
                product_id: product._id,  // Product document ID
                productCode: product.code,
                productName: product.name || product.code,
                unit: product.unit || '件',
                image: product.image_path || product.image || sku.image || '',
                quantity: sku.quantity,
                sku_code: sku.code,
                sku_color: sku.color,
                sku_size: sku.size,
              });
            }
          }
        } else if (!product.has_sku) { // 如果产品没有SKU，则直接使用库位上的数量
          items.push({
            inventoryId: invItem._id,
            product_id: product._id,
            productCode: product.code,
            productName: product.name || product.code,
            unit: product.unit || '件',
            image: product.image_path || product.image || '',
            quantity: locationData.quantity, // 主产品在此库位的数量
            sku_code: null, // 表示是主产品，非特定SKU
            sku_color: null,
            sku_size: null,
          });
        }
      }
    }
    
    res.json({
      locationCode,
      locationName: queryLocationName, // 返回查询的库位名或"无货位"
      items,
      // 返回一些附加信息，帮助前端理解
      productsInfo: inventoryItems.map(inv => inv.product_id) // 包含所有涉及的产品信息
    });
    
  } catch (error) {
    console.error(`获取库位 ${req.params.locationCode} 库存失败:`, error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 盘点调整库存数量
router.post('/adjust', async (req, res) => {
  try {
    const { productId, locationCode, quantity, sku_code } = req.body;

    if (!productId || !locationCode || quantity === undefined) {
      return res.status(400).json({ message: '缺少必要参数 (productId, locationCode, quantity)' });
    }

    if (Number(quantity) < 0) {
      return res.status(400).json({ message: '数量不能为负数' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: '无效的商品ID格式' });
    }

    // 查找商品库存记录，兼容_id和product_id
    let inventoryItem = await Inventory.findOne({ _id: productId });
    if (!inventoryItem) {
      // Fallback: some frontend parts might send product_id from Product model as productId
      const product = await Product.findById(productId);
      if (product) {
        inventoryItem = await Inventory.findOne({ product_id: product._id });
      }
    }
    if (!inventoryItem) {
      // Last attempt if productId was indeed an inventory's product_id ObjectId string
      inventoryItem = await Inventory.findOne({ product_id: productId });
    }

    if (!inventoryItem) {
      return res.status(404).json({ message: '未找到对应的库存记录 for productId: ' + productId });
    }

    // 查找对应的库位
    const locationIndex = inventoryItem.locations.findIndex(
      loc => loc.locationCode === locationCode
    );

    if (locationIndex === -1) {
      // If location doesn't exist, create it? For now, error.
      // Or, if adding to a new location for this item, this part needs adjustment.
      // Current design implies location must exist from /inventory/location/:locationCode perspective.
      return res.status(404).json({ message: `库位 ${locationCode} 在商品 ${inventoryItem.productCode} 的库存中未找到` });
    }

    // Ensure skus array exists
    if (!inventoryItem.locations[locationIndex].skus) {
      inventoryItem.locations[locationIndex].skus = [];
    }

    let oldSkuQuantity = 0;
    let skuAdjusted = false;

    if (sku_code) {
      const skuIndex = inventoryItem.locations[locationIndex].skus.findIndex(
        s => s.code === sku_code
      );

      if (skuIndex !== -1) {
        oldSkuQuantity = inventoryItem.locations[locationIndex].skus[skuIndex].quantity || 0;
        inventoryItem.locations[locationIndex].skus[skuIndex].quantity = Number(quantity);
        skuAdjusted = true;
      } else {
        // SKU not found in this location. This could be an error or an attempt to add a new SKU.
        // For "adjust", it implies the SKU should exist.
        // If it's possible to "adjust" a new SKU into existence, this logic needs to change
        // by potentially finding product details to get color/size for the new SKU.
        // For now, if sku_code is provided but not found, it's an issue.
        // However, the original code would just update location total.
        // Let's be more strict: if sku_code is given, it MUST be adjusted.
        // If we want to allow adding a new SKU via adjust, frontend should call a different endpoint or this needs more info.
         return res.status(404).json({ message: `SKU ${sku_code} 在库位 ${locationCode} 未找到` });
      }
    } else {
      // NO SKU_CODE PROVIDED - This case should ideally not happen if frontend always sends SKU for SKU-items.
      // This part is problematic if the item HAS SKUs. Which SKU to adjust?
      // For now, if no sku_code, and item has SKUs, this is an ambiguous request.
      // If item has NO SKUs, then updating location.quantity directly is fine.
      // Let's check if the product associated with this inventoryItem is a non-SKU product.
      const associatedProduct = await Product.findById(inventoryItem.product_id);
      if (associatedProduct && !associatedProduct.has_sku) {
        // Product has no SKUs, so adjust location quantity directly
        oldSkuQuantity = inventoryItem.locations[locationIndex].quantity || 0; // Treat location quant as "SKU" quant
        inventoryItem.locations[locationIndex].quantity = Number(quantity);
        skuAdjusted = true; // Simulate SKU adjustment for calculation
      } else if (associatedProduct && associatedProduct.has_sku && inventoryItem.locations[locationIndex].skus.length > 0) {
        // Product has SKUs, but no sku_code was given for adjustment. This is ambiguous.
        return res.status(400).json({ message: '商品有多个SKU, 请提供sku_code进行盘点调整' });
      } else {
        // Fallback or product without SKU or empty skus array - adjust location quantity
        // This might also be hit if product has_sku but the specific location has no skus array / items yet.
        oldSkuQuantity = inventoryItem.locations[locationIndex].quantity || 0;
        inventoryItem.locations[locationIndex].quantity = Number(quantity);
        skuAdjusted = true; // Simulate SKU adjustment
      }
    }

    if (!skuAdjusted) {
      // This should not be reached if logic above is correct, but as a safeguard:
      return res.status(500).json({ message: '未能调整任何SKU或库位数量' });
    }

    // Recalculate location quantity based on its SKUs if it has any
    if (inventoryItem.locations[locationIndex].skus.length > 0) {
      inventoryItem.locations[locationIndex].quantity = inventoryItem.locations[locationIndex].skus.reduce(
        (sum, sku) => sum + (sku.quantity || 0), 0
      );
    }
    // If no SKUs, the location quantity was set directly if sku_code was not provided and product is not has_sku.

    // Recalculate total inventory quantity for the product
    inventoryItem.quantity = inventoryItem.locations.reduce(
      (sum, loc) => sum + (loc.quantity || 0), 0
    );
    
    await inventoryItem.save();
    
    // Fetch the updated inventory item to include populated fields if necessary for response
    const updatedInventoryItem = await Inventory.findById(inventoryItem._id)
      // .populate('product_id') // Optional: populate product details
      // .populate('locations.location_id'); // Optional: populate location details
      // For now, return as is, frontend re-fetches details anyway.

    res.json({ 
      message: '库存盘点调整成功', 
      inventory: updatedInventoryItem // Send back the updated item
    });
  } catch (error) {
    console.error('库存盘点调整失败:', error);
    res.status(500).json({ message: '服务器错误: ' + error.message, error: error.toString() });
  }
});

// 获取指定商品有库存的所有货位
router.get('/product-locations/:productCode', async (req, res) => {
  try {
    const { productCode } = req.params;

    if (!productCode) {
      return res.status(400).json({ message: '缺少商品编码 (productCode)' });
    }

    const inventoryItems = await Inventory.find({ 
      productCode: productCode,
      'locations.0': { $exists: true } 
    });

    if (!inventoryItems || inventoryItems.length === 0) {
      return res.status(404).json({ message: `商品 ${productCode} 没有找到任何货位库存记录` });
    }

    const locationCodes = new Set();
    inventoryItems.forEach(item => {
      item.locations.forEach(loc => {
        const hasLocationStock = loc.quantity > 0;
        const hasSkuStock = loc.skus && loc.skus.some(s => s.quantity > 0);

        if (loc.locationCode && (hasLocationStock || hasSkuStock)) { 
          locationCodes.add(loc.locationCode);
        }
      });
    });

    if (locationCodes.size === 0) {
      return res.status(404).json({ message: `商品 ${productCode} 在所有已知货位均无有效库存` });
    }
    
    res.json({
      productCode: productCode,
      locations: Array.from(locationCodes).map(code => ({ code })) 
    });

  } catch (error) {
    console.error(`获取商品 ${req.params.productCode} 的货位列表失败:`, error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

module.exports = router; 