const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const auth = require('../middleware/auth'); // 导入认证中间件

// 获取所有库位
router.get('/', auth, async (req, res) => {
  try {
    const locations = await Location.find();
    // 添加id字段，确保前端兼容性
    const formattedLocations = locations.map(loc => ({
      id: loc._id,
      code: loc.code,
      name: loc.name || loc.code,
      description: loc.description || '',
      priority: loc.priority || 0,
      defective: !!loc.defective,
    }));
    res.json(formattedLocations);
  } catch (err) {
    console.error('获取库位失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 新增库位
router.post('/', auth, async (req, res) => {
  console.log('接收到创建库位请求:', req.body);
  let { code, name, description, priority, defective } = req.body;
  
  // 验证必填字段
  if (!code || code.trim() === '') {
    return res.status(400).json({ message: '库位编码不能为空' });
  }
  
  try {
    // 修剪值
    code = code.trim();
    
    // 检查是否已存在相同编码的库位
    const existingLocation = await Location.findOne({ code });
    if (existingLocation) {
      return res.status(400).json({ message: '库位编码已存在' });
    }
    
    // 如果name为空，使用code作为默认值
    const locationName = name && name.trim() !== '' ? name.trim() : code;
    
    const location = await Location.create({ 
      code, 
      name: locationName,
      description: description || '',
      priority: priority || 0,
      defective: !!defective
    });
    
    console.log('创建库位成功:', location);
    
    // 添加id字段确保前端兼容性
    const formattedLocation = {
      id: location._id,
      code: location.code,
      name: location.name,
      description: location.description || '',
      priority: location.priority || 0,
      defective: !!location.defective,
    };
    
    res.status(201).json(formattedLocation);
  } catch (err) {
    console.error('创建库位失败:', err);
    res.status(400).json({ message: err.message });
  }
});

// 根据ID获取库位
router.get('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    
    // 添加id字段确保前端兼容性
    const formattedLocation = {
      id: location._id,
      code: location.code,
      name: location.name || location.code,
      description: location.description || '',
      priority: location.priority || 0,
      defective: !!location.defective,
    };
    
    res.json(formattedLocation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 更新库位
router.put('/:id', auth, async (req, res) => {
  try {
    const { code, name, description, priority, defective } = req.body;
    
    // 验证必填字段
    if (!code || code.trim() === '') {
      return res.status(400).json({ message: '库位编码不能为空' });
    }
    
    // 检查是否与其他库位编码冲突
    const existingLocation = await Location.findOne({ 
      code: code.trim(), 
      _id: { $ne: req.params.id } 
    });
    
    if (existingLocation) {
      return res.status(400).json({ message: '库位编码已被其他记录使用' });
    }
    
    // 如果name为空，使用code作为默认值
    const locationName = name && name.trim() !== '' ? name.trim() : code.trim();
    
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { 
        code: code.trim(),
        name: locationName,
        description,
        priority: priority || 0,
        defective: !!defective
      },
      { new: true }
    );
    
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    
    // 添加id字段确保前端兼容性
    const formattedLocation = {
      id: location._id,
      code: location.code,
      name: location.name,
      description: location.description || '',
      priority: location.priority || 0,
      defective: !!location.defective,
    };
    
    res.json(formattedLocation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 删除库位
router.delete('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 按编码查找库位
router.get('/code/:code', auth, async (req, res) => {
  try {
    const location = await Location.findOne({ code: req.params.code });
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    
    // 添加id字段确保前端兼容性
    const formattedLocation = {
      id: location._id,
      code: location.code,
      name: location.name || location.code,
      description: location.description || '',
      priority: location.priority || 0,
      defective: !!location.defective,
    };
    
    res.json(formattedLocation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router; 