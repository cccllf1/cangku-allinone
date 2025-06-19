const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Location = require('../models/Location');
const InventoryAdjustment = require('../models/InventoryAdjustment');
const WMS_USER_ID = new mongoose.Types.ObjectId('684c5acd5cf064a67653d0c0');
const auth = require('../middleware/auth');

const SPECIAL_NO_LOCATION_CODE = "无货位"; // 定义特殊无货位编码

// 获取所有库存，包含分库位明细
router.get('/', (req, res) => {
  return res.status(410).json({
    success: false,
    data: null,
    error_code: 'API_DEPRECATED',
            error_message: '此接口已废弃，请使用 /products 或 /inventory/location'
  });
});

// 统一的库位查询接口（支持查询所有库位或指定库位）
router.get('/location/:location_code?', async (req, res) => {
  try {
    // 获取路径参数和查询参数
    const pathLocationCode = req.params.location_code ? decodeURIComponent(req.params.location_code) : null;
    const { 
      location_code: queryLocationCode, 
      page = 1, 
      page_size = 50, 
      has_stock_only = 'true' 
    } = req.query;

    // 优先使用路径参数，其次使用查询参数
    const finalLocationCode = pathLocationCode || queryLocationCode;
    
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(page_size);
    const hasStockOnly = has_stock_only === 'true';

    // 1. 先获取所有商品的SKU图片映射
    const products = await Product.find({}, { skus: 1 });
    const skuImageMap = {};
    products.forEach(prod => {
      (prod.skus || []).forEach(sku => {
        skuImageMap[sku.sku_code] = sku.image_path || sku.image || '';
      });
    });

    // 2. 构建聚合管道
    const pipeline = [
      { $unwind: "$locations" },
      { $unwind: { path: "$locations.skus", preserveNullAndEmptyArrays: true } }
    ];

    // 如果指定了库位编码，添加匹配条件
    if (finalLocationCode) {
      pipeline.push({ 
        $match: { "locations.location_code": finalLocationCode } 
      });
    }

    // 添加数据投影
    pipeline.push({
      $project: {
        location_code: "$locations.location_code",
        product_id: "$product_id",
        product_code: 1,
        product_name: 1,
        sku_code: "$locations.skus.sku_code",
        sku_color: { $ifNull: ["$locations.skus.sku_color", ""] },
        sku_size:  { $ifNull: ["$locations.skus.sku_size",  ""] },
        stock_quantity: {
          $cond: [ 
            { $ifNull: ["$locations.skus.sku_code", false] }, 
            "$locations.skus.stock_quantity", 
            "$locations.stock_quantity" 
          ]
        }
      }
    });

    // 根据参数决定是否过滤零库存
    if (hasStockOnly) {
      pipeline.push({ $match: { stock_quantity: { $gt: 0 } } });
    }

    // 添加排序
    pipeline.push({ $sort: { location_code: 1, product_code: 1, sku_code: 1 } });

    // 如果不是查询指定库位，添加分页支持
    if (!finalLocationCode) {
      const countPipeline = [...pipeline, { $count: "total" }];
      const [items, countResult] = await Promise.all([
        Inventory.aggregate([
          ...pipeline,
          { $skip: (pageNum - 1) * pageSizeNum },
          { $limit: pageSizeNum }
        ]),
        Inventory.aggregate(countPipeline)
      ]);

      const total = countResult[0]?.total || 0;

      // 为每个item添加图片路径
      items.forEach(item => {
        item.image_path = skuImageMap[item.sku_code] || '';
      });

      // 统计信息
      const totalQuantity = items.reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

      res.json({
        success: true,
        data: {
          location_code: finalLocationCode,
          items: items || [],
          pagination: {
            page: pageNum,
            page_size: pageSizeNum,
            total_pages: Math.ceil(total / pageSizeNum),
            total_items: total
          },
          summary: {
            total_items: items.length,
            total_quantity: totalQuantity
          }
        },
        error_code: null,
        error_message: null
      });
    } else {
      // 查询指定库位，不分页
      const items = await Inventory.aggregate(pipeline);

      // 为每个item添加图片路径
      items.forEach(item => {
        item.image_path = skuImageMap[item.sku_code] || '';
      });

      // 统计信息
      const totalQuantity = items.reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

      res.json({
        success: true,
        data: {
          location_code: finalLocationCode,
          items: items || [],
          summary: {
            total_items: items.length,
            total_quantity: totalQuantity
          }
        },
        error_code: null,
        error_message: null
      });
    }
  } catch (err) {
    console.error('获取指定库位库存失败:', err);
    res.status(500).json({ 
      success: false, 
      data: null, 
      error_code: 'INTERNAL_ERROR',
      error_message: err.message
    });
  }
});

