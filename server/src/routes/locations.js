const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

const SPECIAL_NO_LOCATION_CODE = "无货位";

// 获取所有库位
router.get('/', auth, async (req, res) => {
  try {
    const locations = await Location.find().sort({ location_code: 1 });
    const formattedLocations = locations.map(loc => ({
      location_id: loc._id.toString(),
      location_code: loc.location_code || loc.code,
      location_name: loc.location_name || loc.name || loc.code,
      category_code_1: loc.category_code_1 || '',
      category_name_1: loc.category_name_1 || '',
      category_code_2: loc.category_code_2 || '',
      category_name_2: loc.category_name_2 || '',
      description: loc.description || '',
      priority: loc.priority || 0,
      is_defective: !!loc.defective
    }));
    
    res.json({
      success: true,
      data: formattedLocations,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('获取库位失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'FETCH_LOCATIONS_FAILED',
      error_message: '获取库位列表失败'
    });
  }
});

// 新增库位
router.post('/', auth, async (req, res) => {
  try {
    let { 
      location_code, 
      code, 
      location_name, 
      name, 
      description, 
      priority, 
      is_defective,
      category_code_1,
      category_name_1,
      category_code_2,
      category_name_2
    } = req.body;
    location_code = location_code || code;
    location_name = location_name || name || location_code;
    
    if (!location_code || location_code.trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMS',
        error_message: 'location_code 不能为空'
      });
    }

    location_code = location_code.trim().toUpperCase();
    const existingLocation = await Location.findOne({ location_code });
    
    if (existingLocation) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'LOCATION_CODE_EXISTS',
        error_message: 'location_code 已存在'
      });
    }

    const location = await Location.create({
      location_code,
      location_name,
      description: description || '',
      priority: Number(priority) || 0,
      is_defective: !!is_defective,
      category_code_1: category_code_1 || '',
      category_name_1: category_name_1 || '一级分类',
      category_code_2: category_code_2 || '',
      category_name_2: category_name_2 || '二级分类'
    });

    const formattedLocation = {
      location_id: location._id.toString(),
      location_code: location.location_code,
      location_name: location.location_name,
      category_code_1: location.category_code_1 || '',
      category_name_1: location.category_name_1 || '',
      category_code_2: location.category_code_2 || '',
      category_name_2: location.category_name_2 || '',
      description: location.description || '',
      priority: location.priority || 0,
      is_defective: !!location.is_defective,
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      data: formattedLocation,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('创建库位失败:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'DUPLICATE_LOCATION_CODE',
        error_message: 'location_code 已存在 (E11000)'
      });
    }
    res.status(400).json({
      success: false,
      data: null,
      error_code: 'CREATE_LOCATION_FAILED',
      error_message: err.message
    });
  }
});

// 根据ID获取库位
router.get('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'LOCATION_NOT_FOUND',
        error_message: '库位不存在'
      });
    }

    const formattedLocation = {
      location_id: location._id.toString(),
      location_code: location.location_code || location.code,
      location_name: location.location_name || location.name || location.location_code || location.code,
      description: location.description || '',
      priority: location.priority || 0,
      is_defective: !!location.is_defective
    };

    res.json({
      success: true,
      data: formattedLocation,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      error_code: 'FETCH_LOCATION_FAILED',
      error_message: err.message
    });
  }
});

