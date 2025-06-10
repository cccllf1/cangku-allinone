import React, { useState, useEffect, useMemo } from 'react';
import { 
  Input, Button, List, Card, Select, Badge, Tag, Space, 
  Modal, InputNumber, message, Empty, Spin, Form, Checkbox, Drawer
} from 'antd';
import { Popup, Picker } from 'antd-mobile';
import { 
  SearchOutlined, SwapOutlined, 
  SaveOutlined, WarningOutlined, CheckCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, FilterOutlined, ArrowUpOutlined, ArrowDownOutlined, CloseOutlined, SettingOutlined, RightOutlined, LoadingOutlined
} from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';
import theme, { getStyle } from '../styles/theme';
import { getFullImageUrl } from '../utils/imageUtils';
import { Popup as MobilePopup, Picker as MobilePicker } from 'antd-mobile';
import './MobileLocationInventory.css';

const { Option } = Select;

// 自动修正：确保所有 split 用法前面都是字符串，防止 Re.split 错误
function safeSplit(str, sep) {
  if (typeof str === 'string') return str.split(sep);
  return [];
}

const sortFields = [
  { value: 'code', label: '货位编码' },
  { value: 'totalQuantity', label: '合计件数' },
  { value: 'skuCount', label: 'SKU数' },
  { value: 'productCount', label: '商品种数' },
];

const orderOptions = [
  { value: 'asc', label: '升序' },
  { value: 'desc', label: '降序' },
];

const filterOptions = [
  { value: 'all', label: '全部货位' },
  { value: 'hasStock', label: '只显示有货' },
  { value: 'noStock', label: '只显示无货' },
];

function getUnique(arr, keyOrFn) {
  const getVal = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  return Array.from(new Set(arr.map(getVal).filter(Boolean)));
}

// 筛选字段定义
const FIELD_WHITELIST = [
  { key: 'productCode', label: '商品编号', getValue: item => item.productCode || item.code || '' },
  { key: 'color', label: '颜色', getValue: item => item.color || item.sku_color || '' },
  { key: 'sku_size', label: '尺码', getValue: item => item.sku_size || item.size || '' },
  { key: 'quantity', label: '货位SKU数量', getValue: item => item.quantity },
  { key: 'locationCode', label: '货位', getValue: item => item.locationCode || item.code || '' },
  { key: 'quantityRange', label: '货位合计区间', getValue: item => item.quantityRange }
];

