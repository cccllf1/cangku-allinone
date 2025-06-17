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

const buildColorsFromSkus = (skus = []) => {
  const map = {};
  skus.forEach(sku => {
    const skuCode = sku.sku_code || sku.code || '';
    const parsed = parseSkuCode(skuCode);
    const color = sku.sku_color || sku.color || parsed.color;
    const size = sku.sku_size || sku.size || parsed.size;

    if (!map[color]) {
      map[color] = {
        color,
        image_path: sku.image_path || sku.image || '',
        sizes: []
      };
    }

    map[color].sizes.push({
      sku_size: size,
      sku_code: skuCode,
      total_quantity: sku.stock_quantity || sku.quantity || 0,
      locations: []
    });
  });

  return Object.values(map);
};

// 获取所有商品
router.get('/', auth, async (req, res) => {
  try {
    const products = await Product.find(
      {},
      {
        product_code: 1,
        product_name: 1,
        unit: 1,
        image_path: 1,
        has_sku: 1,
        skus: 1,
        created_at: 1,
        updated_at: 1
      }
    ).lean();
    const formattedProducts = products.map(p => ({
      product_id: p._id,
      product_code: p.product_code,
      product_name: p.product_name,
      unit: p.unit || '件',
      image_path: p.image_path || '',
      has_sku: p.has_sku || false,
      skus: (p.skus || []).map(sku => ({
        sku_code: sku.sku_code,
        sku_color: sku.sku_color,
        sku_size: sku.sku_size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || ''
      })),
      created_at: p.created_at,
      updated_at: p.updated_at
    }));
    
    res.json({
      success: true,
      data: formattedProducts,
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
    const product = await Product.findOne(
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
        created_at: 1,
        updated_at: 1
      }
    ).lean();
    
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到对应此外部条码的商品'
      });
    }
    
    const matched_external_code = product.external_codes.find(ec => ec.code === external_code);
    
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit || '件',
      image_path: product.image_path || '',
      has_sku: product.has_sku || false,
      colors: (product.colors && product.colors.length > 0) ? product.colors : buildColorsFromSkus(product.skus || []),
      skus: (product.skus || []).map(sku => ({
        sku_code: sku.sku_code,
        sku_color: sku.sku_color,
        sku_size: sku.sku_size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || ''
      })),
      external_code: matched_external_code,
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
      const formattedProduct = {
        product_id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        unit: product.unit || '件',
        image_path: product.image_path || '',
        has_sku: product.has_sku || false,
        colors: (product.colors && product.colors.length > 0) ? product.colors : buildColorsFromSkus(product.skus || []),
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
      const formattedProduct = {
        product_id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        unit: product.unit || '件',
        image_path: product.image_path || '',
        has_sku: product.has_sku || false,
        colors: (product.colors && product.colors.length > 0) ? product.colors : buildColorsFromSkus(product.skus || []),
        matched_sku: matchedSku ? {
          sku_code: matchedSku.sku_code,
          sku_color: matchedSku.sku_color || (matchedSku.sku_code.split('-')[1] || '默认颜色'),
          sku_size: matchedSku.sku_size || (matchedSku.sku_code.split('-')[2] || '默认尺码'),
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
      product_code: product.product_code || product.code,
      product_name: product.product_name || product.name || product.code,
      unit: product.unit || '件',
      image_path: product.image_path || product.image || '',
      has_sku: product.has_sku || false,
      colors: (product.colors && product.colors.length > 0) ? product.colors : buildColorsFromSkus(product.skus || []),
      description: product.description || '',
      created_at: product.created_at || product.createdAt,
      updated_at: product.updated_at || product.updatedAt
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
      image_path = '',
      has_sku = false,
      skus = [],
      description = '',
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

    // 创建产品对象
    const productData = {
      product_code,
      product_name: product_name || product_code,
      unit,
      image_path,
      has_sku,
      description,
      skus: skus.map(sku => ({
        sku_code: sku.sku_code,
        sku_color: sku.sku_color,
        sku_size: sku.sku_size,
        stock_quantity: 0,
        image_path: sku.image_path || ''
      }))
    };

    const product = await Product.create(productData);

    // 格式化返回的数据
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit,
      image_path: product.image_path,
      has_sku: product.has_sku,
      colors: (product.colors && product.colors.length > 0) ? product.colors : buildColorsFromSkus(product.skus || []),
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
      image_path,
      has_sku,
      skus,
      description,
      deleted_sku_codes,
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

    // 构建更新数据
    const updateData = {
      product_code,
      product_name: product_name || product_code,
      unit,
      description,
      has_sku,
      skus: skus ? skus.map(sku => ({
        sku_code: sku.sku_code,
        sku_color: sku.sku_color,
        sku_size: sku.sku_size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || ''
      })) : []
    };

    if (image_path !== undefined) {
      updateData.image_path = image_path;
    }

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

    // 处理删除SKU时清理其库存
    if (deleted_sku_codes && deleted_sku_codes.length > 0) {
      console.log(`准备清理已删除SKU的库存: ${deleted_sku_codes.join(', ')} for product ${product._id}`);
      const inventoryDoc = await Inventory.findOne({ product_id: product._id });
      if (inventoryDoc) {
        let inventoryModified = false;
        inventoryDoc.locations.forEach(location => {
          const initialSkuCount = location.skus.length;
          location.skus = location.skus.filter(s => !deleted_sku_codes.includes(s.sku_code));
          if (location.skus.length < initialSkuCount) {
            inventoryModified = true;
            location.stock_quantity = location.skus.reduce((sum, sku) => sum + (sku.stock_quantity || 0), 0);
          }
        });

        if (inventoryModified) {
          inventoryDoc.stock_quantity = inventoryDoc.locations.reduce((sum, loc) => sum + (loc.stock_quantity || 0), 0);
          await inventoryDoc.save();
          console.log(`产品 ${product._id} 的已删除SKU库存清理完毕。`);
        }
      }
    }

    // 格式化返回数据
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit,
      image_path: product.image_path,
      has_sku: product.has_sku,
      colors: (product.colors && product.colors.length > 0) ? product.colors : buildColorsFromSkus(product.skus || []),
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