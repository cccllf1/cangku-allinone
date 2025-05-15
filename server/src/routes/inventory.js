const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

// 获取所有库存，包含分库位明细
router.get('/', async (req, res) => {
  const inventory = await Inventory.find();
  // 保证 locations 字段存在且为数组
  const result = inventory.map(item => ({
    ...item.toObject(),
    locations: Array.isArray(item.locations) ? item.locations : []
  }));
  res.json(result);
});

module.exports = router; 