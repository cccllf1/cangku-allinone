const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Inventory = require('../models/Inventory'); // 导入库存模型
const auth = require('../middleware/auth'); // 导入认证中间件

// 新增：SKU查询接口 (支持SKU编码、外部条码和商品编码)
router.get('/sku-lookup/:code', auth, async (req, res) => {
  const { code } = req.params;

  try {
    let product;
    let foundSku;

    // 1. 尝试按 SKU 编码查找
    product = await Product.findOne({ "colors.sizes.sku_code": code }).lean();
    if (product) {
        for (const color of product.colors) {
            const size = color.sizes.find(s => s.sku_code === code);
            if (size) {
                foundSku = { ...size, color: color.color, image_path: color.image_path };
                break;
            }
        }
        if (foundSku) {
            const skuInfo = { ...foundSku, product_code: product.product_code, product_name: product.product_name, product };
            return res.json({ success: true, data: { type: 'sku', result: skuInfo } });
        }
    }

    // 2. 尝试按外部条码查找
    product = await Product.findOne({ "colors.sizes.external_codes.external_code": code }).lean();
    if (product) {
        let targetSkuCode = null;
        for (const color of product.colors) {
            for (const size of color.sizes) {
                if (size.external_codes && size.external_codes.some(ec => ec.external_code === code)) {
                    targetSkuCode = size.sku_code;
                    break;
                }
            }
            if(targetSkuCode) break;
        }

        if (targetSkuCode) {
            for (const color of product.colors) {
                const size = color.sizes.find(s => s.sku_code === targetSkuCode);
                if (size) {
                    foundSku = { ...size, color: color.color, image_path: color.image_path };
                    break;
                }
            }
        }
        
        if (foundSku) {
            const skuInfo = { ...foundSku, product_code: product.product_code, product_name: product.product_name, product };
            return res.json({ success: true, data: { type: 'sku', result: skuInfo } });
        }
    }

    // 3. 尝试按商品编码查找
    product = await Product.findOne({ product_code: code }).lean();
    if (product) {
      return res.json({ success: true, data: { type: 'product', result: product } });
    }

    // 4. 如果都找不到
    res.status(404).json({ success: false, error_message: '未找到匹配的商品、SKU或外部条码' });

  } catch (error) {
    console.error('SKU/Product lookup failed:', error);
    res.status(500).json({ success: false, error_message: '服务器内部错误' });
  }
});

// 解析 SKU 编码，格式假定为 `${product_code}-${color}-${size}`
const parseSkuCode = (skuCode = '') => {
  const parts = skuCode.split('-');
  if (parts.length >= 3) {
    const size = parts.pop();
    const color = parts.pop();
    return { color, size };
  }
  return { color: '默认颜色', size: undefined };
};

// 移除了buildColorsFromSkus函数，不再支持旧SKU结构向颜色结构的转换

