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
    error_message: '此接口已废弃，请使用 /inventory/by-product 或 /inventory/by-location'
  });
});

// 获取指定库位的所有商品库存
router.get('/location/:location_code', async (req, res) => {
  try {
    const location_code = decodeURIComponent(req.params.location_code);
    // 1. 查所有产品SKU图片
    const products = await Product.find({}, { skus: 1 });
    const skuImageMap = {};
    products.forEach(prod => {
      (prod.skus || []).forEach(sku => {
        skuImageMap[sku.sku_code] = sku.image_path || sku.image || '';
      });
    });
    // 2. 查所有库存
    const inventoryRecords = await Inventory.find();
    // 3. 聚合指定库位的 items
    const items = [];
    inventoryRecords.forEach(inv => {
      const productId = inv.product_id;
      const productCode = inv.product_code;
      const productName = inv.product_name;
      (inv.locations || []).forEach(loc => {
        if (loc.location_code !== location_code) return;
        // 有SKU的情况
        if (loc.skus && loc.skus.length > 0) {
          loc.skus.forEach(sku => {
            let sku_size = sku.sku_size || sku.size;
            if (!sku_size && sku.sku_code) {
              const parts = sku.sku_code.split('-');
              sku_size = parts[2] || '';
            }
            const skuObj = sku.toObject ? sku.toObject() : sku;
            items.push({
              product_id: productId,
              product_code: productCode,
              product_name: productName,
              sku_code: sku.sku_code,
              sku_color: skuObj.sku_color,
              sku_size: skuObj.sku_size,
              stock_quantity: sku.stock_quantity || 0,
              image_path: skuImageMap[sku.sku_code] || ''
            });
          });
        } else {
          // 无SKU的情况
          items.push({
            product_id: productId,
            product_code: productCode,
            product_name: productName,
            sku_code: null,
            sku_color: null,
            sku_size: null,
            stock_quantity: loc.stock_quantity || 0,
            image_path: ''
          });
        }
      });
    });
    res.json({
      success: true,
      data: {
        location_code,
        items
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error_code: 'INTERNAL_ERROR', error_message: err.message });
  }
});

// 盘点调整库存数量
router.post('/adjust', auth, async (req, res) => {
  try {
    const {
      product_id,
      location_code,
      product_code,
      sku_code,
      stock_quantity,
      batch_number,
      notes,
      operator_id,
      is_urgent,
      quantity
    } = req.body;

    // 验证必填字段
    if (!location_code || !product_code || !sku_code || typeof stock_quantity !== 'number') {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '缺少必要参数(location_code, product_code, sku_code, stock_quantity)'
      });
    }

    // 查找或创建 Inventory 文档
    let invQuery = {};
    if (product_id) invQuery.product_id = product_id;
    if (product_code) invQuery.product_code = product_code;
    if (!invQuery.product_id && !invQuery.product_code && sku_code && sku_code.includes('-')) {
      invQuery.product_code = sku_code.split('-')[0];
    }
    let inventory = await Inventory.findOne(invQuery);
    if (!inventory) {
      // 新建 Inventory 文档
      inventory = new Inventory({
        product_id,
        product_code,
        product_name: '',
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
    const new_quantity = typeof quantity !== 'undefined' ? quantity : stock_quantity;
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
        previous_quantity,
        adjusted_quantity: new_quantity - previous_quantity,
        current_quantity: new_quantity,
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
  res.status(410).json({ success: false, error_code: 'API_DEPRECATED', error_message: '请改用 /api/inventory/by-product?code=<product_code>' });
});

// === 新增：按库位聚合库存（库位 → 商品 → SKU） ===
router.get('/by-location', async (req, res) => {
  try {
    // 1. 查所有产品SKU图片
    const products = await Product.find({}, { skus: 1 });
    const skuImageMap = {};
    products.forEach(prod => {
      (prod.skus || []).forEach(sku => {
        skuImageMap[sku.sku_code] = sku.image_path || sku.image || '';
      });
    });
    // 2. 查所有库存
    const inventoryRecords = await Inventory.find();
    // 3. 聚合所有库位
    const locationMap = {};
    inventoryRecords.forEach(inv => {
      const productId = inv.product_id;
      const productCode = inv.product_code;
      const productName = inv.product_name;
      (inv.locations || []).forEach(loc => {
        const code = loc.location_code;
        if (!locationMap[code]) {
          locationMap[code] = { location_code: code, items: [] };
        }
        if (loc.skus && loc.skus.length > 0) {
          loc.skus.forEach(sku => {
            locationMap[code].items.push({
              product_id: productId,
              product_code: productCode,
              product_name: productName,
              sku_code: sku.sku_code,
              sku_color: sku.sku_color,
              sku_size: sku.sku_size,
              stock_quantity: sku.stock_quantity || 0,
              image_path: skuImageMap[sku.sku_code] || ''
            });
          });
        } else {
          locationMap[code].items.push({
            product_id: productId,
            product_code: productCode,
            product_name: productName,
            sku_code: null,
            sku_color: null,
            sku_size: null,
            stock_quantity: loc.stock_quantity || 0,
            image_path: ''
          });
        }
      });
    });
    let data = Object.values(locationMap);
    // 过滤每个 location 的 items，只保留 stock_quantity > 0
    data.forEach(loc => {
      loc.items = loc.items.filter(it => (it.stock_quantity ?? 0) > 0);
    });
    // 调试：返回第一个SKU的详细信息用于调试
    const debugInfo = data.length > 0 && data[0].items.length > 0 ? {
      first_sku: data[0].items[0],
      modification_time: new Date().toISOString(),
      debug_msg: 'API已更新 - 应该包含sku_color和sku_size字段'
    } : null;
    
    res.json({ success: true, data, debug: debugInfo, error_code: null, error_message: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error_code: 'INTERNAL_ERROR', error_message: err.message });
  }
});

// === 新增：按商品聚合全部库存（无参数，返回所有商品） ===
router.get('/by-product', async (req, res) => {
  try {
    const inventoryRecords = await Inventory.find();
    if (!inventoryRecords || inventoryRecords.length === 0) {
      return res.json({ success: true, data: [], error_code: null, error_message: null });
    }

    const { code: filterCode, page = 1, pageSize = 50 } = req.query;

    // 如果传入 code，则只处理该商品相关库存记录
    const inventoryFiltered = filterCode ? inventoryRecords.filter(r => r.product_code === filterCode) : inventoryRecords;

    const productMap = {}; // { product_code: { product_code, colors: {...} } }

    inventoryFiltered.forEach(inv => {
      const productCode = inv.product_code || inv.code;
      if (!productMap[productCode]) {
        productMap[productCode] = { product_code: productCode, colors: {} };
      }
      const productObj = productMap[productCode];

      (inv.locations || []).forEach(loc => {
        const locationCode = loc.location_code || loc.locationCode;
        (loc.skus || []).forEach(sku => {
          const skuCode = sku.sku_code || sku.code;
          let color = sku.sku_color || sku.color;
          let size  = sku.sku_size  || sku.size;
          if (!color || !size) {
            const parts = (skuCode || '').split('-');
            color = color || parts[1] || '默认颜色';
            size  = size  || parts[2] || '默认尺码';
          }
          if (!productObj.colors[color]) {
            productObj.colors[color] = { color, image_path: sku.image_path || '', sizes: {} };
          }
          const colorObj = productObj.colors[color];
          if (!colorObj.sizes[size]) {
            colorObj.sizes[size] = { size, sku_code: skuCode, total_qty: 0, locations: [] };
          }
          const sizeObj = colorObj.sizes[size];
          const qty = sku.stock_quantity || sku.quantity || 0;
          sizeObj.total_qty += qty;
          if (qty > 0) {
            sizeObj.locations.push({ location_code: locationCode, stock_quantity: qty });
          }
        });
      });
    });

    /* === 用 products.skus 补全无库存SKU === */
    const allProducts = await Product.find(filterCode ? { product_code: filterCode } : {}, { product_code: 1, skus: 1, product_name:1, unit:1, image_path:1, has_sku:1, category:1 });
    const productDetailMap = {};
    allProducts.forEach(pdoc=>{productDetailMap[pdoc.product_code]=pdoc;});

    // 补全无库存SKU详情（必须在生成 dataArr 之前）
    allProducts.forEach(pdoc => {
      const pcode = pdoc.product_code;
      if (!productMap[pcode]) {
        productMap[pcode] = { product_code: pcode, colors: {} };
      }
      const pObj = productMap[pcode];
      (pdoc.skus || []).forEach(s => {
        const sCode = s.sku_code;
        const sColor = s.sku_color || s.color || (sCode.split('-')[1] || '默认颜色');
        const sSize  = s.sku_size  || s.size  || (sCode.split('-')[2] || '默认尺码');
        if (!pObj.colors[sColor]) {
          pObj.colors[sColor] = { color: sColor, image_path: s.image_path || '', sizes: {} };
        } else if (!pObj.colors[sColor].image_path && s.image_path) {
          pObj.colors[sColor].image_path = s.image_path;
        }
        if (!pObj.colors[sColor].sizes[sSize]) {
          pObj.colors[sColor].sizes[sSize] = { size: sSize, sku_code: sCode, total_qty: 0, locations: [] };
        }
      });
    });

    let dataArr = Object.values(productMap).map(p => {
      const colorsArr = Object.values(p.colors).map(cg => {
        const sizesArr = Object.values(cg.sizes);
        const colTotal = sizesArr.reduce((t, s) => t + (s.total_qty || 0), 0);
        const locSet = new Set();
        sizesArr.forEach(sz => {
          (sz.locations || []).forEach(l => locSet.add(l.location_code));
        });
        const locationCount = locSet.size;
        return {
          ...cg,
          sizes: sizesArr,
          total_qty: colTotal,
          sku_count: sizesArr.length,
          location_count: locationCount
        };
      });
      const prodTotal = colorsArr.reduce((t, c) => t + c.total_qty, 0);
      const skuCount = colorsArr.reduce((t, c) => t + c.sku_count, 0);
      const locSet = new Set();
      colorsArr.forEach(col => {
        col.sizes.forEach(sz => {
          (sz.locations || []).forEach(l => locSet.add(l.location_code));
        });
      });
      const locationCount = locSet.size;
      const det = productDetailMap[p.product_code] || {};
      // 构建扁平 sku 列表，便于前端复用旧逻辑
      const skusFlat = [];
      colorsArr.forEach(cg => {
        cg.sizes.forEach(sz => {
          skusFlat.push({
            sku_code: sz.sku_code,
            sku_color: cg.color,
            sku_size: sz.size,
            image_path: cg.image_path || ''
          });
        });
      });
      return {
        product_id: det._id,
        product_code: p.product_code,
        product_name: det.product_name || '',
        unit: det.unit || '',
        image_path: det.image_path || '',
        has_sku: det.has_sku ?? true,
        total_qty: prodTotal,
        sku_count: skuCount,
        location_count: locationCount,
        color_count: colorsArr.length,
        colors: colorsArr,
        skus: skusFlat
      };
    });

    // 分页处理
    const total = dataArr.length;
    const pageInt = parseInt(page);
    const pageSizeInt = parseInt(pageSize);
    const startIdx = (pageInt - 1) * pageSizeInt;
    const pagedData = dataArr.slice(startIdx, startIdx + pageSizeInt);

    res.json({ success: true, data: pagedData, pagination: { page: pageInt, pageSize: pageSizeInt, total }, error_code: null, error_message: null });
  } catch (err) {
    console.error('聚合全部商品库存失败:', err);
    res.status(500).json({ success: false, data: null, error_code: 'GROUP_ALL_PRODUCTS_FAILED', error_message: '服务器错误，无法聚合库存' });
  }
});

// === 新增：库存转移接口 ===
router.post('/transfer', auth, async (req, res) => {
  try {
    const {
      sku_code,
      product_id,
      product_code,
      from_location_id,
      from_location_code,
      to_location_id,
      to_location_code,
      stock_quantity,
      batch_number,
      notes,
      operator_id,
      sku_color,
      sku_size
    } = req.body;

    // 参数校验
    if (!sku_code || !stock_quantity || (!from_location_id && !from_location_code) || (!to_location_id && !to_location_code) || !operator_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '缺少必要参数(sku_code, stock_quantity, from_location, to_location, operator_id)'
      });
    }
    if (from_location_id === to_location_id && from_location_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '源库位和目标库位不能相同'
      });
    }
    if (from_location_code === to_location_code && from_location_code) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMETERS',
        error_message: '源库位和目标库位不能相同'
      });
    }

    // 先查 Inventory 文档（按 product_code 或 product_id）
    let invQuery = {};
    if (product_id) invQuery.product_id = product_id;
    if (product_code) invQuery.product_code = product_code;
    if (!invQuery.product_id && !invQuery.product_code) {
      // 尝试通过 sku_code 前缀推断 product_code
      if (sku_code && sku_code.includes('-')) {
        invQuery.product_code = sku_code.split('-')[0];
      }
    }
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
    let fromLoc = inventory.locations.find(loc =>
      (from_location_id && loc.location_id && loc.location_id.toString() === from_location_id) ||
      (from_location_code && loc.location_code === from_location_code)
    );
    if (!fromLoc) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'FROM_LOCATION_NOT_FOUND',
        error_message: '未找到源库位'
      });
    }
    // 查找目标库位
    let toLoc = inventory.locations.find(loc =>
      (to_location_id && loc.location_id && loc.location_id.toString() === to_location_id) ||
      (to_location_code && loc.location_code === to_location_code)
    );
    if (!toLoc) {
      // 目标库位不存在则新建
      toLoc = {
        location_id: to_location_id || undefined,
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
    if (fromSku.stock_quantity < stock_quantity) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INSUFFICIENT_STOCK',
        error_message: '源库位库存不足',
        details: { 
          available_quantity: fromSku.stock_quantity,
          requested_quantity: stock_quantity,
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
    fromSku.stock_quantity -= stock_quantity;
    toSku.stock_quantity += stock_quantity;

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

    // 记录转移历史
    const transfer = new InventoryAdjustment({
      location_code: from_location_code,
      to_location_code: to_location_code,
      product_code: inventory.product_code,
      sku_code,
      sku_color: fromSku.sku_color || fromSku.color,
      sku_size: fromSku.sku_size || fromSku.size,
      previous_quantity: fromSku.stock_quantity + stock_quantity,
      adjusted_quantity: -stock_quantity,
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
        sku_code,
        from_location: from_location_code,
        to_location: to_location_code,
        stock_quantity,
        from_current_quantity: fromSku.stock_quantity,
        to_current_quantity: toSku.stock_quantity,
        batch_number,
        operator_id: operator_id,
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