const MobileLocationInventory = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetail, setLocationDetail] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState(0);
  const [transferVisible, setTransferVisible] = useState(false);
  const [targetLocation, setTargetLocation] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [locationOptions, setLocationOptions] = useState([]);
  const [addProductVisible, setAddProductVisible] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [availableSkus, setAvailableSkus] = useState([]);
  const [selectedSku, setSelectedSku] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [inoutVisible, setInoutVisible] = useState(false);
  const [inoutType, setInoutType] = useState('in'); // 'in' or 'out'
  const [inoutQuantity, setInoutQuantity] = useState(1);
  const [inoutItem, setInoutItem] = useState(null);
  const [expandedSkuKey, setExpandedSkuKey] = useState(null);
  const [sortType, setSortType] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterType, setFilterType] = useState('all');
  const [productCodeFilter, setProductCodeFilter] = useState([]);
  const [colorFilter, setColorFilter] = useState([]);
  const [sizeFilter, setSizeFilter] = useState([]);
  const [quantityFilter, setQuantityFilter] = useState([]);
  const [quantityMin, setQuantityMin] = useState();
  const [quantityMax, setQuantityMax] = useState();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [tempFilter, setTempFilter] = useState([]);
  const [codeFilter, setCodeFilter] = useState([]);
  const [stockStatus, setStockStatus] = useState(null);
  const [stockStatusPickerVisible, setStockStatusPickerVisible] = useState(false);
  const [minValue, setMinValue] = useState(null);
  const [maxValue, setMaxValue] = useState(null);
  const minOptions = Array.from({length: 101}, (_, i) => ({ label: i + '', value: i }));
  const maxOptions = Array.from({length: 101}, (_, i) => ({ label: i + '', value: i }));
  const pickerColumns = [minOptions, maxOptions];
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState(new Set());
  const [quantityOptions, setQuantityOptions] = useState([]);
  const [productCode, setProductCode] = useState('未指定');
  const [color, setColor] = useState('未指定');
  const [size, setSize] = useState('未指定');
  const [quantity, setQuantity] = useState('未指定');
  const [locationCode, setLocationCode] = useState('未指定');
  const [locationStatus, setLocationStatus] = useState('未指定');
  const [quantityRange, setQuantityRange] = useState('未指定');
  const [filterOptionVisible, setFilterOptionVisible] = useState(false);
  const [currentFilterField, setCurrentFilterField] = useState('');
  const [currentFilterOptions, setCurrentFilterOptions] = useState([]);
  const [currentSortField, setCurrentSortField] = useState(null);
  const [currentSortOrder, setCurrentSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [sortedItems, setSortedItems] = useState([]);

  const navigate = useNavigate();

  // useMemo放在组件顶层，不能放在fetchLocations等函数内部
  const allInventoryItems = useMemo(() => locations.flatMap(loc => loc.inventoryItems || []), [locations]);
  const allProductCodes = useMemo(() => getUnique(
    allInventoryItems,
    item => {
      // 只提取基础商品编号，不包含颜色和尺码
      if (item.sku_code) {
        const baseCode = safeSplit(item.sku_code, '-')[0];
        return baseCode || '';
      }
      return '';
    }
  ), [allInventoryItems]);
  const allColors = useMemo(() => getUnique(
    allInventoryItems,
    item => item.color || item.sku_color || ''
  ), [allInventoryItems]);
  const allSizes = useMemo(() => getUnique(
    allInventoryItems,
    item => item.sku_size || item.size || ''
  ), [allInventoryItems]);
  const allQuantities = useMemo(() => getUnique(allInventoryItems, 'quantity'), [allInventoryItems]);

  const filterFields = [
    { key: 'productCode', label: '商品编号', options: allProductCodes },
    { key: 'color', label: '颜色', options: allColors },
    { key: 'sku_size', label: '尺码', options: allSizes },
    { key: 'quantity', label: '数量', options: allQuantities },
    { key: 'code', label: '货位', options: locations.map(l => l.code) },
  ];

  // 在组件内定义映射对象
  const filterStateMap = {
    productCode: productCodeFilter,
    color: colorFilter,
    sku_size: sizeFilter,
    quantity: quantityFilter,
    code: codeFilter || [], // 如果没有codeFilter可用空数组兜底
  };
  const setFilterStateMap = {
    productCode: setProductCodeFilter,
    color: setColorFilter,
    sku_size: setSizeFilter,
    quantity: setQuantityFilter,
    code: setCodeFilter || (()=>{}), // 如果没有codeFilter可用空函数兜底
  };

  // 自动提取所有字段名
  const allFieldNames = useMemo(() => {
    const items = locations.flatMap(loc => loc.inventoryItems || []);
    const fieldSet = new Set();
    items.forEach(item => Object.keys(item).forEach(key => fieldSet.add(key)));
    return Array.from(fieldSet);
  }, [locations]);

  // 自动提取所有字段的可选值
  const allFieldOptions = useMemo(() => {
    const options = {
      productCode: new Set(),
      color: new Set(),
      sku_size: new Set(),
      quantity: new Set(),
      locationCode: new Set()
    };
    
    // 遍历所有库位和库存项
    locations.forEach(loc => {
      // 货位选项
      if (loc.code) options.locationCode.add(loc.code);

      // 遍历库存项
      if (loc.inventoryItems) {
        loc.inventoryItems.forEach(item => {
          // 商品编号选项 - 只从SKU code中提取基础商品编号，不包含颜色和尺码
          if (item.sku_code) {
            const baseCode = safeSplit(item.sku_code, '-')[0];
            if (baseCode) options.productCode.add(baseCode);
          }
          // 注意：不再添加完整的SKU编码作为商品编号
          // if (item.productCode) options.productCode.add(item.productCode);
          // if (item.code) options.productCode.add(item.code);

          // 颜色选项
          if (item.color) options.color.add(item.color);
          if (item.sku_color) options.color.add(item.sku_color);
          // 从SKU编码中提取颜色
          if (item.sku_code) {
            const parts = safeSplit(item.sku_code, '-');
            if (parts.length > 1) options.color.add(parts[1]);
          }

          // 尺码选项
          if (item.sku_size) options.sku_size.add(item.sku_size);
          if (item.size) options.sku_size.add(item.size);

          // 数量选项
          if (item.quantity) options.quantity.add(item.quantity);
        });
      }
    });

    // 转换Set为数组并排序
    const result = {};
    Object.keys(options).forEach(key => {
      result[key] = Array.from(options[key])
        .filter(Boolean)
        .sort((a, b) => {
          if (key === 'quantity') {
            return Number(a) - Number(b);
          }
          return String(a).localeCompare(String(b));
        });
    });

    return result;
  }, [locations]);

  // 筛选状态
  const [fieldFilters, setFieldFilters] = useState({
    productCode: [],
    color: [],
    sku_size: [],
    quantity: [],
    locationCode: []
  });

  // 页面加载时获取所有库位
  useEffect(() => {
    fetchLocations();
  }, []);

  // 获取所有库位信息
  const fetchLocations = async () => {
    try {
      setLoading(true);
      // 只获取库存数据，从中提取库位信息
      const inventoryRes = await api.get('/inventory/');
      const inventory = inventoryRes.data || [];
      
      // 从库存数据中提取库位列表
      const locationsList = [];
      const locationSet = new Set();
      
      inventory.forEach(item => {
        if (item.locations && Array.isArray(item.locations)) {
          item.locations.forEach(loc => {
            if (loc.locationCode && !locationSet.has(loc.locationCode)) {
              locationSet.add(loc.locationCode);
              locationsList.push({
                code: loc.locationCode,
                name: loc.locationName || loc.locationCode,
                _id: loc.location_id
              });
            }
          });
        }
      });
      
      // 暂时跳过商品详情获取，直接使用库存数据中的信息
      const productMap = {};
      
      // 获取商品详情以获取图片信息
      const productIds = new Set();
      inventory.forEach(item => {
        if (item.product_id) {
          productIds.add(item.product_id);
        }
      });
      
      let products = [];
      if (productIds.size > 0) {
        try {
          const productPromises = Array.from(productIds).map(id => api.get(`/products/${id}`));
          const productResults = await Promise.all(productPromises);
          products = productResults.map(result => result.data);
          
          // 建立商品映射
          products.forEach(product => {
            productMap[product._id || product.id] = product;
          });
        } catch (error) {
          console.error('获取商品详情失败:', error);
        }
      }

      // 处理每个库位的数据
      const locationData = {};
      const quantities = new Set(); // 存储所有不同的数量值
      
      inventory.forEach(item => {
        if (item.locations && Array.isArray(item.locations)) {
          item.locations.forEach(loc => {
            if (!loc.locationCode) return;
            
            if (!locationData[loc.locationCode]) {
              locationData[loc.locationCode] = {
                skus: new Set(),
                products: new Set(),
                totalQuantity: 0,
                items: []
              };
            }

            const locInfo = locationData[loc.locationCode];
            
            // 处理SKU
            if (loc.skus && Array.isArray(loc.skus)) {
              loc.skus.forEach(sku => {
                if (sku.quantity > 0) {
                  locInfo.skus.add(sku.code);
                  quantities.add(sku.quantity); // 添加到数量集合
                  
                  // 获取真实的图片
                  let imagePath = null;
                  const product = productMap[item.product_id];
                  if (product && product.skus && product.skus.length > 0) {
                    const skuInfo = product.skus.find(s => s.code === sku.code);
                    imagePath = skuInfo?.image_path || skuInfo?.image || product.image_path || product.image;
                  }
                  
                  locInfo.items.push({
                    code: sku.code,
                    quantity: sku.quantity,
                    image: imagePath,
                    skuImage: imagePath,
                    image_path: imagePath,
                    color: sku.color,
                    size: sku.size,
                    sku_code: sku.code,
                    sku_color: sku.color,
                    sku_size: sku.size,
                    productCode: item.productCode || item.code,
                    product_id: item.product_id
                  });
                }
              });
            }

            // 更新统计信息
            locInfo.products.add(item.productCode || item.code);
            locInfo.totalQuantity += loc.quantity || 0;
          });
        }
      });

      // 转换数量集合为排序的数组
      const sortedQuantities = ['未指定', ...Array.from(quantities).sort((a, b) => a - b)];
      setQuantityOptions(sortedQuantities);

      // 合并库位信息
      const processedLocations = locationsList.map(loc => ({
        ...loc,
        skuCount: locationData[loc.code]?.skus.size || 0,
        productCount: locationData[loc.code]?.products.size || 0,
        totalQuantity: locationData[loc.code]?.totalQuantity || 0,
        items: locationData[loc.code]?.items || [],
        inventoryItems: locationData[loc.code]?.items || [] // 为筛选逻辑添加这个字段
      }));

      setLocations(processedLocations);
      setFilteredLocations(processedLocations);
      setLocationOptions(
        processedLocations.map(loc => ({
          value: loc.code,
          label: `${loc.code}`
        }))
      );
    } catch (error) {
      console.error('获取库位失败:', error);
      message.error('获取库位失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取库位库存详情
  const fetchLocationDetail = async (locationCode) => {
    try {
      setLoading(true);
      console.log(`开始获取库位 ${locationCode} 详情`);
      const res = await api.get(`/inventory/location/${locationCode}`);
      console.log(`库位 ${locationCode} 详情获取成功:`, 
        res.data.items ? `有 ${res.data.items.length} 件商品` : '无商品');
      
      // Make sure full product info is loaded with SKU data
      if (res.data.items && res.data.items.length > 0) {
        // Load product details for SKUs to make sure we get the SKU images
        const productPromises = [];
        const productIds = new Set();
        
        res.data.items.forEach(item => {
          if (item.product_id && !productIds.has(item.product_id)) {
            productIds.add(item.product_id);
            productPromises.push(api.get(`/products/${item.product_id}`));
          }
        });
        
        if (productPromises.length > 0) {
          try {
            const productResults = await Promise.all(productPromises);
            const products = productResults.map(result => result.data);
            
            // Update the productsInfo with full product data including SKUs
            res.data.productsInfo = products;
            
            // Update each item with its corresponding SKU图片优先级
            res.data.items = res.data.items.map(item => {
              if (item.sku_code) {
                const product = products.find(p => p._id === item.product_id || p.id === item.product_id);
                if (product && product.skus && product.skus.length > 0) {
                  const skuInfo = product.skus.find(sku => sku.code === item.sku_code);
                  const skuImage = skuInfo?.image_path || skuInfo?.image;
                  const productImage = product.image_path || product.image;
                  return { ...item, image: skuImage || productImage || item.image };
                }
              }
              // 主商品兜底
              if (!item.image && products.length > 0) {
                const product = products.find(p => p._id === item.product_id || p.id === item.product_id);
                if (product) {
                  return { ...item, image: product.image_path || product.image || item.image };
                }
              }
              return item;
            });
          } catch (error) {
            console.error('获取商品详情失败:', error);
          }
        }
      }
      
      setLocationDetail(res.data);
      return res.data;
    } catch (error) {
      console.error('获取库位详情失败:', error);
      if (error.response) {
        console.error('错误详情:', error.response.data);
      }
      message.error('获取库位详情失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    const keyword = searchValue.trim().toLowerCase();
    let filtered = locations;

    // 关键词搜索
    if (keyword) {
      filtered = filtered.filter(loc => 
        loc.code.toLowerCase().includes(keyword) ||
        loc.name?.toLowerCase().includes(keyword)
      );
    }

    // 应用筛选条件
    if (productCode) {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => item.code.includes(productCode))
      );
    }

    if (color !== '未指定') {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => item.code.includes(color))
      );
    }

    if (size !== '未指定') {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => item.code.includes(size))
      );
    }

    if (quantity !== '未指定') {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => item.quantity === Number(quantity))
      );
    }

    if (locationCode !== '未指定') {
      filtered = filtered.filter(loc => loc.code === locationCode);
    }

    if (locationStatus !== '未指定') {
      if (locationStatus === '有货') {
        filtered = filtered.filter(loc => loc.totalQuantity > 0);
      } else if (locationStatus === '无货') {
        filtered = filtered.filter(loc => loc.totalQuantity === 0);
      }
    }

    if (quantityRange !== '未指定') {
      const [min, max] = safeSplit(quantityRange, '-').map(Number);
      filtered = filtered.filter(loc => {
        if (min && max) {
          return loc.totalQuantity >= min && loc.totalQuantity <= max;
        } else if (min) {
          return loc.totalQuantity >= min;
        } else if (max) {
          return loc.totalQuantity <= max;
        }
        return true;
      });
    }

    setFilteredLocations(filtered);
    
    // 如果当前有排序，重新应用排序
    if (currentSortField) {
      handleSort(currentSortField);
    }
  };

  // 显示库位详情
  const showLocationDetail = async (location) => {
    setSelectedLocation(location);
    const detail = await fetchLocationDetail(location.code);
    if (detail) {
      setDetailVisible(true);
    }
  };

  // 开始编辑商品数量
  const startEdit = (item) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
    setEditMode(true);
  };

  // 保存编辑的数量
  const saveEditQuantity = async () => {
    if (!editingItem || !selectedLocation) return;

    try {
      setLoading(true);
      
      // 修复库位编码获取逻辑
      const currentLocationCode = selectedLocation.code || locationDetail?.locationCode || selectedLocation.locationCode;
      
      console.log('保存编辑数量:', {
        productId: editingItem.inventoryId || editingItem._id,
        locationCode: currentLocationCode,
        quantity: Number(editQuantity),
        sku_code: editingItem.sku_code || '',
        sku_color: editingItem.sku_color || '',
        sku_size: editingItem.sku_size || ''
      });

      // 调用API保存数量修改
      await api.post('/inventory/adjust', {
        productId: editingItem.inventoryId || editingItem._id,
        locationCode: currentLocationCode,
        quantity: Number(editQuantity),
        sku_code: editingItem.sku_code || '',
        sku_color: editingItem.sku_color || '',
        sku_size: editingItem.sku_size || ''
      });

      // 更新本地数据
      const updatedDetail = await fetchLocationDetail(currentLocationCode);
      setLocationDetail(updatedDetail);
      
      // 刷新库位列表以更新计数
      await fetchLocations();
      
      message.success('数量已更新');
      setEditMode(false);
      setEditingItem(null);
    } catch (error) {
      console.error('保存失败:', error);
      if (error.response) {
        console.error('错误详情:', error.response.data);
      }
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 显示转移弹窗
  const showTransferModal = (item) => {
    setEditingItem(item);
    setTransferQuantity(Math.min(item.quantity, 1));
    setTargetLocation(null);
    setTransferVisible(true);
  };

  // 执行转移操作
  const handleTransfer = async () => {
    if (!editingItem || !selectedLocation || !targetLocation || transferQuantity <= 0) {
      message.warning('请完善转移信息');
      return;
    }

    if (transferQuantity > editingItem.quantity) {
      message.warning('转移数量不能大于当前数量');
      return;
    }

    try {
      setLoading(true);
      
      // 修复库位编码获取逻辑
      const fromLocationCode = selectedLocation.code || locationDetail?.locationCode || selectedLocation.locationCode;
      
      console.log('开始转移商品:', {
        product_id: editingItem.product_id,
        sku_code: editingItem.sku_code,
        from_locationCode: fromLocationCode,
        to_targetLocation: targetLocation,
        quantity: transferQuantity
      });

      // 先从当前库位出库 - 修复API参数
      await api.post('/outbound/', {
        product_id: editingItem.product_id,
        location_code: fromLocationCode, // 使用正确的参数名
        quantity: transferQuantity,
        ...(editingItem.sku_code ? {
          skuCode: editingItem.sku_code, // 使用正确的参数名
          sku_color: editingItem.sku_color,
          sku_size: editingItem.sku_size
        } : {})
      });

      // 再入库到目标库位 - 修复API参数
      await api.post('/inbound/', {
        product_id: editingItem.product_id,
        location_code: targetLocation, // 使用正确的参数名
        quantity: transferQuantity,
        ...(editingItem.sku_code ? {
          skuCode: editingItem.sku_code, // 使用正确的参数名
          sku_color: editingItem.sku_color,
          sku_size: editingItem.sku_size
        } : {})
      });

      message.success('转移成功');
      
      // 更新本地数据
      const updatedDetail = await fetchLocationDetail(fromLocationCode);
      setLocationDetail(updatedDetail);
      
      // 刷新库位列表
      await fetchLocations();
      
      // 关闭弹窗
      setTransferVisible(false);
    } catch (error) {
      console.error('转移失败:', error);
      if (error.response) {
        console.error('错误详情:', error.response.data);
      }
      message.error('转移失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 计算每个库位的商品款数
  const getLocationProductCount = (locationCode) => {
    // 在locations数组中查找匹配的库位
    const location = locations.find(loc => loc.code === locationCode);
    // 如果找到库位且有productCount属性则返回，否则返回0
    return location && location.productCount ? location.productCount : 0;
  };

  // 将商品从当前库位移动到"无货位"
  const moveToNoLocation = async (item) => {
    if (!item || !selectedLocation) return;
    
    try {
      setLoading(true);
      
      // 修复库位编码获取逻辑
      const fromLocationCode = selectedLocation.code || locationDetail?.locationCode || selectedLocation.locationCode;
      
      // 先从当前库位出库 - 修复API参数
      await api.post('/outbound/', {
        product_id: item.product_id,
        location_code: fromLocationCode, // 使用正确的参数名
        quantity: item.quantity,
        ...(item.sku_code ? {
          skuCode: item.sku_code, // 使用正确的参数名
          sku_color: item.sku_color,
          sku_size: item.sku_size
        } : {})
      });
      
      // 再入库到"无货位" - 修复API参数
      await api.post('/inbound/', {
        product_id: item.product_id,
        location_code: "无货位", // 使用正确的参数名
        quantity: item.quantity,
        ...(item.sku_code ? {
          skuCode: item.sku_code, // 使用正确的参数名
          sku_color: item.sku_color,
          sku_size: item.sku_size
        } : {})
      });
      
      message.success('商品已移至无货位');
      
      // 更新本地数据
      const updatedDetail = await fetchLocationDetail(fromLocationCode);
      setLocationDetail(updatedDetail);
      
      // 刷新库位列表
      await fetchLocations();
    } catch (error) {
      console.error('移动到无货位失败:', error);
      if (error.response) {
        console.error('错误详情:', error.response.data);
      }
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // 根据输入查找相似商品
  const searchSimilarProducts = async (value) => {
    if (!value || value.length < 2) {
      setProductSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      setSearchLoading(true);
      // 获取所有产品
      const response = await api.get('/products/');
      const products = response.data;
      
      // 首先检查是否有完全匹配的商品
      const exactMatch = products.filter(p => p.code === value);
      
      // 查找匹配的产品 - 完全匹配、开头匹配、包含匹配、名称匹配
      const startsWith = products.filter(p => p.code.startsWith(value) && p.code !== value);
      const contains = products.filter(p => p.code.includes(value) && !p.code.startsWith(value));
      const nameMatches = products.filter(p => 
        p.name && p.name.toLowerCase().includes(value.toLowerCase()) && 
        !exactMatch.includes(p) && !startsWith.includes(p) && !contains.includes(p)
      );
      
      // 按优先级合并结果
      const suggestions = [
        ...exactMatch,
        ...startsWith,
        ...contains,
        ...nameMatches
      ].slice(0, 10); // 最多显示10个建议
      
      setProductSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('搜索商品失败:', error);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // 处理输入变化
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputCode(value);
    searchSimilarProducts(value);
    setSelectedProduct(null); // 清除选中的商品
    setAvailableSkus([]); // 清除SKU选项
    setSelectedSku(null); // 清除选中的SKU
  };
  
  // 选择建议的商品
  const selectSuggestion = (product) => {
    setInputCode(product.code);
    setSelectedProduct(product);
    setShowSuggestions(false);
    
    // 如果商品有SKU，显示SKU选择
    if (product.skus && product.skus.length > 0) {
      setAvailableSkus(product.skus);
      setSelectedSku(null);
    } else {
      setAvailableSkus([]);
      setSelectedSku(null);
    }
  };

  // 打开添加商品弹窗
  const showAddProductModal = () => {
    setInputCode('');
    setAddQuantity(1);
    setProductSuggestions([]);
    setShowSuggestions(false);
    setSelectedProduct(null);
    setAvailableSkus([]);
    setSelectedSku(null);
    setAddProductVisible(true);
    
    // 添加一个延迟聚焦
    setTimeout(() => {
      const inputElement = document.getElementById('productInput');
      if (inputElement) {
        inputElement.focus();
      }
    }, 300);
  };
  
  // 添加新商品到当前库位
  const handleAddProduct = async () => {
    if (!selectedLocation) {
      message.warning('请先选择一个库位');
      return;
    }
    
    if ((!inputCode || inputCode.trim() === '') && !selectedProduct) {
      message.warning('请输入商品编码或从下拉列表中选择');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果已经选择了商品，直接使用
      let product = selectedProduct;
      
      // 如果没有选择商品，尝试根据编码查找
      if (!product && inputCode.trim() !== '') {
        try {
          const response = await api.get(`/products/code/${inputCode}`);
          product = response.data;
        } catch (error) {
          console.error('根据编码查找商品失败:', error);
          
          // 尝试搜索相似产品
          await searchSimilarProducts(inputCode);
          
          if (productSuggestions.length > 0) {
            // 有搜索建议，展示下拉列表
            setLoading(false);
            return;
          } else {
            message.error('未找到商品，请检查编码');
            setLoading(false);
            return;
          }
        }
      }
      
      if (!product) {
        message.warning('未找到商品');
        return;
      }
      
      // 如果商品有SKU但未选择SKU，提示用户选择
      if (product.skus && product.skus.length > 0 && !selectedSku) {
        message.warning('该商品有多个SKU，请选择具体的SKU');
        return;
      }
      
      // 构建入库数据
      const inboundData = {
        product_id: product.id || product._id,
        location_code: selectedLocation.code || locationDetail?.locationCode || selectedLocation.locationCode,
        quantity: addQuantity
      };
      
      // 如果选择了SKU，添加SKU信息
      if (selectedSku) {
        inboundData.sku_code = selectedSku.code;
        inboundData.sku_color = selectedSku.color;
        inboundData.sku_size = selectedSku.size;
      }
      
      // 直接入库到当前库位
      await api.post('/inbound/', inboundData);
      
      message.success({
        content: `已添加 ${product.name} 到 ${selectedLocation.code}`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
      
      // 更新本地数据
      const updatedDetail = await fetchLocationDetail(selectedLocation.code);
      setLocationDetail(updatedDetail);
      
      // 刷新库位列表
      await fetchLocations();
      
      // 重置状态
      setInputCode('');
      setSelectedProduct(null);
      setAvailableSkus([]);
      setSelectedSku(null);
      setAddQuantity(1);
      
      // 保持弹窗打开，以便继续添加
      setTimeout(() => {
        const inputElement = document.getElementById('productInput');
        if (inputElement) {
          inputElement.focus();
        }
      }, 300);
    } catch (error) {
      console.error('添加商品失败:', error);
      message.error('添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取筛选项显示文本的函数
  const getFilterText = (filterValues) => {
    if (!filterValues || filterValues.length === 0) return '未指定';
    return filterValues.join(',');
  };

  // 货位状态选项
  const STOCK_STATUS_OPTIONS = [
    { label: '全部', value: 'all' },
    { label: '只看有货', value: 'hasStock' },
    { label: '只看无货', value: 'noStock' },
  ];

  // 获取显示文本的函数
  const getStockStatusText = (status) => {
    if (status === null) return '未指定';
    const option = STOCK_STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.label : '未指定';
  };

  const getQuantityRangeText = (range) => {
    if (!range || range[0] === null && range[1] === null) return '未指定';
    return `${range[0] === null ? '不限' : range[0]} ~ ${range[1] === null ? '不限' : range[1]}`;
  };

  // 公共样式
  const filterRowStyle = {
    display: 'flex',
    alignItems: 'center',
    height: 48,
    padding: '0 16px',
    borderBottom: '1px solid #f5f5f5',
    background: '#fff',
    fontSize: 16,
    cursor: 'pointer',
  };
  const filterLabelStyle = {
    minWidth: 80,
    color: '#222',
    fontWeight: 400,
    flexShrink: 0,
  };
  const filterValueStyle = {
    color: '#888',
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 0,
  };

  // fetchLocations后自动刷新筛选项数据
  useEffect(() => {
    // locations变化时，刷新field options（如货位code）
    // 这里可触发一次handleSearch或setFilteredLocations，保证数据流同步
    handleSearch();
  }, [locations]);

  // 在组件体内、所有弹窗渲染前加：
  const safePickerColumns = Array.isArray(pickerColumns) && pickerColumns.length === 2
    ? pickerColumns.map(col => Array.isArray(col) ? col : [])
    : [[], []];
  const safeStockStatusOptions = Array.isArray(STOCK_STATUS_OPTIONS) ? STOCK_STATUS_OPTIONS : [];

  // 获取动态筛选选项
  const getDynamicFieldOptions = useMemo(() => {
    const options = {
      productCode: new Set(),
      color: new Set(),
      sku_size: new Set(),
      locationCode: new Set(),
      quantity: new Set()
    };

    // 遍历所有库位和商品
    locations.forEach(loc => {
      if (loc.inventoryItems) {
        loc.inventoryItems.forEach(item => {
          // 检查是否符合已选的筛选条件
          let matchesFilters = true;

          // 检查商品编号
          if (fieldFilters.productCode.length > 0) {
            const baseCode = item.sku_code?.split('-')[0];
            const matches = fieldFilters.productCode.some(code => 
              (baseCode && code === baseCode) ||
              (item.productCode && code === item.productCode) ||
              (item.code && code === item.code)
            );
            if (!matches) matchesFilters = false;
          }

          // 检查颜色
          if (fieldFilters.color.length > 0) {
            const skuColor = item.sku_code ? safeSplit(item.sku_code, '-')[1] : null;
            const matches = fieldFilters.color.some(color => 
              (skuColor && color === skuColor) ||
              (item.color && color === item.color) ||
              (item.sku_color && color === item.sku_color)
            );
            if (!matches) matchesFilters = false;
          }

          // 检查尺码
          if (fieldFilters.sku_size.length > 0) {
            const skuSize = item.sku_code ? safeSplit(item.sku_code, '-')[2] : null;
            const matches = fieldFilters.sku_size.some(size => 
              (skuSize && size === skuSize) ||
              (item.sku_size && size === item.sku_size) ||
              (item.size && size === item.size)
            );
            if (!matches) matchesFilters = false;
          }

          // 检查数量
          if (fieldFilters.quantity.length > 0) {
            if (!fieldFilters.quantity.includes(item.quantity?.toString())) {
              matchesFilters = false;
            }
          }

          // 检查货位
          if (fieldFilters.locationCode.length > 0) {
            if (!fieldFilters.locationCode.includes(loc.code)) {
              matchesFilters = false;
            }
          }

          // 如果符合所有已选条件，则添加该商品的选项
          if (matchesFilters) {
            // 添加商品编号选项 - 只提取基础商品编号，不包含颜色和尺码
            if (item.sku_code) {
              const baseCode = safeSplit(item.sku_code, '-')[0];
              if (baseCode) options.productCode.add(baseCode);
            }
            // 注意：不再添加完整的SKU编码作为商品编号
            // if (item.productCode) options.productCode.add(item.productCode);
            // if (item.code) options.productCode.add(item.code);

            // 添加颜色选项
            if (item.sku_code) {
              const parts = safeSplit(item.sku_code, '-');
              if (parts[1]) options.color.add(parts[1]);
            }
            if (item.color) options.color.add(item.color);
            if (item.sku_color) options.color.add(item.sku_color);

            // 添加尺码选项
            if (item.sku_code) {
              const parts = safeSplit(item.sku_code, '-');
              if (parts[2]) options.sku_size.add(parts[2]);
            }
            if (item.sku_size) options.sku_size.add(item.sku_size);
            if (item.size) options.sku_size.add(item.size);

            // 添加数量选项
            if (item.quantity > 0) {
              options.quantity.add(item.quantity.toString());
            }

            // 添加货位选项
            if (loc.code) options.locationCode.add(loc.code);
          }
        });
      }
    });

    // 转换Set为数组并排序
    const result = {};
    Object.keys(options).forEach(key => {
      result[key] = Array.from(options[key])
        .filter(Boolean)
        .sort((a, b) => {
          if (key === 'quantity') {
            return Number(a) - Number(b);
          }
          return String(a).localeCompare(String(b));
        });
    });

    return result;
  }, [locations, fieldFilters]);

  // 在Modal组件中使用动态选项
  const getFieldOptions = (field) => {
    return getDynamicFieldOptions[field] || [];
  };

  // 过滤显示的商品
  const filteredItems = useMemo(() => {
    // 先按搜索关键词过滤货位
    let baseLocations = locations;
    const keyword = searchValue.trim().toLowerCase();
    if (keyword) {
      baseLocations = locations.filter(loc => 
        loc.code.toLowerCase().includes(keyword) ||
        loc.name?.toLowerCase().includes(keyword)
      );
    }

    return baseLocations.map(loc => {
      if (!loc.inventoryItems) return null;

      const filteredInventoryItems = loc.inventoryItems.filter(item => {
        let matchesFilters = true;

        // 检查商品编号
        if (fieldFilters.productCode?.length > 0) {
          const baseCode = item.sku_code ? safeSplit(item.sku_code, '-')[0] : null;
          const matches = fieldFilters.productCode.some(code => 
            (baseCode && code === baseCode) ||
            (item.productCode && code === item.productCode) ||
            (item.code && code === item.code)
          );
          if (!matches) matchesFilters = false;
        }

        // 检查颜色
        if (fieldFilters.color?.length > 0) {
          const skuColor = item.sku_code ? safeSplit(item.sku_code, '-')[1] : null;
          const matches = fieldFilters.color.some(color => 
            (skuColor && color === skuColor) ||
            (item.color && color === item.color) ||
            (item.sku_color && color === item.sku_color)
          );
          if (!matches) matchesFilters = false;
        }

        // 检查尺码
        if (fieldFilters.sku_size?.length > 0) {
          const skuSize = item.sku_code ? safeSplit(item.sku_code, '-')[2] : null;
          const matches = fieldFilters.sku_size.some(size => 
            (skuSize && size === skuSize) ||
            (item.sku_size && size === item.sku_size) ||
            (item.size && size === item.size)
          );
          if (!matches) matchesFilters = false;
        }

        // 检查数量
        if (fieldFilters.quantity?.length > 0) {
          if (!fieldFilters.quantity.includes(item.quantity?.toString())) {
            matchesFilters = false;
          }
        }

        // 检查货位
        if (fieldFilters.locationCode?.length > 0) {
          if (!fieldFilters.locationCode.includes(loc.code)) {
            matchesFilters = false;
          }
        }

        return matchesFilters;
      });

      if (filteredInventoryItems.length === 0) return null;

      return {
        ...loc,
        inventoryItems: filteredInventoryItems
      };
    }).filter(Boolean);
  }, [locations, fieldFilters, searchValue]);

  // 当筛选数据变化时重新应用排序
  useEffect(() => {
    if (currentSortField && filteredItems.length > 0) {
      const sorted = [...filteredItems].sort((a, b) => {
        let aValue, bValue;
        
        switch(currentSortField) {
          case 'code':
            aValue = a.code || '';
            bValue = b.code || '';
            break;
          case 'skuCount':
            aValue = a.skuCount || 0;
            bValue = b.skuCount || 0;
            break;
          case 'productCount':
            aValue = a.productCount || 0;
            bValue = b.productCount || 0;
            break;
          case 'totalQuantity':
            aValue = a.totalQuantity || 0;
            bValue = b.totalQuantity || 0;
            break;
          default:
            return 0;
        }
        
        // 字符串排序
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const result = aValue.localeCompare(bValue);
          return currentSortOrder === 'asc' ? result : -result;
        }
        
        // 数字排序
        const result = aValue - bValue;
        return currentSortOrder === 'asc' ? result : -result;
      });
      
      setSortedItems(sorted);
    }
  }, [filteredItems, currentSortField, currentSortOrder]);

  // 处理数量筛选
  const handleQuantityFilter = (quantity) => {
    const newSelected = new Set(selectedQuantities);
    if (newSelected.has(quantity)) {
      newSelected.delete(quantity);
    } else {
      newSelected.add(quantity);
    }
    setSelectedQuantities(newSelected);
  };

  // 清除筛选条件
  const clearFilters = () => {
    // 清除fieldFilters状态
    setFieldFilters({
      productCode: [],
      color: [],
      sku_size: [],
      quantity: [],
      locationCode: []
    });
    
    // 清除显示状态
    setProductCode('未指定');
    setColor('未指定');
    setSize('未指定');
    setQuantity('未指定');
    setLocationCode('未指定');
    setLocationStatus('未指定');
    setQuantityRange('未指定');
    setFilterVisible(false);
  };

  // 显示筛选选项弹窗
  const showFilterOptions = (field, fieldLabel) => {
    setCurrentFilterField(field);
    
    let options = [];
    switch(field) {
      case 'productCode':
        options = getDynamicFieldOptions.productCode || [];
        break;
      case 'color':
        options = getDynamicFieldOptions.color || [];
        break;
      case 'size':
        options = getDynamicFieldOptions.sku_size || [];
        break;
      case 'quantity':
        options = getDynamicFieldOptions.quantity || [];
        break;
      case 'locationCode':
        options = getDynamicFieldOptions.locationCode || [];
        break;
      case 'locationStatus':
        options = ['有货', '无货'];
        break;
      case 'quantityRange':
        options = ['1-10件', '11-20件', '21-50件', '50件以上'];
        break;
      default:
        options = [];
    }
    
    setCurrentFilterOptions(options);
    setFilterOptionVisible(true);
  };

  // 选择筛选选项
  const selectFilterOption = (option) => {
    // 更新fieldFilters状态以触发动态筛选
    setFieldFilters(prevFilters => {
      const newFilters = { ...prevFilters };
      
      switch(currentFilterField) {
        case 'productCode':
          // 如果选项已存在则移除，否则添加（支持多选）
          if (newFilters.productCode.includes(option)) {
            newFilters.productCode = newFilters.productCode.filter(item => item !== option);
          } else {
            newFilters.productCode = [...newFilters.productCode, option];
          }
          setProductCode(newFilters.productCode.length > 0 ? newFilters.productCode.join(', ') : '未指定');
          break;
        case 'color':
          if (newFilters.color.includes(option)) {
            newFilters.color = newFilters.color.filter(item => item !== option);
          } else {
            newFilters.color = [...newFilters.color, option];
          }
          setColor(newFilters.color.length > 0 ? newFilters.color.join(', ') : '未指定');
          break;
        case 'size':
          if (newFilters.sku_size.includes(option)) {
            newFilters.sku_size = newFilters.sku_size.filter(item => item !== option);
          } else {
            newFilters.sku_size = [...newFilters.sku_size, option];
          }
          setSize(newFilters.sku_size.length > 0 ? newFilters.sku_size.join(', ') : '未指定');
          break;
        case 'quantity':
          if (newFilters.quantity.includes(option)) {
            newFilters.quantity = newFilters.quantity.filter(item => item !== option);
          } else {
            newFilters.quantity = [...newFilters.quantity, option];
          }
          setQuantity(newFilters.quantity.length > 0 ? newFilters.quantity.join(', ') : '未指定');
          break;
        case 'locationCode':
          if (newFilters.locationCode.includes(option)) {
            newFilters.locationCode = newFilters.locationCode.filter(item => item !== option);
          } else {
            newFilters.locationCode = [...newFilters.locationCode, option];
          }
          setLocationCode(newFilters.locationCode.length > 0 ? newFilters.locationCode.join(', ') : '未指定');
          break;
        case 'locationStatus':
          setLocationStatus(option);
          break;
        case 'quantityRange':
          setQuantityRange(option);
          break;
      }
      
      return newFilters;
    });
    
    setFilterOptionVisible(false);
    // 不需要调用handleSearch，因为fieldFilters变化会自动触发filteredItems重新计算
  };

  // 显示入库/出库弹窗
  const showInoutModal = (type, locationCode) => {
    setInoutType(type);
    setSelectedLocation({ code: locationCode });
    setInoutQuantity(1);
    setInoutVisible(true);
  };

  // 处理排序
  const handleSort = (field) => {
    let newOrder = 'asc';
    
    // 如果点击的是当前排序字段，切换排序方向
    if (currentSortField === field) {
      newOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    }
    
    setCurrentSortField(field);
    setCurrentSortOrder(newOrder);
    
    // 对filteredItems进行排序
    const sorted = [...filteredItems].sort((a, b) => {
      let aValue, bValue;
      
      switch(field) {
        case 'code':
          aValue = a.code || '';
          bValue = b.code || '';
          break;
        case 'skuCount':
          aValue = a.skuCount || 0;
          bValue = b.skuCount || 0;
          break;
        case 'productCount':
          aValue = a.productCount || 0;
          bValue = b.productCount || 0;
          break;
        case 'totalQuantity':
          aValue = a.totalQuantity || 0;
          bValue = b.totalQuantity || 0;
          break;
        default:
          return 0;
      }
      
      // 字符串排序
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return newOrder === 'asc' ? result : -result;
      }
      
      // 数字排序
      const result = aValue - bValue;
      return newOrder === 'asc' ? result : -result;
    });
    
    setSortedItems(sorted);
  };

  // 获取排序图标
  const getSortIcon = (field) => {
    if (currentSortField !== field) {
      return <span style={{ opacity: 0.3 }}>↕</span>;
    }
    return currentSortOrder === 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
  };

  // 显示图片预览
  const showImagePreview = (imagePath, skuCode) => {
    if (imagePath) {
      setPreviewImage({
        url: getFullImageUrl(imagePath),
        title: skuCode || '商品图片'
      });
    }
  };

  // 处理入库或出库操作
  const handleInoutOperation = async () => {
    if (!selectedLocation || !inoutQuantity) return;
    
    try {
      setLoading(true);
      
      const endpoint = inoutType === 'in' ? '/inbound/' : '/outbound/';
      
      // 构建基本请求数据 - 修复库位编码获取逻辑
      const locationCode = selectedLocation.code || locationDetail?.locationCode || selectedLocation.locationCode;
      const requestData = {
        location_code: locationCode,
        quantity: inoutQuantity,
        productCode: inoutItem?.sku_code || inoutItem?.code || inoutItem?.productCode,
        notes: `${inoutType === 'in' ? '入库' : '出库'}操作 - 货位: ${locationCode}`
      };
      
      // 如果有选中的SKU
      if (inoutItem) {
        requestData.skuCode = inoutItem.sku_code;
        requestData.sku_color = inoutItem.color || inoutItem.sku_color;
        requestData.sku_size = inoutItem.sku_size || inoutItem.size;
      }
      
      console.log('请求数据:', requestData);
      
      // 调用API进行入库或出库
      const response = await api.post(endpoint, requestData);
      console.log('API响应:', response.data);
        
      // 成功处理
      message.success(inoutType === 'in' ? '入库成功' : '出库成功');
      setInoutVisible(false);
      setInoutItem(null);
      
      // 重新加载数据
      fetchLocations();
      
    } catch (error) {
      console.error('API调用失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* 顶部导航栏 */}
      <MobileNavBar currentPage="locationInventory" />
      {/* 搜索栏和筛选按钮 */}
      <div className="search-bar">
        <Input
          className="search-input"
          placeholder="搜索货位编码"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
        />
        <Button onClick={handleSearch}><SearchOutlined /></Button>
        <Button onClick={() => setFilterVisible(true)}><FilterOutlined /></Button>
      </div>
      {/* 排序选项 */}
      <div className="sort-bar">
        <span 
          className={`sort-header ${currentSortField === 'code' ? 'active' : ''}`}
          onClick={() => handleSort('code')}
        >
          货位编码 {getSortIcon('code')}
        </span>
        <span 
          className={`sort-header ${currentSortField === 'skuCount' ? 'active' : ''}`}
          onClick={() => handleSort('skuCount')}
        >
          SKU数 {getSortIcon('skuCount')}
        </span>
        <span 
          className={`sort-header ${currentSortField === 'productCount' ? 'active' : ''}`}
          onClick={() => handleSort('productCount')}
        >
          商品种数 {getSortIcon('productCount')}
        </span>
        <span 
          className={`sort-header ${currentSortField === 'totalQuantity' ? 'active' : ''}`}
          onClick={() => handleSort('totalQuantity')}
        >
          合计件数 {getSortIcon('totalQuantity')}
        </span>
      </div>
      {/* 货位列表 */}
      <div className="location-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>加载中...</div>
        ) : (currentSortField ? sortedItems : filteredItems).length > 0 ? (
          (currentSortField ? sortedItems : filteredItems).map(loc => (
            <div key={loc.code} className="location-item" onClick={() => showLocationDetail(loc)}>
              <div className="location-info-section">
                <div className="location-code">{loc.code}</div>
                <div className="location-info">
                  <span>{loc.productCount}种商品</span>
                  <span>{loc.skuCount}个SKU</span>
                </div>
                <div className="location-total">合计{loc.totalQuantity}件</div>
              </div>
              {loc.inventoryItems && loc.inventoryItems.length > 0 && (
                <div className="location-images-section">
                  {loc.inventoryItems
                    .sort((a, b) => (a.quantity || 0) - (b.quantity || 0)) // 按数量升序排列，数量少的在左边，数量多的在右边
                    .map((item, index) => {
                    // 生成图片URL - 使用SKU code或者产品code
                    const imageCode = item.sku_code || item.code || item.productCode || '129092';
                    const imagePath = item.image || item.skuImage || item.image_path;
                    
                    // 提取尺码信息
                    const size = item.sku_size || item.size || 
                      (item.sku_code ? safeSplit(item.sku_code, '-')[2] : '') || 'M';
                    
                    return (
                      <div key={`${item.sku_code || item.code || index}`} className="sku-item">
                        <div 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            position: 'relative'
                          }}
                        >
                          {imagePath ? (
                            <img 
                              src={getFullImageUrl(imagePath)} 
                              alt={item.sku_code || item.code}
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'contain'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              backgroundColor: '#f0f0f0',
                              display: imagePath ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              color: '#666',
                              textAlign: 'center',
                              lineHeight: '12px',
                              position: 'absolute',
                              top: 0,
                              left: 0
                            }}
                          >
                            {imagePath ? '无图' : imageCode.substring(0, 6)}
                          </div>
                        </div>
                        <div className="sku-size-tag">{size}</div>
                        <div className="sku-quantity">{item.quantity || 0}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#999' }}>
            暂无库位信息
          </div>
        )}
      </div>
      {/* 筛选弹窗 */}
      <Popup
        visible={filterVisible}
        onMaskClick={() => setFilterVisible(false)}
        position="left"
        bodyStyle={{ width: '200px' }}
      >
        <div className="filter-popup">
          <div className="filter-header">
            <CloseOutlined onClick={() => setFilterVisible(false)} />
            <span>筛选</span>
          </div>
          <div className="filter-content">
            <div className="filter-item" onClick={() => showFilterOptions('productCode', '商品编号')}>
              <div className="filter-label">商品编号：</div>
              <div className="filter-value">
                <span>{productCode}</span>
                <RightOutlined />
              </div>
            </div>
            <div className="filter-item" onClick={() => showFilterOptions('color', '颜色')}>
              <div className="filter-label">颜色：</div>
              <div className="filter-value">
                <span>{color}</span>
                <RightOutlined />
              </div>
            </div>
            <div className="filter-item" onClick={() => showFilterOptions('size', '尺码')}>
              <div className="filter-label">尺码：</div>
              <div className="filter-value">
                <span>{size}</span>
                <RightOutlined />
              </div>
            </div>
            <div className="filter-item" onClick={() => showFilterOptions('quantity', '数量')}>
              <div className="filter-label">数量：</div>
              <div className="filter-value">
                <span>{quantity}</span>
                <RightOutlined />
              </div>
            </div>
            <div className="filter-item" onClick={() => showFilterOptions('locationCode', '货位')}>
              <div className="filter-label">货位：</div>
              <div className="filter-value">
                <span>{locationCode}</span>
                <RightOutlined />
              </div>
            </div>
            <div className="filter-item" onClick={() => showFilterOptions('locationStatus', '货位状态')}>
              <div className="filter-label">货位状态：</div>
              <div className="filter-value">
                <span>{locationStatus}</span>
                <RightOutlined />
              </div>
            </div>
            <div className="filter-item" onClick={() => showFilterOptions('quantityRange', '件数区间')}>
              <div className="filter-label">件数区间：</div>
              <div className="filter-value">
                <span>{quantityRange}</span>
                <RightOutlined />
              </div>
            </div>
          </div>
          <div className="filter-footer">
            <Button block danger onClick={clearFilters} style={{ borderRadius: 24, color: '#ff4d4f', borderColor: '#ff4d4f' }}>
              清除条件
            </Button>
          </div>
        </div>
      </Popup>

      {/* 筛选选项弹窗 */}
      <Popup
        visible={filterOptionVisible}
        onMaskClick={() => setFilterOptionVisible(false)}
        position="right"
        bodyStyle={{ width: '200px' }}
      >
        <div className="filter-option-popup">
          <div className="filter-header">
            <CloseOutlined onClick={() => setFilterOptionVisible(false)} />
            <span>选择{currentFilterField === 'productCode' ? '商品编号' : 
                        currentFilterField === 'color' ? '颜色' :
                        currentFilterField === 'size' ? '尺码' :
                        currentFilterField === 'quantity' ? '数量' :
                        currentFilterField === 'locationCode' ? '货位' :
                        currentFilterField === 'locationStatus' ? '货位状态' :
                        currentFilterField === 'quantityRange' ? '件数区间' : '选项'}</span>
          </div>
          <div className="filter-option-content">
            <div className="filter-option-item" onClick={() => selectFilterOption('未指定')}>
              <span>未指定</span>
            </div>
            {currentFilterOptions.map((option, index) => {
              // 检查当前选项是否已被选中
              let isSelected = false;
              switch(currentFilterField) {
                case 'productCode':
                  isSelected = fieldFilters.productCode.includes(option);
                  break;
                case 'color':
                  isSelected = fieldFilters.color.includes(option);
                  break;
                case 'size':
                  isSelected = fieldFilters.sku_size.includes(option);
                  break;
                case 'quantity':
                  isSelected = fieldFilters.quantity.includes(option);
                  break;
                case 'locationCode':
                  isSelected = fieldFilters.locationCode.includes(option);
                  break;
              }
              
              return (
                <div 
                  key={index} 
                  className={`filter-option-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectFilterOption(option)}
                  style={{
                    backgroundColor: isSelected ? '#1890ff' : 'transparent',
                    color: isSelected ? '#fff' : '#000'
                  }}
                >
                  <span>{option}</span>
                  {isSelected && <span style={{ marginLeft: '8px' }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </Popup>

      {/* 货位详情弹窗 */}
      <Modal
        title={`库位详情: ${selectedLocation?.code || selectedLocation?.name || '未知库位'}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={showAddProductModal}>
            添加商品到此库位
          </Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        centered
        bodyStyle={{ 
          maxHeight: '70vh', 
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
          paddingRight: '20px',
          position: 'relative'
        }}
        className="location-detail-modal"
      >
        {locationDetail && (
          <div 
            style={{ 
              minHeight: '500px',
              padding: '8px 0',
              touchAction: 'pan-y'
            }}
          >
            {locationDetail.inventoryItems && locationDetail.inventoryItems.length > 0 ? (
              locationDetail.inventoryItems.map((item, index) => {
                const imageCode = item.sku_code || item.code || item.productCode || '129092';
                const skuInfo = item.sku_code ? safeSplit(item.sku_code, '-') : [];
                const color = item.color || item.sku_color || (skuInfo[1] || '');
                const size = item.sku_size || item.size || (skuInfo[2] || '');
                const imagePath = item.image || item.skuImage || item.image_path;
                
                return (
                  <Card key={index} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flexShrink: 0 }}>
                        <div 
                          style={{ 
                            width: 80, 
                            height: 100, 
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            cursor: imagePath ? 'pointer' : 'default'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (imagePath) {
                              showImagePreview(imagePath, item.sku_code || item.code);
                            }
                          }}
                        >
                          {imagePath ? (
                            <img 
                              src={getFullImageUrl(imagePath)} 
                              alt={item.sku_code || item.code}
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'contain'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              backgroundColor: '#f0f0f0',
                              display: imagePath ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              color: '#666',
                              textAlign: 'center',
                              lineHeight: '12px',
                              position: 'absolute',
                              top: 0,
                              left: 0
                            }}
                          >
                            {imagePath ? '无图' : imageCode.substring(0, 6)}
                          </div>
                        </div>
                      </div>
                      <div 
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => {
                          // 切换展开状态：如果当前SKU已展开则折叠，否则展开当前SKU
                          const skuKey = `${locationDetail.code}-${item.sku_code || item.code}`;
                          setExpandedSkuKey(expandedSkuKey === skuKey ? null : skuKey);
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <Tag>{item.productCode || imageCode}</Tag>
                          <Tag>{item.productCode || imageCode}</Tag>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="blue">SKU: {item.sku_code || item.code}</Tag>
                        </div>
                        <div style={{ color: '#666', marginBottom: 8 }}>
                          颜色: {color} 尺寸: {size}
                        </div>
                        <div style={{ color: '#1890ff', fontWeight: 'bold', marginBottom: 12 }}>
                          数量: {item.quantity || 0} 件
                        </div>
                        
                        {/* 只有当前SKU展开时才显示操作按钮 */}
                        {expandedSkuKey === `${locationDetail.code}-${item.sku_code || item.code}` && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', marginLeft: '-96px' }}>
                            <Button 
                              size="small"
                              style={{ backgroundColor: '#fadb14', borderColor: '#fadb14', color: '#000' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(item);
                              }}
                            >
                              修改
                            </Button>
                            <Button 
                              size="small"
                              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                showTransferModal(item);
                              }}
                            >
                              转移
                            </Button>
                            <Button 
                              size="small"
                              danger
                              onClick={(e) => {
                                e.stopPropagation();
                                moveToNoLocation(item);
                              }}
                            >
                              清库位
                            </Button>
                            <Button 
                              type="primary" 
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInoutItem(item);
                                showInoutModal('in', locationDetail.code);
                              }}
                            >
                              入库
                            </Button>
                            <Button 
                              danger 
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInoutItem(item);
                                showInoutModal('out', locationDetail.code);
                              }}
                            >
                              出库
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (locationDetail.items && locationDetail.items.length > 0) ? (
              locationDetail.items.map((item, index) => {
                const imageCode = item.sku_code || item.code || item.productCode || '129092';
                const skuInfo = item.sku_code ? safeSplit(item.sku_code, '-') : [];
                const color = item.color || item.sku_color || (skuInfo[1] || '');
                const size = item.sku_size || item.size || (skuInfo[2] || '');
                const imagePath = item.image || item.skuImage || item.image_path;
                
                return (
                  <Card key={index} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flexShrink: 0 }}>
                        <div 
                          style={{ 
                            width: 80, 
                            height: 100, 
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            cursor: imagePath ? 'pointer' : 'default'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (imagePath) {
                              showImagePreview(imagePath, item.sku_code || item.code);
                            }
                          }}
                        >
                          {imagePath ? (
                            <img 
                              src={getFullImageUrl(imagePath)} 
                              alt={item.sku_code || item.code}
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'contain'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              backgroundColor: '#f0f0f0',
                              display: imagePath ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              color: '#666',
                              textAlign: 'center',
                              lineHeight: '12px',
                              position: 'absolute',
                              top: 0,
                              left: 0
                            }}
                          >
                            {imagePath ? '无图' : imageCode.substring(0, 6)}
                          </div>
                        </div>
                      </div>
                      <div 
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => {
                          // 切换展开状态：如果当前SKU已展开则折叠，否则展开当前SKU
                          const skuKey = `${locationDetail.code}-${item.sku_code || item.code}`;
                          setExpandedSkuKey(expandedSkuKey === skuKey ? null : skuKey);
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <Tag>{item.productCode || imageCode}</Tag>
                          <Tag>{item.productCode || imageCode}</Tag>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="blue">SKU: {item.sku_code || item.code}</Tag>
                        </div>
                        <div style={{ color: '#666', marginBottom: 8 }}>
                          颜色: {color} 尺寸: {size}
                        </div>
                        <div style={{ color: '#1890ff', fontWeight: 'bold', marginBottom: 12 }}>
                          数量: {item.quantity || 0} 件
                        </div>
                        
                        {/* 只有当前SKU展开时才显示操作按钮 */}
                        {expandedSkuKey === `${locationDetail.code}-${item.sku_code || item.code}` && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', marginLeft: '-96px' }}>
                            <Button 
                              size="small"
                              style={{ backgroundColor: '#fadb14', borderColor: '#fadb14', color: '#000' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(item);
                              }}
                            >
                              修改
                            </Button>
                            <Button 
                              size="small"
                              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                showTransferModal(item);
                              }}
                            >
                              转移
                            </Button>
                            <Button 
                              size="small"
                              danger
                              onClick={(e) => {
                                e.stopPropagation();
                                moveToNoLocation(item);
                              }}
                            >
                              清库位
                            </Button>
                            <Button 
                              type="primary" 
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInoutItem(item);
                                showInoutModal('in', locationDetail.code);
                              }}
                            >
                              入库
                            </Button>
                            <Button 
                              danger 
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInoutItem(item);
                                showInoutModal('out', locationDetail.code);
                              }}
                            >
                              出库
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <Empty description="该货位暂无库存" />
            )}
          </div>
        )}
      </Modal>

      {/* 入库/出库弹窗 */}
      <Modal
        title={inoutType === 'in' ? '入库操作' : '出库操作'}
        open={inoutVisible}
        onCancel={() => setInoutVisible(false)}
        onOk={handleInoutOperation}
        confirmLoading={loading}
      >
        {selectedLocation && (
          <div>
            <p><strong>货位:</strong> {selectedLocation.code}</p>
            
            {/* 显示当前操作的SKU */}
            {inoutItem ? (
              <div>
                <p><strong>SKU:</strong> <Tag color="blue">{inoutItem.sku_code || inoutItem.code}</Tag></p>
                <p><strong>当前库存:</strong> {inoutItem.quantity || 0} 件</p>
              </div>
            ) : (
              <p>对整个货位进行操作</p>
            )}
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>{inoutType === 'in' ? '入库' : '出库'}数量:</strong>
              </label>
              <InputNumber
                min={1}
                value={inoutQuantity}
                onChange={value => setInoutQuantity(value)}
                style={{ width: '100%' }}
                autoFocus
                placeholder="请输入数量"
              />
            </div>
            
            {inoutType === 'out' && inoutItem && inoutQuantity > (inoutItem.quantity || 0) && (
              <div style={{ color: '#ff4d4f' }}>
                警告: 出库数量大于当前库存
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 转移弹窗 */}
      <Modal
        title="转移库存"
        open={transferVisible}
        onCancel={() => setTransferVisible(false)}
        onOk={handleTransfer}
        confirmLoading={loading}
      >
        {editingItem && (
          <div>
            <p><strong>商品:</strong> {editingItem.sku_code || editingItem.code}</p>
            <p><strong>当前库位:</strong> {selectedLocation?.code}</p>
            <p><strong>当前数量:</strong> {editingItem.quantity} 件</p>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>目标库位:</strong>
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择目标库位或输入新库位编码"
                value={targetLocation}
                onChange={setTargetLocation}
                showSearch
                allowClear
                mode="combobox" // 允许输入自定义值
                filterOption={(input, option) => {
                  if (!option || !option.children) return false;
                  return option.children.toString().toLowerCase().indexOf(input.toLowerCase()) >= 0;
                }}
                onSearch={(value) => {
                  // 当用户输入时，如果不在选项中，也设置为目标库位
                  if (value && !locationOptions.some(loc => loc.value === value)) {
                    setTargetLocation(value);
                  }
                }}
              >
                {/* 添加无货位选项 */}
                <Option key="无货位" value="无货位">
                  无货位 (特殊库位)
                </Option>
                {/* 现有库位选项 */}
                {locationOptions
                  .filter(loc => loc.value !== (selectedLocation?.code || locationDetail?.locationCode)) // 排除当前库位
                  .map(loc => (
                  <Option key={loc.value} value={loc.value}>
                    {loc.value} {loc.label && loc.label !== loc.value ? `(${loc.label})` : ''}
                  </Option>
                ))}
              </Select>
              {targetLocation && !locationOptions.some(loc => loc.value === targetLocation) && targetLocation !== '无货位' && (
                <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
                  将创建新库位: {targetLocation}
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>转移数量:</strong>
              </label>
              <InputNumber
                min={1}
                max={editingItem.quantity}
                value={transferQuantity}
                onChange={value => setTransferQuantity(value)}
                style={{ width: '100%' }}
                placeholder="请输入转移数量"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑数量弹窗 */}
      <Modal
        title="修改库存数量"
        open={editMode}
        onCancel={() => setEditMode(false)}
        onOk={saveEditQuantity}
        confirmLoading={loading}
      >
        {editingItem && (
          <div>
            <p><strong>商品:</strong> {editingItem.sku_code || editingItem.code}</p>
            <p><strong>货位:</strong> {selectedLocation?.code}</p>
            <p><strong>当前数量:</strong> {editingItem.quantity} 件</p>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>新数量:</strong>
              </label>
              <InputNumber
                min={0}
                value={editQuantity}
                onChange={value => setEditQuantity(value)}
                style={{ width: '100%' }}
                autoFocus
                placeholder="请输入新的数量"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 添加商品到库位弹窗 */}
      <Modal
        title={`添加商品到 ${selectedLocation?.code || '库位'}`}
        open={addProductVisible}
        onCancel={() => setAddProductVisible(false)}
        onOk={handleAddProduct}
        confirmLoading={loading}
        okText="添加"
        cancelText="取消"
        centered
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <strong>商品编码:</strong>
            </label>
            <div style={{ position: 'relative' }}>
              <Input
                id="productInput"
                value={inputCode}
                onChange={handleInputChange}
                placeholder="输入商品编码或搜索商品"
                suffix={searchLoading ? <LoadingOutlined /> : <SearchOutlined />}
                autoComplete="off"
              />
              
              {/* 搜索建议下拉列表 */}
              {showSuggestions && productSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #d9d9d9',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  {productSuggestions.map((product, index) => (
                    <div
                      key={product._id || product.id || index}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: index < productSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        backgroundColor: selectedProduct && 
                          (selectedProduct._id === product._id || selectedProduct.id === product.id) 
                          ? '#f6ffed' : 'white'
                      }}
                      onClick={() => selectSuggestion(product)}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = selectedProduct && 
                          (selectedProduct._id === product._id || selectedProduct.id === product.id) 
                          ? '#f6ffed' : 'white';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: '#1890ff' }}>{product.code}</div>
                      {product.name && <div style={{ fontSize: '12px', color: '#666' }}>{product.name}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* 显示已选择的商品信息 */}
            {selectedProduct && (
              <div style={{ 
                marginTop: 8, 
                padding: 8, 
                backgroundColor: '#f6ffed', 
                border: '1px solid #b7eb8f',
                borderRadius: 4 
              }}>
                <div><strong>已选择:</strong> {selectedProduct.code}</div>
                {selectedProduct.name && <div>{selectedProduct.name}</div>}
              </div>
            )}
          </div>

          {/* SKU选择 */}
          {availableSkus.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>选择SKU:</strong>
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择具体的SKU"
                value={selectedSku?.code}
                onChange={(value) => {
                  const sku = availableSkus.find(s => s.code === value);
                  setSelectedSku(sku);
                }}
                showSearch
                filterOption={(input, option) => {
                  if (!option || !option.children) return false;
                  return option.children.toString().toLowerCase().indexOf(input.toLowerCase()) >= 0;
                }}
              >
                {availableSkus.map(sku => (
                  <Option key={sku.code} value={sku.code}>
                    {sku.code} {sku.color && `- ${sku.color}`} {sku.size && `- ${sku.size}`}
                  </Option>
                ))}
              </Select>
              
              {/* 显示已选择的SKU信息 */}
              {selectedSku && (
                <div style={{ 
                  marginTop: 8, 
                  padding: 8, 
                  backgroundColor: '#e6f7ff', 
                  border: '1px solid #91d5ff',
                  borderRadius: 4 
                }}>
                  <div><strong>SKU:</strong> {selectedSku.code}</div>
                  {selectedSku.color && <div><strong>颜色:</strong> {selectedSku.color}</div>}
                  {selectedSku.size && <div><strong>尺码:</strong> {selectedSku.size}</div>}
                  {selectedSku.price && <div><strong>价格:</strong> ¥{selectedSku.price}</div>}
                </div>
              )}
            </div>
          )}
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <strong>添加数量:</strong>
            </label>
            <InputNumber
              min={1}
              value={addQuantity}
              onChange={value => setAddQuantity(value)}
              style={{ width: '100%' }}
              placeholder="请输入添加数量"
            />
          </div>
          
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>• 如果商品已存在于此库位，将增加数量</div>
            <div>• 如果商品不存在，将创建新的库存记录</div>
          </div>
        </div>
      </Modal>

      {/* 图片预览弹窗 */}
      <Modal
        title={previewImage?.title || '图片预览'}
        open={!!previewImage}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        width="90%"
        centered
        bodyStyle={{ 
          maxHeight: '70vh', 
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
          paddingRight: '20px',
          position: 'relative'
        }}
        className="image-preview-modal"
      >
        {previewImage && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div style={{ display: 'none', padding: '20px', color: '#999' }}>
              图片加载失败
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MobileLocationInventory; 