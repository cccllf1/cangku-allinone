const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Inventory = require('../models/Inventory'); // 导入库存模型
const auth = require('../middleware/auth'); // 导入认证中间件

// 获取所有商品
router.get('/', auth, async (req, res) => {
  try {
    const products = await Product.find();
    // 保证返回的字段格式一致
    const formattedProducts = products.map(p => ({
      product_id: p._id,
      product_code: p.product_code || p.code,
      product_name: p.product_name || p.name,
      unit: p.unit || '件',
      image_path: p.image_path || p.image || '',
      has_sku: p.has_sku || false,
      skus: (p.skus || []).map(sku => ({
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.sku_color || sku.color,
        sku_size: sku.sku_size || sku.size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || sku.image || ''
      }))
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
    // 查找包含此外部条码的商品
    const product = await Product.findOne({ "external_codes.code": external_code });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到对应此外部条码的商品'
      });
    }
    
    // 返回找到的商品和匹配的外部条码信息
    const matched_external_code = product.external_codes.find(ec => ec.code === external_code);
    
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code || product.code,
      product_name: product.product_name || product.name,
      unit: product.unit || '件',
      image_path: product.image_path || product.image || '',
      has_sku: product.has_sku || false,
      skus: (product.skus || []).map(sku => ({
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.sku_color || sku.color,
        sku_size: sku.sku_size || sku.size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || sku.image || ''
      })),
      external_code: matched_external_code
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

// 新增：按商品编码查询 (注意：该路由必须放在/:id前面)
router.get('/code/:code', auth, async (req, res) => {
  try {
    const code = req.params.code;
    // 1. 先查主码
    let product = await Product.findOne({ 
      $or: [
        { product_code: code },
        { code: code }  // 兼容旧数据
      ]
    });
    
    if (product) {
      // 格式化返回字段
      const formattedProduct = {
        product_id: product._id,
        product_code: product.product_code || product.code,
        product_name: product.product_name || product.name,
        unit: product.unit || '件',
        image_path: product.image_path || product.image || '',
        has_sku: product.has_sku || false,
        skus: (product.skus || []).map(sku => ({
          sku_code: sku.sku_code || sku.code,
          sku_color: sku.color,
          sku_size: sku.size,
          stock_quantity: sku.stock_quantity || 0,
          image_path: sku.image_path || sku.image || ''
        })),
        description: product.description || ''
      };
      
      return res.json({
        success: true,
        data: formattedProduct,
        error_code: null,
        error_message: null
      });
    }
    
    // 2. 查 SKU
    product = await Product.findOne({ 'skus.sku_code': code });
    if (product) {
      const matchedSku = product.skus.find(sku => sku.sku_code === code);
      const formattedProduct = {
        product_id: product._id,
        product_code: product.product_code || product.code,
        product_name: product.product_name || product.name,
        unit: product.unit || '件',
        image_path: product.image_path || product.image || '',
        has_sku: product.has_sku || false,
        skus: matchedSku ? [{
          sku_code: matchedSku.sku_code || matchedSku.code,
          sku_color: matchedSku.color,
          sku_size: matchedSku.size,
          stock_quantity: matchedSku.stock_quantity || 0,
          image_path: matchedSku.image_path || matchedSku.image || ''
        }] : [],
        matched_sku: matchedSku ? {
          sku_code: matchedSku.sku_code || matchedSku.code,
          sku_color: matchedSku.color,
          sku_size: matchedSku.size,
          stock_quantity: matchedSku.stock_quantity || 0,
          image_path: matchedSku.image_path || matchedSku.image || ''
        } : null,
        description: product.description || ''
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
      skus: (product.skus || []).map(sku => ({
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.color,
        sku_size: sku.size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || sku.image || ''
      })),
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
  let { code, name, unit, image, image_path, has_sku, skus, description, product_code, product_name, category } = req.body;
  // 兼容前端字段名
  code = code || product_code;
  name = name || product_name;
  if (!name) name = code;
  // 如果单位为空，设置默认值为"件"
  if (!unit || unit.trim() === '') {
    unit = '件';
  }
  // 统一字段名，前端可能使用image_path
  const imageUrl = image || image_path || '';
  
  try {
    // 创建产品对象，包含基本信息
    const productData = {
      product_code: code, 
      product_name: name, 
      unit, 
      image_path: imageUrl,
      description
    };
    
    // 如果有SKU相关字段，添加到产品对象中
    if (has_sku !== undefined) {
      productData.has_sku = has_sku;
    }
    
    if (skus) {
      // 确保SKU字段名符合规范，兼容前端字段名
      productData.skus = skus.map(sku => ({
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.sku_color || sku.color,
        sku_size: sku.sku_size || sku.size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || '' // 只用image_path，不兜底主图
      }));
    }
    
    const product = await Product.create(productData);
    
    // 格式化返回的数据
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code || product.code,
      product_name: product.product_name || product.name || product.code,
      unit: product.unit,
      image_path: product.image_path || '',
      has_sku: product.has_sku,
      skus: (product.skus || []).map(sku => ({
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.sku_color || sku.color,
        sku_size: sku.sku_size || sku.size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || ''
      })),
      description: product.description || ''
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
  let { code, name, unit, image, image_path, has_sku, skus, description, deleted_sku_codes, product_code, product_name } = req.body;
  // 兼容前端字段名
  code = code || product_code;
  name = name || product_name;
  const imageUrl = image || image_path;
  if (!name && code) name = code; // 如果名称为空，但编码存在，则用编码填充名称
  if (!unit) unit = '件'; // 默认单位

  const updateData = {
    product_code: code,
    product_name: name,
    unit,
    description,
    has_sku,
    skus: skus ? skus.map(sku => ({
      sku_code: sku.sku_code || sku.code,
      sku_color: sku.sku_color || sku.color,
      sku_size: sku.sku_size || sku.size,
      stock_quantity: sku.stock_quantity || 0,
      image_path: sku.image_path || '' // 只用image_path，不兜底主图
    })) : [], // 确保skus是一个数组，并且字段名符合规范
  };
  if (imageUrl !== undefined) { // 只有当传入了image或image_path时才更新它
    updateData.image_path = imageUrl;
  }

  try {
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'PRODUCT_NOT_FOUND',
        error_message: '未找到商品'
      });
    }

    // 处理删除SKU时清理其库存的逻辑
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
            // 重新计算库位数量
            location.stock_quantity = location.skus.reduce((sum, sku) => sum + (sku.stock_quantity || 0), 0);
          }
        });

        if (inventoryModified) {
          // 重新计算产品总库存
          inventoryDoc.stock_quantity = inventoryDoc.locations.reduce((sum, loc) => sum + (loc.stock_quantity || 0), 0);
          await inventoryDoc.save();
          console.log(`产品 ${product._id} 的已删除SKU库存清理完毕。`);
        }
      } else {
        console.log(`产品 ${product._id} 没有找到对应的库存记录，无需清理已删除SKU。`);
      }
    }
    
    const formattedProduct = {
      product_id: product._id,
      product_code: product.product_code || product.code,
      product_name: product.product_name || product.name || product.code,
      unit: product.unit,
      image_path: product.image_path || '',
      has_sku: product.has_sku,
      skus: (product.skus || []).map(sku => ({
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.sku_color || sku.color,
        sku_size: sku.sku_size || sku.size,
        stock_quantity: sku.stock_quantity || 0,
        image_path: sku.image_path || ''
      })),
      description: product.description || ''
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
    const productId = req.params.id;
    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      return res.status(404).json({ error: '未找到要删除的商品' });
    }

    // 删除商品后，一并删除其所有库存记录
    const inventoryDeletionResult = await Inventory.deleteMany({ product_id: productId });
    console.log(`已删除产品 ${product.product_code} (ID: ${productId}) 的 ${inventoryDeletionResult.deletedCount} 条库存记录。`);

    res.json({ message: '商品及其关联库存已成功删除' });
  } catch (err) {
    console.error('删除商品失败:', err);
    res.status(500).json({ error: '删除商品失败: ' + err.message }); // 500 for server-side issues
  }
});

module.exports = router; 