// 获取所有商品
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      page_size = 20, 
      search = '', 
      category_code_1 = '', 
      category_code_2 = '', 
      has_stock_only = false 
    } = req.query;

    const pageNum = parseInt(page);
    const pageSizeNum = Math.min(parseInt(page_size), 100); // 最大100条
    const hasStockOnly = has_stock_only === 'true';

    // 构建商品查询条件
    const productQuery = {};
    if (search) {
      productQuery.$or = [
        { product_code: { $regex: search, $options: 'i' } },
        { product_name: { $regex: search, $options: 'i' } }
      ];
    }
    if (category_code_1) {
      productQuery.category_code_1 = category_code_1;
    }
    if (category_code_2) {
      productQuery.category_code_2 = category_code_2;
    }

    // 获取商品基础信息
    const products = await Product.find(productQuery, {
      product_code: 1,
      product_name: 1,
      unit: 1,
      image_path: 1,
      has_sku: 1,
      category_code_1: 1,
      category_name_1: 1,
      category_code_2: 1,
      category_name_2: 1,
      colors: 1,
      skus: 1,
      description: 1,
      created_at: 1,
      updated_at: 1
    }).lean();

    // 获取所有商品的库存信息 - 使用聚合管道展开嵌套结构
    const productCodes = products.map(p => p.product_code);
    const inventoryData = await Inventory.aggregate([
      { $match: { product_code: { $in: productCodes } } },
      { $unwind: "$locations" },
      { $unwind: { path: "$locations.skus", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          product_code: 1,
          location_code: "$locations.location_code",
          sku_code: "$locations.skus.sku_code",
          sku_color: { $ifNull: ["$locations.skus.sku_color", ""] },
          sku_size: { $ifNull: ["$locations.skus.sku_size", ""] },
          stock_quantity: {
            $cond: [ 
              { $ifNull: ["$locations.skus.sku_code", false] }, 
              "$locations.skus.stock_quantity", 
              "$locations.stock_quantity" 
            ]
          }
        }
      }
    ]);

    // 构建库存映射 - 处理扁平化的库存数据
    const inventoryMap = {};
    inventoryData.forEach(inv => {
      const productCode = inv.product_code;
      const skuCode = inv.sku_code;
      const locationCode = inv.location_code;
      const qty = inv.stock_quantity || 0;
      
      // 优先从SKU编码解析颜色和尺寸，确保数据准确性
      let color = '默认颜色';
      let size = '默认尺寸';
      
      if (skuCode && skuCode.includes('-')) {
        const parts = skuCode.split('-');
        if (parts.length >= 3) {
          color = parts[1];
          size = parts[2];
        }
      }
      
      // 如果解析失败，才使用数据库字段
      if (color === '默认颜色') {
        color = inv.sku_color || '默认颜色';
      }
      if (size === '默认尺寸') {
        size = inv.sku_size || '默认尺寸';
      }
      
      if (!inventoryMap[productCode]) {
        inventoryMap[productCode] = { colors: {} };
      }
      if (!inventoryMap[productCode].colors[color]) {
        inventoryMap[productCode].colors[color] = { sizes: {} };
      }
      if (!inventoryMap[productCode].colors[color].sizes[size]) {
        inventoryMap[productCode].colors[color].sizes[size] = { 
          sku_code: skuCode, 
          sku_total_quantity: 0, 
          locations: [] 
        };
      }
      
      inventoryMap[productCode].colors[color].sizes[size].sku_total_quantity += qty;
      if (qty > 0) {
        inventoryMap[productCode].colors[color].sizes[size].locations.push({
          location_code: locationCode,
          stock_quantity: qty
        });
      }
    });

    // 格式化商品数据，整合库存信息
    let formattedProducts = products.map(p => {
      const productCode = p.product_code;
      const invData = inventoryMap[productCode] || { colors: {} };
      
      // 构建colors结构，合并商品定义和库存数据
      const colorsResult = [];
      const colorMap = {};
      
      // 先从商品的colors结构获取基础信息
      (p.colors || []).forEach(colorDef => {
        const color = colorDef.color;
        colorMap[color] = {
          color: color,
          image_path: colorDef.image_path || '',
          color_total_quantity: 0,
          total_sku_count: 0,
          total_location_count: 0,
          sizes: []
        };
        
        (colorDef.sizes || []).forEach(sizeDef => {
          const size = sizeDef.sku_size;
          const skuCode = sizeDef.sku_code;
          const invColorData = invData.colors[color];
          const invSizeData = invColorData?.sizes[size] || { sku_total_quantity: 0, locations: [] };
          
          colorMap[color].sizes.push({
            sku_size: size,
            sku_code: skuCode,
            sku_total_quantity: invSizeData.sku_total_quantity,
            locations: invSizeData.locations || []
          });
          
          colorMap[color].color_total_quantity += invSizeData.sku_total_quantity;
          colorMap[color].total_sku_count += 1;
          
          // 计算该颜色涉及的库位数量
          const locationSet = new Set();
          (invSizeData.locations || []).forEach(loc => locationSet.add(loc.location_code));
          colorMap[color].total_location_count = Math.max(colorMap[color].total_location_count, locationSet.size);
        });
      });
      
      // 再从库存数据中补充可能遗漏的颜色/尺寸（如果商品结构不完整）
      Object.keys(invData.colors || {}).forEach(color => {
        if (!colorMap[color]) {
          colorMap[color] = {
            color: color,
            image_path: '',
            color_total_quantity: 0,
            total_sku_count: 0,
            total_location_count: 0,
            sizes: []
          };
        }
        
        Object.keys(invData.colors[color].sizes || {}).forEach(size => {
          const sizeData = invData.colors[color].sizes[size];
          const existingSize = colorMap[color].sizes.find(s => s.sku_size === size);
          
          if (!existingSize) {
            colorMap[color].sizes.push({
              sku_size: size,
              sku_code: sizeData.sku_code,
              sku_total_quantity: sizeData.sku_total_quantity,
              locations: sizeData.locations || []
            });
            
            colorMap[color].color_total_quantity += sizeData.sku_total_quantity;
            colorMap[color].total_sku_count += 1;
          }
        });
        
        // 重新计算库位数量
        const locationSet = new Set();
        colorMap[color].sizes.forEach(sz => {
          (sz.locations || []).forEach(loc => locationSet.add(loc.location_code));
        });
        colorMap[color].total_location_count = locationSet.size;
      });
      
      const colorsArray = Object.values(colorMap);
      
      // 计算商品级统计
      const product_total_quantity = colorsArray.reduce((sum, color) => sum + color.color_total_quantity, 0);
      const total_sku_count = colorsArray.reduce((sum, color) => sum + color.total_sku_count, 0);
      const total_color_count = colorsArray.length;
      
      // 计算商品涉及的总库位数量
      const allLocationSet = new Set();
      colorsArray.forEach(color => {
        color.sizes.forEach(size => {
          (size.locations || []).forEach(loc => allLocationSet.add(loc.location_code));
        });
      });
      const total_location_count = allLocationSet.size;
      
      // 构建扁平SKU列表（兼容性）
      const skusFlat = [];
      colorsArray.forEach(color => {
        color.sizes.forEach(size => {
          skusFlat.push({
            sku_code: size.sku_code,
            sku_color: color.color,
            sku_size: size.sku_size,
            image_path: color.image_path || ''
          });
        });
      });
      
      return {
        product_id: p._id,
        product_code: p.product_code,
        product_name: p.product_name,
        unit: p.unit || '件',
        image_path: p.image_path || '',
        has_sku: p.has_sku || true,
        category_code_1: p.category_code_1 || '',
        category_name_1: p.category_name_1 || '',
        category_code_2: p.category_code_2 || '',
        category_name_2: p.category_name_2 || '',
        description: p.description || '',
        product_total_quantity,
        total_sku_count,
        total_location_count,
        total_color_count,
        colors: colorsArray,
        skus: skusFlat,
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    });

    // 如果需要过滤有库存的商品
    if (hasStockOnly) {
      formattedProducts = formattedProducts.filter(p => p.product_total_quantity > 0);
    }

    // 分页处理
    const total = formattedProducts.length;
    const totalPages = Math.ceil(total / pageSizeNum);
    const startIndex = (pageNum - 1) * pageSizeNum;
    const paginatedProducts = formattedProducts.slice(startIndex, startIndex + pageSizeNum);
    
    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          current_page: pageNum,
          page_size: pageSizeNum,
          total_count: total,
          total_pages: totalPages,
          has_next_page: pageNum < totalPages,
          has_prev_page: pageNum > 1
        }
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('获取商品列表失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'FETCH_PRODUCTS_FAILED',
      error_message: '获取商品列表失败'
    });
  }
});