// 更新库位
router.put('/:id', auth, async (req, res) => {
  try {
    let { location_code, code, location_name, name, description, priority, is_defective } = req.body;
    location_code = location_code || code;
    location_name = location_name || name || location_code;

    if (!location_code || location_code.trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'INVALID_PARAMS',
        error_message: 'location_code 不能为空'
      });
    }

    const target_location_id = req.params.id;
    location_code = location_code.trim().toUpperCase();
    
    const targetLocation = await Location.findById(target_location_id);
    if (!targetLocation) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'LOCATION_NOT_FOUND',
        error_message: '要更新的库位不存在'
      });
    }

    if (location_code !== targetLocation.location_code) {
      const existingLocationWithNewCode = await Location.findOne({
        location_code: location_code,
        _id: { $ne: target_location_id }
      });
      
      if (existingLocationWithNewCode) {
        return res.status(400).json({
          success: false,
          data: null,
          error_code: 'LOCATION_CODE_EXISTS',
          error_message: '新的 location_code 已被其他记录使用'
        });
      }
    }

    const old_location_code = targetLocation.location_code;
    const old_location_name = targetLocation.location_name;

    const updatedLocation = await Location.findByIdAndUpdate(
      target_location_id,
      {
        location_code,
        location_name,
        description: description || '',
        priority: Number(priority) || 0,
        is_defective: !!is_defective,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!updatedLocation) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'UPDATE_FAILED',
        error_message: '库位更新失败，未找到记录'
      });
    }

    // 更新 Inventory 中相关字段
    if (updatedLocation.location_code !== old_location_code || updatedLocation.location_name !== old_location_name) {
      try {
        const result = await Inventory.updateMany(
          { "locations.location_id": target_location_id },
          {
            "$set": {
              "locations.$[elem].location_code": updatedLocation.location_code,
              "locations.$[elem].location_name": updatedLocation.location_name
            }
          },
          { arrayFilters: [{ "elem.location_id": new mongoose.Types.ObjectId(target_location_id) }] }
        );
        console.log(`更新了 ${result.modifiedCount} 条库存记录中关于库位 ${target_location_id} 的信息。`);
      } catch (inventoryUpdateError) {
        console.error(`更新库存记录中库位信息失败 (库位ID: ${target_location_id}):`, inventoryUpdateError);
      }
    }

    const formattedLocation = {
      location_id: updatedLocation._id.toString(),
      location_code: updatedLocation.location_code,
      location_name: updatedLocation.location_name,
      description: updatedLocation.description || '',
      priority: updatedLocation.priority || 0,
      is_defective: !!updatedLocation.is_defective,
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: formattedLocation,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      error_code: 'UPDATE_LOCATION_FAILED',
      error_message: err.message
    });
  }
});

// 删除库位
router.delete('/:id', auth, async (req, res) => {
  try {
    const location_id = req.params.id;
    
    const detailedInventoryCheck = await Inventory.findOne({
      locations: {
        $elemMatch: {
          location_id: new mongoose.Types.ObjectId(location_id),
          stock_quantity: { $gt: 0 }
        }
      }
    });

    if (detailedInventoryCheck) {
      return res.status(400).json({
        success: false,
        data: null,
        error_code: 'LOCATION_HAS_INVENTORY',
        error_message: '无法删除：此库位尚有库存。请先清空或转移此库位的库存。'
      });
    }

    const location = await Location.findByIdAndDelete(location_id);
    if (!location) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'LOCATION_NOT_FOUND',
        error_message: '库位不存在'
      });
    }

    res.json({
      success: true,
      data: {
        message: '删除成功',
        location_id: location_id,
        deleted_at: new Date().toISOString()
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('删除库位失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'DELETE_LOCATION_FAILED',
      error_message: err.message
    });
  }
});

// 按编码查找库位
router.get('/code/:location_code', auth, async (req, res) => {
  try {
    const location = await Location.findOne({ 
      code: req.params.location_code.toUpperCase() 
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        data: null,
        error_code: 'LOCATION_NOT_FOUND',
        error_message: '库位不存在'
      });
    }

    const formattedLocation = {
      location_id: location._id.toString(),
      location_code: location.code,
      location_name: location.name || location.code,
      description: location.description || '',
      priority: location.priority || 0,
      is_defective: !!location.is_defective,
      created_at: location.created_at || location.createdAt,
      updated_at: location.updated_at || location.updatedAt
    };

    res.json({
      success: true,
      data: formattedLocation,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    console.error('获取库位详情失败:', err);
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'FETCH_LOCATION_FAILED',
      error_message: '获取库位详情失败'
    });
  }
});

module.exports = router; 