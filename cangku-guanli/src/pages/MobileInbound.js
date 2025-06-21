import React, { useEffect, useState, useCallback } from 'react';
import { Button, Input, message, List, Form, Select, Modal, Typography } from 'antd';
import { showResultModal } from '../components/ResultModal';
const { Text } = Typography;
import { SyncOutlined } from '@ant-design/icons';
import * as api from '../api/request';
import { getCurrentUser } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';
import theme, { getStyle, messageConfig } from '../styles/theme';
import { getCache, setCache } from '../utils/cacheUtils';
import InboundItemCard from '../components/InboundItemCard';

const { Option } = Select;

const MobileInbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  // 添加状态用于商品搜索和下拉显示
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [previewImage, setPreviewImage] = useState(null);
  
  const [loadingLocations, setLoadingLocations] = useState(false);
  
  // 计算是否可以提交：至少一个条目且每条必填字段完整
  const canSubmit = tableData.length > 0 && tableData.every(it => it.sku_code && it.location_code && it.stock_quantity > 0);
  
  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    message.success({
      content: '退出成功',
      icon: messageConfig.success.icon
    });
    navigate('/login');
  };
  
  // 获取所有库位
  const fetchLocations = async (forceRefresh = false) => {
    try {
      // 如果不是强制刷新，先尝试从缓存获取
      if (!forceRefresh) {
        const cachedLocations = getCache('locations');
        if (cachedLocations) {
          console.log('从缓存获取库位信息');
          setLocationOptions(cachedLocations);
          return;
        }
      }

      // 缓存不存在或强制刷新时，从服务器获取
      setLoadingLocations(true);
              const response = await api.get('/api/inventory/location');
      if (response?.data?.success) {
        const locations = response.data.data || [];
        // 创建库位选项并插入"无货位"
        const allOptions = [
          { value: "无货位", label: "无货位" },
          ...locations.map(loc => ({
            value: loc.location_code,
            label: `${loc.location_code}${loc.items?.length ? ` (${loc.items.length}个SKU)` : ''}`
          }))
        ];
        
        // 更新状态并缓存数据
        setLocationOptions(allOptions);
        setCache('locations', allOptions);
        console.log('库位信息已更新并缓存');
      }
    } catch (error) {
      console.error('获取库位失败:', error);
      message.error('获取库位失败');
      
      // 如果请求失败，尝试使用缓存数据
      const cachedLocations = getCache('locations');
      if (cachedLocations) {
        console.log('使用缓存的库位信息');
        setLocationOptions(cachedLocations);
      }
    } finally {
      setLoadingLocations(false);
    }
  };
  
  // 页面加载时获取库位和用户信息
  useEffect(() => {
    fetchLocations();
    fetchCurrentUser();
  }, []);
  
  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      navigate('/login');
    }
  };
  
  // 添加点击外部区域关闭下拉菜单的处理
  useEffect(() => {
    const handleClickOutside = (event) => {
      const suggestionsElement = document.getElementById('product-suggestions');
      const inputElement = document.getElementById('scanInput');
      
      if (
        suggestionsElement && 
        !suggestionsElement.contains(event.target) && 
        inputElement && 
        !inputElement.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 移除商品
  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
    message.success({
      content: '已移除',
      icon: messageConfig.success.icon
    });
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
      // 获取所有产品，确保包含完整信息
      const response = await api.get('/products/');
      const products = response.data;
      
      // 首先检查是否有完全匹配的商品
      const exactMatch = products.filter(p => p.code === value);
      if (exactMatch.length > 0) {
        // 如果有精确匹配，对每个匹配的产品获取完整信息
        for (let i = 0; i < exactMatch.length; i++) {
          try {
            const detailResponse = await api.get(`/products/code/${exactMatch[i].code}`);
            // 用详细信息替换原有信息
            exactMatch[i] = detailResponse.data;
          } catch (error) {
            console.error(`获取商品 ${exactMatch[i].code} 详情失败:`, error);
          }
        }
      }
      
      // 查找匹配的产品 - 完全匹配、开头匹配、包含匹配
      const startsWith = products.filter(p => p.code.startsWith(value) && p.code !== value);
      const contains = products.filter(p => p.code.includes(value) && !p.code.startsWith(value));
      
      // 按优先级合并结果
      const suggestions = [
        ...exactMatch,
        ...startsWith,
        ...contains
      ].slice(0, 10); // 最多显示10个建议
      
      setProductSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('搜索商品失败:', error);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // 修改输入处理函数，移除实时搜索
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputCode(value);
  };

  // 处理回车事件
  const handlePressEnter = () => {
    handleScan();
  };

  // 处理扫描
  const handleScan = useCallback(async () => {
    const rawCode = inputCode.trim();
    if (!rawCode) {
      message.warning('请输入商品条码');
      return;
    }
    
    // === 若已存在同 SKU，直接累加数量 ===
    const sameIdx = tableData.findIndex(it => it.display_code === rawCode);
    if (sameIdx !== -1) {
      setTableData(prev => prev.map((it, idx) => idx === sameIdx ? { ...it, stock_quantity: (it.stock_quantity || 0) + 1 } : it));
      setInputCode('');
      return;
    }
    
    try {
      setLoading(true);
      
      // 然后查询商品信息
      let productData = null;
      try {
        // 1) 若含 '-' 当作 SKU 直接查 /products/code
        if (rawCode.includes('-')) {
          const skuRes = await api.get(`/api/products/code/${rawCode}`);
          productData = skuRes?.data?.data;
        } else {
          // 2) 先查商品码
          const prodRes = await api.get(`/api/products/code/${rawCode}`);
          productData = prodRes?.data?.data;
        }
      } catch (err) {
        if (err.response && err.response.status === 404 && !rawCode.includes('-')) {
          // 3) 商品码404时查外部条码
          try {
            const extRes = await api.get(`/api/products/external-code/${rawCode}`);
            productData = extRes?.data?.data;
          } catch (err2) {
            // 外部条码也404
          }
        }
      }

      if (!productData) {
        message.info('未找到商品信息，可继续添加');
        return;
      }

      const product = productData;  // 统一变量名
      let colorsArray = Array.isArray(product.colors) ? product.colors : [];
      if (colorsArray.length === 0 && Array.isArray(product.skus)) {
        // 根据 skus 组装 colors / sizes 结构（仍使用后台数据）
        const map = {};
        product.skus.forEach(sku => {
          const col = sku.sku_color || '默认颜色';
          if (!map[col]) map[col] = { color: col, image_path: sku.image_path || '', sizes: [] };
          map[col].sizes.push({
            sku_size: sku.sku_size,
            sku_code: sku.sku_code,
            sku_total_quantity: sku.stock_quantity || 0,
            locations: []
          });
        });
        colorsArray = Object.values(map);
      }
      console.log('Product data:', product);

      // 处理颜色选项
      const colorOptions = colorsArray.map(color => ({
        label: color.color,
        value: color.color,
        image_path: color.image_path || ''
      }));
      // 处理尺码选项
      const sizeOptions = {};
      colorsArray.forEach(color => {
        const sizesArray = Array.isArray(color.sizes)
          ? color.sizes
          : Object.values(color.sizes || {});
        if (sizesArray.length > 0) {
          sizeOptions[color.color] = sizesArray.map(size => ({
            label: `${size.sku_size} (${size.sku_code})`,
            value: size.sku_code,
            size: size.sku_size,
            sku_total_quantity: size.sku_total_quantity,
            locations: size.locations || []
          }));
        }
      });

      // === 自动选中颜色和尺码逻辑 ===
      let autoColor = null;
      let autoSkuCode = null;
      let autoSize = null;
      let autoLocation = selectedLocation || "无货位";
      
      // 1. 如果API返回了matched_sku（SKU编码查询 或 SKU级外部条码查询）
      if (product.matched_sku) {
        autoColor = product.matched_sku.sku_color;
        autoSkuCode = product.matched_sku.sku_code;
        autoSize = product.matched_sku.sku_size;
        // 查找库位信息
        const locArr = sizeOptions[autoColor]?.find(sz => sz.value === autoSkuCode)?.locations;
        if (locArr && locArr.length === 1) {
          autoLocation = locArr[0].location_code;
        }
      }
      // 2. 如果原始扫描是完整SKU格式（包含'-'）
      else if (rawCode.includes('-')) {
        const parts = rawCode.split('-');
        if (parts.length >= 3) {
          autoColor = parts[1];
          autoSkuCode = rawCode;
          autoSize = parts.slice(2).join('-');
          // 如果在 sizeOptions 中找得到该 SKU 的库存地点，则默认第一个库位
          const locArr = sizeOptions[autoColor]?.find(sz => sz.value === autoSkuCode)?.locations;
          if (locArr && locArr.length === 1) {
            autoLocation = locArr[0].location_code;
          }
        }
      }

      // === 构建待插入的商品条目 ===
      const itemObj = {
        key: `${rawCode}-${Date.now()}`,
        product_code: product.product_code,
        display_code: autoSkuCode || rawCode,
        product_name: product.product_name || '未知商品',
        unit: product.unit || '件',
        stock_quantity: 1,
        location_code: autoLocation,
        product_id: product.product_id,
        location_id: null,
        image_path: product.image_path || '',
        sku_code: autoSkuCode,
        sku_color: autoColor,
        sku_size: autoSize,
        status: 'found',
        colorOptions,
        sizeOptions,
        colors: colorsArray
      };

      setTableData(prev => [...prev, itemObj]);
      setInputCode('');
      message.success('已找到商品信息');
    } catch (error) {
      console.error('查询商品信息失败:', error);
      message.error('查询商品信息失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  }, [inputCode, selectedLocation]);

  // 处理颜色变更
  const handleColorChange = (key, color) => {
    console.log('Color Change:', color);
    setTableData(prev => prev.map(item => {
      if (item.key === key) {
        const colorObj = (item.colors || []).find(c => c.color === color);
        return {
          ...item,
          sku_color: color,
          sku_code: null,
          sku_size: null,
          image_path: colorObj?.image_path || item.image_path,
          location_code: selectedLocation || "无货位"
        };
      }
      return item;
    }));
  };

  // 处理SKU变更
  const handleSkuChange = (key, skuCode) => {
    console.log('SKU Change:', skuCode);
    setTableData(prev => prev.map(item => {
      if (item.key === key) {
        const selectedColor = item.colors.find(c => 
          Object.values(c.sizes || {}).some(s => s.sku_code === skuCode)
        );
        
        if (selectedColor) {
          const selectedSize = Object.values(selectedColor.sizes || {}).find(s => 
            s.sku_code === skuCode
          );
          
          if (selectedSize) {
            console.log('Selected Size:', selectedSize);
            return {
              ...item,
              sku_code: skuCode,
              sku_size: selectedSize.sku_size,
              display_code: skuCode, // 显示完整SKU
              image_path: selectedColor.image_path || item.image_path,
              location_code: selectedSize.locations?.length === 1 
                ? selectedSize.locations[0].location_code 
                : selectedLocation || "无货位"
            };
          }
        }
      }
      return item;
    }));
  };

  // 处理货位变更
  const handleLocationChange = (key, locationCode) => {
    setTableData(prev => prev.map(item => {
      if (item.key === key) {
        return {
          ...item,
          location_code: locationCode
        };
      }
      return item;
    }));
  };

  // 处理数量变更
  const handleQuantityChange = (key, value) => {
    setTableData(prev => prev.map(item => {
      if (item.key === key) {
        return { ...item, stock_quantity: value };
      }
      return item;
    }));
  };

  // 确认入库
  const handleSubmit = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    
    try {
      setLoading(true);
      
      // 执行入库操作
      for (const item of tableData) {
        if (!item.product_id || !item.location_code || !item.sku_code) {
          message.warning(`商品 ${item.product_name} 信息不完整，请检查`);
          continue;
        }

        const inboundData = {
          sku_code: item.sku_code,
          location_code: item.location_code === "无货位" ? "无货位" : item.location_code,
          inbound_quantity: Number(item.stock_quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端入库操作'
        };
        
        const resp = await api.post('/inbound/', inboundData);

        const inventoryObj = resp.data?.inventory || resp.data?.data;
        if (inventoryObj) {
          const { sku_location_quantity, sku_total_quantity, inbound_quantity, sku_code } = inventoryObj;
          showResultModal({
            success: true,
            operation: '入库',
            sku_code: sku_code || item.sku_code,
            operation_quantity: inbound_quantity || Number(item.stock_quantity),
            sku_location_quantity,
            sku_total_quantity,
          });
        } else {
          showResultModal({
            success: true,
            operation: '入库',
            sku_code: item.sku_code,
            operation_quantity: Number(item.stock_quantity),
          });
        }
      }
      setTableData([]);
    } catch (e) {
      console.error('入库失败:', e);
      const errorMsg = e.response?.data?.error_message || e.response?.data?.message || e.message || '未知错误';
      showResultModal({
        success: false,
        operation: '入库',
        sku_code: tableData.length === 1 ? tableData[0]?.sku_code : '',
        error_message: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // 刷新库位列表
  const handleRefreshLocations = () => {
    fetchLocations(true);
  };

  return (
    <div style={{ padding: '8px' }}>
      <MobileNavBar currentPage="inbound" />
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px' 
      }}>
        
        <div style={{ marginBottom: '10px' }}>
          <div style={{ 
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <Input
              placeholder="扫描商品条码或手动输入"
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              onPressEnter={handleScan}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              onClick={handleScan}
              loading={loading}
              style={{ minWidth: '80px' }}
            >
              确认
            </Button>
          </div>
        </div>

        {/* 3. 商品列表表头和操作区 */}
        <div style={{ 
          padding: '2px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Text strong style={{ fontSize: '16px' }}>入库商品({tableData.length})</Text>
          
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            justifyContent: 'flex-end'
          }}>
            <Button 
              type="primary"
              size="middle"
              disabled={!canSubmit}
              style={{
                borderRadius: '4px',
                fontWeight: 'normal',
                opacity: canSubmit ? 1 : 0.4
              }}
              onClick={handleSubmit}
            >
              确认入库
            </Button>
            
            <Select
              mode="tags"
              placeholder="选择或输入入库库位"
              style={{ 
                width: '150px',
                borderRadius: '4px'
              }}
              value={selectedLocation ? [selectedLocation] : []}
              onChange={(val) => {
                const value = val[val.length - 1];
                setSelectedLocation(value);
              }}
              options={locationOptions}
              size="middle"
            />
          </div>
        </div>

        {/* 5. 商品列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <List
            dataSource={tableData}
            renderItem={(item) => (
              <InboundItemCard
                key={item.key}
                item={item}
                locationOptions={locationOptions}
                onColorChange={handleColorChange}
                onSkuChange={handleSkuChange}
                onLocationChange={handleLocationChange}
                onQuantityChange={handleQuantityChange}
                onDelete={handleDelete}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default MobileInbound; 
