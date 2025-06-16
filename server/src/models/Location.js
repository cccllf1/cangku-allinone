const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  location_code: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    minlength: 1,
    uppercase: true
  },
  location_name: { 
    type: String,
    required: true
  },
  description: { 
    type: String,
    default: ''
  },
  priority: { 
    type: Number, 
    default: 0 
  },
  is_defective: { 
    type: Boolean, 
    default: false 
  },
  category_code_1: { 
    type: String,
    default: ''
  },
  category_code_2: { 
    type: String,
    default: ''
  },
  category_name_1: { 
    type: String, 
    default: '一级分类' 
  },
  category_name_2: { 
    type: String, 
    default: '二级分类' 
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: { 
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  } 
});

module.exports = mongoose.model('Location', locationSchema); 