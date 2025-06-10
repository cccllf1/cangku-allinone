console.log('skuExternalCodes.js 已加载');
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
// const auth = require('../middleware/auth');

// 获取SKU的所有外部条码
router.get('/:skuCode/external-codes', async (req, res) => {
  console.log('命中 SKU 外部码路由:', req.params.skuCode);
  try {
    const skuCode = req.params.skuCode;
    const product = await Product.findOne({ 'skus.code': skuCode });
    if (!product) return res.status(404).json({ message: '未找到SKU' });
    const sku = product.skus.find(s => s.code === skuCode);
    res.json(sku.external_codes || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 为SKU添加外部条码
router.post('/:skuCode/external-codes', async (req, res) => {
  try {
    const skuCode = req.params.skuCode;
    const { external_code } = req.body;
    if (!external_code) return res.status(400).json({ message: '外部条码不能为空' });
    const product = await Product.findOne({ 'skus.code': skuCode });
    if (!product) return res.status(404).json({ message: '未找到SKU' });
    const sku = product.skus.find(s => s.code === skuCode);
    if (!sku.external_codes) sku.external_codes = [];
    if (sku.external_codes.some(ec => ec.external_code === external_code)) {
      return res.status(400).json({ message: '该外部条码已存在' });
    }
    sku.external_codes.push({ external_code });
    await product.save();
    res.json({ message: '添加成功', external_codes: sku.external_codes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除SKU的外部条码
router.delete('/:skuCode/external-codes/:externalCode', async (req, res) => {
  try {
    const skuCode = req.params.skuCode;
    const externalCode = req.params.externalCode;
    const product = await Product.findOne({ 'skus.code': skuCode });
    if (!product) return res.status(404).json({ message: '未找到SKU' });
    const sku = product.skus.find(s => s.code === skuCode);
    if (!sku.external_codes) sku.external_codes = [];
    const before = sku.external_codes.length;
    sku.external_codes = sku.external_codes.filter(ec => ec.external_code !== externalCode);
    if (before === sku.external_codes.length) {
      return res.status(404).json({ message: '未找到该外部条码' });
    }
    await product.save();
    res.json({ message: '删除成功', external_codes: sku.external_codes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 通过外部条码查找SKU
router.get('/external/:externalCode', async (req, res) => {
  const externalCode = req.params.externalCode;
  const product = await Product.findOne({ 'skus.external_codes.external_code': externalCode });
  if (!product) return res.status(404).json({ message: '未找到SKU' });
  const sku = product.skus.find(sku =>
    sku.external_codes && sku.external_codes.some(ec => ec.external_code === externalCode)
  );
  if (!sku) return res.status(404).json({ message: '未找到SKU' });
  res.json({
    productCode: product.code,
    productName: product.name,
    skuCode: sku.code,
    color: sku.color,
    size: sku.size,
    product_id: product._id,
    sku
  });
});

module.exports = router;