// 盘点调整库存数量
router.post('/adjust', auth, async (req, res) => {
  try {
    const {
      location_code,
      sku_code,
      target_quantity,     // 必填：盘点目标数量（库存调整的唯一字段）
      batch_number,
      notes,
      operator_id,
      is_urgent
    } = req.body;

    // === 严格字段校验：禁止使用非标准字段名 ===
    const forbiddenFields = ['stock_quantity', 'quantity', 'qty'];
    const usedForbiddenFields = forbiddenFields.filter(field => req.body[field] !== undefined);
    if (usedForbiddenFields.length > 0) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_FIELD_NAME',
        error_message: `禁止使用字段: ${usedForbiddenFields.join(', ')}，请使用标准字段名 target_quantity`
      });
    }

    const final_quantity = target_quantity;
    
    // 验证必填字段
    if (!location_code || !sku_code || typeof final_quantity !== 'number') {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '缺少必要参数(location_code, sku_code, target_quantity)'
      });
    }

    // 从SKU编码解析商品编码
    const product_code = sku_code.includes('-') ? sku_code.split('-')[0] : sku_code;
    
    // 查找或创建 Inventory 文档
    let invQuery = { product_code };
    let inventory = await Inventory.findOne(invQuery);
    if (!inventory) {
      // 新建 Inventory 文档
      inventory = new Inventory({
        product_code,
        product_name: product_code, // 默认使用商品编码作为名称
        locations: []
      });
    }

    // 查找或创建库位
    let loc = inventory.locations.find(l => l.location_code === location_code);
    if (!loc) {
      loc = {
        location_code,
        stock_quantity: 0,
        skus: []
      };
      inventory.locations.push(loc);
    }

    // 查找或创建 SKU
    let sku = loc.skus.find(s => s.sku_code === sku_code);
    if (!sku) {
      sku = {
        sku_code,
        stock_quantity: 0
      };
      loc.skus.push(sku);
    }

    // 盘点直接覆盖库存为目标数量
    const previous_quantity = sku.stock_quantity;
    const new_quantity = final_quantity;
    if (new_quantity < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INSUFFICIENT_STOCK',
        error_message: '库存不能为负数',
        details: {
          location_code,
          product_code,
          sku_code,
          requested_quantity: new_quantity
        }
      });
    }
    
    // 更新SKU库存
    sku.stock_quantity = new_quantity;
    
    // 更新库位总库存
    loc.stock_quantity = loc.skus.reduce((total, s) => total + (s.stock_quantity || 0), 0);
    
    // 更新整体库存
    inventory.total_quantity = inventory.locations.reduce((total, l) => 
      total + l.skus.reduce((skuTotal, s) => skuTotal + (s.stock_quantity || 0), 0), 0);

    // 保存更改
    await inventory.save();

    // 计算SKU库存统计
    let sku_location_quantity = 0;
    let sku_total_quantity = 0;

    // 查找当前SKU在当前库位的数量
    const currentLocation = inventory.locations.find(l => l.location_code === location_code);
    if (currentLocation) {
      const currentSku = currentLocation.skus.find(s => s.sku_code === sku_code);
      sku_location_quantity = currentSku ? currentSku.stock_quantity : 0;
    }

    // 计算该SKU在所有库位的总数量
    inventory.locations.forEach(loc => {
      const skuInLocation = loc.skus.find(s => s.sku_code === sku_code);
      if (skuInLocation) {
        sku_total_quantity += skuInLocation.stock_quantity;
      }
    });

    // 记录调整历史
    const adjustment = new InventoryAdjustment({
      location_code,
      product_code,
      sku_code,
      previous_quantity,
      adjusted_quantity: new_quantity - previous_quantity,
      current_quantity: new_quantity,
      batch_number,
      operator_id: operator_id || (req.user && req.user.id) || WMS_USER_ID,
      notes,
      is_urgent: !!is_urgent
    });
    await adjustment.save();

    res.json({
      success: true,
      data: {
        location_code,
        product_code,
        sku_code,
        target_quantity: new_quantity,
        previous_quantity,
        adjusted_quantity: new_quantity - previous_quantity,
        current_quantity: new_quantity,
        sku_location_quantity,
        sku_total_quantity,
        batch_number,
        operator_id: operator_id || (req.user && req.user.id) || WMS_USER_ID,
        adjusted_at: adjustment.created_at,
        notes
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('库存调整失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'STOCK_ADJUSTMENT_FAILED',
      error_message: '库存调整失败: ' + (err && err.message ? err.message : ''),
      details: err && err.stack ? err.stack : err
    });
  }
});