// 根据外部条码查询商品
router.get('/external-code/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;

    const product = await Product.findOne({
      'colors.sizes.external_codes.external_code': code
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        error_code: 'NOT_FOUND',
        error_message: '未找到使用该外部条码的SKU'
      });
    }

    let matched_sku = null;
    let matched_color = null;

    // 遍历查找匹配的SKU
    for (const color of product.colors) {
      const sku = color.sizes.find(s => s.external_codes && s.external_codes.some(ec => ec.external_code === code));
      if (sku) {
        matched_sku = sku;
        matched_color = color;
        break;
      }
    }

    // 理论上不会到这里，因为前面的查询已经保证了存在
    if (!matched_sku) {
      return res.status(404).json({
        success: false,
        error_code: 'NOT_FOUND',
        error_message: '数据不一致：找到商品但未找到SKU'
      });
    }
    
    // 返回一个与按SKU编码查询时类似的精简结构
    const responseData = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      image_path: product.image_path,
      // `matched_sku` 字段对接收端非常重要
      matched_sku: {
        sku_code: matched_sku.sku_code,
        color: matched_color.color,
        size: matched_sku.sku_size,
        image_path: matched_sku.image_path || matched_color.image_path || product.image_path,
        stock_quantity: matched_sku.sku_total_quantity || 0
      }
    };
    
    res.json({
      success: true,
      data: responseData,
      error_code: null,
      error_message: null
    });
    
  } catch (err) {
    console.error('根据外部条码查询商品失败:', err);
    res.status(500).json({
      success: false,
      error_code: 'SERVER_ERROR',
      error_message: '服务器内部错误'
    });
  }
});

