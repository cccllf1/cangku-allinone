import api from './auth';

// 获取库存列表
export const getInventoryList = async () => {
  try {
    const response = await api.get('/inventory/');
    return response.data;
  } catch (error) {
    console.error('获取库存列表失败:', error);
    throw error;
  }
};

// 调整库存
export const adjustStock = async (data) => {
  try {
    const response = await api.post('/inventory/adjust', {
      product_code: data.product_code,
      location_code: data.location_code,
      sku_code: data.sku_code,
      stock_quantity: data.stock_quantity,
      batch_number: data.batch_number,
      notes: data.notes
    });
    return response.data;
  } catch (error) {
    console.error('库存调整失败:', error);
    throw error;
  }
};

// 获取指定商品的库存
export const getProductInventory = async (product_code) => {
  try {
    const response = await api.get(`/inventory/product/${product_code}`);
    return response.data;
  } catch (error) {
    console.error('获取商品库存失败:', error);
    throw error;
  }
};

// 批量调整库存
export const batchAdjustStock = async (adjustments) => {
  try {
    const response = await api.post('/inventory/batch-adjust', {
      adjustments: adjustments.map(item => ({
        product_code: item.product_code,
        location_code: item.location_code,
        sku_code: item.sku_code,
        stock_quantity: item.stock_quantity,
        batch_number: item.batch_number,
        notes: item.notes
      }))
    });
    return response.data;
  } catch (error) {
    console.error('批量库存调整失败:', error);
    throw error;
  }
};

// 获取指定库位的库存
export const getLocationInventory = async (location_code) => {
  try {
    const response = await api.get(`/inventory/location/${location_code}`);
    return response.data;
  } catch (error) {
    console.error('获取库位库存失败:', error);
    throw error;
  }
}; 