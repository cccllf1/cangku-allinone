console.log('skuExternalCodes.js 已加载');
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
// const auth = require('../middleware/auth');

// 获取SKU的所有外部条码
router.get('/:sku_code/external-codes', async (req, res) => {
  console.log('命中 SKU 外部码路由:', req.params.sku_code);
  try {
    const sku_code = req.params.sku_code;
    const product = await Product.findOne({ 'skus.sku_code': sku_code });
    if (!product) return res.status(404).json({
      success: false,
      data: null,
      error_code: 'SKU_NOT_FOUND',
      error_message: '未找到SKU'
    });
    const sku = product.skus.find(s => s.sku_code === sku_code);
    res.json({
      success: true,
      data: sku.external_codes || [],
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'FETCH_EXTERNAL_CODES_FAILED',
      error_message: err.message
    });
  }
});

// 为SKU添加外部条码
router.post('/:sku_code/external-codes', async (req, res) => {
  try {
    const sku_code = req.params.sku_code;
    const { external_code } = req.body;
    if (!external_code) return res.status(400).json({
      success: false,
      data: null,
      error_code: 'MISSING_EXTERNAL_CODE',
      error_message: 'external_code 不能为空'
    });
    const product = await Product.findOne({ 'skus.sku_code': sku_code });
    if (!product) return res.status(404).json({
      success: false,
      data: null,
      error_code: 'SKU_NOT_FOUND',
      error_message: '未找到SKU'
    });
    const sku = product.skus.find(s => s.sku_code === sku_code);
    if (!sku.external_codes) sku.external_codes = [];
    if (sku.external_codes.some(ec => ec.external_code === external_code)) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'DUPLICATE_EXTERNAL_CODE',
        error_message: '该 external_code 已存在'
      });
    }
    sku.external_codes.push({ external_code });
    await product.save();
    res.json({
      success: true,
      data: {
        message: '添加成功',
        external_codes: sku.external_codes
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'ADD_EXTERNAL_CODE_FAILED',
      error_message: err.message
    });
  }
});

// 删除SKU的外部条码
router.delete('/:sku_code/external-codes/:external_code', async (req, res) => {
  try {
    const sku_code = req.params.sku_code;
    const external_code = req.params.external_code;
    const product = await Product.findOne({ 'skus.sku_code': sku_code });
    if (!product) return res.status(404).json({ message: '未找到SKU' });
    const sku = product.skus.find(s => s.sku_code === sku_code);
    if (!sku.external_codes) sku.external_codes = [];
    const before = sku.external_codes.length;
    sku.external_codes = sku.external_codes.filter(ec => ec.external_code !== external_code);
    if (before === sku.external_codes.length) {
      return res.status(404).json({ message: '未找到该 external_code' });
    }
    await product.save();
    res.json({ message: '删除成功', external_codes: sku.external_codes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 通过外部条码查找SKU
router.get('/external/:external_code', async (req, res) => {
  const external_code = req.params.external_code;
  try {
    const product = await Product.findOne({ 'skus.external_codes.external_code': external_code });
    if (!product) return res.status(404).json({
      success: false,
      data: null,
      error_code: 'SKU_NOT_FOUND',
      error_message: '未找到SKU'
    });
    const sku = product.skus.find(sku =>
      sku.external_codes && sku.external_codes.some(ec => ec.external_code === external_code)
    );
    if (!sku) return res.status(404).json({
      success: false,
      data: null,
      error_code: 'SKU_NOT_FOUND',
      error_message: '未找到SKU'
    });
    res.json({
      success: true,
      data: {
        product_code: product.product_code || product.code,
        product_name: product.product_name || product.name,
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.color,
        sku_size: sku.size,
        product_id: product._id,
        sku
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

module.exports = router;