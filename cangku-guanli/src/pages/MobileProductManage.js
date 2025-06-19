import React, { useEffect, useState, useRef } from 'react';
import { Button, Input, message, List, Card, Space, Modal, Form, Switch, Select, Upload, Tabs, Badge, Tag, Popconfirm, InputNumber, Image, Collapse, Dropdown, Menu } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PictureOutlined, SaveOutlined, SearchOutlined, LinkOutlined, CloseOutlined, ArrowRightOutlined, InboxOutlined, ExportOutlined, RedoOutlined, WarningOutlined, SettingOutlined, DownOutlined, SwapOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
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
  const pCode = baseProductCode || (formInstance ? formInstance.getFieldValue('product_code') : '') || 'SKU_FALLBACK';
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
  const [skuDetailVisible, setSkuDetailVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [colorOptions, setColorOptions] = useState(DEFAULT_COLORS);
  const [sizeOptions, setSizeOptions] = useState(DEFAULT_SIZES);

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

  // 新增：用于记录当前展开的货位
  const [expandedLocationKey, setExpandedLocationKey] = useState(null);

  // 新增：当前用户信息
  const [currentUser, setCurrentUser] = useState(null);

  // 自动滚动到最右
  useEffect(() => {
    const scrollAllToRight = () => {
      if (window.__imgListRefs) {
        Object.values(window.__imgListRefs).forEach(ref => {
          if (ref && ref.scrollWidth > ref.clientWidth) {
            ref.scrollLeft = ref.scrollWidth;
          }
        });
      }
    };
    scrollAllToRight();
    window.addEventListener('resize', scrollAllToRight);
    return () => window.removeEventListener('resize', scrollAllToRight);
  });

  // 加载所有产品和自定义设置
  useEffect(() => {
    // fetchProducts(); // 已由 /products 代替
    loadCustomSettings();
    // 拉取库存 - 使用新的标准字段名
    api.get('/products', { params: { page: 1, page_size: 1000 } }).then(res => {
      const list = res.data.data?.products || [];
      const map = {};
      const stats = {};
      list.forEach(prod => {
        let total = 0;
        (prod.colors || []).forEach(col => {
          (col.sizes || []).forEach(sz => {
            total += sz.sku_total_quantity || 0;
          });
        });
        map[prod.product_code] = total;
        stats[prod.product_code] = {
          product_total_quantity: prod.product_total_quantity || total,
          total_sku_count: prod.total_sku_count || 0,           // 修正字段名
          total_color_count: prod.total_color_count || 0,       // 修正字段名
          total_location_count: prod.total_location_count || 0  // 修正字段名
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
        product_code: product.product_code,
        unit: product.unit,
        description: product.description,
        category_code_1: product.category_code_1 || '',
        category_name_1: product.category_name_1 || '',
        category_code_2: product.category_code_2 || '',
        category_name_2: product.category_name_2 || '',
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
            sku_size: size,
            sku_code: sku.sku_code,
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
        values.name = values.product_code;
      }
      
      // 将 skus 格式转换为后端期望的 colors 格式
      const colors = skus.map(colorGroup => ({
        color: colorGroup.color,
        image_path: colorGroup.image_path || '',
        sizes: colorGroup.sizes.map(sizeItem => ({
          size: sizeItem.sku_size,
          sku_code: sizeItem.sku_code
        }))
      }));

      const data = {
        product_code: values.product_code,
        product_name: values.name,
        unit: values.unit,
        colors: colors,
        description: values.description,
        category_code_1: values.category_code_1 || '',
        category_name_1: values.category_name_1 || '',
        category_code_2: values.category_code_2 || '',
        category_name_2: values.category_name_2 || '',
        operator_id: currentUser?.user_id || null
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
      const res = await api.get('/products', { params: { search: product.product_code, page_size: 1 } });
      const productAggArr = res.data.data?.products || [];
      const productAgg = productAggArr[0];
      const inventoryList = []; // 不再用
      
      console.log('[[ SKU DETAIL ]] Colors returned:', productAgg?.colors?.length || 0);
      
              // 由返回结果直接构造 map（sku_code → sku_total_quantity）以及 imageMap
      const map = {};
      const imageMap = {};
      if (productAgg && productAgg.colors) {
        productAgg.colors.forEach(col => {
          col.sizes.forEach(sz => {
            map[sz.sku_code] = sz.sku_total_quantity;
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
              sku_size: sz.sku_size,
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
          value: loc.location_code || '',
          label: loc.location_code || ''
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
      const cur = sku?.currentStock ?? 0;
      setCurrentStock(cur);
      setQuantity(cur);
      setSelectedLocation(defaultLoc);
      setLocationOptions([{ value: defaultLoc, label: defaultLoc }]);
    } else if (type === 'outbound' && sku && sku.product_code) {
      // 检查字段标准性
      if (!sku.product_code) {
        message.error('缺少 product_code 字段，无法出库');
        return;
      }
      const pcodeParts = sku.product_code.split('-');
      if (!pcodeParts[0]) {
        message.error('product_code 字段格式不正确');
        return;
      }
      const pcode = pcodeParts[0];
      api.get('/products', { params: { search: pcode, page_size: 1 } }).then(res => {
        const prodData = (res.data.data?.products || [])[0];
        const availableLocations = [];
        if (prodData && prodData.colors) {
          prodData.colors.forEach(col => {
            col.sizes.forEach(sz => {
              if (sz.sku_code === sku.product_code) {
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
      fetchLocations(defaultLoc);
    }
    setExpandedSkuKey(null);
    setWarehouseActionVisible(true);
    setActionVisibleKey(null);
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
    if (!selectedSku.product_code) {
      message.error('缺少 product_code 字段，无法操作');
      return;
    }
    if (warehouseActionType !== 'adjust' && quantity <= 0) {
      message.warning('数量必须大于0');
      return;
    }
    // 检查 product_code 字段格式
    const fallbackProductCodeParts = selectedSku.product_code.split('-');
    if (!fallbackProductCodeParts[0]) {
      message.error('product_code 字段格式不正确');
      return;
    }
    const fallbackProductCode = fallbackProductCodeParts[0];
    let productId = selectedProduct?.product_id || null;
    let productName = selectedProduct?.product_name || fallbackProductCode;
    try {
      setLoading(true);
      if (!productId) {
        const response = await api.get(`/products/code/${fallbackProductCode}`);
        const product = response.data.data;
        if (!product || !product.product_id) {
          message.error('找不到对应的产品或产品ID无效');
          setLoading(false);
          return;
        }
        productId = product.product_id;
        productName = product.product_name || fallbackProductCode;
      }
      let payload = {};
      let actionEndpoint = '/outbound/';
      
      if (warehouseActionType === 'inbound') {
        actionEndpoint = '/inbound/';
        payload = {
          sku_code: selectedSku.product_code,
          location_code: selectedLocation,
          inbound_quantity: Number(quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端商品管理入库操作'
        };
      } else if (warehouseActionType === 'outbound') {
        actionEndpoint = '/outbound/';
        payload = {
          sku_code: selectedSku.product_code,
          location_code: selectedLocation,
          outbound_quantity: Number(quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端商品管理出库操作'
        };
      } else if (warehouseActionType === 'adjust') {
        actionEndpoint = '/inventory/adjust';
        payload = {
          sku_code: selectedSku.product_code,
          location_code: selectedLocation,
          target_quantity: Number(quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端商品管理库存调整'
        };
      }
      const response = await api.post(actionEndpoint, payload);
      let actionText = '出库';
      if (warehouseActionType === 'inbound') actionText = '入库';
      else if (warehouseActionType === 'adjust') actionText = '盘点调整';
      message.success({
        content: `已${actionText}: ${productName} (${selectedSku.product_code}) ${quantity}件 ${warehouseActionType === 'inbound' ? '到' : warehouseActionType === 'outbound' ? '从' : '于'} ${selectedLocation}`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
      setWarehouseActionVisible(false);
      
      // API已经返回了最新的库存数据，不需要手动计算
      if (response.data && response.data.inventory) {
        const { sku_location_quantity, sku_total_quantity } = response.data.inventory;
        console.log('操作完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
    } catch (error) {
      console.error('[[ WAREHOUSE ACTION ]] 操作失败:', error.response || error);
      message.error(`${warehouseActionType === 'inbound' ? '入库' : '出库'}失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ has_sku: true, product_code: '', name: '', unit: '件', description: '', category: ['衣服'] });
    setSkus([
      {
        color: '本色',
        image_path: '',
        sizes: [
          {
            sku_size: '均码',
            product_code: generateDynamicSkuCode('', '本色', '均码', form)
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
      product_code: currentRecord.product_code,
      name: currentRecord.product_name,
      unit: currentRecord.unit,
      description: currentRecord.description,
      category_code_1: currentRecord.category_code_1 || '',
      category_name_1: currentRecord.category_name_1 || '',
      category_code_2: currentRecord.category_code_2 || '',
      category_name_2: currentRecord.category_name_2 || ''
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
            sku_size: size,
            sku_code: sku.sku_code,
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
    const productCodeFromForm = form.getFieldValue('product_code');
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
        sku_code: generateDynamicSkuCode(productCodeFromForm, colorGroup.color, sizeItem.sku_size, form)
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
    const productCode = form.getFieldValue('product_code') || '';
    const newColor = {
      color: unusedColor,
      image_path: '',
      sizes: [{
        sku_size: defaultSize,
        sku_code: generateDynamicSkuCode(productCode, unusedColor, defaultSize, form)
      }]
    };
    setSkus([...skus, newColor]);
  };

  // === 新增：添加尺码 ===
  const handleAddSize = (colorIdx) => {
    const newSize = sizeOptions.find(s => !skus[colorIdx].sizes.some(sz => sz.sku_size === s)) || `尺码${skus[colorIdx].sizes.length + 1}`;
    setSkus(prev => {
      const arr = [...prev];
      const colorGroup = { ...arr[colorIdx] };
      const productCode = form.getFieldValue('product_code') || '';
      colorGroup.sizes = [
        ...colorGroup.sizes,
        {
          sku_size: newSize,
          sku_code: generateDynamicSkuCode(productCode, colorGroup.color, newSize, form)
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
      await api.delete(`/products/${id}`, { data: { operator_id: currentUser?.user_id || null } });
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
      const ia = STANDARD_SIZE_ORDER.indexOf(a.sku_size);
      const ib = STANDARD_SIZE_ORDER.indexOf(b.sku_size);
      if (ia === -1 && ib === -1) return a.sku_size.localeCompare(b.sku_size);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  // 新增：清库存操作
  const handleClearStock = async (item, location_code) => {
    if (!item || !location_code || !currentUser?.user_id) {
      message.error('缺少必要参数，无法清库存');
      return;
    }
    try {
      setLoading(true);
      const requestData = {
        sku_code: item.sku_code,
        location_code,
        target_quantity: 0,
        operator_id: currentUser.user_id,
        notes: '清库存'
      };
      const response = await api.post('/inventory/adjust', requestData);
      message.success('清库存成功');
      // API已经返回最新数据，不需要刷新
      if (response.data && response.data.data) {
        const { sku_location_quantity, sku_total_quantity } = response.data.data;
        console.log('清库存完成，最新库存:', { sku_location_quantity, sku_total_quantity });
      }
    } catch (error) {
      message.error('清库存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };
  const handleClearStockWithConfirm = (item, location_code) => {
    Modal.confirm({
      title: '确认要清空该SKU此货位库存吗？',
      content: `SKU: ${item.sku_code}，库位: ${location_code}，此操作会将该SKU此货位库存清零，且不可恢复。确定要继续吗？`,
      okText: '确定清库存',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => handleClearStock(item, location_code)
    });
  };

  // 新增：当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data && response.data.success) {
          setCurrentUser(response.data.data);
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
      }
    };
    fetchCurrentUser();
  }, []);

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
                    count={`合计:${productStatsMap[product.product_code]?.product_total_quantity ?? 0}`}
                    style={{ backgroundColor: '#2db7f5', marginLeft: 8 }}
                  />
                  <span style={{ marginLeft: 8, color: '#faad14' }}>
                    库位: {productStatsMap[product.product_code]?.total_location_count ?? 0}
                  </span>
                </div>
              </div>
              {/* 中间图片区域，flex自适应，最小0px最大填充，超出隐藏，每张图片宽高65px且不会被压缩 */}
              <div
                className="img-list-outer"
                style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', margin: '0 8px', paddingBottom: 2 }}
                ref={el => { if (el) window.__imgListRefs = (window.__imgListRefs || []); window.__imgListRefs[product.product_code] = el; }}
              >
                <div className="img-list-inner" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', minWidth: 'max-content', gap: 4, alignItems: 'center' }}>
                  {/* 只显示颜色级别图片，无兜底逻辑 */}
                  {product.colors && product.colors.some(color => color.image_path)
                    ? (() => {
                        return product.colors
                          .filter(color => color.image_path)
                          .map((color, idx) => {
                            const colorQty = color.color_total_quantity || 0;
                            const colorSkuCount = color.total_sku_count || 0;
                            return (
                              <div key={`color-${color.color}-${idx}`} style={{ position: 'relative', width: 65, height: 65, borderRadius: 6, overflow: 'hidden', background: getColorBackground(color.color), border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 65px' }}>
                                <img
                                  src={getFullImageUrl(color.image_path)}
                                  alt={`${product.product_name || product.product_code} - ${color.color}`}
                                  style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                                />
                                {/* 左上角该颜色库存数角标 */}
                                <div style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 8, fontSize: 15, padding: '0 7px', fontWeight: 700, minWidth: 24, textAlign: 'center', lineHeight: '20px', height: 20 }}>{colorQty}</div>
                                {/* 右下角该颜色SKU数角标 */}
                                <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 8, fontSize: 15, padding: '0 7px', fontWeight: 700, minWidth: 20, textAlign: 'center', lineHeight: '20px', height: 20 }}>{colorSkuCount}</div>
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
                if (changed.product_code !== undefined) {
                  // 商品编码变动，自动刷新所有SKU编码
                  setSkus(prevSkus => prevSkus.map(colorGroup => ({
                    ...colorGroup,
                    sizes: colorGroup.sizes.map(sizeItem => ({
                      ...sizeItem,
                      sku_code: generateDynamicSkuCode(changed.product_code, colorGroup.color, sizeItem.sku_size, form)
                    }))
                  })));
                }
              }}
            >
              <Form.Item
                name="product_code"
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
                name="category_code_1"
                label="一级分类编码"
              >
                <Input placeholder="如：CLOTHING（服装）、FOOTWEAR（鞋类）" />
              </Form.Item>
              
              <Form.Item
                name="category_name_1"
                label="一级分类名称"
              >
                <Input placeholder="如：服装、鞋类、配件" />
              </Form.Item>
              
              <Form.Item
                name="category_code_2"
                label="二级分类编码"
              >
                <Input placeholder="如：TOPS（上装）、BOTTOMS（下装）" />
              </Form.Item>
              
              <Form.Item
                name="category_name_2"
                label="二级分类名称"
              >
                <Input placeholder="如：上装、下装、内衣" />
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
                    <Input
                      mode="tags"
                      allowClear
                      style={{ width: 120, marginRight: 8 }}
                      value={colorGroup.color}
                      onChange={val => handleUpdateColor(colorIdx, val)}
                      placeholder="输入或选择颜色"
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
                    
                    {colorGroup.sizes.map((size, sizeIdx) => (
                      <div key={`size-${size.sku_code}-${sizeIdx}`} style={{
                        marginBottom: 8,
                        padding: '8px',
                        border: '1px solid #f0f0f0',
                        borderRadius: '4px',
                        backgroundColor: '#fafafa'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {/* 尺码输入框 */}
                          <div style={{ flex: '0 0 80px' }}>
                            <span style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>尺码:</span>
                            <Input
                              mode="tags"
                              allowClear
                              style={{ width: '100%' }}
                              value={size.sku_size}
                              onChange={val => handleUpdateSize(colorIdx, sizeIdx, 'sku_size', val)}
                              options={DEFAULT_SIZES.map(s => ({ value: s, label: s }))}
                              placeholder="输入或选择尺码"
                            />
                          </div>
                          
                          {/* SKU编码编辑 */}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>SKU编码:</span>
                            <Input
                              value={size.sku_code}
                              size="small"
                              onChange={e => handleUpdateSize(colorIdx, sizeIdx, 'sku_code', e.target.value)}
                              placeholder="SKU编码"
                            />
                          </div>
                          
                          {/* 库存显示 */}
                          <div style={{ flex: '0 0 80px', textAlign: 'center' }}>
                            <span style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>库存:</span>
                            <Tag color="green" style={{ fontSize: 12 }}>
                              {skuInventoryMap[size.sku_code] ?? 0}
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
              // 使用产品的colors数据，而不是从SKU中获取图片
              const productColors = selectedProduct.colors || [];
              
              // 如果没有colors数据，则按颜色分组SKU (向后兼容)
              const colorGroups = {};
              if (productColors.length > 0) {
                // 使用产品的colors数据
                productColors.forEach((colorData) => {
                  const color = colorData.color || '默认颜色';
                  colorGroups[color] = {
                    color,
                    image_path: colorData.image_path || '',  // 使用颜色级别的图片
                    sizes: []
                  };
                });
                
                // 将SKU分配到对应颜色组
                selectedProduct.skus.forEach((sku) => {
                  const color = sku.sku_color || '默认颜色';
                  if (colorGroups[color]) {
                    colorGroups[color].sizes.push({
                      sku_size: sku.sku_size || '默认尺码',
                      sku_code: sku.sku_code,
                      sku_color: sku.sku_color,
                      locations: sku.locations || []
                    });
                  }
                });
              } else {
                // 向后兼容：如果没有colors数据，按SKU分组 (但不使用SKU的image_path)
                selectedProduct.skus.forEach((sku) => {
                  const color = sku.sku_color || '默认颜色';
                  if (!colorGroups[color]) {
                    colorGroups[color] = {
                      color,
                      image_path: '',  // 不使用SKU的图片，只显示颜色图片
                      sizes: []
                    };
                  }
                  colorGroups[color].sizes.push({
                    sku_size: sku.sku_size || '默认尺码',
                    sku_code: sku.sku_code,
                    sku_color: sku.sku_color,
                    locations: sku.locations || []
                  });
                });
              }
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
                          group.sizes.reduce((sum, size) => sum + (skuInventoryMap[size.sku_code] ?? 0), 0)
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
                        const skuKey = `${group.color}-${size.sku_size}-${size.sku_code}`;
                        const isExpanded = expandedSkuKey === skuKey;
                        const locOptions = size.locations || [];
                        const selectedLoc = rowLocationMap[size.sku_code] || (locOptions[0]?.location_code ?? '无货位');
                        const selectedLocObj = locOptions.find(l=>l.location_code===selectedLoc) || { stock_quantity: 0 };
                        const keyId = `${size.sku_code}|${selectedLoc}`;
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
                              {size.sku_size} ({size.sku_code})
                              <span style={{ marginLeft: 8, color: '#52c41a', fontWeight: 500 }}>
                                库存: {skuInventoryMap[size.sku_code] ?? 0}
                              </span>
                            </Tag>
                            {/* 操作区：仅在展开时显示 */}
                            {isExpanded && (
                              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
                                {/* 库位列表 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {locOptions.map(loc => {
                                    const isExpanded = expandedLocationKey === loc.location_code;
                                    return (
                                      <div key={loc.location_code} style={{ marginBottom: 8 }}>
                                        {/* 货位信息一行 */}
                                        <div
                                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 8px', background: isExpanded ? '#e6f7ff' : '#f5f5f5', border: '1px solid #91d5ff', borderRadius: 4 }}
                                          onClick={e => { e.stopPropagation(); setExpandedLocationKey(isExpanded ? null : loc.location_code); }}
                                        >
                                          <span>库位：{loc.location_code}</span>
                                          <span style={{ color: '#52c41a', marginLeft: 8 }}>{loc.stock_quantity}件</span>
                                        </div>
                                        {/* 按钮区，展开时显示（无货位也允许） */}
                                        {isExpanded && (
                                          <div style={{ marginTop: 12, display: 'flex', gap: 4, justifyContent: 'center' }}>
                                            <Button
                                              type="primary"
                                              style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                              size="small"
                                              onClick={e => { e.stopPropagation(); showWarehouseAction('inbound', { ...size, product_code: size.sku_code, sku_color: group.color }, selectedLoc); }}
                                            >入库</Button>
                                            <Button
                                              danger
                                              size="small"
                                              onClick={e => { e.stopPropagation(); showWarehouseAction('outbound', { ...size, product_code: size.sku_code, sku_color: group.color }, selectedLoc); }}
                                            >出库</Button>
                                            <Button
                                              size="small"
                                              style={{ background: '#fadb14', borderColor: '#fadb14', color: '#000' }}
                                              onClick={e => { e.stopPropagation(); showWarehouseAction('adjust', { ...size, product_code: size.sku_code, sku_color: group.color, currentStock: skuInventoryMap[size.sku_code] ?? 0 }, selectedLoc); }}
                                            >盘点</Button>
                                            <Button
                                              size="small"
                                              danger
                                              style={{ background: '#ff4d4f', borderColor: '#ff4d4f', fontWeight: 'bold', marginLeft: 8 }}
                                              onClick={e => { e.stopPropagation(); handleClearStockWithConfirm({ ...size, sku_color: group.color }, loc.location_code); }}
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
                                {/* 选货位入库按钮紧贴货位列表底部 */}
                                <Button
                                  type="primary"
                                  size="small"
                                  style={{ background: '#1890ff', borderColor: '#1890ff', marginTop: 0 }}
                                  onClick={async e => {
                                    e.stopPropagation();
                                    setSelectedSku({ ...size, product_code: size.sku_code, sku_color: group.color });
                                    setWarehouseActionType('inbound');
                                    await fetchLocations();
                                    setWarehouseActionVisible(true);
                                  }}
                                >选货位入库</Button>
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
                {selectedProduct?.product_name || ''} ({selectedSku.sku_code})
              </div>
              <div style={{ color: '#666' }}>
                {selectedSku.sku_color} - {selectedSku.sku_size}
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
                    placeholder="选择已有库位或输入新库位"
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