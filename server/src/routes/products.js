const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// 获取所有商品
router.get('/', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// 新增商品
router.post('/', async (req, res) => {
  let { code, name, unit, image } = req.body;
  if (!name) name = code;
  try {
    const product = await Product.create({ code, name, unit, image });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 修改商品
router.put('/:id', async (req, res) => {
  let { code, name, unit, image } = req.body;
  if (!name) name = code;
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { code, name, unit, image },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: '未找到商品' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 删除商品
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: '未找到商品' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 获取单个商品
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: '未找到商品' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 新增：按商品编码查询
router.get('/code/:code', async (req, res) => {
  try {
    const product = await Product.findOne({ code: req.params.code });
    if (!product) return res.status(404).json({ error: '未找到商品' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; 