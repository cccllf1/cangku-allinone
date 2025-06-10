const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const Inventory = require('../models/Inventory'); // 新增引入
const mongoose = require('mongoose');
const auth = require('../middleware/auth'); // 导入认证中间件

// 获取所有库位
router.get('/', auth, async (req, res) => {
  try {
    const locations = await Location.find().sort({ code: 1 }); // 按编码排序
    // 添加id字段，确保前端兼容性
    const formattedLocations = locations.map(loc => ({
      id: loc._id.toString(), // 确保是字符串
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
  
  if (!code || code.trim() === '') {
    return res.status(400).json({ message: '库位编码不能为空' });
  }
  
  try {
    code = code.trim().toUpperCase(); // 编码统一转为大写
    
    const existingLocation = await Location.findOne({ code });
    if (existingLocation) {
      return res.status(400).json({ message: '库位编码已存在' });
    }
    
    const locationName = name && name.trim() !== '' ? name.trim() : code;
    
    const location = await Location.create({ 
      code, 
      name: locationName,
      description: description || '',
      priority: Number(priority) || 0,
      defective: !!defective
    });
    
    console.log('创建库位成功:', location);
    
    const formattedLocation = {
      id: location._id.toString(),
      code: location.code,
      name: location.name,
      description: location.description || '',
      priority: location.priority || 0,
      defective: !!location.defective,
    };
    
    res.status(201).json(formattedLocation);
  } catch (err) {
    console.error('创建库位失败:', err);
    if (err.code === 11000) {
        return res.status(400).json({ message: '库位编码已存在 (E11000)' });
    }
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
    
    const formattedLocation = {
      id: location._id.toString(),
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
    let { code, name, description, priority, defective } = req.body;
    
    if (!code || code.trim() === '') {
      return res.status(400).json({ message: '库位编码不能为空' });
    }

    const targetLocationId = req.params.id;
    code = code.trim().toUpperCase(); // 编码统一转为大写

    // 检查目标货位是否存在
    const targetLocation = await Location.findById(targetLocationId);
    if (!targetLocation) {
        return res.status(404).json({ message: '要更新的库位不存在' });
    }
    
    // 检查新编码是否已被其他库位使用
    if (code !== targetLocation.code) { // 只有当编码改变时才检查冲突
        const existingLocationWithNewCode = await Location.findOne({ 
          code: code, 
          _id: { $ne: targetLocationId } 
        });
        if (existingLocationWithNewCode) {
          return res.status(400).json({ message: '新的库位编码已被其他记录使用' });
        }
    }

    const oldLocationCode = targetLocation.code; // 保存旧的货位编码，以便下面更新Inventory
    const oldLocationName = targetLocation.name;
    
    const locationName = name && name.trim() !== '' ? name.trim() : code;
    
    const updatedLocation = await Location.findByIdAndUpdate(
      targetLocationId,
      { 
        code: code,
        name: locationName,
        description: description || '',
        priority: Number(priority) || 0,
        defective: !!defective
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedLocation) {
      // 理论上前面已经检查过findById，这里应该不会触发，但作为保险
      return res.status(404).json({ message: '库位更新失败，未找到记录' });
    }

    // 如果货位编码或名称发生变化，则更新Inventory中相关的记录
    if (updatedLocation.code !== oldLocationCode || updatedLocation.name !== oldLocationName) {
      console.log(`库位 ${targetLocationId} (${oldLocationCode}) 信息已更改为 ${updatedLocation.code} (${updatedLocation.name})，开始更新库存记录...`);
      try {
        const result = await Inventory.updateMany(
          { "locations.location_id": targetLocationId },
          { 
            "$set": { 
              "locations.$[elem].locationCode": updatedLocation.code,
              "locations.$[elem].locationName": updatedLocation.name
            }
          },
          { arrayFilters: [{ "elem.location_id": new mongoose.Types.ObjectId(targetLocationId) }] }
        );
        console.log(`更新了 ${result.modifiedCount} 条库存记录中关于库位 ${targetLocationId} 的信息。`);
      } catch (inventoryUpdateError) {
        console.error(`更新库存记录中库位信息失败 (库位ID: ${targetLocationId}):`, inventoryUpdateError);
        // 即使这里失败，主库位信息已更新，所以不回滚或抛出主错误，但记录日志
        // 可以考虑更复杂的错误处理或补偿机制
      }
    }
    
    const formattedLocation = {
      id: updatedLocation._id.toString(),
      code: updatedLocation.code,
      name: updatedLocation.name,
      description: updatedLocation.description || '',
      priority: updatedLocation.priority || 0,
      defective: !!updatedLocation.defective,
    };
    
    res.json(formattedLocation);
  } catch (err) {
    console.error('更新库位失败:', err);
    if (err.code === 11000) {
        return res.status(400).json({ message: '库位编码已存在 (E11000)' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 删除库位
router.delete('/:id', auth, async (req, res) => {
  try {
    const locationId = req.params.id;

    // 检查此库位是否在任何Inventory记录中被引用且有库存
    const inventoryWithLocation = await Inventory.findOne({
      'locations.location_id': locationId,
      'locations.quantity': { $gt: 0 }
    });

    // 另一种更精确的检查方式是检查 locations 数组中特定 location_id 下的 skus 是否有 quantity > 0
    // 或者检查 locations 数组中特定 location_id 的 quantity 是否大于 0
    const detailedInventoryCheck = await Inventory.findOne({
        locations: {
            $elemMatch: {
                location_id: new mongoose.Types.ObjectId(locationId),
                quantity: { $gt: 0 }
            }
        }
    });

    if (detailedInventoryCheck) {
      return res.status(400).json({ message: '无法删除：此库位尚有库存。请先清空或转移此库位的库存。' });
    }

    // 如果没有库存关联，则可以安全删除货位
    const location = await Location.findByIdAndDelete(locationId);
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('删除库位失败:', err);
    res.status(500).json({ message: err.message }); // 改为500，因为可能是 ObjectId 格式错误等
  }
});

// 按编码查找库位
router.get('/code/:code', auth, async (req, res) => {
  try {
    const location = await Location.findOne({ code: req.params.code.toUpperCase() }); //查询时也转大写
    if (!location) {
      return res.status(404).json({ message: '库位不存在' });
    }
    
    const formattedLocation = {
      id: location._id.toString(),
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