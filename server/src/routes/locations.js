const express = require('express');
const router = express.Router();
const Location = require('../models/Location');

// 获取所有库位
router.get('/', async (req, res) => {
  const locations = await Location.find();
  res.json(locations);
});

// 新增库位
router.post('/', async (req, res) => {
  const { code, name } = req.body;
  try {
    const location = await Location.create({ code, name });
    res.status(201).json(location);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; 