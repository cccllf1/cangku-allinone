/*
 * Simple i18n utility: map error_code -> localized message
 */

const dictionaries = {
  'zh-CN': {
    INTERNAL_ERROR: '服务器内部错误',
    API_DEPRECATED: '接口已废弃',
    PRODUCT_NOT_FOUND: '商品不存在',
    LOCATION_NOT_FOUND: '库位不存在',
    INSUFFICIENT_STOCK: '库存不足'
  },
  'en-US': {
    INTERNAL_ERROR: 'Internal server error',
    API_DEPRECATED: 'API deprecated',
    PRODUCT_NOT_FOUND: 'Product not found',
    LOCATION_NOT_FOUND: 'Location not found',
    INSUFFICIENT_STOCK: 'Insufficient stock'
  }
};

function getMessage(code = '', lang = 'zh-CN') {
  const dict = dictionaries[lang] || dictionaries['zh-CN'];
  return dict[code] || code; // fallback to code itself
}

module.exports = { getMessage }; 