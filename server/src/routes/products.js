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
      id: p._id,
      code: p.code,
      name: p.name || p.code,
      unit: p.unit || '件',
      image_path: p.image || ''  // 确保前端字段命名一致
    }));
    res.json(formattedProducts);
  } catch (err) {
    console.error('获取商品列表失败:', err);
    res.status(500).json({ error: '获取商品列表失败' });
  }
});

// 根据外部条码查询商品
router.get('/external-code/:code', auth, async (req, res) => {
  try {
    const externalCode = req.params.code;
    // 查找包含此外部条码的商品
    const product = await Product.findOne({ "external_codes.code": externalCode });
    
    if (!product) {
      return res.status(404).json({ message: '未找到对应此外部条码的商品' });
    }
    
    // 返回找到的商品和匹配的外部条码信息
    const matchedExternalCode = product.external_codes.find(ec => ec.code === externalCode);
    
    const formattedProduct = {
      id: product._id,
      code: product.code,
      name: product.name || product.code,
      unit: product.unit || '件',
      image_path: product.image || product.image_path || '',
      has_sku: product.has_sku || false,
      skus: product.skus || [],
      external_code: matchedExternalCode
    };
    
    res.json(formattedProduct);
  } catch (err) {
    console.error('查询外部条码失败:', err);
    res.status(500).json({ message: '查询失败: ' + err.message });
  }
});

// 获取商品所有外部条码
router.get('/:id/external-codes', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '未找到商品' });
    }
    
    res.json(product.external_codes || []);
  } catch (err) {
    console.error('获取外部条码失败:', err);
    res.status(500).json({ message: '获取外部条码失败: ' + err.message });
  }
});

// 为商品添加外部条码
router.post('/:id/external-codes', auth, async (req, res) => {
  try {
    const { code, source, description } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: '外部条码不能为空' });
    }
    
    // 检查是否已存在此外部条码
    const existingProduct = await Product.findOne({ "external_codes.code": code });
    if (existingProduct) {
      return res.status(400).json({ 
        message: '此外部条码已关联到其他商品',
        existingProduct: {
          id: existingProduct._id,
          code: existingProduct.code,
          name: existingProduct.name || existingProduct.code
        }
      });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '未找到商品' });
    }
    
    // 初始化external_codes数组(如果不存在)
    if (!product.external_codes) {
      product.external_codes = [];
    }
    
    // 添加新的外部条码
    product.external_codes.push({
      code,
      source: source || '客户退货',
      description: description || ''
    });
    
    await product.save();
    
    res.status(201).json({
      message: '外部条码添加成功',
      external_codes: product.external_codes
    });
  } catch (err) {
    console.error('添加外部条码失败:', err);
    res.status(500).json({ message: '添加外部条码失败: ' + err.message });
  }
});

// 删除商品的外部条码
router.delete('/:id/external-codes/:code', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '未找到商品' });
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
      return res.status(404).json({ message: '未找到指定的外部条码' });
    }
    
    await product.save();
    
    res.json({
      message: '外部条码删除成功',
      external_codes: product.external_codes
    });
  } catch (err) {
    console.error('删除外部条码失败:', err);
    res.status(500).json({ message: '删除外部条码失败: ' + err.message });
  }
});

// 新增：按商品编码查询 (注意：该路由必须放在/:id前面)
router.get('/code/:code', auth, async (req, res) => {
  try {
    const product = await Product.findOne({ code: req.params.code });
    if (!product) return res.status(404).json({ error: '未找到商品' });
    // 格式化返回字段
    const formattedProduct = {
      id: product._id,
      code: product.code,
      name: product.name || product.code,
      unit: product.unit || '件',
      image_path: product.image || ''
    };
    res.json(formattedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 获取单个商品
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: '未找到商品' });
    // 格式化返回字段
    const formattedProduct = {
      id: product._id,
      code: product.code,
      name: product.name || product.code,
      unit: product.unit || '件',
      image_path: product.image || ''
    };
    res.json(formattedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 新增商品
router.post('/', auth, async (req, res) => {
  let { code, name, unit, image, image_path } = req.body;
  if (!name) name = code;
  // 如果单位为空，设置默认值为"件"
  if (!unit || unit.trim() === '') {
    unit = '件';
  }
  // 统一字段名，前端可能使用image_path
  const imageUrl = image || image_path || '';
  
  try {
    const product = await Product.create({ 
      code, 
      name, 
      unit, 
      image: imageUrl 
    });
    
    // 格式化返回的数据
    const formattedProduct = {
      id: product._id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      image_path: product.image
    };
    
    res.status(201).json(formattedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 修改商品
router.put('/:id', auth, async (req, res) => {
  let { code, name, unit, image, image_path } = req.body;
  if (!name) name = code;
  // 如果单位为空，设置默认值为"件"
  if (!unit || unit.trim() === '') {
    unit = '件';
  }
  // 统一字段名，前端可能使用image_path
  const imageUrl = image || image_path || '';
  
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { code, name, unit, image: imageUrl },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: '未找到商品' });
    
    // 格式化返回的数据
    const formattedProduct = {
      id: product._id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      image_path: product.image
    };
    
    res.json(formattedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 删除商品
router.delete('/:id', auth, async (req, res) => {
  try {
    // 先查找商品
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '未找到商品' });
    }
    
    // 检查商品是否有库存，使用productCode查询
    const inventory = await Inventory.findOne({ productCode: product.code });
    if (inventory && inventory.quantity > 0) {
      return res.status(400).json({ 
        message: '无法删除有库存的商品，请先清空库存', 
        quantity: inventory.quantity 
      });
    }
    
    // 如果没有库存或库存为0，才允许删除
    await Product.findByIdAndDelete(req.params.id);
    
    // 同时删除库存记录（如果存在）
    if (inventory) {
      await Inventory.findByIdAndDelete(inventory._id);
    }
    
    res.json({ success: true, message: '商品删除成功' });
  } catch (err) {
    console.error('删除商品失败:', err);
    res.status(500).json({ message: '删除商品失败: ' + err.message });
  }
});

module.exports = router; 