// 获取商品所有外部条码
router.get('/:id/external-codes', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到商品'
      });
    }
    
    res.json({
      success: true,
      data: product.external_codes || [],
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('获取外部条码失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'FETCH_FAILED',
      error_message: '获取外部条码失败: ' + err.message
    });
  }
});

// 为商品添加外部条码
router.post('/:id/external-codes', auth, async (req, res) => {
  try {
    const { code, source, description } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMS',
        error_message: '外部条码不能为空'
      });
    }
    
    // 检查是否已存在此外部条码
    const existingProduct = await Product.findOne({ "external_codes.code": code });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        data: {
          product_id: existingProduct._id,
          product_code: existingProduct.product_code || existingProduct.code,
          product_name: existingProduct.product_name || existingProduct.name
        },
        error_code: 'EXTERNAL_CODE_EXISTS',
        error_message: '此外部条码已关联到其他商品'
      });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到商品'
      });
    }
    
    // 初始化external_codes数组(如果不存在)
    if (!product.external_codes) {
      product.external_codes = [];
    }
    
    // 添加新的外部条码
    product.external_codes.push({
      code,
      source: source || '手动添加',
      description: description || ''
    });
    
    await product.save();
    
    res.status(201).json({
      success: true,
      data: {
        message: '外部条码添加成功',
        external_codes: product.external_codes
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('添加外部条码失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'ADD_FAILED',
      error_message: '添加外部条码失败: ' + err.message
    });
  }
});

// 删除商品的外部条码
router.delete('/:id/external-codes/:code', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到商品'
      });
    }
    
    // 如果external_codes不存在，初始化为空数组
    if (!product.external_codes) {
      product.external_codes = [];
    }
    
    // 找到并移除指定的外部条码
    const initialLength = product.external_codes.length;
    product.external_codes = product.external_codes.filter(ec => ec.code !== req.params.code);
    
    // 如果数组长度没变，说明没有找到匹配的条码
    if (initialLength === product.external_codes.length) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'EXTERNAL_CODE_NOT_FOUND',
        error_message: '未找到指定的外部条码'
      });
    }
    
    await product.save();
    
    res.json({
      success: true,
      data: {
        message: '外部条码删除成功',
        external_codes: product.external_codes
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('删除外部条码失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'DELETE_FAILED',
      error_message: '删除外部条码失败: ' + err.message
    });
  }
});

