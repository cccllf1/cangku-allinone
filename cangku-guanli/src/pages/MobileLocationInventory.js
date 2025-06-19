import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  Input, Button, List, Card, Select, Badge, Tag, Space, 
  Modal, InputNumber, message, Empty, Spin, Form, Checkbox, Drawer, Upload
} from 'antd';
import { Popup, Picker } from 'antd-mobile';
import { 
  SearchOutlined, SwapOutlined, 
  SaveOutlined, WarningOutlined, CheckCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, FilterOutlined, ArrowUpOutlined, ArrowDownOutlined, CloseOutlined, SettingOutlined, RightOutlined, LoadingOutlined, ExclamationCircleOutlined
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
  { key: 'product_code', label: '商品编号', getValue: item => item.product_code || item.sku_code?.split('-')[0] || '' },
  { key: 'sku_color', label: '颜色', getValue: item => item.sku_color || '' },
  { key: 'sku_size', label: '尺码', getValue: item => item.sku_size || '' },
  { key: 'stock_quantity', label: '货位SKU数量', getValue: item => item.stock_quantity },
  { key: 'location_code', label: '货位', getValue: item => item.location_code || '' },
  { key: 'quantity_range', label: '货位合计区间', getValue: item => item.quantity_range }
];

// 独立的图片区组件
function ImageRow({ items, getFullImageUrl }) {
  const imagesContainerRef = useRef(null);
  const sortedItems = Array.isArray(items) ? [...items].sort((a, b) => a.stock_quantity - b.stock_quantity) : [];
  return (
    <div
      ref={imagesContainerRef}
      style={{ overflowX: 'auto', minWidth: 0 }}
    >
      <div className="location-images-section" style={{ display: 'flex', gap: 0 }}>
        {sortedItems.map((item, idx) => (
          <div key={item.sku_code || idx} style={{ position: 'relative', width: 65, height: 65, border: '1px solid #eee', borderRadius: 6, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.image_path ? (
              <img src={getFullImageUrl(item.image_path)} alt={item.sku_code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#bbb', fontSize: 12 }}>无图</div>
            )}
            {/* 左上角SKU总数角标 */}
            <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,0.2)', color: '#222', borderRadius: 8, fontSize: 12, padding: '0 7px', fontWeight: 700, minWidth: 20, textAlign: 'center', lineHeight: '20px', height: 20 }}>{sortedItems.length}</div>
            {/* 右下角该SKU库存角标 */}
            <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(255,77,79,0.2)', color: '#ff4d4f', borderRadius: 8, fontSize: 13, padding: '0 7px', fontWeight: 700, minWidth: 20, textAlign: 'center', lineHeight: '20px', height: 20 }}>{item.stock_quantity}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 子组件：每行独立自动滚动
function LocationImageRow({ items, getFullImageUrl }) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = 0; // 试试最左
      }
    }, 0);
  }, [items.length, items.map(item => item.sku_code).join(',')]);
  return (
    <div
      ref={scrollRef}
      style={{
        overflowX: 'auto',
        minWidth: 0,
        padding: 0,
        margin: 0,
        border: 'none',
        background: 'none',
        scrollbarWidth: 'auto', // 显示滚动条
        msOverflowStyle: 'auto',
      }}
      // className="hide-horizontal-scrollbar" // 移除隐藏滚动条
    >
      <div
        className="location-images-section"
        style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}
      >
        {items
          .slice()
          .sort((a, b) => a.stock_quantity - b.stock_quantity)
          .map((item, idx) => (
            <div
              key={item.sku_code || idx}
              style={{
                flex: 'none',
                position: 'relative',
                width: 65,
                height: 65,
                border: '1px solid #eee',
                borderRadius: 6,
                overflow: 'hidden',
                background: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.image_path ? (
                <img
                  src={getFullImageUrl(item.image_path)}
                  alt={item.sku_code}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ color: '#bbb', fontSize: 12 }}>无图</div>
              )}
              {/* 左上角SKU总数角标 */}
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  background: 'rgba(0,0,0,0.2)', // 20% 透明黑
                  color: '#fff',
                  borderRadius: 8,
                  fontSize: 12,
                  padding: '0 7px',
                  fontWeight: 700,
                  minWidth: 20,
                  textAlign: 'center',
                  lineHeight: '20px',
                  height: 20,
                }}
              >
                {getSkuSize(item)}
              </div>
              {/* 右下角该SKU库存角标 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  background: 'rgba(255,77,79,0.2)', // 20% 透明红
                  color: '#fff',
                  borderRadius: 8,
                  fontSize: 13,
                  padding: '0 7px',
                  fontWeight: 700,
                  minWidth: 20,
                  textAlign: 'center',
                  lineHeight: '20px',
                  height: 20,
                }}
              >
                {item.stock_quantity}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// 全局监听页面resize，所有图片横向滚动区始终锁定最右

function useScrollAllImageRowsToRight() {
  useLayoutEffect(() => {
    function scrollAllToRight() {
      document.querySelectorAll('.location-images-section').forEach(section => {
        const el = section.parentElement;
        if (el) el.scrollLeft = el.scrollWidth;
      });
    }
    window.addEventListener('resize', scrollAllToRight);
    setTimeout(scrollAllToRight, 100);
    return () => window.removeEventListener('resize', scrollAllToRight);
  }, []);
}

// 在组件顶部加一个提取尺码的函数
function getSkuSize(item) {
  if (item.sku_size) return item.sku_size;
  if (item.sku_code) {
    const parts = item.sku_code.split('-');
    return parts[2] || '-';
  }
  return '-';
}

// 提取颜色的函数
function getSkuColor(item) {
  if (item.sku_color) return item.sku_color;
  if (item.sku_code) {
    const parts = item.sku_code.split('-');
    return parts[1] || '';
  }
  return '';
}

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
  const [currentUser, setCurrentUser] = useState(null);
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
  const [quantityRangeMin, setQuantityRangeMin] = useState('');
  const [quantityRangeMax, setQuantityRangeMax] = useState('');
  const [filterOptionVisible, setFilterOptionVisible] = useState(false);
  const [quantityRangeInputVisible, setQuantityRangeInputVisible] = useState(false);
  const [currentFilterField, setCurrentFilterField] = useState('');
  const [currentFilterOptions, setCurrentFilterOptions] = useState([]);
  const [currentSortField, setCurrentSortField] = useState(null);
  const [currentSortOrder, setCurrentSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [sortedItems, setSortedItems] = useState([]);
  const [noLocationItems, setNoLocationItems] = useState([]);
  const [selectedNoLocItem, setSelectedNoLocItem] = useState(null);

  const navigate = useNavigate();

  // useMemo放在组件顶层，不能放在fetchLocations等函数内部
  const allInventoryItems = useMemo(() => locations.flatMap(loc => loc.inventoryItems || []), [locations]);
  const allLocationCodes = useMemo(() => getUnique(locations, loc => loc.location_code), [locations]);

  const filterFields = [
    { key: 'product_code', label: '商品编号', options: allInventoryItems.map(item => item.product_code) },
    { key: 'color', label: '颜色', options: allInventoryItems.map(item => item.color) },
    { key: 'sku_size', label: '尺码', options: allInventoryItems.map(item => item.sku_size) },
    { key: 'quantity', label: '数量', options: allInventoryItems.map(item => item.quantity) },
    { key: 'location_code', label: '货位', options: allLocationCodes },
  ];

  // 在组件内定义映射对象
  const filterStateMap = {
    product_code: productCodeFilter,
    color: colorFilter,
    sku_size: sizeFilter,
    quantity: quantityFilter,
    location_code: codeFilter || [], // 如果没有codeFilter可用空数组兜底
  };
  const setFilterStateMap = {
    product_code: setProductCodeFilter,
    color: setColorFilter,
    sku_size: setSizeFilter,
    quantity: setQuantityFilter,
    location_code: setCodeFilter || (()=>{}), // 如果没有codeFilter可用空函数兜底
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
      product_code: new Set(),
      color: new Set(),
      sku_size: new Set(),
      quantity: new Set(),
      location_code: new Set()
    };
    
    // 遍历所有库位和库存项
    locations.forEach(loc => {
      // 货位选项
      if (loc.location_code) options.location_code.add(loc.location_code);

      // 遍历库存项
      if (loc.inventoryItems) {
        loc.inventoryItems.forEach(item => {
          // 商品编号选项 - 只从SKU code中提取基础商品编号，不包含颜色和尺码
          if (item.sku_code) {
            const baseCode = safeSplit(item.sku_code, '-')[0];
            if (baseCode) options.product_code.add(baseCode);
          }
          // 注意：不再添加完整的SKU编码作为商品编号
       

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
    product_code: [],
    color: [],
    sku_size: [],
    quantity: [],
    location_code: []
  });

  // 页面加载时获取所有库位
  useEffect(() => {
    fetchLocations();
  }, []);

  // 获取所有库位信息
  const fetchLocations = async () => {
    setLoading(true);
    try {
                const response = await api.get('/inventory/location');
      if (response.data && response.data.success) {
        // 适配新接口结构
        const locations = (response.data.data || []).map(loc => {
          const items = loc.items || [];
          // SKU数
          const skuCount = items.length;
          // 商品种数（按 product_code 去重）
          const productSet = new Set(items.map(it => it.product_code));
          const productCount = productSet.size;
          // 合计件数
          const totalQuantity = items.reduce((sum, it) => sum + (it.stock_quantity || 0), 0);
          return {
            location_code: loc.location_code,
            items,
            skuCount,
            productCount,
            totalQuantity
          };
        });
        setLocations(locations);
        setFilteredLocations(locations);
        setLocationOptions(
          locations.map(loc => ({
            value: loc.location_code,
            label: loc.location_code
          }))
        );
      } else {
        throw new Error(response.data.error_message || '获取库存失败');
      }
    } catch (error) {
      message.error('获取库存失败: ' + (error.response?.data?.error_message || error.message));
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
      console.log('location detail:', res.data);
      if (res.data.data && res.data.data.items && res.data.data.items.length > 0) {
        // ... existing code ...
      }
      setLocationDetail(res.data.data); // 修正为只取data字段
      return res.data.data;
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
        (typeof loc.location_code === 'string' && loc.location_code.toLowerCase().includes(keyword)) ||
        (typeof loc.name === 'string' && loc.name.toLowerCase().includes(keyword))
      );
    }

    // 应用筛选条件
    if (productCode) {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => typeof item.sku_code === 'string' && item.sku_code.includes(productCode))
      );
    }

    if (color !== '未指定') {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => typeof item.sku_code === 'string' && item.sku_code.includes(color))
      );
    }

    if (size !== '未指定') {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => typeof item.sku_code === 'string' && item.sku_code.includes(size))
      );
    }

    if (quantity !== '未指定') {
      filtered = filtered.filter(loc => 
        loc.items?.some(item => item.quantity === Number(quantity))
      );
    }

    if (locationCode !== '未指定') {
      filtered = filtered.filter(loc => loc.location_code === locationCode);
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
    // 补全 location_code 字段，确保后续弹窗有货位信息
    const locCode = location.location_code;
    setSelectedLocation(location);
    console.log('弹窗打开时 selectedLocation:', location); // 自动打印
    const detail = await fetchLocationDetail(locCode);
    if (detail) {
      setDetailVisible(true);
    }
  };

  // 开始编辑商品数量
  const startEdit = (item) => {
    let latestItem = null;
    if (item && locationDetail && locationDetail.items) {
      latestItem = locationDetail.items.find(
        it => it.sku_code === item.sku_code
      );
    }
    setEditingItem(latestItem || item);
    setEditQuantity((latestItem || item).quantity);
    setEditMode(true);
  };

  // 保存编辑的数量
  const saveEditQuantity = async () => {
    if (!editingItem || !selectedLocation) return;
    if (!currentUser || !currentUser.user_id) {
      message.error('未获取到用户信息，请重新登录');
      return;
    }
    try {
      setLoading(true);
      const currentLocationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
      const requestData = {
        sku_code: editingItem.sku_code,
        location_code: currentLocationCode,
        target_quantity: Number(editQuantity),
        operator_id: currentUser.user_id,
        notes: '手动修改库存数量'
      };
      const response = await api.post('/inventory/adjust', requestData);
      // API已经返回最新库存数据，不需要重新获取
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log('库存调整完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
      message.success('数量已更新');
      setEditMode(false);
      setEditingItem(null);
    } catch (error) {
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 显示转移弹窗
  const showTransferModal = (item) => {
    setEditingItem(item);
    const qty = item.stock_quantity ?? item.quantity ?? 0;
    setTransferQuantity(qty > 0 ? 1 : 0);
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
    if (!currentUser || !currentUser.user_id) {
      message.error('未获取到用户信息，请重新登录');
      return;
    }
    try {
      setLoading(true);
      const fromLocationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
      const response = await api.post('/inventory/transfer', {
        sku_code: editingItem.sku_code,
        from_location_code: fromLocationCode,
        to_location_code: targetLocation,
        transfer_quantity: Number(transferQuantity),
        operator_id: currentUser.user_id,
        notes: '移动库存操作'
      });
      message.success('转移成功');
      // API已经返回最新库存数据，不需要重新获取
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log('库存转移完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
      setTransferVisible(false);
    } catch (error) {
      message.error('转移失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 计算每个库位的商品款数
  const getLocationProductCount = (locationCode) => {
    // 在locations数组中查找匹配的库位
    const location = locations.find(loc => loc.location_code === locationCode);
    // 如果找到库位且有productCount属性则返回，否则返回0
    return location && location.productCount ? location.productCount : 0;
  };

  // 将商品从当前库位移动到"无货位"
  const moveToNoLocation = async (item) => {
    if (!item || !selectedLocation) return;
    
    try {
      setLoading(true);
      
      // 修复库位编码获取逻辑
      const fromLocationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
      
      // 直接使用库存转移API，更高效
      const response = await api.post('/inventory/transfer', {
        sku_code: item.sku_code,
        from_location_code: fromLocationCode,
        to_location_code: "无货位",
        transfer_quantity: Number(item.quantity),
        operator_id: currentUser.user_id,
        notes: '移动到无货位操作'
      });
      
      message.success('商品已移至无货位');
      
      // API已经返回最新库存数据，不需要重新获取
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log('移动到无货位完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
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
      const exactMatch = products.filter(p => p.product_code === value);
      
      // 查找匹配的产品 - 完全匹配、开头匹配、包含匹配、名称匹配
      const startsWith = products.filter(p => p.product_code.startsWith(value) && p.product_code !== value);
      const contains = products.filter(p => p.product_code.includes(value) && !p.product_code.startsWith(value));
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
    setInputCode(product.product_code);
    setSelectedProduct(product);
    setShowSuggestions(false);
    // 如果商品有SKU，显示SKU选择
    if (product.skus && product.skus.length > 0) {
      // 只保留标准字段名
      const normalizedSkus = product.skus.map(sku => ({
        ...sku,
        sku_code: sku.sku_code,
        sku_color: sku.sku_color,
        sku_size: sku.sku_size,
      }));
      setAvailableSkus(normalizedSkus);
      setSelectedSku(null);
    } else {
      setAvailableSkus([]);
      setSelectedSku(null);
    }
  };

  // 打开添加商品弹窗
  const showAddProductModal = async () => {
    setAddProductVisible(true);
    setSelectedNoLocItem(null);
    setAddQuantity(1);
    try {
              const res = await api.get('/inventory/location');
      const noLoc = res.data.data.find(loc => loc.location_code === '无货位');
      setNoLocationItems(noLoc ? noLoc.items : []);
    } catch (e) {
      setNoLocationItems([]);
    }
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
    if (!currentUser || !currentUser.user_id) {
      message.error('未获取到用户信息，请重新登录');
      return;
    }
    try {
      setLoading(true);
      let product = selectedProduct;
      if (!product && inputCode.trim() !== '') {
        try {
          const response = await api.get(`/products/code/${inputCode}`);
          product = response.data;
        } catch (error) {
          await searchSimilarProducts(inputCode);
          if (productSuggestions.length > 0) {
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
      if (product.skus && product.skus.length > 0 && !selectedSku) {
        message.warning('该商品有多个SKU，请选择具体的SKU');
        return;
      }
      // 上架数据（从无货位转移到当前库位）
      const toLocationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
      const fromLocationCode = '无货位';
      const qty = addQuantity;
      if (qty <= 0) {
        message.info('上架数量必须大于0');
        return;
      }
      if (selectedProduct && addQuantity > selectedProduct.stock_quantity) {
        message.error('上架数量不能大于无货位库存');
        return;
      }
      const transferData = {
        sku_code: selectedSku ? selectedSku.sku_code : (product.sku_code || ''),
        from_location_code: fromLocationCode,
        to_location_code: toLocationCode,
        transfer_quantity: Number(qty),
        operator_id: currentUser.user_id,
        notes: '上架操作'
      };
      await api.post('/inventory/transfer', transferData);
      message.success({
        content: `已上架 ${product.name || product.product_name || product.product_code} 到 ${toLocationCode}`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
      const updatedDetail = await fetchLocationDetail(toLocationCode);
      setLocationDetail(updatedDetail);
      await fetchLocations();
      setInputCode('');
      setSelectedProduct(null);
      setAvailableSkus([]);
      setSelectedSku(null);
      setAddQuantity(1);
      setTimeout(() => {
        const inputElement = document.getElementById('productInput');
        if (inputElement) {
          inputElement.focus();
        }
      }, 300);
    } catch (error) {
      message.error('上架失败');
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
      product_code: new Set(),
      color: new Set(),
      sku_size: new Set(),
      location_code: new Set(),
      quantity: new Set()
    };

    // 遍历所有库位和商品
    locations.forEach(loc => {
      if (loc.inventoryItems) {
        loc.inventoryItems.forEach(item => {
          // 检查是否符合已选的筛选条件
          let matchesFilters = true;

          // 检查商品编号
          if (fieldFilters.product_code.length > 0) {
            const baseCode = item.sku_code?.split('-')[0];
            const matches = fieldFilters.product_code.some(code => 
              (baseCode && code === baseCode) ||
              (item.product_code && code === item.product_code)
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
          if (fieldFilters.location_code.length > 0) {
            if (!fieldFilters.location_code.includes(loc.location_code)) {
              matchesFilters = false;
            }
          }

          // 如果符合所有已选条件，则添加该商品的选项
          if (matchesFilters) {
            // 添加商品编号选项 - 只提取基础商品编号，不包含颜色和尺码
            if (item.sku_code) {
              const baseCode = safeSplit(item.sku_code, '-')[0];
              if (baseCode) options.product_code.add(baseCode);
            }
            // 注意：不再添加完整的SKU编码作为商品编号
            // if (item.productCode) options.productCode.add(item.productCode);
            // if (item. ffffcode) options.productCode.add(item.ffffcode);

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
            if (loc.location_code) options.location_code.add(loc.location_code);
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
        loc.location_code.toLowerCase().includes(keyword) ||
        loc.name?.toLowerCase().includes(keyword)
      );
    }

    // 按货位状态筛选
    if (locationStatus !== '未指定') {
      if (locationStatus === '有货') {
        baseLocations = baseLocations.filter(loc => loc.totalQuantity > 0);
      } else if (locationStatus === '无货') {
        baseLocations = baseLocations.filter(loc => loc.totalQuantity === 0);
      }
    }

    const processedLocations = baseLocations.map(loc => {
      // 如果没有库存项，直接返回货位信息（用于件数区间筛选）
      if (!loc.inventoryItems || loc.inventoryItems.length === 0) {
        return loc;
      }

      const filteredInventoryItems = loc.inventoryItems.filter(item => {
        let matchesFilters = true;

        // 检查商品编号
        if (fieldFilters.product_code?.length > 0) {
          const baseCode = item.sku_code ? safeSplit(item.sku_code, '-')[0] : null;
          const matches = fieldFilters.product_code.some(code => 
            (baseCode && code === baseCode) ||
            (item.product_code && code === item.product_code)
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
        if (fieldFilters.location_code?.length > 0) {
          if (!fieldFilters.location_code.includes(loc.location_code)) {
            matchesFilters = false;
          }
        }

        return matchesFilters;
      });

      // 如果有商品级别的筛选条件，但没有匹配的商品，则排除此货位
      const hasProductFilters = fieldFilters.product_code?.length > 0 || 
                               fieldFilters.color?.length > 0 || 
                               fieldFilters.sku_size?.length > 0 || 
                               fieldFilters.quantity?.length > 0 ||
                               fieldFilters.location_code?.length > 0;
      
      if (hasProductFilters && filteredInventoryItems.length === 0) {
        return null;
      }

      return {
        ...loc,
        inventoryItems: filteredInventoryItems
      };
    }).filter(Boolean);

    // 最后按件数区间筛选（基于货位总量）
    const finalFilteredLocations = processedLocations.filter(loc => {
      // 按件数区间筛选
      if (quantityRangeMin !== '' || quantityRangeMax !== '') {
        const quantity = loc.totalQuantity || 0;
        const min = quantityRangeMin !== '' ? parseInt(quantityRangeMin) : 0;
        const max = quantityRangeMax !== '' ? parseInt(quantityRangeMax) : Infinity;
        return quantity >= min && quantity <= max;
      }
      return true;
    });

    return finalFilteredLocations;
  }, [locations, fieldFilters, searchValue, locationStatus, quantityRangeMin, quantityRangeMax]);

  // 当筛选数据变化时重新应用排序
  useEffect(() => {
    if (currentSortField && filteredItems.length > 0) {
      const sorted = [...filteredItems].sort((a, b) => {
        let aValue, bValue;
        
        switch(currentSortField) {
          case 'code':
            aValue = a.location_code || '';
            bValue = b.location_code || '';
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
      product_code: [],
      color: [],
      sku_size: [],
      quantity: [],
      location_code: []
    });
    
    // 清除显示状态
    setProductCode('未指定');
    setColor('未指定');
    setSize('未指定');
    setQuantity('未指定');
    setLocationCode('未指定');
    setLocationStatus('未指定');
    setQuantityRange('未指定');
    setQuantityRangeMin('');
    setQuantityRangeMax('');
    setFilterVisible(false);
  };

  // 显示筛选选项弹窗
  const showFilterOptions = (field, fieldLabel) => {
    setCurrentFilterField(field);
    
    // 如果是件数区间，显示输入界面
    if (field === 'quantityRange') {
      setQuantityRangeInputVisible(true);
      return;
    }
    
    let options = [];
    switch(field) {
      case 'product_code':
        options = getDynamicFieldOptions.product_code || [];
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
      case 'location_code':
        options = getDynamicFieldOptions.location_code || [];
        break;
      case 'locationStatus':
        options = ['有货', '无货'];
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
      case 'product_code':
          // 如果选项已存在则移除，否则添加（支持多选）
          if (newFilters.product_code.includes(option)) {
            newFilters.product_code = newFilters.product_code.filter(item => item !== option);
          } else {
            newFilters.product_code = [...newFilters.product_code, option];
          }
          setProductCode(newFilters.product_code.length > 0 ? newFilters.product_code.join(', ') : '未指定');
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
      case 'location_code':
          if (newFilters.location_code.includes(option)) {
            newFilters.location_code = newFilters.location_code.filter(item => item !== option);
          } else {
            newFilters.location_code = [...newFilters.location_code, option];
          }
          setLocationCode(newFilters.location_code.length > 0 ? newFilters.location_code.join(', ') : '未指定');
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
  const showInoutModal = async (type, locationCode, item) => {
    setInoutType(type);
    setSelectedLocation({ location_code: locationCode });
    setInoutQuantity(1);
    // 自动拉取最新 locationDetail
    const detail = await fetchLocationDetail(locationCode);
    let latestItem = null;
    if (item && detail && detail.items) {
      latestItem = detail.items.find(
        it => it.sku_code === item.sku_code
      );
    }
    setInoutItem(latestItem || item || null);
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
          aValue = a.location_code || '';
          bValue = b.location_code || '';
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
    if (!currentUser || !currentUser.user_id) {
      message.error('未获取到用户信息，请重新登录');
      return;
    }
    try {
      setLoading(true);
      const endpoint = inoutType === 'in' ? '/inbound/' : '/outbound/';
      const locationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
      const requestData = {
        location_code: locationCode,
        quantity: inoutQuantity,
        product_code: inoutItem?.product_code,
        product_id: inoutItem?.product_id,
        sku_code: inoutItem?.sku_code,
        sku_color: inoutItem?.sku_color,
        sku_size: inoutItem?.sku_size,
        operator_id: currentUser.user_id,
        notes: `${inoutType === 'in' ? '入库' : '出库'}操作 - 货位: ${locationCode}`
      };
      const response = await api.post(endpoint, requestData);
      setInoutVisible(false);
      message.success(`${inoutType === 'in' ? '入库' : '出库'}成功`);
      // API已经返回最新库存数据，不需要重新获取
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log(`${inoutType === 'in' ? '入库' : '出库'}完成，最新库存:`, { sku_location_quantity, sku_total_quantity });
      }
    } catch (error) {
      message.error(`${inoutType === 'in' ? '入库' : '出库'}失败: ` + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 在主页面组件里调用
  useScrollAllImageRowsToRight();

  // 获取当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data && response.data.success) {
          setCurrentUser(response.data.data);
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        message.error('获取用户信息失败');
      }
    };
    fetchCurrentUser();
  }, []);

  // 清库存操作
  const handleClearStock = async (item) => {
    if (!item || !selectedLocation || !currentUser?.user_id) {
      message.error('缺少必要参数，无法清库存');
      return;
    }
    try {
      setLoading(true);
      const currentLocationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
      const requestData = {
        sku_code: item.sku_code,
        location_code: currentLocationCode,
        target_quantity: 0,
        operator_id: currentUser.user_id,
        notes: '清库存'
      };
      const response = await api.post('/inventory/adjust', requestData);
      message.success('清库存成功');
      // API已经返回最新库存数据，不需要重新获取
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log('清库存完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
    } catch (error) {
      message.error('清库存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 清库位操作（移库到无货位）
  const handleClearLocation = async (item) => {
    if (!item || !selectedLocation || !currentUser?.user_id) {
      message.error('缺少必要参数，无法清库位');
      return;
    }
    const fromLocationCode = selectedLocation.location_code;
    const toLocationCode = '无货位';
    const qty = item.stock_quantity ?? item.quantity ?? 0;
    if (qty <= 0) {
      message.info('该SKU本库位已无库存');
      return;
    }
    try {
      setLoading(true);
      const requestData = {
        sku_code: item.sku_code,
        from_location_code: fromLocationCode,
        to_location_code: toLocationCode,
        transfer_quantity: Number(qty),
        operator_id: currentUser.user_id,
        notes: '清库位-移至无货位'
      };
      const response = await api.post('/inventory/transfer', requestData);
      message.success('清库位成功，库存已移至无货位');
      // API已经返回最新库存数据，不需要重新获取
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log('清库位完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
    } catch (error) {
      message.error('清库位失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 包装清库存操作，增加确认弹窗
  const handleClearStockWithConfirm = (item) => {
    Modal.confirm({
      title: '确认要清空该SKU库存吗？',
      content: `SKU: ${item.sku_code}，此操作会将该SKU库存清零，且不可恢复。确定要继续吗？`,
      okText: '确定清库存',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => handleClearStock(item)
    });
  };

  // 1. 在组件内定义唯一筛选项数据源
  const allItems = useMemo(() => locations.flatMap(loc => loc.items || []), [locations]);

  // 渲染货位列表前，先过滤 locations：
  const displayLocations = locations.filter(loc => loc.location_code && loc.location_code !== 'DEFAULT');

  return (
    <div className="page-container" style={{ padding: 16 }}>
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
          (currentSortField ? sortedItems : filteredItems).map(loc => {
            const location_code = loc.location_code;
            if (!location_code) console.warn('库位缺少location_code:', loc);
            const items = loc.items || [];
            const totalQuantity = items.reduce((sum, it) => sum + (it.stock_quantity || 0), 0);
            const skuCount = items.length;
            const productCount = new Set(items.map(it => it.product_code)).size;
            const isEmpty = totalQuantity === 0;
            return (
              <div key={location_code} className={`location-item ${isEmpty ? 'empty-location' : ''}`} onClick={() => {
                console.log('点击库位:', { ...loc, location_code });
                showLocationDetail({ ...loc, location_code });
              }}>
                <div className="location-info-section">
                  <div className="location-code">{loc.location_code}</div>
                  {!isEmpty && (
                    <>
                      <div style={{ lineHeight: 1.2, margin: '2px 0', fontSize: 13 }}>
                        <span style={{ color: '#888' }}>商品</span>
                        <span style={{ color: '#1890ff', fontWeight: 600 }}>{loc.productCount}</span>
                        <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
                        <span style={{ color: '#888' }}>SKU：</span>
                        <span style={{ color: '#52c41a', fontWeight: 600 }}>{loc.skuCount}</span>
                        <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
                        <span style={{ color: '#888' }}>总数：</span>
                        <span style={{ color: '#fa541c', fontWeight: 700 }}>{loc.totalQuantity}</span>
                        <span style={{ color: '#888', marginLeft: 2 }}>件</span>
                      </div>
                    </>
                  )}
                </div>
                {items.length > 0 && (
                  <LocationImageRow items={items} getFullImageUrl={getFullImageUrl} />
                )}
              </div>
            );
          })
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
            <div className="filter-item" onClick={() => showFilterOptions('product_code', '商品编号')}>
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
            <div className="filter-item" onClick={() => showFilterOptions('location_code', '货位')}>
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
            <span>选择{currentFilterField === 'product_code' ? '商品编号' : 
                        currentFilterField === 'color' ? '颜色' :
                        currentFilterField === 'size' ? '尺码' :
                        currentFilterField === 'quantity' ? '数量' :
                        currentFilterField === 'location_code' ? '货位' :
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
                case 'product_code':
                  isSelected = fieldFilters.product_code.includes(option);
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
                case 'location_code':
                  isSelected = fieldFilters.location_code.includes(option);
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
        title={`库位详情: ${selectedLocation?.location_code || '未知库位'}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={showAddProductModal}>
            上架
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
          locationDetail.items && locationDetail.items.length > 0 ? (
            <div style={{margin:'12px 0'}}>
              {locationDetail.items
                .filter(item => item.stock_quantity > 0)
                .map((item, index) => {
                  const imagePath = item.image_path || item.image;
                  const skuKey = item.sku_code || item.product_id || index;
                  const isExpanded = expandedSkuKey === skuKey;
                  return (
                    <div
                      key={skuKey}
                      style={{
                        border: '1px solid #eee',
                        borderRadius: 12,
                        marginBottom: 8,
                        padding: 8,
                        background: '#fff',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        transition: 'min-height 0.2s',
                        minHeight: isExpanded ? undefined : 100,
                        maxHeight: isExpanded ? undefined : 100,
                        height: isExpanded ? 'auto' : 100
                      }}
                      onClick={() => setExpandedSkuKey(isExpanded ? null : skuKey)}
                    >
                      <div style={{display: 'flex', gap: 8, alignItems: 'center', width: '100%', minHeight: 100, overflow: 'hidden'}}>
                        <div style={{width: 100, height: 100, background: '#f5f5f5', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                          {imagePath ? (
                            <img src={getFullImageUrl ? getFullImageUrl(imagePath) : imagePath} alt={item.sku_code} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                          ) : (
                            <span style={{color: '#bbb', fontSize: 12}}>无图</span>
                          )}
                        </div>
                        <div style={{flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                          <div style={{display: 'flex', gap: 4, marginBottom: 2, flexWrap: 'wrap'}}>
                            <Tag style={{padding: '0 4px', fontSize: 12}}>{item.product_code}</Tag>
                            <Tag style={{padding: '0 4px', fontSize: 12}}>{item.product_name}</Tag>
                          </div>
                          <div style={{marginBottom: 2, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            <Tag color="blue" style={{padding: '0 4px', fontSize: 12}}>SKU: {item.sku_code}</Tag>
                          </div>
                          <div style={{color: '#666', fontSize: 12, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            颜色: {item.sku_color} 尺寸: {item.sku_size}
                          </div>
                          <div style={{color: '#1890ff', fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap'}}>
                            数量: {item.stock_quantity} 件
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{display: 'flex', flexDirection: 'row', gap: 8, marginTop: 4, width: '100%', justifyContent: 'flex-start'}} onClick={e => e.stopPropagation()}>
                          <Button size="small" style={{backgroundColor: '#fadb14', borderColor: '#fadb14', color: '#000'}} onClick={() => { console.log('点击修改，selectedLocation:', selectedLocation, 'item:', item); startEdit(item); }}>修改</Button>
                          <Button size="small" style={{backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff'}} onClick={() => { console.log('点击转移，selectedLocation:', selectedLocation, 'item:', item); showTransferModal(item); }}>转移</Button>
                          <Button size="small" danger onClick={() => { console.log('点击清库位，selectedLocation:', selectedLocation, 'item:', item); handleClearLocation(item); }}>清库位</Button>
                          <Button type="primary" size="small" onClick={() => { console.log('点击入库，selectedLocation:', selectedLocation, 'item:', item); setInoutItem(item); showInoutModal('in', locationDetail.location_code, item); }}>入库</Button>
                          <Button danger size="small" onClick={() => { console.log('点击出库，selectedLocation:', selectedLocation, 'item:', item); setInoutItem(item); showInoutModal('out', locationDetail.location_code, item); }}>出库</Button>
                          <Button
                            danger
                            type="primary"
                            icon={<ExclamationCircleOutlined />}
                            style={{
                              background: '#ff4d4f',
                              borderColor: '#ff4d4f',
                              fontWeight: 'bold',
                              marginLeft: 12,
                              boxShadow: '0 0 0 2px #fff, 0 0 0 4px #ffccc7'
                            }}
                            onClick={() => handleClearStockWithConfirm(item)}
                            title="此操作不可恢复，请谨慎操作"
                          >
                            清库存
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <Empty description="该货位暂无库存" />
          )
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
            <p><strong>当前库位:</strong> {selectedLocation?.location_code ? selectedLocation.location_code : <span style={{color: 'red'}}>缺少 location_code 字段</span>}</p>
            
            {/* 显示当前操作的SKU */}
            {inoutItem ? (
              <div>
                <p><strong>SKU:</strong> <Tag color="blue">{inoutItem.sku_code !== undefined && inoutItem.sku_code !== null && inoutItem.sku_code !== '' ? inoutItem.sku_code : <span style={{color: 'red'}}>缺少 sku_code 字段</span>}</Tag></p>
                <p><strong>当前库存:</strong> {(inoutItem.stock_quantity ?? inoutItem.quantity ?? 0)} 件</p>
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
            <p><strong>商品:</strong> {editingItem.sku_code !== undefined && editingItem.sku_code !== null && editingItem.sku_code !== '' ? editingItem.sku_code : <span style={{color: 'red'}}>缺少 sku_code 字段</span>}</p>
            <p><strong>当前库位:</strong> {selectedLocation?.location_code || '未知'}</p>
            <p><strong>当前数量:</strong> {(editingItem?.stock_quantity ?? editingItem?.quantity ?? 0)} 件</p>
            
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
                  .filter(loc => loc.value !== (selectedLocation?.location_code || locationDetail?.location_code)) // 排除当前库位
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
            <p><strong>商品:</strong> {editingItem.sku_code !== undefined && editingItem.sku_code !== null && editingItem.sku_code !== '' ? editingItem.sku_code : <span style={{color: 'red'}}>缺少 sku_code 字段</span>}</p>
            <p><strong>当前库位:</strong> {selectedLocation?.location_code || '未知'}</p>
            <p><strong>当前数量:</strong> {(editingItem.stock_quantity ?? editingItem.quantity ?? 0)} 件</p>
            
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
        title={`上架到 ${selectedLocation?.location_code || '库位'}`}
        open={addProductVisible}
        onCancel={() => setAddProductVisible(false)}
        footer={null}
        centered
      >
        <div>
          <div style={{ marginBottom: 12, fontWeight: 'bold' }}>无货位商品：</div>
          {noLocationItems.length === 0 ? (
            <div style={{ color: '#999', marginBottom: 16 }}>暂无无货位商品</div>
          ) : (
            noLocationItems.map(item => (
              <div
                key={item.sku_code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 8,
                  background: selectedNoLocItem && selectedNoLocItem.sku_code === item.sku_code ? '#e6f7ff' : '#fff',
                  borderRadius: 4,
                  padding: 4,
                  cursor: 'pointer',
                  border: selectedNoLocItem && selectedNoLocItem.sku_code === item.sku_code ? '2px solid #1890ff' : '1px solid #eee'
                }}
                onClick={() => {
                  setSelectedNoLocItem(item);
                  setSelectedProduct(item);
                  setSelectedSku({
                    sku_code: item.sku_code,
                    sku_color: item.sku_color,
                    sku_size: item.sku_size
                  });
                  setAddQuantity(item.stock_quantity);
                }}
              >
                <img
                  src={item.image_path || '/no-image.png'}
                  alt="SKU"
                  style={{ width: 40, height: 40, objectFit: 'cover', marginRight: 8, borderRadius: 4, border: '1px solid #eee' }}
                  onError={e => { e.target.src = '/no-image.png'; }}
                />
                <span style={{ flex: 1 }}>{item.product_name || item.product_code} | {item.sku_code} | 库存: {item.stock_quantity}</span>
              </div>
            ))
          )}
          {/* 选中SKU后显示数量输入和上架按钮 */}
          {selectedNoLocItem && (
            <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <div style={{ marginBottom: 8 }}>上架SKU: <b>{selectedNoLocItem.sku_code}</b></div>
              <div style={{ marginBottom: 8 }}>可上架数量: <b>{selectedNoLocItem.stock_quantity}</b></div>
              <InputNumber
                min={1}
                max={selectedNoLocItem.stock_quantity}
                value={addQuantity}
                onChange={value => {
                  if (value > selectedNoLocItem.stock_quantity) {
                    setAddQuantity(selectedNoLocItem.stock_quantity);
                  } else {
                    setAddQuantity(value);
                  }
                }}
                style={{ width: 120, marginRight: 12 }}
                placeholder="请输入上架数量"
              />
              <Button type="primary" onClick={async () => {
                if (addQuantity > selectedNoLocItem.stock_quantity) {
                  message.error('上架数量不能大于无货位库存');
                  return;
                }
                try {
                  setLoading(true);
                  const toLocationCode = selectedLocation.location_code || locationDetail?.location_code || selectedLocation.location_code;
                  const fromLocationCode = '无货位';
                  const transferData = {
                    sku_code: selectedNoLocItem.sku_code,
                    from_location_code: fromLocationCode,
                    to_location_code: toLocationCode,
                    transfer_quantity: Number(addQuantity),
                    operator_id: currentUser.user_id,
                    notes: '上架操作'
                  };
                  await api.post('/inventory/transfer', transferData);
                  message.success('上架成功');
                  setAddProductVisible(false);
                  setSelectedNoLocItem(null);
                  setAddQuantity(1);
                  const updatedDetail = await fetchLocationDetail(toLocationCode);
                  setLocationDetail(updatedDetail);
                  await fetchLocations();
                } catch (error) {
                  message.error('上架失败: ' + (error.response?.data?.message || error.message));
                } finally {
                  setLoading(false);
                }
              }}>上架</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* 件数区间输入弹窗 */}
      <Modal
        title="设置件数区间"
        open={quantityRangeInputVisible}
        onCancel={() => setQuantityRangeInputVisible(false)}
        onOk={() => {
          // 更新显示文本
          let rangeText = '未指定';
          if (quantityRangeMin !== '' || quantityRangeMax !== '') {
            if (quantityRangeMin !== '' && quantityRangeMax !== '') {
              rangeText = `${quantityRangeMin}-${quantityRangeMax}件`;
            } else if (quantityRangeMin !== '') {
              rangeText = `≥${quantityRangeMin}件`;
            } else if (quantityRangeMax !== '') {
              rangeText = `≤${quantityRangeMax}件`;
            }
          }
          setQuantityRange(rangeText);
          setQuantityRangeInputVisible(false);
        }}
        okText="确定"
        cancelText="取消"
        centered
        width={300}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              最小件数：
            </label>
            <InputNumber
              min={0}
              value={quantityRangeMin !== '' ? parseInt(quantityRangeMin) : undefined}
              onChange={(value) => setQuantityRangeMin(value !== null && value !== undefined ? value.toString() : '')}
              placeholder="不限制"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              最大件数：
            </label>
            <InputNumber
              min={0}
              value={quantityRangeMax !== '' ? parseInt(quantityRangeMax) : undefined}
              onChange={(value) => setQuantityRangeMax(value !== null && value !== undefined ? value.toString() : '')}
              placeholder="不限制"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>• 留空表示不限制</div>
            <div>• 可以只设置最小值或最大值</div>
            <div>• 设置范围会筛选货位的总件数</div>
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