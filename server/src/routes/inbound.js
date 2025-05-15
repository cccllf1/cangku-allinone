const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

// 入库接口
router.post('/', async (req, res) => {
  const { productCode, productName, unit, quantity, image } = req.body;
  if (!productCode || !quantity) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  let inv = await Inventory.findOne({ productCode });
  if (inv) {
    inv.total += Number(quantity);
    await inv.save();
  } else {
    inv = await Inventory.create({ productCode, productName, unit, total: quantity, image });
  }
  res.json(inv);
});

module.exports = router; 