// 按商品编码或SKU编码或外部条码查询
router.get('/code/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;
    let queryType = null;
    let product = null;

    // 1. 按优先级依次尝试查询，让数据库结果决定匹配类型
    
    // 优先级1: 尝试按SKU编码查询（最精确）
    try {
      product = await Product.findOne({ 'colors.sizes.sku_code': code }).lean();
      if (product) {
        queryType = 'sku';
        console.log(`找到SKU匹配: ${code}`);
      }
    } catch (e) {
      console.log(`SKU查询异常: ${e.message}`);
    }
    
    // 优先级2: 如果SKU查询无结果，尝试按产品代码查询
    if (!product) {
      try {
        product = await Product.findOne({ product_code: code }).lean();
        if (product) {
          queryType = 'product';
          console.log(`找到产品代码匹配: ${code}`);
        }
      } catch (e) {
        console.log(`产品代码查询异常: ${e.message}`);
      }
    }
    
    // 优先级3: 如果产品代码查询也无结果，尝试按外部条码查询
    if (!product) {
      try {
        product = await Product.findOne({ 'colors.sizes.external_codes.external_code': code }).lean();
        if (product) {
          queryType = 'external_code';
          console.log(`找到外部条码匹配: ${code}`);
        }
      } catch (e) {
        console.log(`外部条码查询异常: ${e.message}`);
      }
    }

    // 如果所有查询都失败
    if (!product) {
      return res.status(404).json({
        success: false,
        error_code: 'NOT_FOUND',
        error_message: '未找到商品或SKU'
      });
    }

    // 2. [统一逻辑] 获取并聚合该商品的完整库存信息
    const inventoryData = await Inventory.aggregate([
      { $match: { product_code: product.product_code } },
      { $unwind: "$locations" },
      { $unwind: "$locations.skus" },
      { $group: {
          _id: { sku_code: "$locations.skus.sku_code", location_code: "$locations.location_code" },
          stock_quantity: { $sum: "$locations.skus.stock_quantity" }
      }},
      { $group: {
          _id: "$_id.sku_code",
          locations: { $push: { location_code: "$_id.location_code", stock_quantity: "$stock_quantity" } },
          sku_total_quantity: { $sum: "$stock_quantity" }
      }}
    ]);
    
    const inventoryMap = new Map(inventoryData.map(item => [item._id, item]));

    // 3. [统一逻辑] 将库存信息整合到商品结构中
    let product_total_quantity = 0;
    for (const color of product.colors) {
      let color_total_quantity = 0;
      for (const size of color.sizes) {
        const inv = inventoryMap.get(size.sku_code);
        size.sku_total_quantity = inv ? inv.sku_total_quantity : 0;
        size.locations = inv ? inv.locations : [];
        color_total_quantity += size.sku_total_quantity;
      }
      color.color_total_quantity = color_total_quantity;
      product_total_quantity += color_total_quantity;
    }
    product.product_total_quantity = product_total_quantity;
    
    // 4. 根据查询类型构建matched_sku对象
    if (queryType === 'sku' || queryType === 'external_code') {
      let matched_sku_data = null;
      let targetSkuCode = null;
      
      if (queryType === 'sku') {
        // SKU查询，直接使用查询代码
        targetSkuCode = code;
      } else if (queryType === 'external_code') {
        // 外部条码查询，需要找到对应的SKU代码
        for (const color of product.colors) {
          for (const size of color.sizes) {
            if (size.external_codes && size.external_codes.some(ec => ec.external_code === code)) {
              targetSkuCode = size.sku_code;
              break;
            }
          }
          if (targetSkuCode) break;
        }
      }
      
      // 根据SKU代码构建matched_sku对象
      if (targetSkuCode) {
        for (const color of product.colors) {
          const foundSize = color.sizes.find(s => s.sku_code === targetSkuCode);
          if (foundSize) {
            matched_sku_data = {
              sku_code: foundSize.sku_code,
              sku_color: color.color,
              sku_size: foundSize.sku_size,
              image_path: color.image_path || '',
              stock_quantity: foundSize.sku_total_quantity, // 使用整合后的总库存
              sku_total_quantity: foundSize.sku_total_quantity,
              locations: foundSize.locations,
              external_codes: foundSize.external_codes || []
            };
            break;
          }
        }
      }
      product.matched_sku = matched_sku_data;
    }

    // 5. 返回最终处理好的商品数据，包含查询类型信息
    res.json({
      success: true,
      data: {
        ...product, // 返回所有整合后的字段
        product_id: product._id,
        query_type: queryType, // 告诉前端是通过什么方式找到的
        query_code: code // 告诉前端查询的原始代码
      },
      error_code: null,
      error_message: null
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'QUERY_FAILED',
      error_message: err.message
    });
  }
});