// 获取指定商品有库存的所有货位
router.get('/product-locations/:product_code', async (req, res) => {
  try {
    const { product_code } = req.params;

    if (!product_code) {
      return res.status(400).json({ message: '缺少商品编码 (product_code)' });
    }

    const inventoryItems = await Inventory.find({ 
      product_code: product_code,
      'locations.0': { $exists: true } 
    });

    if (!inventoryItems || inventoryItems.length === 0) {
      return res.status(404).json({ message: `商品 ${product_code} 没有找到任何货位库存记录` });
    }

    const location_codes = new Set();
    inventoryItems.forEach(item => {
      item.locations.forEach(loc => {
        const hasLocationStock = loc.stock_quantity > 0;
        const hasSkuStock = loc.skus && loc.skus.some(s => s.stock_quantity > 0);

        if (loc.location_code && (hasLocationStock || hasSkuStock)) { 
          location_codes.add(loc.location_code);
        }
      });
    });

    if (location_codes.size === 0) {
      return res.status(404).json({ message: `商品 ${product_code} 在所有已知货位均无有效库存` });
    }
    
    res.json({
      product_code: product_code,
      locations: Array.from(location_codes).map(code => ({ code })) 
    });

  } catch (error) {
    console.error(`获取商品 ${req.params.product_code} 的货位列表失败:`, error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});


// === 新增：按商品聚合库存（颜色 → 尺码 → 库位） ===
router.get('/by-product/:product_code', (req, res) => {
      res.status(410).json({ success: false, error_code: 'API_DEPRECATED', error_message: '请改用 /api/products?search=<product_code>' });
});



// === 🗑️ /inventory/by-product 接口已删除 ===
// 该接口功能已完全整合到 /products 接口中，前端代码已全部更新

// === 新增：库存转移接口 ===
router.post('/transfer', auth, async (req, res) => {
  try {
    const {
      sku_code,
      from_location_code,
      to_location_code,
      transfer_quantity,    // 必填：转移数量（库存转移的唯一字段）
      batch_number,
      notes,
      operator_id
    } = req.body;

    // === 严格字段校验：禁止使用非标准字段名 ===
    const forbiddenFields = ['stock_quantity', 'quantity', 'qty'];
    const usedForbiddenFields = forbiddenFields.filter(field => req.body[field] !== undefined);
    if (usedForbiddenFields.length > 0) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_FIELD_NAME',
        error_message: `禁止使用字段: ${usedForbiddenFields.join(', ')}，请使用标准字段名 transfer_quantity`
      });
    }

    const final_quantity = transfer_quantity;
    
    // 参数校验
    if (!sku_code || !final_quantity || !from_location_code || !to_location_code || !operator_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '缺少必要参数(sku_code, transfer_quantity, from_location_code, to_location_code, operator_id)'
      });
    }
    if (from_location_code === to_location_code) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '源库位和目标库位不能相同'
      });
    }

    // 从SKU编码解析商品编码
    const product_code = sku_code.includes('-') ? sku_code.split('-')[0] : sku_code;
    
    // 查找 Inventory 文档
    let invQuery = { product_code };
    let inventory = await Inventory.findOne(invQuery);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'INVENTORY_NOT_FOUND',
        error_message: '未找到对应商品的库存记录'
      });
    }

    // 查找源库位
    let fromLoc = inventory.locations.find(loc => loc.location_code === from_location_code);
    if (!fromLoc) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'FROM_LOCATION_NOT_FOUND',
        error_message: '未找到源库位'
      });
    }
    // 查找目标库位
    let toLoc = inventory.locations.find(loc => loc.location_code === to_location_code);
    if (!toLoc) {
      // 目标库位不存在则新建
      toLoc = {
        location_code: to_location_code,
        stock_quantity: 0,
        skus: []
      };
      inventory.locations.push(toLoc);
    }

    // 源库位SKU明细
    let fromSku = fromLoc.skus.find(sku => sku.sku_code === sku_code);
    if (!fromSku) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'FROM_SKU_NOT_FOUND',
        error_message: '源库位无此SKU'
      });
    }
    if (fromSku.stock_quantity < final_quantity) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INSUFFICIENT_STOCK',
        error_message: '源库位库存不足',
        details: { 
          available_quantity: fromSku.stock_quantity,
          requested_quantity: final_quantity,
          sku_code,
          location_code: from_location_code
        }
      });
    }

    // 目标库位SKU明细
    let toSku = toLoc.skus.find(sku => sku.sku_code === sku_code);
    if (!toSku) {
      toSku = {
        sku_code,
        sku_color: fromSku.sku_color || fromSku.color,
        sku_size: fromSku.sku_size || fromSku.size,
        stock_quantity: 0
      };
      toLoc.skus.push(toSku);
    }

    // 扣减源库位，增加目标库位
    fromSku.stock_quantity -= final_quantity;
    toSku.stock_quantity += final_quantity;

    // 更新源库位和目标库位的总库存
    fromLoc.stock_quantity = fromLoc.skus.reduce((total, s) => total + (s.stock_quantity || 0), 0);
    toLoc.stock_quantity = toLoc.skus.reduce((total, s) => total + (s.stock_quantity || 0), 0);

    // 更新整体库存（虽然总量不变，但为了保持一致性）
    inventory.total_quantity = inventory.locations.reduce((total, l) => 
      total + l.skus.reduce((skuTotal, s) => skuTotal + (s.stock_quantity || 0), 0), 0);

    // 记录批次号和备注（如有）
    if (batch_number) toSku.batch_number = batch_number;
    if (notes) toSku.notes = notes;

    // 保存所有更改
    await inventory.save();

    // 计算SKU库存统计
    let sku_location_quantity = toSku.stock_quantity;  // 转移后目标库位的数量
    let sku_total_quantity = 0;

    // 计算该SKU在所有库位的总数量
    inventory.locations.forEach(loc => {
      const skuInLocation = loc.skus.find(s => s.sku_code === sku_code);
      if (skuInLocation) {
        sku_total_quantity += skuInLocation.stock_quantity;
      }
    });

    // 记录转移历史
    const transfer = new InventoryAdjustment({
      location_code: from_location_code,
      to_location_code: to_location_code,
      product_code: product_code,
      sku_code,
      sku_color: fromSku.sku_color || fromSku.color,
      sku_size: fromSku.sku_size || fromSku.size,
      previous_quantity: fromSku.stock_quantity + final_quantity,
      adjusted_quantity: -final_quantity,
      current_quantity: fromSku.stock_quantity,
      batch_number,
      operator_id: operator_id,
      notes: notes || '库存转移',
      transfer_type: 'transfer'
    });
    await transfer.save();

    res.json({
      success: true,
      data: {
        product_code,
        sku_code,
        from_location_code,
        to_location_code,
        transfer_quantity: final_quantity,
        sku_location_quantity,
        sku_total_quantity,
        batch_number,
        operator_id: operator_id,
        transfer_at: transfer.created_at,
        notes
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('库存转移失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'TRANSFER_FAILED',
      error_message: '库存转移失败: ' + (err && err.message ? err.message : ''),
      details: err && err.stack ? err.stack : err
    });
  }
});

module.exports = router; 