console.log('skuExternalCodes.js 已加载');
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// 获取指定SKU的所有外部条码
router.get('/:sku_code/external-codes', auth, async (req, res) => {
  try {
    const { sku_code } = req.params;
    const product = await Product.findOne({ "colors.sizes.sku_code": sku_code });
    if (!product) {
      return res.status(404).json({ success: false, error_message: 'SKU not found' });
    }

    let externalCodes = [];
    for (const color of product.colors) {
      const size = color.sizes.find(s => s.sku_code === sku_code);
      if (size && size.external_codes) {
        externalCodes = size.external_codes;
        break;
      }
    }
    
    res.json({ success: true, data: externalCodes });
  } catch (error) {
    res.status(500).json({ success: false, error_message: error.message });
  }
});

// 为SKU添加外部条码
router.post('/:sku_code/external-codes', auth, async (req, res) => {
  try {
    const { sku_code } = req.params;
    const { external_code, operator_id } = req.body;

    if (!external_code || !operator_id) {
        return res.status(400).json({ success: false, error_message: 'external_code 和 operator_id 都是必填项' });
    }

    const product = await Product.findOne({ "colors.sizes.sku_code": sku_code });
    if (!product) {
      return res.status(404).json({ success: false, error_message: 'SKU not found' });
    }

    let updated = false;
    for (const color of product.colors) {
      const size = color.sizes.find(s => s.sku_code === sku_code);
      if (size) {
        if (!size.external_codes) {
          size.external_codes = [];
        }
        // 检查条码是否已存在
        if (!size.external_codes.some(ec => ec.external_code === external_code)) {
          size.external_codes.push({ external_code });
          updated = true;
        }
        break;
      }
    }

    if (updated) {
      await product.save();
      res.status(201).json({ success: true, message: 'External code added successfully.' });
    } else {
      res.status(200).json({ success: true, message: 'External code already exists.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error_message: error.message });
  }
});

// 删除SKU的外部条码
router.delete('/:sku_code/external-codes/:external_code', auth, async (req, res) => {
  try {
    const { sku_code, external_code } = req.params;
    const { operator_id } = req.body;

     if (!operator_id) {
        return res.status(400).json({ success: false, error_message: 'operator_id 是必填项' });
    }
    
    const product = await Product.findOne({ "colors.sizes.sku_code": sku_code });
    if (!product) {
      return res.status(404).json({ success: false, error_message: 'SKU not found' });
    }

    let updated = false;
    for (const color of product.colors) {
      const size = color.sizes.find(s => s.sku_code === sku_code);
      if (size && size.external_codes) {
        const initialLength = size.external_codes.length;
        size.external_codes = size.external_codes.filter(ec => ec.external_code !== external_code);
        if (size.external_codes.length < initialLength) {
          updated = true;
        }
        break;
      }
    }

    if (updated) {
      await product.save();
      res.status(200).json({ success: true, message: 'External code deleted successfully.' });
    } else {
      res.status(404).json({ success: false, error_message: 'External code not found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error_message: error.message });
  }
});

// 通过外部条码查找SKU
router.get('/external/:external_code', async (req, res) => {
  const external_code = req.params.external_code;
  try {
    const product = await Product.findOne({ 'skus.external_codes.external_code': external_code });
    if (!product) return res.status(404).json({
      success: false,
      data: null,
      error_code: 'SKU_NOT_FOUND',
      error_message: '未找到SKU'
    });
    const sku = product.skus.find(sku =>
      sku.external_codes && sku.external_codes.some(ec => ec.external_code === external_code)
    );
    if (!sku) return res.status(404).json({
      success: false,
      data: null,
      error_code: 'SKU_NOT_FOUND',
      error_message: '未找到SKU'
    });
    res.json({
      success: true,
      data: {
        product_code: product.product_code || product.code,
        product_name: product.product_name || product.name,
        sku_code: sku.sku_code || sku.code,
        sku_color: sku.color,
        sku_size: sku.size,
        product_id: product._id,
        sku
      },
      error_code: null,
      error_message: null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error_code: 'QUERY_FAILED',
      error_message: err.message
    });
  }
});

module.exports = router;