// 获取单个商品
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到商品'
      });
    }

    // 格式化返回字段
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit || '件',
      has_sku: product.has_sku || false,
      category_code_1: product.category_code_1 || '',
      category_name_1: product.category_name_1 || '',
      category_code_2: product.category_code_2 || '',
      category_name_2: product.category_name_2 || '',
      product_total_quantity: 0, // 商品所有SKU的总数量（新建商品时为0）
      colors: product.colors || [],
      description: product.description || '',
      created_at: product.created_at,
      updated_at: product.updated_at
    };

    res.json({
      success: true,
      data: formattedProduct,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('获取商品详情失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'FETCH_PRODUCT_FAILED',
      error_message: '获取商品详情失败'
    });
  }
});

// 新增商品
router.post('/', auth, async (req, res) => {
  try {
    const { 
      product_code,
      product_name,
      unit = '件',
      colors = [],
      description = '',
      category_code_1,
      category_name_1,
      category_code_2,
      category_name_2,
      operator_id,
      is_urgent = false,
      notes = ''
    } = req.body;

    // 验证必需参数
    if (!product_code) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'MISSING_PRODUCT_CODE',
        error_message: '商品编码不能为空'
      });
    }

    if (!operator_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'MISSING_OPERATOR_ID',
        error_message: '缺少操作人ID'
      });
    }

    // 验证必须提供颜色数组（不支持简单商品）
    if (!colors || colors.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'MISSING_COLORS',
        error_message: '必须提供colors数组，系统不支持简单商品'
      });
    }

    // 检查商品编码是否已存在
    const existingProduct = await Product.findOne({ product_code });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_CODE_EXISTS',
        error_message: '商品编码已存在'
      });
    }

    // 从colors结构生成skus数组
    const skus = [];
    colors.forEach(color => {
      (color.sizes || []).forEach(size => {
        const sku_code = size.sku_code || `${product_code}-${color.color}-${size.size}`;
        skus.push({
          sku_code,
          sku_color: color.color,
          sku_size: size.size,
          stock_quantity: 0,
          image_path: color.image_path || ''
        });
      });
    });

    // 创建产品对象
    const productData = {
      product_code,
      product_name: product_name || product_code,
      unit,
      has_sku: true, // 系统只支持变体商品
      description,
      category_code_1,
      category_name_1,
      category_code_2,
      category_name_2,
      colors: colors.map(color => ({
        color: color.color,
        image_path: color.image_path || '',
        color_total_quantity: 0, // 该颜色下所有尺寸的总数量
        sizes: (color.sizes || []).map(size => ({
          sku_size: size.size,
          sku_code: size.sku_code || `${product_code}-${color.color}-${size.size}`,
          sku_total_quantity: 0,
          locations: []
        }))
      })),
      skus // 保持向后兼容
    };

    const product = await Product.create(productData);

    // 格式化返回的数据
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit,
      has_sku: product.has_sku,
      product_total_quantity: 0, // 商品所有SKU的总数量
      colors: product.colors || [],
      description: product.description,
      created_at: new Date().toISOString(),
      operated_at: new Date().toISOString(),
      operator_id,
      is_urgent,
      notes
    };

    res.status(201).json({
      success: true,
      data: formattedProduct,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('创建商品失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'CREATE_PRODUCT_FAILED',
      error_message: err.message
    });
  }
});

