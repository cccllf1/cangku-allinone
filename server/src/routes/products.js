const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Inventory = require('../models/Inventory'); // 导入库存模型
const auth = require('../middleware/auth'); // 导入认证中间件

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

    // 获取所有商品的库存信息
    const productCodes = products.map(p => p.product_code);
    const inventoryData = await Inventory.find(
      { product_code: { $in: productCodes } },
      { product_code: 1, locations: 1 }
    ).lean();

    // 构建库存映射
    const inventoryMap = {};
    inventoryData.forEach(inv => {
      const productCode = inv.product_code;
      if (!inventoryMap[productCode]) {
        inventoryMap[productCode] = { colors: {} };
      }
      
      (inv.locations || []).forEach(loc => {
        const locationCode = loc.location_code;
        (loc.skus || []).forEach(sku => {
          const skuCode = sku.sku_code;
          const color = sku.sku_color || sku.color || '默认颜色';
          const size = sku.sku_size || sku.size || '默认尺寸';
          const qty = sku.stock_quantity || 0;  // 只使用标准字段名 stock_quantity
          
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
      });
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
    const external_code = req.params.code;
    
    // 1. 先查商品级外部条码
    let product = await Product.findOne(
      { "external_codes.code": external_code },
      {
        product_code: 1,
        product_name: 1,
        unit: 1,
        image_path: 1,
        has_sku: 1,
        skus: 1,
        colors: 1,
        external_codes: 1,
        category_code_1: 1,
        category_name_1: 1,
        category_code_2: 1,
        category_name_2: 1,
        description: 1,
        created_at: 1,
        updated_at: 1
      }
    ).lean();
    
    let matched_external_code = null;
    let matched_sku = null;
    
    if (product) {
      // 商品级外部条码
      matched_external_code = product.external_codes.find(ec => ec.code === external_code);
    } else {
      // 2. 再查SKU级外部条码
      product = await Product.findOne(
        { "skus.external_codes.external_code": external_code },
        {
          product_code: 1,
          product_name: 1,
          unit: 1,
          image_path: 1,
          has_sku: 1,
          skus: 1,
          colors: 1,
          external_codes: 1,
          category_code_1: 1,
          category_name_1: 1,
          category_code_2: 1,
          category_name_2: 1,
          description: 1,
          created_at: 1,
          updated_at: 1
        }
      ).lean();
      
      if (product) {
        // 找到匹配的SKU
        matched_sku = product.skus.find(sku => 
          sku.external_codes && sku.external_codes.some(ec => ec.external_code === external_code)
        );
        if (matched_sku) {
          matched_external_code = matched_sku.external_codes.find(ec => ec.external_code === external_code);
        }
      }
    }
    
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到对应此外部条码的商品'
      });
    }
    
    // 计算商品总数量
    const productTotal = (product.skus || []).reduce((total, sku) => total + (sku.stock_quantity || 0), 0);
    
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
      product_total_quantity: productTotal, // 商品所有SKU的总数量
      colors: product.colors || [],
      description: product.description || '',
      external_code: matched_external_code,
      created_at: product.created_at,
      updated_at: product.updated_at
    };
    
    // 如果找到了匹配的SKU，添加matched_sku字段（和SKU编码查询保持一致）
    if (matched_sku) {
      formattedProduct.matched_sku = {
        sku_code: matched_sku.sku_code,
        sku_color: matched_sku.sku_color,
        sku_size: matched_sku.sku_size,
        stock_quantity: matched_sku.stock_quantity || 0,
        image_path: matched_sku.image_path || ''
      };
    }
    
    res.json({
      success: true,
      data: formattedProduct,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('查询外部条码失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'QUERY_FAILED',
      error_message: '查询失败: ' + err.message
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

// 按商品编码查询
router.get('/code/:code', auth, async (req, res) => {
  try {
    const product_code = req.params.code;
    
    // 1. 先查主码
    let product = await Product.findOne(
      { product_code },
      {
        product_code: 1,
        product_name: 1,
        unit: 1,
        image_path: 1,
        has_sku: 1,
        skus: 1,
        colors: 1,
        description: 1,
        created_at: 1,
        updated_at: 1
      }
    ).lean();
    
    if (product) {
      // 计算商品总数量
      const productTotal = (product.skus || []).reduce((total, sku) => total + (sku.stock_quantity || 0), 0);
      
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
        product_total_quantity: productTotal, // 商品所有SKU的总数量
        colors: product.colors || [],
        description: product.description || '',
        created_at: product.created_at,
        updated_at: product.updated_at
      };
      
      return res.json({
        success: true,
        data: formattedProduct,
        error_code: null,
        error_message: null
      });
    }
    
    // 2. 查 SKU
    product = await Product.findOne(
      { 'skus.sku_code': product_code },
      {
        product_code: 1,
        product_name: 1,
        unit: 1,
        image_path: 1,
        has_sku: 1,
        skus: 1,
        colors: 1,
        description: 1,
        created_at: 1,
        updated_at: 1
      }
    ).lean();
    if (product) {
      const matchedSku = product.skus.find(sku => sku.sku_code === product_code);
      // 计算商品总数量
      const productTotal = (product.skus || []).reduce((total, sku) => total + (sku.stock_quantity || 0), 0);
      
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
        product_total_quantity: productTotal, // 商品所有SKU的总数量
        colors: product.colors || [],
        matched_sku: matchedSku ? {
          sku_code: matchedSku.sku_code,
          sku_color: matchedSku.sku_color,
          sku_size: matchedSku.sku_size,
          stock_quantity: matchedSku.stock_quantity || 0,
          image_path: matchedSku.image_path || ''
        } : null,
        description: product.description || '',
        created_at: product.created_at,
        updated_at: product.updated_at
      };
      
      return res.json({
        success: true,
        data: formattedProduct,
        error_code: null,
        error_message: null
      });
    }
    
    // 3. 都查不到
    return res.status(404).json({
      success: false,
      data: null,
      error_code: 'PRODUCT_NOT_FOUND',
      error_message: '未找到商品'
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

    // 检查是否有库存
    const inventory = await Inventory.findOne({ product_id: productId });
    if (inventory && inventory.stock_quantity > 0) {
      return res.status(400).json({
        success: false,
        data: {
          product_id: productId,
          stock_quantity: inventory.stock_quantity
        },
        error_code: 'OPERATION_NOT_ALLOWED',
        error_message: '商品还有库存，不能删除'
      });
    }

    // 删除商品
    await Product.findByIdAndDelete(productId);

    // 删除相关的库存记录
    const inventoryDeletionResult = await Inventory.deleteMany({ product_id: productId });
    console.log(`已删除产品 ${product.product_code} (ID: ${productId}) 的 ${inventoryDeletionResult.deletedCount} 条库存记录。`);

    res.json({
      success: true,
      data: {
        product_id: productId,
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