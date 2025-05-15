const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

// 出库接口
router.post('/', async (req, res) => {
  const { productCode, quantity } = req.body;
  if (!productCode || !quantity) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  let inv = await Inventory.findOne({ productCode });
  if (!inv) {
    return res.status(404).json({ error: '未找到该商品库存' });
  }
  if (inv.total < quantity) {
    return res.status(400).json({ error: '库存不足' });
  }
  inv.total -= Number(quantity);
  await inv.save();
  res.json(inv);
});

module.exports = router; 