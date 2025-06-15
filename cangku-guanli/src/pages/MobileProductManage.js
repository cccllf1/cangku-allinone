import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Modal, Form, Switch, Select, Upload, Tabs, Badge, Tag, Popconfirm, InputNumber, Image, Collapse, Dropdown, Menu } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PictureOutlined, SaveOutlined, SearchOutlined, LinkOutlined, ScanOutlined, CloseOutlined, ArrowRightOutlined, InboxOutlined, ExportOutlined, RedoOutlined, WarningOutlined, SettingOutlined, DownOutlined, SwapOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';
import { getFullImageUrl } from '../utils/imageUtils';

const { TabPane } = Tabs;
const { Option } = Select;

// 默认颜色选项
const DEFAULT_COLORS = [
  '黑色', '白色', '红色', '蓝色', '绿色', '黄色', 
  '紫色', '粉色', '灰色', '棕色', '橙色', '米色'
];

// 默认尺码选项
const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];

// 排序尺码选项，优先按标准顺序，其余排后
const STANDARD_SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
function sortSizes(sizes) {
  return sizes.slice().sort((a, b) => {
    const ia = STANDARD_SIZE_ORDER.indexOf(a);
    const ib = STANDARD_SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Helper function to generate SKU code dynamically
const generateDynamicSkuCode = (baseProductCode, color, size, formInstance) => {
  console.log(`[[ SKU GEN ]] BaseCode: ${baseProductCode}, Color: ${color}, Size: ${size}`);
  const pCode = baseProductCode || (formInstance ? formInstance.getFieldValue('code') : '') || 'SKU_FALLBACK';
  const c = color || 'COLOR_FALLBACK';
  const s = size || 'SIZE_FALLBACK';
  const result = `${pCode}-${c}-${s}`;
  console.log(`[[ SKU GEN ]] Result: ${result}`);
  return result;
};

// 根据颜色名称返回对应的背景色
const getColorBackground = (colorName) => {
  const colorMap = {
    '黄色': '#fff9c4',
    '绿色': '#d9f7be', 
    '粉色': '#ffadd2',
    '蓝色': '#bae7ff',
    '黑色': '#f0f0f0',
    '卡其色': '#f6ffed',
    '红色': '#ffccc7',
    '白色': '#ffffff',
    '灰色': '#f5f5f5',
    '默认颜色': '#f0f0f0'
  };
  return colorMap[colorName] || '#f0f0f0';
};

const MobileProductManage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [skus, setSkus] = useState([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [skuDetailVisible, setSkuDetailVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [colorOptions, setColorOptions] = useState(DEFAULT_COLORS);
  const [sizeOptions, setSizeOptions] = useState(DEFAULT_SIZES);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const navigate = useNavigate();

  // 添加入库和出库相关状态
  const [warehouseActionVisible, setWarehouseActionVisible] = useState(false);
  const [warehouseActionType, setWarehouseActionType] = useState(''); // 'inbound' 或 'outbound'
  const [selectedSku, setSelectedSku] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 新增库存映射
  const [skuInventoryMap, setSkuInventoryMap] = useState({});

  // 新增产品库存映射
  const [productInventoryMap, setProductInventoryMap] = useState({});

  // 新增：用于记录当前展开的SKU code
  const [expandedSkuKey, setExpandedSkuKey] = useState(null);

  // 新增：用于记录产品统计信息
  const [productStatsMap, setProductStatsMap] = useState({});

  // 新增：用于记录SKU与货位的映射
  const [rowLocationMap, setRowLocationMap] = useState({});

  // 控制哪条 SKU|库位 行显示操作按钮
  const [actionVisibleKey, setActionVisibleKey] = useState(null);

  // 新增：用于记录当前库存
  const [currentStock, setCurrentStock] = useState(0);

  // 新增：用于记录删除模态框中的产品
  const [deleteModalProduct, setDeleteModalProduct] = useState(null);

  // 加载所有产品和自定义设置
  useEffect(() => {
    // fetchProducts(); // 已由 /inventory/by-product 代替
    loadCustomSettings();
    // 拉取库存
    api.get('inventory/by-product', { params: { page: 1, pageSize: 1000 } }).then(res => {
      const list = res.data.data || [];
      const map = {};
      const stats = {};
      list.forEach(prod => {
        let total = 0;
        (prod.colors || []).forEach(col => {
          (col.sizes || []).forEach(sz => {
            total += sz.total_qty || 0;
          });
        });
        map[prod.product_code] = total;
        stats[prod.product_code] = {
          total_qty: prod.total_qty || total,
          sku_count: prod.sku_count || 0,
          color_count: prod.color_count || 0,
          location_count: prod.location_count || 0
        };
      });
      setProductInventoryMap(map);
      setProductStatsMap(stats);
      setProducts(list);
      setFilteredProducts(list);
    }).catch(err => {
      console.error('获取库存数据失败:', err);
    });
  }, []);
  
  // 加载自定义设置
  const loadCustomSettings = () => {
    try {
      // 从localStorage中获取设置，如果有则更新
      const savedColors = localStorage.getItem('productColors');
      const savedSizes = localStorage.getItem('productSizes');
      const savedCategories = localStorage.getItem('productCategories');
      
      if (savedColors) {
        setColorOptions(JSON.parse(savedColors));
      }
      
      if (savedSizes) {
        setSizeOptions(JSON.parse(savedSizes));
      }

      if (savedCategories) {
        setCategoryOptions(JSON.parse(savedCategories));
      } else {
        // 默认分类
        setCategoryOptions(['衣服', '裤子', '上衣', '套装', '外套', '连衣裙', '半身裙', '短裤']);
      }
    } catch (error) {
      console.error('加载自定义设置失败:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products/');
      const productsData = response.data.data || []; // 修复：使用正确的响应字段
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error('获取产品失败:', error);
      message.error('获取产品失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索产品
  const handleSearch = () => {
    if (!searchValue) {
      setFilteredProducts(products);
      return;
    }
    
    const filtered = products.filter(product => 
      (product.product_name && product.product_name.toLowerCase().includes(searchValue.toLowerCase())) || 
      (product.product_code && product.product_code.toLowerCase().includes(searchValue.toLowerCase()))
    );
    
    setFilteredProducts(filtered);
    
    if (filtered.length === 0) {
      message.info('没有找到匹配的产品');
    }
  };

  // 显示产品表单
  const showProductForm = (product = null) => {
    if (product && (product._id || product.product_id || product.id)) {
      const currentRecord = { 
        ...product, 
        _id: product._id || product.product_id || product.id,
        product_id: product._id || product.product_id || product.id
      };
      setCurrentProduct(currentRecord);
      setEditing(currentRecord); // 设置编辑状态
      console.log('Setting editing state:', currentRecord); // Debug log
    } else {
      setCurrentProduct(null);
      setEditing(null); // 清除编辑状态
    }
    
    if (product) {
      form.setFieldsValue({
        name: product.product_name,
        code: product.product_code,
        unit: product.unit,
        description: product.description,
        category: product.category && product.category.length > 0 ? product.category : ['衣服'],
      });
      
      // 转换SKU为按颜色分组的结构
      if (product.skus && Array.isArray(product.skus)) {
        // 按颜色分组SKU
        const groupedSkus = [];
        const colorGroups = {};
        
        product.skus.forEach(sku => {
          // 如果sku_color为空，尝试从sku_code中解析
          let color = sku.sku_color;
          let size = sku.sku_size;
          
          if (!color || color.trim() === '' || !size || size.trim() === '') {
            // 从SKU编码中解析颜色和尺寸 (格式: productCode-color-size)
            const parts = (sku.sku_code || '').split('-');
            if (parts.length >= 3) {
              color = (!color || color.trim() === '') ? parts[1] : color;
              size = (!size || size.trim() === '') ? parts[2] : size;
            }
          }
          
          color = color && color.trim() !== '' ? color : '默认颜色';
          size = size && size.trim() !== '' ? size : '默认尺码';
          
          if (!colorGroups[color]) {
            const colorImage = sku.image_path || '';
            console.log(`[[ LOAD ]] Creating color group for ${color}: sku.image_path=${sku.image_path}, final colorImage=${colorImage}`);
            colorGroups[color] = {
              color: color,
              image_path: colorImage,
              sizes: []
            };
            groupedSkus.push(colorGroups[color]);
          }
          
          colorGroups[color].sizes.push({
            size: size,
            code: sku.sku_code,
            locations: sku.locations || []
          });
        });
        
        setSkus(groupedSkus);
      } else {
        setSkus([]);
      }
    } else {
      form.resetFields();
      setSkus([]);
    }
    
    setModalVisible(true);
  };

  // 处理表单提交
  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      
      if (!values.name || values.name.trim() === '') {
        values.name = values.code;
      }
      
      let flatSkus = [];

      skus.forEach((colorGroup, index) => {
        colorGroup.sizes.forEach(sizeItem => {
          flatSkus.push({
            sku_code: sizeItem.code,
            sku_color: colorGroup.color,
            sku_size: sizeItem.size,
            image_path: colorGroup.image_path || '',
            locations: sizeItem.locations || []
          });
        });
      });

      const data = {
        code: values.code,
        name: values.name,
        unit: values.unit,
        skus: flatSkus,
        description: values.description
      };

      console.log('[[ SUBMIT ]] Final data:', data);

      if (editing && (editing._id || editing.product_id)) {
        const productId = editing._id || editing.product_id;
        console.log('Using PUT request with ID:', productId);
        await api.put(`/products/${productId}`, data);
        message.success('产品已更新');
      } else {
        console.log('Using POST request (creating new product)');
        await api.post('/products', data);
        message.success('产品已创建');
      }
      
      setModalVisible(false);
      // fetchProducts(); // 刷新产品列表已由 inventory 聚合实现，上行调用移除
    } catch (error) {
      console.error('提交失败:', error);
      message.error('提交失败: ' + (error.response?.data?.error_message || error.message));
    } finally {
      setConfirmLoading(false);
    }
  };

  // 打开SKU详情弹窗时加载库存
  const showSkuDetail = async (product, e) => {
    if (e) e.stopPropagation();
    
    try {
      console.log('[[ SKU DETAIL ]] Starting showSkuDetail for product:', product.product_code);
      
      // 仅查询该商品的聚合库存数据（颜色 → 尺码 → 库位）
      const res = await api.get('inventory/by-product', { params: { code: product.product_code } });
      const productAggArr = res.data.data || [];
      const productAgg = productAggArr[0];
      const inventoryList = []; // 不再用
      
      console.log('[[ SKU DETAIL ]] Colors returned:', productAgg?.colors?.length || 0);
      
      // 由返回结果直接构造 map（sku_code → total_qty）以及 imageMap
      const map = {};
      const imageMap = {};
      if (productAgg && productAgg.colors) {
        productAgg.colors.forEach(col => {
          col.sizes.forEach(sz => {
            map[sz.sku_code] = sz.total_qty;
            imageMap[sz.sku_code] = col.image_path;
          });
        });
      }
      
      // 在聚合模式下直接把颜色结构转换为 skusToShow
      if (productAgg && productAgg.colors) {
        const skusToShow = [];
        productAgg.colors.forEach(col => {
          col.sizes.forEach(sz => {
            skusToShow.push({
              sku_code: sz.sku_code,
              sku_color: col.color,
              sku_size: sz.size,
              image_path: col.image_path || '',
              locations: sz.locations || []
            });
          });
        });

        const productWithSkus = {
          ...product,
          skus: skusToShow
        };
        setSelectedProduct(productWithSkus);
        setSkuDetailVisible(true);
        setSkuInventoryMap(map);
        return; // 结束
      }
    } catch (err) {
      console.error('获取SKU详情失败:', err);
      message.error('获取SKU详情失败');
      setSkuInventoryMap({});
    }
  };

  // 获取所有库位
  const fetchLocations = async (defaultLoc = null) => {
    try {
      setLoadingLocations(true);
      const response = await api.get('/locations/');
      const locations = response.data.data || []; // 修复：使用正确的响应字段
      // 创建库位选项并插入"无货位"
      const allOptions = [
        { value: "无货位", label: "无货位" },
        ...locations.map(loc => ({
          value: loc.location_code || loc.code || '',
          label: loc.location_code || loc.code || ''
        }))
      ];
      // 如果指定了默认库位且列表中没有，插入
      if (defaultLoc && !allOptions.some(opt => opt.value === defaultLoc)) {
        allOptions.unshift({ value: defaultLoc, label: defaultLoc });
      }
      // 去重，确保"无货位"只出现一次
      const uniqueOptions = Array.from(new Map(allOptions.map(i => [i.value, i])).values());
      setLocationOptions(uniqueOptions);
      setLoadingLocations(false);
    } catch (error) {
      console.error('获取库位失败:', error);
      message.error('获取库位失败');
      setLoadingLocations(false);
    }
  };
  
  // 显示入库/出库操作模态框
  const showWarehouseAction = (type, sku, defaultLoc = '无货位') => {
    setWarehouseActionType(type);
    setSelectedSku(sku);
    if (type === 'adjust') {
      // 盘点不允许切换库位，直接锁定当前库位
      const cur = sku?.currentStock ?? 0;
      setCurrentStock(cur);
      setQuantity(cur);
      setSelectedLocation(defaultLoc);
      setLocationOptions([{ value: defaultLoc, label: defaultLoc }]);
    } else if (type === 'outbound' && sku && sku.code) {
      // 只显示该 SKU 有库存的库位
      const pcode = sku.code.split('-')[0];
      api.get('inventory/by-product', { params: { code: pcode } }).then(res => {
        const prodData = (res.data.data || [])[0];
        const availableLocations = [];
        if (prodData && prodData.colors) {
          prodData.colors.forEach(col => {
            col.sizes.forEach(sz => {
              if (sz.sku_code === sku.code) {
                (sz.locations || []).forEach(loc => {
                  if (loc.stock_quantity > 0) {
                    availableLocations.push({
                      value: loc.location_code,
                      label: `${loc.location_code}（库存: ${loc.stock_quantity}）`
                    });
                  }
                });
              }
            });
          });
        }
        if (availableLocations.length === 0) {
          availableLocations.push({ value: '', label: '无可出库的库位', disabled: true });
        }
        setLocationOptions(availableLocations);
        setSelectedLocation(availableLocations[0]?.value || '');
      });
    } else {
      // 入库或其他情况，显示全部库位
      fetchLocations(defaultLoc);
    }
    // 折叠当前展开行，避免按钮区保持展开
    setExpandedSkuKey(null);
    setWarehouseActionVisible(true);
    setActionVisibleKey(null);
    // 非 adjust 时重置当前库存和数量默认值
    if (type !== 'adjust') {
      setCurrentStock(0);
      setQuantity(1);
      setSelectedLocation(defaultLoc);
    }
  };
  
  // 执行入库/出库操作
  const handleWarehouseAction = async () => {
    if (!selectedSku || !selectedLocation) {
      message.warning('请选择SKU和货位');
      return;
    }
    if (warehouseActionType !== 'adjust' && quantity <= 0) {
      message.warning('数量必须大于0');
      return;
    }
    console.log('[[ WAREHOUSE ACTION ]] Attempting action:', warehouseActionType, 'SKU:', selectedSku, 'Qty:', quantity, 'Loc:', selectedLocation);
    try {
      setLoading(true); // Start loading indicator for warehouse action

      // ① 直接尝试从已选商品中读取 product_id，减少一次请求
      const fallbackProductCode = selectedSku.code.split('-')[0];
      let productId = selectedProduct?.product_id || null;
      let productName = selectedProduct?.product_name || fallbackProductCode;

      // ② 如果本地没有 product_id，再去调用 /products/code/:code 获取
      if (!productId) {
        console.log('[[ WAREHOUSE ACTION ]] product_id 在本地数据缺失，开始调用 /products/code/', fallbackProductCode);
        const response = await api.get(`/products/code/${fallbackProductCode}`);
        const product = response.data.data;
        if (!product || !product.product_id) {
          message.error('找不到对应的产品或产品ID无效');
          console.error('[[ WAREHOUSE ACTION ]] Product not found or product ID missing. Product data:', product);
          setLoading(false);
          return;
        }
        productId = product.product_id;
        productName = product.product_name || fallbackProductCode;
      }

      console.log('[[ WAREHOUSE ACTION ]] Using productId:', productId);
      const payload = {
        product_id: productId,
        location_code: selectedLocation,
        quantity,
        stock_quantity: quantity,
        sku_code: selectedSku.code,
        sku_color: selectedSku.color,
        sku_size: selectedSku.size
      };
      console.log('[[ WAREHOUSE ACTION ]] Payload for API:', payload);
      let actionEndpoint = '/outbound/';
      if (warehouseActionType === 'inbound') {
        actionEndpoint = '/inbound/';
      } else if (warehouseActionType === 'adjust') {
        payload.product_code = fallbackProductCode; // adjust 接口使用 product_code
        const diff = quantity - currentStock;
        if (diff === 0) {
          message.info('库存数量未变化，无需盘点调整');
          setLoading(false);
          setWarehouseActionVisible(false);
          return;
        }
        payload.stock_quantity = diff; // 差异数（新-旧）
        // 保留 product_id 以满足后端必填
        actionEndpoint = '/inventory/adjust';
      }
      await api.post(actionEndpoint, payload);
      let actionText = '出库';
      if (warehouseActionType === 'inbound') actionText = '入库';
      else if (warehouseActionType === 'adjust') actionText = '盘点调整';
      message.success({
        content: `已${actionText}: ${productName} (${selectedSku.code}) ${quantity}件 ${warehouseActionType === 'inbound' ? '到' : warehouseActionType === 'outbound' ? '从' : '于'} ${selectedLocation}`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
      setWarehouseActionVisible(false);
      // === 本地乐观更新，立即刷新数量显示 ===
      if (selectedProduct) {
        const diffVal = warehouseActionType === 'inbound' ? quantity : warehouseActionType === 'outbound' ? -quantity : (warehouseActionType === 'adjust' ? (quantity - currentStock) : 0);
        if (diffVal !== 0) {
          // 更新 skuInventoryMap
          setSkuInventoryMap(prev => ({
            ...prev,
            [selectedSku.code]: (prev[selectedSku.code] || 0) + diffVal
          }));

          // 更新 selectedProduct -> 对应库位库存
          setSelectedProduct(prevProd => {
            if (!prevProd) return prevProd;
            const prod = JSON.parse(JSON.stringify(prevProd));
            const skuItem = prod.skus.find(s => s.sku_code === selectedSku.code);
            if (skuItem) {
              let locItem = skuItem.locations.find(l => l.location_code === selectedLocation);
              if (!locItem) {
                // 入库时可能新增库位
                locItem = { location_code: selectedLocation, stock_quantity: 0 };
                skuItem.locations.push(locItem);
              }
              locItem.stock_quantity = Math.max(0, (locItem.stock_quantity || 0) + diffVal);
            }
            return prod;
          });
        }
      }
    } catch (error) {
      console.error('[[ WAREHOUSE ACTION ]] 操作失败:', error.response || error);
      message.error(`${warehouseActionType === 'inbound' ? '入库' : '出库'}失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    } finally {
      setLoading(false); // Stop loading indicator for warehouse action
    }
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ has_sku: true, code: '', name: '', unit: '件', description: '', category: ['衣服'] });
    setSkus([
      {
        color: '本色',
        image_path: '',
        sizes: [
          {
            size: '均码',
            code: generateDynamicSkuCode('', '本色', '均码', form)
          }
        ]
      }
    ]);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    const currentRecord = { ...record, _id: record._id || record.id };
    setEditing(currentRecord); 

    form.setFieldsValue({
      code: currentRecord.product_code,
      name: currentRecord.product_name,
      unit: currentRecord.unit,
      description: currentRecord.description,
      category: currentRecord.category && currentRecord.category.length > 0 ? currentRecord.category : ['衣服']
    });

    if (currentRecord.skus && Array.isArray(currentRecord.skus)) {
        const groupedSkus = [];
        const colorGroups = {};
        
        currentRecord.skus.forEach(sku => {
          // 如果sku_color为空，尝试从sku_code中解析
          let color = sku.sku_color;
          let size = sku.sku_size;
          
          if (!color || color.trim() === '' || !size || size.trim() === '') {
            // 从SKU编码中解析颜色和尺寸 (格式: productCode-color-size)
            const parts = (sku.sku_code || '').split('-');
            if (parts.length >= 3) {
              color = (!color || color.trim() === '') ? parts[1] : color;
              size = (!size || size.trim() === '') ? parts[2] : size;
            }
          }
          
          color = color && color.trim() !== '' ? color : '默认颜色';
          size = size && size.trim() !== '' ? size : '默认尺码';
          
          if (!colorGroups[color]) {
            colorGroups[color] = {
              color: color,
              image_path: sku.image_path || '',
              sizes: []
            };
            groupedSkus.push(colorGroups[color]);
          }
          
          colorGroups[color].sizes.push({
            size: size,
            code: sku.sku_code,
            locations: sku.locations || []
          });
        });
        
        setSkus(groupedSkus);
      } else {
        setSkus([]);
      }

    setModalVisible(true);
  };

  const handlePreview = (url) => {
    if (!url) { message.error('无法预览图片：URL为空'); return; }
    setPreviewImage(url); setPreviewVisible(true);
  };
  
  // Renamed from handleBatchRegenerateSkusAndSave
  const handleBatchRegenerateSkusOnly = () => {
    console.log('[[ BATCH REGENERATE SKU ONLY ]] Entered.');
    const productCodeFromForm = form.getFieldValue('code');
    if (!productCodeFromForm) {
      message.warning('请输入商品编码后再执行此操作。');
      console.log('[[ BATCH REGENERATE SKU ONLY ]] Product code is missing.');
      return;
    }
    const regeneratedSkus = skus.map(colorGroup => ({
      ...colorGroup,
      sizes: colorGroup.sizes.map(sizeItem => ({
        ...sizeItem,
        // Always use the current color and size from the item for regeneration
        code: generateDynamicSkuCode(productCodeFromForm, colorGroup.color, sizeItem.size, form)
      }))
    }));
    console.log('[[ BATCH REGENERATE SKU ONLY ]] Regenerated SKUs:', JSON.stringify(regeneratedSkus, null, 2));
    setSkus(regeneratedSkus);
    message.success('所有SKU编码已刷新!'); // Provide feedback
    // DO NOT CALL handleFormSubmit() here
  };

  // 添加颜色功能
  const handleAddColor = () => {
    // 取一个未用过的颜色名
    let unusedColor = colorOptions.find(c => !skus.some(sku => sku.color === c)) || `新颜色${skus.length + 1}`;
    const defaultSize = sizeOptions[0] || 'M';
    // 获取当前商品编码
    const productCode = form.getFieldValue('code') || '';
    const newColor = {
      color: unusedColor,
      image_path: '',
      sizes: [{
        size: defaultSize,
        code: generateDynamicSkuCode(productCode, unusedColor, defaultSize, form)
      }]
    };
    setSkus([...skus, newColor]);
  };

  // === 新增：添加尺码 ===
  const handleAddSize = (colorIdx) => {
    const newSize = sizeOptions.find(s => !skus[colorIdx].sizes.some(sz => sz.size === s)) || `尺码${skus[colorIdx].sizes.length + 1}`;
    setSkus(prev => {
      const arr = [...prev];
      const colorGroup = { ...arr[colorIdx] };
      const productCode = form.getFieldValue('code') || '';
      colorGroup.sizes = [
        ...colorGroup.sizes,
        {
          size: newSize,
          code: generateDynamicSkuCode(productCode, colorGroup.color, newSize, form)
        }
      ];
      arr[colorIdx] = colorGroup;
      return arr;
    });
  };

  // === 新增：删除尺码 ===
  const handleRemoveSize = (colorIdx, sizeIdx) => {
    setSkus(prev => {
      const arr = [...prev];
      const colorGroup = { ...arr[colorIdx] };
      colorGroup.sizes = colorGroup.sizes.filter((_, idx) => idx !== sizeIdx);
      arr[colorIdx] = colorGroup;
      return arr;
    });
  };

  // === 新增：删除颜色 ===
  const handleRemoveColor = (colorIdx) => {
    setSkus(prev => prev.filter((_, idx) => idx !== colorIdx));
  };

  // 修复颜色图片上传逻辑
  const handleColorImageUpload = async (file, colorIndex) => {
    if (loading) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      setLoading(true);
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data && response.data.image_path) {
        setSkus(prevSkus => {
          const newSkus = [...prevSkus];
          if (newSkus[colorIndex]) {
            newSkus[colorIndex] = {
              ...newSkus[colorIndex],
              image_path: response.data.image_path
            };
          }
          return newSkus;
        });
        message.success('颜色图片上传成功');
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      message.error('颜色图片上传失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 删除商品
  const handleDelete = async (record) => {
    try {
      const id = record.product_id || record._id || record.id;
      if (!id) {
        message.error('无法获取商品ID，删除失败');
        return;
      }
      await api.delete(`/products/${id}`);
      message.success('商品已删除');
      setProducts(prev => prev.filter(p => p.product_code !== record.product_code));
      setFilteredProducts(prev => prev.filter(p => p.product_code !== record.product_code));
    } catch (err) {
      console.error('删除商品失败:', err);
      message.error('删除失败');
    }
  };

  // 标准尺码顺序
  const STANDARD_SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
  function sortSizesArr(arr) {
    return arr.slice().sort((a, b) => {
      const ia = STANDARD_SIZE_ORDER.indexOf(a.size);
      const ib = STANDARD_SIZE_ORDER.indexOf(b.size);
      if (ia === -1 && ib === -1) return a.size.localeCompare(b.size);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="products" />

      {/* 新增商品按钮 */}
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginBottom: 12 }}
      >
        新增商品
      </Button>

      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索商品编码或名称"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          suffix={
            <Space>
              <Button 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
              />
            </Space>
          }
          style={{ width: '100%' }}
        />
      </div>

      {/* 产品列表 */}
      <List
        dataSource={filteredProducts}
        renderItem={product => (
          <Card 
            style={{ marginBottom: 8 }} 
            size="small"
            onClick={(e) => product.has_sku ? showSkuDetail(product, e) : null}
            hoverable={product.has_sku}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {/* 左侧文字信息，固定宽度120px，超出省略号 */}
              <div style={{ width: 120, minWidth: 120, maxWidth: 120, textAlign: 'left', marginRight: 8, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_name || product.product_code}</div>
                <div style={{ color: '#666', fontSize: '0.95em', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>编码: {product.product_code}</div>
                <div style={{ color: '#888', fontSize: '0.95em', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {product.category && product.category.length > 0 && (
                    <span style={{ marginLeft: 0 }}>
                      分类: {Array.isArray(product.category) ? product.category.join(', ') : product.category}
                    </span>
                  )}
                  <Badge
                    count={`合计:${productStatsMap[product.product_code]?.total_qty ?? 0}`}
                    style={{ backgroundColor: '#2db7f5', marginLeft: 8 }}
                  />
                  <span style={{ marginLeft: 8, color: '#faad14' }}>
                    库位: {productStatsMap[product.product_code]?.location_count ?? 0}
                  </span>
                </div>
              </div>
              {/* 中间图片区域，flex自适应，最小0px最大填充，超出隐藏，每张图片宽高65px且不会被压缩 */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, margin: '0 8px', overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'center' }}>
                {product.skus && product.skus.length > 0 && product.skus.some(sku => sku.image_path)
                  ? (() => {
                      // 构建 sku_code -> total_qty map
                      const skuQtyMap = {};
                      if (product.colors) {
                        product.colors.forEach(col => {
                          (col.sizes || []).forEach(sz => {
                            skuQtyMap[sz.sku_code] = sz.total_qty;
                          });
                        });
                      }
                      // 按图片分组（同图片的SKU归为一组）
                      const imgMap = {};
                      product.skus.filter(sku => sku.image_path).forEach(sku => {
                        if (!imgMap[sku.image_path]) imgMap[sku.image_path] = [];
                        imgMap[sku.image_path].push(sku);
                      });
                      const imgEntries = Object.entries(imgMap);
                      // 计算最多能显示几张图片
                      const maxImgCount = Math.floor((Math.max(0, document.body.clientWidth - 120 - 60 - 48)) / (65 + 4)); // 120:文字区, 60:按钮区, 48:左右margin+gap
                      return imgEntries.slice(0, maxImgCount).map(([imgPath, skuList], idx) => {
                        // 用skuQtyMap统计真实库存
                        const totalQty = skuList.reduce((sum, sku) => sum + (skuQtyMap[sku.sku_code] || 0), 0);
                        return (
                          <div key={imgPath+idx} style={{ position: 'relative', width: 65, height: 65, borderRadius: 6, overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 65px' }}>
                            <img
                              src={getFullImageUrl(imgPath)}
                              alt={product.product_name || product.product_code}
                              style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 6 }}
                            />
                            {/* 左上角合计件数角标（仅数字，白字） */}
                            <div style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 8, fontSize: 15, padding: '0 7px', fontWeight: 700, minWidth: 24, textAlign: 'center', lineHeight: '20px', height: 20 }}>{totalQty}</div>
                            {/* 右下角有货尺码数角标（只显示有货SKU数，白字） */}
                            <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 8, fontSize: 15, padding: '0 7px', fontWeight: 700, minWidth: 20, textAlign: 'center', lineHeight: '20px', height: 20 }}>{skuList.filter(sku => (skuQtyMap[sku.sku_code] || 0) > 0).length}</div>
                          </div>
                        );
                      });
                    })()
                  : (
                    <div style={{ width: 65, height: 65, backgroundColor: '#f0f0f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexShrink: 0, color: '#999', fontSize: 14 }}>
                      无图
                    </div>
                  )
                }
              </div>
              {/* 操作按钮区，固定宽度60px */}
              <div style={{ width: 60, minWidth: 60, maxWidth: 60, display: 'flex', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={e => { e.stopPropagation(); handleEdit(product); }}
                />
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={e => {
                    e.stopPropagation();
                    setDeleteModalProduct(product);
                  }}
                />
              </div>
            </div>
          </Card>
        )}
      />
      
      {/* 产品表单 */}
      <Modal
        title={editing ? '编辑商品' : '新增商品'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setModalVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" loading={confirmLoading} onClick={handleFormSubmit}>保存</Button>
        ]}
        width="95%"
      >
        <Tabs defaultActiveKey="1">
          <TabPane tab="基本信息" key="1">
            <Form
              form={form}
              layout="vertical"
              onValuesChange={(changed, all) => {
                if (changed.code !== undefined) {
                  // 商品编码变动，自动刷新所有SKU编码
                  setSkus(prevSkus => prevSkus.map(colorGroup => ({
                    ...colorGroup,
                    sizes: colorGroup.sizes.map(sizeItem => ({
                      ...sizeItem,
                      code: generateDynamicSkuCode(changed.code, colorGroup.color, sizeItem.size, form)
                    }))
                  })));
                }
              }}
            >
              <Form.Item
                name="code"
                label="商品编码"
                rules={[{ required: true, message: '请输入商品编码' }]}
              >
                <Input placeholder="请输入商品编码" />
              </Form.Item>
              
              <Form.Item
                name="name"
                label="商品名称"
                extra="选填，如不填写将使用商品编码作为名称"
              >
                <Input placeholder="请输入商品名称（选填）" />
              </Form.Item>
              
              <Form.Item
                name="category"
                label="商品分类"
              >
                <Select
                  mode="tags"
                  placeholder="选择或输入分类（如：衣服、裤子等）"
                  style={{ width: '100%' }}
                  value={Array.isArray(form.getFieldValue('category')) ? form.getFieldValue('category').filter(cat => (categoryOptions || []).includes(cat)) : []}
                  options={(categoryOptions || []).map(cat => ({ value: cat, label: cat }))}
                  maxTagCount={1}
                />
              </Form.Item>
              
              <Form.Item
                name="unit"
                label="单位"
                initialValue="件"
              >
                <Input placeholder="件、个、箱等" />
              </Form.Item>
              
              <Form.Item
                name="description"
                label="描述"
              >
                <Input.TextArea rows={3} placeholder="商品描述（选填）" />
              </Form.Item>
            </Form>
          </TabPane>
          
          <TabPane tab="颜色尺码管理" key="2">
            {skus.map((colorGroup, colorIdx) => (
              <Card 
                key={`color-${colorGroup.color}-${colorIdx}`}
                size="small"
                title={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>颜色：</span>
                    <Select
                      mode="tags"
                      value={colorOptions && colorOptions.includes(colorGroup.color) ? [colorGroup.color] : []}
                      style={{ width: 120, marginRight: 8 }}
                      placeholder="颜色名称"
                      onChange={valueArr => handleUpdateColor(colorIdx, valueArr[0] || '')}
                      options={(colorOptions || []).map(c => ({ value: c, label: c }))}
                    />
                    <Button 
                      danger 
                      size="small" 
                      onClick={() => handleRemoveColor(colorIdx)}
                    >
                      删除此颜色
                    </Button>
                  </div>
                }
                style={{ marginBottom: 16 }}
              >
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>颜色图片</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ marginRight: 16, width: 120, height: 120, border: '1px dashed #d9d9d9', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fafafa' }}>
                        {colorGroup.image_path ? (
                          <img
                            src={getFullImageUrl(colorGroup.image_path)}
                            alt={colorGroup.color}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                            onClick={() => handlePreview(getFullImageUrl(colorGroup.image_path))}
                          />
                        ) : (
                          <div style={{ textAlign: 'center' }}>
                            <PictureOutlined style={{ fontSize: 24 }} />
                            <div>无图片</div>
                          </div>
                        )}
                      </div>
                      <Upload
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={(file) => {
                          handleColorImageUpload(file, colorIdx);
                          return false;
                        }}
                        disabled={loading}
                      >
                        <Button icon={<PictureOutlined />} disabled={loading}>
                          {loading ? '上传中...' : '上传图片'}
                        </Button>
                      </Upload>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>尺码列表:</div>
                      <Button size="small" type="primary" onClick={() => handleAddSize(colorIdx)}>添加尺码</Button>
                    </div>
                    
                    {colorGroup.sizes.map((sizeItem, sizeIdx) => (
                      <div key={`size-${sizeItem.code}-${sizeIdx}`} style={{
                        marginBottom: 8,
                        padding: '8px',
                        border: '1px solid #f0f0f0',
                        borderRadius: '4px',
                        backgroundColor: '#fafafa'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {/* 尺码下拉选择 */}
                          <div style={{ flex: '0 0 100px' }}>
                            <span style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>尺码:</span>
                            <Select
                              value={sizeOptions && (Array.isArray(sizeOptions) && typeof sizeOptions[0] === 'string' ? sizeOptions.includes(sizeItem.size) : sizeOptions.some(opt => opt.value === sizeItem.size)) ? sizeItem.size : undefined}
                              size="small"
                              style={{ width: '100%' }}
                              onChange={value => handleUpdateSize(colorIdx, sizeIdx, 'size', value)}
                              options={Array.isArray(sizeOptions) && typeof sizeOptions[0] === 'string'
                                ? sortSizes(sizeOptions).map(s => ({ value: s, label: s }))
                                : (sizeOptions || [])}
                            />
                          </div>
                          
                          {/* SKU编码编辑 */}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>SKU编码:</span>
                            <Input
                              value={sizeItem.code}
                              size="small"
                              onChange={e => handleUpdateSize(colorIdx, sizeIdx, 'code', e.target.value)}
                              placeholder="SKU编码"
                            />
                          </div>
                          
                          {/* 库存显示 */}
                          <div style={{ flex: '0 0 80px', textAlign: 'center' }}>
                            <span style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>库存:</span>
                            <Tag color="green" style={{ fontSize: 12 }}>
                              {skuInventoryMap[sizeItem.code] ?? 0}
                            </Tag>
                          </div>
                          
                          {/* 删除按钮 */}
                          <div style={{ flex: '0 0 40px' }}>
                            <Button
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveSize(colorIdx, sizeIdx)}
                              title="删除此尺码"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Button type="primary" onClick={handleAddColor}>添加颜色</Button>
              <Button 
                type="primary" 
                ghost
                icon={<RedoOutlined />}
                onClick={handleBatchRegenerateSkusOnly}
              >
                刷新SKU编码
              </Button>
            </div>
          </TabPane>
        </Tabs>
      </Modal>

      {/* SKU详情弹窗 */}
      <Modal
        title={selectedProduct ? `${selectedProduct.product_name || selectedProduct.product_code} 的SKU款式` : 'SKU详情'}
        open={skuDetailVisible}
        onCancel={() => setSkuDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSkuDetailVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary"
            onClick={() => {
              setSkuDetailVisible(false);
              showProductForm(selectedProduct);
            }}
          >
            编辑商品
          </Button>
        ]}
        width="100%"
        style={{ top: 0 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        {selectedProduct && selectedProduct.skus && (
          <>
            {(() => {
              // 按颜色分组SKU
              const colorGroups = {};
              selectedProduct.skus.forEach((sku) => {
                const color = sku.sku_color || '默认颜色';
                if (!colorGroups[color]) {
                  colorGroups[color] = {
                    color,
                    image_path: sku.image_path || '',
                    sizes: []
                  };
                }
                colorGroups[color].sizes.push({
                  size: sku.sku_size || '默认尺码',
                  code: sku.sku_code,
                  color: sku.sku_color,
                  locations: sku.locations || []
                });
              });
              return Object.values(colorGroups).map((group, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: 16 }}>
                        {group.color}
                      </span>
                      <span style={{ color: '#52c41a', fontWeight: 500, fontSize: 14 }}>
                        总库存: {
                          group.sizes.reduce((sum, size) => sum + (skuInventoryMap[size.code] ?? 0), 0)
                        }
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>
                        尺码列表:
                      </span>
                    </div>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {/* 颜色图片 */}
                    <div style={{ flex: '0 0 100px', marginRight: 16 }}>
                      <div style={{ 
                        width: 100, 
                        height: 100, 
                        backgroundColor: getColorBackground(group.color), 
                        display: 'flex', 
                        flexDirection: 'column',
                        justifyContent: 'center', 
                        alignItems: 'center',
                        border: '2px solid #ddd',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        {group.image_path ? (
                          <img 
                            src={getFullImageUrl(group.image_path)} 
                            alt={group.color}
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              cursor: 'pointer'
                            }}
                            onClick={() => handlePreview(getFullImageUrl(group.image_path))}
                          />
                        ) : (
                          <div style={{ textAlign: 'center' }}>
                            <PictureOutlined style={{ fontSize: 24 }} />
                            <div>无图片</div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 尺码列表 */}
                    <div style={{ flex: 1 }}>
                      {sortSizesArr(group.sizes).map((size, idx) => {
                        const skuKey = `${group.color}-${size.size}-${size.code}`;
                        const isExpanded = expandedSkuKey === skuKey;
                        const locOptions = size.locations || [];
                        const selectedLoc = rowLocationMap[size.code] || (locOptions[0]?.location_code ?? '无货位');
                        const selectedLocObj = locOptions.find(l=>l.location_code===selectedLoc) || { stock_quantity: 0 };
                        const keyId = `${size.code}|${selectedLoc}`;
                        const sel = selectedLoc === locOptions[0]?.location_code;
                        const showBtns = actionVisibleKey === keyId;
                        return (
                          <div key={idx} style={{
                            marginBottom: 8,
                            padding: '4px 8px',
                            border: '1px solid #f0f0f0',
                            borderRadius: '4px',
                            backgroundColor: isExpanded ? '#f6faff' : '#fafafa',
                            cursor: 'pointer'
                          }}
                            onClick={() => { setExpandedSkuKey(isExpanded ? null : skuKey); setActionVisibleKey(showBtns ? null : keyId); }}
                          >
                            {/* SKU信息行 */}
                            <Tag color="blue" style={{ marginRight: 12, fontSize: 16, padding: '4px 12px' }}>
                              {size.size} ({size.code})
                              <span style={{ marginLeft: 8, color: '#52c41a', fontWeight: 500 }}>
                                库存: {skuInventoryMap[size.code] ?? 0}
                              </span>
                            </Tag>
                            {/* 操作区：仅在展开时显示 */}
                            {isExpanded && (
                              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
                                {/* 库位列表 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {locOptions.length === 0 && (
                                    <div style={{ padding: '4px 8px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                                      无货位
                                    </div>
                                  )}
                                  {locOptions.map(loc => {
                                    const sel = selectedLoc === loc.location_code;
                                    return (
                                      <div
                                        key={loc.location_code}
                                        onClick={() => {
                                          setRowLocationMap(prev => ({ ...prev, [size.code]: loc.location_code }));
                                          setActionVisibleKey(showBtns ? null : keyId);
                                        }}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          padding: '4px 8px',
                                          background: sel ? '#e6f7ff' : '#f5f5f5',
                                          border: '1px solid #91d5ff',
                                          borderRadius: 4,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <span>库位：{loc.location_code}</span>
                                        <span style={{ color: '#52c41a' }}>{loc.stock_quantity}件</span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* 按钮组 */}
                                {showBtns && (
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                                    <Button
                                      type="primary"
                                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                      size="small"
                                      onClick={() => showWarehouseAction('inbound', {
                                        code: size.code,
                                        color: group.color,
                                        size: size.size
                                      }, selectedLoc)}
                                    >入库</Button>
                                    <Button
                                      danger
                                      size="small"
                                      onClick={() => showWarehouseAction('outbound', {
                                        code: size.code,
                                        color: group.color,
                                        size: size.size
                                      }, selectedLoc)}
                                    >出库</Button>
                                    <Button
                                      size="small"
                                      style={{ background: '#fadb14', borderColor: '#fadb14', color: '#000' }}
                                      onClick={() => showWarehouseAction('adjust', {
                                        code: size.code,
                                        color: group.color,
                                        size: size.size,
                                        currentStock: selectedLocObj.stock_quantity
                                      }, selectedLoc)}
                                    >盘点</Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ));
            })()}
          </>
        )}
      </Modal>

      {/* 入库/出库操作模态框 */}
      <Modal
        title={warehouseActionType === 'inbound' ? '入库操作' : warehouseActionType === 'outbound' ? '出库操作' : '盘点操作'}
        open={warehouseActionVisible}
        onCancel={() => setWarehouseActionVisible(false)}
        onOk={handleWarehouseAction}
        confirmLoading={loadingLocations}
      >
        {selectedSku && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                {selectedProduct?.product_name || ''} ({selectedSku.code})
              </div>
              <div style={{ color: '#666' }}>
                {selectedSku.color} - {selectedSku.size}
              </div>
            </div>
            
            <Form layout="vertical">
              {warehouseActionType === 'adjust' && (
                <div style={{ marginBottom: 8, color: '#fa8c16' }}>当前库存: {currentStock} 件</div>
              )}
              {warehouseActionType === 'adjust' ? (
                <Form.Item label="货位">
                  <Input value={selectedLocation} disabled />
                </Form.Item>
              ) : (
                <Form.Item label="货位">
                  <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    value={selectedLocation ? [selectedLocation] : []}
                    onChange={val => setSelectedLocation(val[val.length - 1])}
                    options={locationOptions}
                    loading={loadingLocations}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              )}
              <Form.Item label="数量">
                <InputNumber 
                  min={warehouseActionType === 'adjust' ? undefined : 1}
                  value={quantity} 
                  onChange={setQuantity} 
                  style={{ width: '100%' }} 
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 图片预览Modal */}
      <Modal
        title="图片预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width="90vw"
        centered
        bodyStyle={{ textAlign: 'center', padding: 24 }}
      >
        <img
          src={previewImage}
          style={{ maxWidth: '80vw', height: 'auto', borderRadius: 8, boxShadow: '0 2px 16px #0002', display: 'inline-block' }}
          alt="图片预览"
        />
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        open={!!deleteModalProduct}
        onCancel={() => setDeleteModalProduct(null)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteModalProduct(null)}>取消</Button>,
          <Button key="delete" danger type="primary" onClick={async () => {
            await handleDelete(deleteModalProduct);
            setDeleteModalProduct(null);
          }}>确认删除</Button>
        ]}
        centered
        closable={false}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <ExclamationCircleFilled style={{ color: '#ff4d4f', fontSize: 32, marginRight: 12 }} />
          <span style={{ color: '#ff4d4f', fontWeight: 700, fontSize: 22 }}>
            确认删除产品: {deleteModalProduct?.product_code}?
          </span>
        </div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>
          您确定要删除产品 <b>{deleteModalProduct?.product_code}</b> 吗？
        </div>
        <div style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
          此操作将会从系统中永久删除该产品，并且会同时删除该产品在所有库位的所有库存记录。
        </div>
        <div style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>
          此操作不可恢复！请谨慎操作。
        </div>
      </Modal>
    </div>
  );
};

export default MobileProductManage; 