// 修改商品
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      product_code,
      product_name,
      unit = '件',
      description,
      category_code_1,
      category_name_1,
      category_code_2,
      category_name_2,
      colors = [],
      operator_id,
      is_urgent = false,
      notes = ''
    } = req.body;

    // 验证必需参数
    if (!operator_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'MISSING_OPERATOR_ID',
        error_message: '缺少操作人ID'
      });
    }

    // 如果提供了colors参数，验证不能为空（不支持简单商品）
    if (colors !== undefined && colors.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_COLORS',
        error_message: 'colors数组不能为空，系统不支持简单商品'
      });
    }

    // 从colors结构生成skus数组
    const skus = [];
    colors.forEach(color => {
      (color.sizes || []).forEach(size => {
        const sku_code = size.sku_code || `${product_code}-${color.color}-${size.size}`;
        skus.push({
          sku_code,
          sku_color: color.color,
          sku_size: size.size,
          stock_quantity: 0,
          image_path: color.image_path || ''
        });
      });
    });

    // 构建更新数据
    const updateData = {
      product_code,
      product_name: product_name || product_code,
      unit,
      description,
      category_code_1,
      category_name_1,
      category_code_2,
      category_name_2,
      has_sku: true, // 系统只支持变体商品
      colors: colors.map(color => ({
        color: color.color,
        image_path: color.image_path || '',
        color_total_quantity: 0,
        sizes: (color.sizes || []).map(size => ({
          sku_size: size.size,
          sku_code: size.sku_code || `${product_code}-${color.color}-${size.size}`,
          sku_total_quantity: 0,
          locations: []
        }))
      })),
      skus // 保持内部数据结构
    };

    // 查找并更新商品
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到商品'
      });
    }

    // 商品修改时不支持删除SKU，如需删除SKU请使用专门的SKU管理接口

    // 计算商品总数量
    const productTotal = (product.skus || []).reduce((total, sku) => total + (sku.stock_quantity || 0), 0);
    
    // 格式化返回数据
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit,
      has_sku: product.has_sku,
      category_code_1: product.category_code_1,
      category_name_1: product.category_name_1,
      category_code_2: product.category_code_2,
      category_name_2: product.category_name_2,
      product_total_quantity: productTotal, // 商品所有SKU的总数量
      colors: product.colors || [],
      description: product.description,
      updated_at: new Date().toISOString(),
      operated_at: new Date().toISOString(),
      operator_id,
      is_urgent,
      notes
    };

    res.json({
      success: true,
      data: formattedProduct,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('更新商品失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'UPDATE_PRODUCT_FAILED',
      error_message: err.message
    });
  }
});

// 删除商品
router.delete('/:id', auth, async (req, res) => {
  try {
    const { operator_id, is_urgent, notes } = req.body;
    
    // 验证必需参数
    if (!operator_id) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'MISSING_OPERATOR_ID',
        error_message: '缺少操作人ID'
      });
    }

    const productId = req.params.id;
    
    // 先检查商品是否存在
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到要删除的商品'
      });
    }

    // 统计并删除库存（即使有库存也执行删除）
    const inventoryList = await Inventory.find({ product_id: productId });
    const totalStock = inventoryList.reduce((sum, inv) => sum + (inv.stock_quantity || 0), 0);

    const inventoryDeletionResult = await Inventory.deleteMany({ product_id: productId });

    // 删除商品本身
    await Product.findByIdAndDelete(productId);

    console.log(`已删除产品 ${product.product_code} (ID: ${productId}) 及其 ${inventoryDeletionResult.deletedCount} 条库存记录（原总库存 ${totalStock} 件）。`);

    res.json({
      success: true,
      data: {
        product_id: productId,
        deleted_inventory_count: inventoryDeletionResult.deletedCount,
        deleted_stock_quantity: totalStock,
        operated_at: new Date().toISOString(),
        operator_id,
        is_urgent: is_urgent || false,
        notes: notes || ''
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('删除商品失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'DELETE_PRODUCT_FAILED',
      error_message: '删除商品失败: ' + err.message
    });
  }
});

module.exports = router; 