import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Modal, Form, Switch, Select, Upload, Tabs, Badge, Tag, Popconfirm, InputNumber, Image, Collapse, Dropdown, Menu } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PictureOutlined, SaveOutlined, SearchOutlined, LinkOutlined, ScanOutlined, CloseOutlined, ArrowRightOutlined, InboxOutlined, ExportOutlined, RedoOutlined, WarningOutlined, SettingOutlined, DownOutlined, SwapOutlined } from '@ant-design/icons';
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

const MobileProductManage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [hasSKU, setHasSKU] = useState(true);
  const [skus, setSkus] = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
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
  const [fileList, setFileList] = useState([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 在表单状态中增加skuCode
  const [skuCode, setSkuCode] = useState('');
  const [deletedSkuCodesThisSession, setDeletedSkuCodesThisSession] = useState([]);

  // 新增库存映射
  const [skuInventoryMap, setSkuInventoryMap] = useState({});

  // 新增产品库存映射
  const [productInventoryMap, setProductInventoryMap] = useState({});

  // 新增：用于记录当前展开的SKU code
  const [expandedSkuKey, setExpandedSkuKey] = useState(null);

  // 加载所有产品和自定义设置
  useEffect(() => {
    fetchProducts();
    loadCustomSettings();
    // 拉取库存
    api.get('/inventory/').then(res => {
      const inventoryList = res.data || [];
      const map = {};
      inventoryList.forEach(inv => {
        // 统计主商品下所有SKU的总库存
        let total = 0;
        if (inv.locations && Array.isArray(inv.locations)) {
          inv.locations.forEach(loc => {
            if (loc.skus && Array.isArray(loc.skus)) {
              loc.skus.forEach(sku => {
                total += sku.quantity || 0;
              });
            }
          });
        }
        // 兜底：如果没有SKU，统计主商品自身库存
        if (total === 0 && inv.quantity) total = inv.quantity;
        map[inv.productCode] = total;
      });
      setProductInventoryMap(map);
    });
  }, []);
  
  // 加载自定义设置
  const loadCustomSettings = () => {
    try {
      // 从localStorage中获取设置，如果有则更新
      const savedColors = localStorage.getItem('productColors');
      const savedSizes = localStorage.getItem('productSizes');
      
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
      setProducts(response.data);
      setFilteredProducts(response.data);
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
      (product.name && product.name.toLowerCase().includes(searchValue.toLowerCase())) || 
      (product.code && product.code.toLowerCase().includes(searchValue.toLowerCase()))
    );
    
    setFilteredProducts(filtered);
    
    if (filtered.length === 0) {
      message.info('没有找到匹配的产品');
    }
  };

  // 显示产品表单
  const showProductForm = (product = null) => {
    if (product && (product._id || product.id)) {
      setCurrentProduct({ ...product, _id: product._id || product.id });
    } else {
      setCurrentProduct(null);
    }
    const hasSKUs = product && product.skus && product.skus.length > 0;
    setHasSKU(hasSKUs);
    
    if (product) {
      form.setFieldsValue({
        name: product.name,
        code: product.code,
        unit: product.unit,
        description: product.description,
        has_sku: hasSKUs,
      });
      setImageUrl(product.image_path || product.image || '');
      
      // 取第一个SKU的code作为skuCode（仅编辑时）
      if (!hasSKUs && product.skus && product.skus.length > 0) {
        setSkuCode(product.skus[0].code || '');
      } else {
        setSkuCode(''); // 新增时skuCode为空
      }
      
      // 转换SKU为按颜色分组的结构
      if (hasSKUs && Array.isArray(product.skus)) {
        // 按颜色分组SKU
        const groupedSkus = [];
        const colorGroups = {};
        
        product.skus.forEach(sku => {
          const color = sku.color || '默认颜色';
          if (!colorGroups[color]) {
            colorGroups[color] = {
              color: color,
              image: sku.image || product.image_path || '',
              sizes: []
            };
            groupedSkus.push(colorGroups[color]);
          }
          
          colorGroups[color].sizes.push({
            size: sku.size || '默认尺码',
            code: sku.code
          });
        });
        
        setSkus(groupedSkus);
      } else {
        setSkus([]);
      }
    } else {
      form.resetFields();
      setImageUrl('');
      setSkus([]);
      setSkuCode(''); // 新增时skuCode为空
    }
    
    setFormVisible(true);
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
      const mainImageForSkus = uploadedImageUrl || imageUrl || ''; // Get the main image URL that will be saved

      if (hasSKU) {
        skus.forEach(colorGroup => {
          const colorImage = colorGroup.image || mainImageForSkus;
          colorGroup.sizes.forEach(sizeItem => {
            flatSkus.push({
              color: colorGroup.color,
              size: sizeItem.size,
              code: sizeItem.code,
              image: colorImage // Use color-specific image, fallback to main image if not available
            });
          });
        });
      } else {
        // Single SKU mode, ensure it also gets an image field, typically the main product image.
        flatSkus = [{
          code: skuCode || values.code, 
          color: '默认',
          size: '默认',
          image: mainImageForSkus // Assign main product image to the single SKU's image field
        }];
      }
      
      const productData = {
        ...values,
        skus: flatSkus,
        image: mainImageForSkus || 'https://picsum.photos/200', // Ensure productData.image is not just the placeholder if mainImageForSkus is empty
        ...(deletedSkuCodesThisSession.length > 0 && { deleted_sku_codes: deletedSkuCodesThisSession })
      };

      console.log('Submitting productData:', JSON.stringify(productData, null, 2)); // Log data being sent

      if (editing && editing._id) {
        await api.put(`/products/${editing._id}`, productData);
        message.success('产品已更新');
      } else {
        await api.post('/products', productData);
        message.success('产品已创建');
      }
      
      setDeletedSkuCodesThisSession([]);
      setModalVisible(false);
      fetchProducts();
    } catch (error) {
      console.error('保存产品失败:', error);
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfirmLoading(false);
    }
  };

  // 上传图片
  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.url) {
        setImageUrl(response.data.url);
        message.success('图片上传成功');
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败');
    } finally {
      setLoading(false);
    }
  };

  // 上传颜色图片
  const handleColorImageUpload = async (file, colorIndex) => {
    const formData = new FormData();
    formData.append('image', file); // 确保字段名是 'image'
    try {
      setLoading(true);
      const response = await api.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // 修复：只更新对应 colorIndex 的 image 字段
      setSkus(prevSkus => {
        const newSkus = [...prevSkus];
        newSkus[colorIndex] = { ...newSkus[colorIndex], image: response.data.url };
        return newSkus;
      });
      message.success('颜色图片上传成功');
    } catch (error) {
      console.error('颜色图片上传失败:', error);
      message.error('颜色图片上传失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 删除产品
  const handleDelete = async (productToDelete) => {
    Modal.confirm({
      title: <span style={{color: 'red', fontWeight: 'bold'}}>确认删除产品: {productToDelete.name || productToDelete.code}?</span>,
      icon: <WarningOutlined style={{ color: 'red' }} />,
      content: (
        <div>
          <p>您确定要删除产品 <strong>{productToDelete.name || productToDelete.code}</strong> 吗?</p>
          <p style={{color: 'red', fontWeight: 'bold'}}>
            此操作将会从系统中永久删除该产品，并且会同时删除该产品在所有库位的所有库存记录。
          </p>
          <p style={{color: 'red', fontWeight: 'bold'}}>此操作不可恢复！请谨慎操作。</p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          await api.delete(`/products/${productToDelete.id || productToDelete._id}`);
          message.success('产品及其库存已成功删除');
          fetchProducts(); // 重新获取产品列表
        } catch (error) {
          console.error('删除产品失败:', error);
          message.error('删除失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message));
        } finally {
          setLoading(false);
        }
      },
      onCancel() {
        console.log('取消删除产品');
      },
    });
  };

  // 添加颜色
  const handleAddColor = () => {
    console.log('[[ ADD COLOR ]]');
    let unusedColor = colorOptions.find(c => !skus.some(sku => sku.color === c)) || `新颜色${skus.length + 1}`;
    const defaultSize = sizeOptions[0] || 'M';
    // 获取当前商品编码
    const productCode = form.getFieldValue('code') || '';
    const newColor = {
      color: unusedColor, image: '',
      sizes: [{
        size: defaultSize,
        code: generateDynamicSkuCode(productCode, unusedColor, defaultSize, form)
      }]
    };
    setSkus([...skus, newColor]);
  };

  // 添加尺码
  const handleAddSize = (colorIndex) => {
    const updatedSkus = [...skus];
    const colorGroup = updatedSkus[colorIndex];
    console.log('[[ ADD SIZE ]] for color:', colorGroup.color);
    let unusedSize = sizeOptions.find(s => !colorGroup.sizes.some(item => item.size === s)) || `新尺码${colorGroup.sizes.length + 1}`;
    // 获取当前商品编码
    const productCode = form.getFieldValue('code') || '';
    colorGroup.sizes.push({
      size: unusedSize,
      code: generateDynamicSkuCode(productCode, colorGroup.color, unusedSize, form)
    });
    setSkus(updatedSkus);
  };

  // 更新颜色名称
  const handleUpdateColor = (index, newColorValue) => {
    console.log('[[ UPDATE COLOR ]] New color:', newColorValue, 'for index:', index);
    const updatedSkus = [...skus];
    updatedSkus[index].color = newColorValue;
    // 获取当前商品编码
    const productCode = form.getFieldValue('code') || '';
    // When color name changes, mark child SKU codes as needing regeneration
    updatedSkus[index].sizes.forEach((sizeItem, sizeIndex) => {
      updatedSkus[index].sizes[sizeIndex].code = generateDynamicSkuCode(productCode, newColorValue, sizeItem.size, form);
    });
    setSkus(updatedSkus);
  };

  // 更新尺码信息
  const handleUpdateSize = (colorIndex, sizeIndex, field, value) => {
    console.log(`[[ UPDATE SIZE ]] ColorIdx: ${colorIndex}, SizeIdx: ${sizeIndex}, Field: ${field}, Value: ${value}`);
    const updatedSkus = [...skus];
    const colorGroup = updatedSkus[colorIndex];
    updatedSkus[colorIndex].sizes[sizeIndex][field] = value;
    // 获取当前商品编码
    const productCode = form.getFieldValue('code') || '';
    if (field === 'size') {
      // When size name changes, mark this SKU code as needing regeneration
      updatedSkus[colorIndex].sizes[sizeIndex].code = generateDynamicSkuCode(productCode, colorGroup.color, value, form);
    }
    // If field is 'code', it's a direct manual update by user to the placeholder or existing code
    setSkus(updatedSkus);
  };

  // 移除颜色
  const handleRemoveColor = (index) => {
    const productCodeFromForm = form.getFieldValue('code');
    console.log('[[ REMOVE COLOR ]] Product code:', productCodeFromForm, 'Removing color at index:', index);
    const skusToRemove = skus[index]?.sizes?.map(s => s.code) || [];
    if (skusToRemove.length > 0) {
      console.log('[[ REMOVE COLOR ]] SKU codes to mark for deletion:', skusToRemove);
      setDeletedSkuCodesThisSession(prev => [...new Set([...prev, ...skusToRemove])]);
    }
    const updatedSkus = [...skus]; updatedSkus.splice(index, 1); setSkus(updatedSkus);
  };

  // 移除尺码
  const handleRemoveSize = (colorIndex, sizeIndex) => {
    const productCodeFromForm = form.getFieldValue('code');
    const colorGroup = skus[colorIndex];
    const sizeItem = colorGroup?.sizes?.[sizeIndex];
    if (sizeItem && sizeItem.code) {
      console.log('[[ REMOVE SIZE ]] Product code:', productCodeFromForm, 'Removing size at colorIdx:', colorIndex, 'sizeIdx:', sizeIndex, 'SKU code:', sizeItem.code);
      setDeletedSkuCodesThisSession(prev => [...new Set([...prev, sizeItem.code])]);
    }
    const updatedSkus = [...skus]; updatedSkus[colorIndex].sizes.splice(sizeIndex, 1); setSkus(updatedSkus);
  };

  // 打开扫码器
  const openScanner = () => {
    setScannerVisible(true);
  };
  
  // 处理扫码结果
  const handleScanResult = (barcode) => {
    if (!barcode) return;
    
    setSearchValue(barcode);
    setScannerVisible(false);
    
    // 延迟一点执行搜索，等待状态更新
    setTimeout(() => {
      handleSearch();
    }, 300);
  };

  // 打开SKU详情弹窗时加载库存
  const showSkuDetail = async (product, e) => {
    if (e) e.stopPropagation();
    if (product.has_sku && product.skus && product.skus.length > 0) {
      setSelectedProduct(product);
      setSkuDetailVisible(true);
      // 查询所有SKU库存
      try {
        const res = await api.get('/inventory/');
        const inventoryList = res.data || [];
        // 构建SKU库存映射
        const map = {};
        inventoryList.forEach(inv => {
          // 1. SKU独立行
          if (inv.productCode && inv.productCode.includes('-')) {
            map[inv.productCode] = inv.quantity || 0;
          }
          // 2. 主商品下的SKU
          if (inv.locations && Array.isArray(inv.locations)) {
            inv.locations.forEach(loc => {
              if (loc.skus && Array.isArray(loc.skus)) {
                loc.skus.forEach(sku => {
                  if (!map[sku.code]) map[sku.code] = 0;
                  map[sku.code] += sku.quantity || 0;
                });
              }
            });
          }
        });
        setSkuInventoryMap(map);
      } catch (err) {
        setSkuInventoryMap({});
      }
    } else {
      message.info('此产品没有SKU款式');
    }
  };

  // 获取所有库位
  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await api.get('/locations/');
      const locations = response.data;
      // 创建库位选项并插入"无货位"
      const allOptions = [
        { value: "无货位", label: "无货位" },
        ...locations.map(loc => ({
          value: loc.code,
          label: loc.code
        }))
      ];
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
  const showWarehouseAction = (type, sku) => {
    setWarehouseActionType(type);
    setSelectedSku(sku);
    setQuantity(1);
    setSelectedLocation('无货位');

    if (type === 'outbound' && sku && sku.code) {
      // 只显示该SKU有库存的库位
      api.get('/inventory/').then(res => {
        const inventoryList = res.data || [];
        const availableLocations = [];
        inventoryList.forEach(inv => {
          if (inv.locations && Array.isArray(inv.locations)) {
            inv.locations.forEach(loc => {
              if (loc.skus && Array.isArray(loc.skus)) {
                const skuInLoc = loc.skus.find(s => s.code === sku.code && s.quantity > 0);
                if (skuInLoc) {
                  availableLocations.push({
                    value: loc.locationCode,
                    label: `${loc.locationCode}（库存: ${skuInLoc.quantity}）`
                  });
                }
              }
            });
          }
        });
        // 如果没有可选库位，显示提示
        if (availableLocations.length === 0) {
          availableLocations.push({ value: '', label: '无可出库的库位', disabled: true });
        }
        setLocationOptions(availableLocations);
        setSelectedLocation(availableLocations[0]?.value || '');
      });
    } else {
      // 入库或其他情况，显示全部库位
      fetchLocations();
    }
    setWarehouseActionVisible(true);
  };
  
  // 执行入库/出库操作
  const handleWarehouseAction = async () => {
    if (!selectedSku || !selectedLocation || quantity <= 0) {
      message.warning(quantity <= 0 ? '数量必须大于0' : '请选择SKU和货位'); return;
    }
    console.log('[[ WAREHOUSE ACTION ]] Attempting action:', warehouseActionType, 'SKU:', selectedSku, 'Qty:', quantity, 'Loc:', selectedLocation);
    try {
      setLoading(true); // Start loading indicator for warehouse action
      const productCode = selectedSku.code.split('-')[0];
      console.log('[[ WAREHOUSE ACTION ]] Derived productCode:', productCode);
      const response = await api.get(`/products/code/${productCode}`);
      const product = response.data;
      if (!product || !(product.id || product._id)) { 
        message.error('找不到对应的产品或产品ID无效'); 
        console.error('[[ WAREHOUSE ACTION ]] Product not found or product ID missing. Product data:', product);
        setLoading(false);
        return; 
      }
      console.log('[[ WAREHOUSE ACTION ]] Found product by code:', product);
      const productId = product.id || product._id;
      console.log('[[ WAREHOUSE ACTION ]] Using productId:', productId);
      const payload = {
        product_id: productId, 
        locationCode: selectedLocation, 
        quantity: quantity,
        sku_code: selectedSku.code, 
        sku_color: selectedSku.color, 
        sku_size: selectedSku.size
      };
      console.log('[[ WAREHOUSE ACTION ]] Payload for API:', payload);
      const actionEndpoint = warehouseActionType === 'inbound' ? '/inbound/' : '/outbound/';
      await api.post(actionEndpoint, payload);
      message.success({
        content: `已${warehouseActionType === 'inbound' ? '入库' : '出库'}: ${product.name || productCode} (${selectedSku.code}) ${quantity}件 ${warehouseActionType === 'inbound' ? '到' : '从'} ${selectedLocation}`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
      setWarehouseActionVisible(false);
      // === 新增：操作成功后刷新SKU库存 ===
      if (selectedProduct) {
        await showSkuDetail(selectedProduct);
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
    setFileList([]);
    setUploadedImageUrl('');
    setImageUrl(''); 
    setHasSKU(true);
    form.setFieldsValue({ has_sku: true, code: '', name: '', unit: '件', description: '' });
    setSkuCode(''); 
    // 自动生成一个默认颜色为"本色"，尺码为"均码"的SKU
    const productCode = '';
    setSkus([
      {
        color: '本色',
        image: '',
        sizes: [
          {
            size: '均码',
            code: generateDynamicSkuCode(productCode, '本色', '均码', form)
          }
        ]
      }
    ]);
    setDeletedSkuCodesThisSession([]);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    const currentRecord = { ...record, _id: record._id || record.id };
    setEditing(currentRecord); 
    setDeletedSkuCodesThisSession([]);

    form.setFieldsValue({
      code: currentRecord.code,
      name: currentRecord.name,
      unit: currentRecord.unit,
      description: currentRecord.description,
      has_sku: !!currentRecord.has_sku 
    });

    setHasSKU(!!currentRecord.has_sku);

    const imageToUse = currentRecord.image_path || currentRecord.image;
    if (imageToUse) {
      const fullUrl = getFullImageUrl(imageToUse);
      setFileList([{ uid: '-1', name: 'image.png', status: 'done', url: fullUrl }]);
      setUploadedImageUrl(imageToUse); 
      setImageUrl(imageToUse); 
    } else {
      setFileList([]);
      setUploadedImageUrl('');
      setImageUrl('');
    }
    
    if (currentRecord.has_sku && Array.isArray(currentRecord.skus)) {
        const groupedSkus = [];
        const colorGroups = {};
        currentRecord.skus.forEach(sku => {
          const color = sku.color || '默认颜色';
          if (!colorGroups[color]) {
            colorGroups[color] = { color: color, image: sku.image || '', sizes: [] };
            groupedSkus.push(colorGroups[color]);
          }
          colorGroups[color].sizes.push({ size: sku.size || '默认尺码', code: sku.code });
        });
        setSkus(groupedSkus);
      } else {
        setSkus([]);
      }

    if (!currentRecord.has_sku && currentRecord.skus && currentRecord.skus.length > 0) {
      setSkuCode(currentRecord.skus[0].code || '');
    } else {
      setSkuCode('');
    }
    setModalVisible(true);
  };

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
      return false;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过2MB!');
      return false;
    }
    return true;
  };

  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    console.log('[[ MAIN IMG UPLOAD ]] Attempting to upload main product image:', file.name);
    const formData = new FormData();
    formData.append('image', file); // Field name for backend
    try {
      const response = await api.post('/upload/image', formData, { // Correct endpoint
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const serverUrl = response.data.url;
      console.log('[[ MAIN IMG UPLOAD ]] Success, server URL:', serverUrl);
      setUploadedImageUrl(serverUrl); // Store for submission
      // Update fileList for Antd Upload component to show the uploaded image
      setFileList([{ uid: file.uid, name: file.name, status: 'done', url: getFullImageUrl(serverUrl) }]);
      message.success('图片上传成功');
      onSuccess(response, file); // Notify Antd Upload
    } catch (err) {
      console.error('[[ MAIN IMG UPLOAD ]] Failed:', err.response || err);
      message.error('图片上传失败: ' + (err.response?.data?.message || err.message));
      onError(err); // Notify Antd Upload
    }
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
                type="primary" 
                icon={<ScanOutlined />} 
                onClick={openScanner}
              />
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
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {product.image_path || product.image ? (
                <img 
                  src={getFullImageUrl(product.image_path || product.image)} 
                  alt={product.name || product.code} 
                  style={{ width: 50, height: 50, marginRight: 12, objectFit: 'contain' }}
                  onClick={e => { e.stopPropagation(); handlePreview(getFullImageUrl(product.image_path || product.image)); }}
                />
              ) : (
                <div style={{ width: 50, height: 50, backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <PictureOutlined />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{product.name || product.code}</div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>编码: {product.code}</div>
                <div style={{ color: '#888', fontSize: '0.9em' }}>
                  单位: {product.unit || '件'}
                  {product.has_sku && 
                    <Badge
                      count={`${product.skus?.length || 0} SKU`}
                      style={{ backgroundColor: '#2db7f5', marginLeft: 8 }}
                    />
                  }
                  <span style={{ marginLeft: 12, color: '#52c41a', fontWeight: 500 }}>
                    总库存: {productInventoryMap[product.code] ?? 0}
                  </span>
                </div>
              </div>
              {/* 操作按钮区 */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={e => { e.stopPropagation(); handleEdit(product); }}
                />
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={e => { e.stopPropagation(); handleDelete(product); }}
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
              
              {/* 启用多SKU开关 */}
              <Form.Item
                label="启用多SKU（颜色/尺码）"
                name="has_sku"
                valuePropName="checked"
              >
                <Switch
                  checked={hasSKU}
                  onChange={checked => {
                    setHasSKU(checked);
                    if (!checked) {
                      setSkus([]);
                    } else {
                      const productCode = form.getFieldValue('code') || '';
                      setSkus([
                        {
                          color: '本色',
                          image: '',
                          sizes: [
                            {
                              size: '均码',
                              code: generateDynamicSkuCode(productCode, '本色', '均码', form)
                            }
                          ]
                        }
                      ]);
                    }
                  }}
                  checkedChildren="多SKU"
                  unCheckedChildren="单SKU"
                />
              </Form.Item>
              
              <Form.Item
                name="name"
                label="商品名称"
                extra="选填，如不填写将使用商品编码作为名称"
              >
                <Input placeholder="请输入商品名称（选填）" />
              </Form.Item>
              
              {/* 新增SKU编码输入框，仅在未启用多尺码/颜色时显示 */}
              {!hasSKU && (
                <Form.Item label="SKU编码">
                  <Input value={skuCode} onChange={e => setSkuCode(e.target.value)} placeholder="可留空，系统将自动用商品编码作为SKU编码" />
                </Form.Item>
              )}
              
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
              
              <Form.Item
                label="商品图片"
              >
                <Upload
                  listType="picture-card"
                  fileList={fileList}
                  customRequest={handleUpload}
                  beforeUpload={beforeUpload}
                  onPreview={handlePreview}
                  onChange={({ fileList }) => setFileList(fileList)}
                  maxCount={1}
                >
                  {fileList.length >= 1 ? null : (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>上传图片</div>
                    </div>
                  )}
                </Upload>
                {uploadedImageUrl && (
                  <div>
                    <p>已上传图片预览：</p>
                    <img
                      src={getFullImageUrl(uploadedImageUrl)}
                      alt="已上传图片"
                      style={{ width: 120, cursor: 'pointer' }}
                      onClick={handlePreview}
                    />
                  </div>
                )}
              </Form.Item>
            </Form>
          </TabPane>
          
          <TabPane tab="颜色尺码管理" key="2" disabled={!hasSKU}>
            {hasSKU && (
              <div>
                {skus.map((colorGroup, colorIdx) => (
                  <Card 
                    key={colorIdx}
                    size="small"
                    title={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span>颜色：</span>
                        <Select
                          mode="tags"
                          value={colorGroup.color ? [colorGroup.color] : []}
                          style={{ width: 120, marginRight: 8 }}
                          placeholder="颜色名称"
                          onChange={valueArr => handleUpdateColor(colorIdx, valueArr[0] || '')}
                          options={colorOptions.map(c => ({ value: c, label: c }))}
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
                            {colorGroup.image ? (
                              <img
                                src={getFullImageUrl(colorGroup.image)}
                                alt={colorGroup.color}
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                onClick={() => handlePreview(getFullImageUrl(colorGroup.image))}
                              />
                            ) : (
                              <div style={{ textAlign: 'center' }}>
                                <PictureOutlined style={{ fontSize: 24 }} />
                                <div>无图片</div>
                              </div>
                            )}
                          </div>
                          <Upload
                            showUploadList={false}
                            customRequest={({ file }) => handleColorImageUpload(file, colorIdx)}
                            beforeUpload={beforeUpload}
                            accept="image/*"
                          >
                            <Button icon={<PictureOutlined />}>上传图片</Button>
                          </Upload>
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>尺码列表:</div>
                          <Button size="small" type="primary" onClick={() => handleAddSize(colorIdx)}>添加尺码</Button>
                        </div>
                        
                        {colorGroup.sizes.map((sizeItem, sizeIdx) => {
                          const skuKey = `${colorGroup.color}-${sizeItem.size}-${sizeItem.code}`;
                          const isExpanded = expandedSkuKey === skuKey;
                          return (
                            <div key={sizeIdx} style={{
                              marginBottom: 8,
                              padding: '4px 8px',
                              border: '1px solid #f0f0f0',
                              borderRadius: '4px',
                              backgroundColor: isExpanded ? '#f6faff' : '#fafafa',
                              cursor: 'pointer'
                            }}
                              onClick={() => setExpandedSkuKey(isExpanded ? null : skuKey)}
                            >
                              {/* SKU信息Tag，点击可展开操作区 */}
                              <Tag color="blue" style={{ marginRight: 12, fontSize: 16, padding: '4px 12px' }}>
                                {sizeItem.size} ({sizeItem.code})
                                <span style={{ marginLeft: 8, color: '#52c41a', fontWeight: 500 }}>
                                  库存: {skuInventoryMap[sizeItem.code] ?? 0}
                                </span>
                              </Tag>
                              {/* 操作区：仅在展开时显示 */}
                              {isExpanded && (
                                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }} onClick={e => e.stopPropagation()}>
                                  <Button
                                    type="primary"
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                    size="small"
                                    icon={<InboxOutlined />}
                                    onClick={() => showWarehouseAction('inbound', {
                                      code: sizeItem.code,
                                      color: colorGroup.color,
                                      size: sizeItem.size
                                    })}
                                  >
                                    入库
                                  </Button>
                                  <Button
                                    danger
                                    size="small"
                                    icon={<ExportOutlined />}
                                    onClick={() => showWarehouseAction('outbound', {
                                      code: sizeItem.code,
                                      color: colorGroup.color,
                                      size: sizeItem.size
                                    })}
                                  >
                                    出库
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
              </div>
            )}
          </TabPane>
        </Tabs>
      </Modal>

      {/* SKU详情弹窗 */}
      <Modal
        title={selectedProduct ? `${selectedProduct.name || selectedProduct.code} 的SKU款式` : 'SKU详情'}
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
            {/* 按颜色分组显示SKU */}
            {(() => {
              // 按颜色分组SKU
              const colorGroups = {};
              
              selectedProduct.skus.forEach(sku => {
                const color = sku.color || '默认颜色';
                if (!colorGroups[color]) {
                  colorGroups[color] = {
                    color,
                    image: sku.image || selectedProduct.image_path || '',
                    sizes: []
                  };
                }
                colorGroups[color].sizes.push({
                  size: sku.size || '默认尺码',
                  code: sku.code,
                  color: sku.color,  // 添加颜色字段用于操作
                });
              });
              
              return Object.values(colorGroups).map((group, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  title={
                    <span style={{ fontWeight: 'bold' }}>
                      {group.color}
                      <span style={{ marginLeft: 16, color: '#52c41a', fontWeight: 500, fontSize: 14 }}>
                        总库存: {
                          group.sizes.reduce((sum, size) => sum + (skuInventoryMap[size.code] ?? 0), 0)
                        }
                      </span>
                    </span>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {/* 颜色图片 */}
                    <div style={{ flex: '0 0 100px', marginRight: 16 }}>
                      {group.image ? (
                        <img 
                          src={getFullImageUrl(group.image)} 
                          alt={group.color} 
                          style={{ width: '100%', objectFit: 'contain' }} 
                        />
                      ) : (
                        <div style={{ width: 100, height: 100, backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <PictureOutlined style={{ fontSize: 24 }} />
                        </div>
                      )}
                    </div>
                    
                    {/* 尺码列表 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>尺码列表:</div>
                        {group.sizes.map((size, idx) => {
                          const skuKey = `${group.color}-${size.size}-${size.code}`;
                          const isExpanded = expandedSkuKey === skuKey;
                          return (
                            <div key={idx} style={{
                              marginBottom: 8,
                              padding: '4px 8px',
                              border: '1px solid #f0f0f0',
                              borderRadius: '4px',
                              backgroundColor: isExpanded ? '#f6faff' : '#fafafa',
                              cursor: 'pointer'
                            }}
                              onClick={() => setExpandedSkuKey(isExpanded ? null : skuKey)}
                            >
                              {/* SKU信息Tag，点击可展开操作区 */}
                              <Tag color="blue" style={{ marginRight: 12, fontSize: 16, padding: '4px 12px' }}>
                                {size.size} ({size.code})
                                <span style={{ marginLeft: 8, color: '#52c41a', fontWeight: 500 }}>
                                  库存: {skuInventoryMap[size.code] ?? 0}
                                </span>
                              </Tag>
                              {/* 操作区：仅在展开时显示 */}
                              {isExpanded && (
                                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }} onClick={e => e.stopPropagation()}>
                                  <Button
                                    type="primary"
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                    size="small"
                                    icon={<InboxOutlined />}
                                    onClick={() => showWarehouseAction('inbound', {
                                      code: size.code,
                                      color: group.color,
                                      size: size.size
                                    })}
                                  >
                                    入库
                                  </Button>
                                  <Button
                                    danger
                                    size="small"
                                    icon={<ExportOutlined />}
                                    onClick={() => showWarehouseAction('outbound', {
                                      code: size.code,
                                      color: group.color,
                                      size: size.size
                                    })}
                                  >
                                    出库
                                  </Button>
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
        title={`${warehouseActionType === 'inbound' ? '入库' : '出库'}操作`}
        open={warehouseActionVisible}
        onCancel={() => setWarehouseActionVisible(false)}
        onOk={handleWarehouseAction}
        confirmLoading={loadingLocations}
      >
        {selectedSku && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                {selectedProduct?.name || ''} ({selectedSku.code})
              </div>
              <div style={{ color: '#666' }}>
                {selectedSku.color} - {selectedSku.size}
              </div>
            </div>
            
            <Form layout="vertical">
              <Form.Item label="数量">
                <InputNumber 
                  min={1} 
                  value={quantity} 
                  onChange={setQuantity} 
                  style={{ width: '100%' }} 
                />
              </Form.Item>
              
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
            </Form>
          </div>
        )}
      </Modal>

      {/* 扫码器Modal */}
      <Modal
        title="扫描条码"
        open={scannerVisible}
        onCancel={() => setScannerVisible(false)}
        footer={null}
        width="100%"
        style={{ top: 0 }}
        bodyStyle={{ height: 'calc(100vh - 100px)', padding: 0 }}
      >
        <BarcodeScannerComponent 
          onScan={handleScanResult}
          onClose={() => setScannerVisible(false)}
        />
      </Modal>

      {/* 图片预览Modal */}
      <Modal
        title="图片预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={320}
      >
        <Image
          src={previewImage}
          style={{ width: '100%' }}
          preview={false}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        />
      </Modal>
    </div>
  );
};

export default MobileProductManage; 