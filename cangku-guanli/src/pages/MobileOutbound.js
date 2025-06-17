import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Form, InputNumber, Select, Modal } from 'antd';
import { ScanOutlined, DeleteOutlined, SaveOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';
import theme, { getStyle, messageConfig } from '../styles/theme';
import { getFullImageUrl } from '../utils/imageUtils';

const { Option } = Select;

const MobileOutbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [productSuggestionVisible, setProductSuggestionVisible] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [styleOptions, setStyleOptions] = useState([]);
  const [colorOptions, setColorOptions] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [suggestedInventory, setSuggestedInventory] = useState(null);
  const [allInventory, setAllInventory] = useState([]);
  
  // 添加SKU选择相关状态
  const [skuSelectVisible, setSkuSelectVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSku, setSelectedSku] = useState(null);
  
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  const [previewImage, setPreviewImage] = useState(null);
  
  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    message.success('退出成功');
    navigate('/login');
  };
  
  // 在组件加载时获取库位信息
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取所有库位
        const locationsRes = await api.get('/locations/');
        setLocations(locationsRes.data);
        
        // 获取库存明细
        await fetchInventory();
      } catch (error) {
        console.error('获取数据失败:', error);
        message.error('获取数据失败');
      }
    };
    
    fetchData();
  }, []);
  
  // 获取库存数据
  const fetchInventory = async () => {
    try {
      const inventoryRes = await api.get('/inventory/');
      const inventory = inventoryRes.data;
      
      // 创建扁平化数据结构，直接展示SKU信息
      const flattenedInventory = [];
      
      // 处理每个库存项
      inventory.forEach(item => {
        // 检查是否是SKU商品
        if (item.productCode && item.productCode.includes('-')) {
          // 将SKU直接添加到列表
          const parts = item.productCode.split('-');
          const baseCode = parts[0];
          const color = parts.length > 1 ? parts[1] : '';
          const size = parts.length > 2 ? parts[2] : '';
          
          flattenedInventory.push({
            ...item,
            isSku: true,
            baseProductCode: baseCode,
            color: color,
            size: size,
            skuInfo: {
              code: item.productCode,
              color: color,
              size: size
            }
          });
        } else {
          // 检查是否有SKU子项
          if (item.locations) {
            let hasSku = false;
            
            item.locations.forEach(loc => {
              if (loc.skus && loc.skus.length > 0) {
                hasSku = true;
                
                // 将每个SKU作为单独条目添加
                loc.skus.forEach(sku => {
                  // 检查是否已有足够的库存信息
                  if (sku.quantity > 0) {
                    // 创建包含必要信息的SKU条目
                    flattenedInventory.push({
                      product_id: item.product_id,
                      productCode: sku.code,
                      productName: `${item.productName || ''} (${sku.color || ''} ${sku.size || ''})`,
                      quantity: sku.quantity,
                      unit: item.unit || '件',
                      isSku: true,
                      baseProductCode: item.productCode,
                      baseProductName: item.productName,
                      color: sku.color,
                      size: sku.size,
                      skuInfo: {
                        code: sku.code,
                        color: sku.color,
                        size: sku.size
                      },
                      // 仅保留有该SKU的库位
                      locations: [{
                        ...loc,
                        quantity: sku.quantity,
                        skus: [sku]
                      }]
                    });
                  }
                });
              }
            });
            
            // 如果有SKU，添加分类条目；如果没有，添加普通商品
            if (hasSku) {
              flattenedInventory.push({
                ...item,
                isCategory: true
              });
            } else {
              flattenedInventory.push(item);
            }
          } else {
            // 普通商品，直接添加
            flattenedInventory.push(item);
          }
        }
      });
      
      setAllInventory(flattenedInventory);
      console.log('获取库存成功', flattenedInventory.length);
    } catch (error) {
      console.error('获取库存失败', error);
    }
  };

  // 移除商品
  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
    message.success({
      content: '已移除',
      icon: messageConfig.success.icon
    });
  };

  // 处理条码扫描
  const handleScan = async () => {
    if (!inputCode || inputCode.length < 3) return;
    try {
      setLoading(true);
      // 1. 先查SKU码
      if (inputCode.includes('-')) {
        // 新增：如果是完整SKU码，且能唯一匹配SKU，直接添加
        let baseProductCode = inputCode.split('-')[0];
        let response = await api.get(`/products/code/${baseProductCode}`);
        let product = response.data;
        if (product && product.skus && product.skus.length > 0) {
          const matchingSku = product.skus.find(sku => sku.code === inputCode);
          if (matchingSku) {
            await addProductWithSku(product, matchingSku);
            setInputCode('');
            setLoading(false);
            return;
          }
        }
        // 否则走原有逻辑
        await handleSkuBarcode(inputCode);
        setLoading(false);
        return;
      }
      // 2. 查商品码
      try {
        const res = await api.get(`/products/code/${inputCode}`);
        if (res.data) {
          selectProduct(res.data);
          setInputCode('');
          setLoading(false);
          return;
        }
      } catch (err) {
        // 3. 查外部条码（商品级）
        if (err.response && err.response.status === 404) {
          try {
            const res = await api.get(`/products/external-code/${inputCode}`);
      if (res.data) {
        selectProduct(res.data);
        setInputCode('');
        setLoading(false);
        return;
      }
          } catch (err2) {
            // 4. 查SKU外部码
        try {
              const externalRes = await api.get(`/sku/external/${inputCode}`);
              if (externalRes.data && externalRes.data.skuCode) {
                const skuData = externalRes.data;
                await addProductWithSku({
                  code: skuData.productCode,
                  name: skuData.productName,
                  _id: skuData.product_id,
                  skus: [skuData.sku]
                }, skuData.sku);
                setInputCode('');
                setLoading(false);
                return;
          }
            } catch (e) {
              // 5. 走原有流程
            }
          }
        } else {
          throw err;
        }
      }
      // 5. 走原有流程
          message.warning('未找到商品，请核对编码');
    } catch (error) {
      console.error('扫码错误:', error);
      message.error('查询失败，请重试');
    } finally {
      setLoading(false);
      setInputCode('');
    }
  };
  
  // 处理SKU条码扫描
  const handleSkuBarcode = async (skuCode) => {
    try {
      // 先检查库存中是否直接有该SKU
      const matchingSku = allInventory.find(item => 
        item.isSku && item.productCode === skuCode && item.quantity > 0
      );
      let baseProductCode = skuCode.split('-')[0];
      let response, product;
      // 获取完整商品信息
      response = await api.get(`/products/code/${baseProductCode}`);
      product = response.data;
      if (matchingSku) {
        // 直接从库存添加SKU
        const skuObj = {
          code: matchingSku.productCode,
          color: matchingSku.color,
          size: matchingSku.size
        };
        await addProductWithSku(product, skuObj);
        return;
      }
      
      // 如果库存中没有直接匹配，按原有流程处理
      // 提取基础商品编码
      baseProductCode = skuCode.split('-')[0];
      
      // 查找商品
      response = await api.get(`/products/code/${baseProductCode}`);
      product = response.data;
      
      if (!product) {
        message.warning('未找到商品，请核对编码');
        return;
      }
      
      // 检查SKU
      if (product.skus && product.skus.length > 0) {
        const matchingSku = product.skus.find(sku => sku.code === skuCode);
        
        if (matchingSku) {
          // 有匹配的SKU，直接选择
          await addProductWithSku(product, matchingSku);
          return;
        }
      }
      
      // 未找到精确匹配的SKU，尝试解析SKU信息
      const parts = skuCode.split('-');
      if (parts.length >= 3) {
        const color = parts[1];
        const size = parts[2];
        
        // 创建临时SKU对象
        const tempSku = {
          code: skuCode,
          color: color,
          size: size
        };
        
        // 添加到出库列表
        await addProductWithSku(product, tempSku);
      } else {
        // 无法解析SKU信息，显示普通商品选择
        selectProduct(product);
      }
    } catch (error) {
      console.error('处理SKU条码失败:', error);
      message.error('SKU查询失败');
    }
  };

  // 选择商品（修复selectProduct未定义问题）
  const selectProduct = async (product) => {
    setCurrentProduct(product);
    // 如果有SKU，弹出SKU选择
    if (product.has_sku && product.skus && product.skus.length > 0) {
      // 构建SKU选项
      let skuOpts = product.skus.map(sku => ({
        value: sku.code,
        label: `${sku.color || ''} ${sku.size || ''} (${sku.code})`,
        sku: { ...sku, code: sku.code }
      }));
      setSkuOptions(skuOpts);
      setSelectedSku(null);
      setSkuSelectVisible(true);
    } else {
      // 没有SKU，直接添加到出库列表
      await addProductWithSku(product, null);
      setInputCode('');
    }
  };

  // 添加带SKU的商品
  const addProductWithSku = async (product, sku) => {
    console.log("添加SKU商品:", product.code, sku);
    
    // 直接查找匹配的SKU库存
    let skuInventory = null;
    
    if (sku && sku.code) {
      // 先查找精确匹配的SKU库存
      skuInventory = allInventory.find(item => 
        item.isSku && item.productCode === sku.code && item.quantity > 0
      );
      
      // 如果没找到精确匹配，尝试通过颜色和尺码查找
      if (!skuInventory && sku.color && sku.size) {
        skuInventory = allInventory.find(item => 
          item.isSku && 
          item.baseProductCode === product.code &&
          item.color === sku.color && 
          item.size === sku.size &&
          item.quantity > 0
        );
      }
    }
    
    // 如果找到了SKU库存，使用它的信息
    if (skuInventory) {
      // 获取适合出库的库位（有SKU库存的）
      let bestLocation = null;
      let maxQuantity = 0;
      
      // 找到库存最多的库位
      if (skuInventory.locations && skuInventory.locations.length > 0) {
        skuInventory.locations.forEach(loc => {
          if (loc.quantity > maxQuantity) {
            maxQuantity = loc.quantity;
            bestLocation = loc;
          }
        });
      }
      
      if (!bestLocation || maxQuantity <= 0) {
        message.warning(`${product.name} (${sku.color} ${sku.size}) 无库存或库位信息不完整`);
        return false;
      }
      
      let masterProductSku = null;
      if (product.skus && sku && sku.code) {
        masterProductSku = product.skus.find(s => s.code === sku.code);
      }
      const skuImage = masterProductSku?.image_path || masterProductSku?.image || sku?.image_path || sku?.image || product.image || '';
      
      // 添加到出库列表
      setTableData([...tableData, {
        key: Date.now().toString(),
        productId: product._id || skuInventory.product_id,
        productCode: product.code,
        productName: product.name || skuInventory.baseProductName,
        skuCode: sku.code,
        skuColor: sku.color,
        skuSize: sku.size,
        unit: product.unit || skuInventory.unit || '件',
        location: bestLocation.locationCode,
        locationName: bestLocation.locationName || bestLocation.locationCode,
        quantity: 1,
        maxQuantity: maxQuantity,
        image: product.image || skuInventory.image,
        skuImage,
      }]);
      
      message.success(`已添加: ${product.name || skuInventory.baseProductName} (${sku.color} ${sku.size})`);
      return true;
    }
    
    // 使用原来的查找逻辑作为后备
    const productInventory = allInventory.find(i => !i.isSku && i.productCode === product.code);
    
    if (!productInventory || !productInventory.locations || productInventory.locations.length === 0) {
      message.warning(`${product.name} (${sku?.code || product.code}) 无库存`);
      return false;
    }
    
    // 获取所有有库存的位置 - 如果有SKU，则只显示有该SKU库存的货位
    let filteredLocations = productInventory.locations.filter(loc => loc.quantity > 0);
    
    // 如果是SKU，筛选有该SKU库存的货位
    if (sku && sku.code) {
      filteredLocations = filteredLocations.filter(loc => {
        if (!loc.skus || !Array.isArray(loc.skus)) return false;
        
        // 查找匹配的SKU
        const matchedSku = loc.skus.find(s => 
          s.code === sku.code || 
          (s.color === sku.color && s.size === sku.size)
        );
        
        return matchedSku && matchedSku.quantity > 0;
      });
    }
    
    if (filteredLocations.length === 0) {
      message.warning(`${product.name} ${sku ? `(${sku.color} ${sku.size})` : ''} 在所有库位都无库存`);
      return false;
    }
    
    // 默认选择库存最多的位置
    let bestLocation = filteredLocations[0];
    let maxQuantity = 0;
    
    filteredLocations.forEach(loc => {
      let quantity = 0;
      
      if (sku && sku.code) {
        // 查找匹配的SKU库存
        const matchedSku = loc.skus?.find(s => 
          s.code === sku.code || 
          (s.color === sku.color && s.size === sku.size)
        );
        quantity = matchedSku?.quantity || 0;
      } else {
        quantity = loc.quantity;
      }
      
      if (quantity > maxQuantity) {
        maxQuantity = quantity;
        bestLocation = loc;
      }
    });
    
    // 确定库存数量
    let skuInventoryQty = 0;
    if (sku && sku.code && bestLocation.skus) {
      const matchedSku = bestLocation.skus.find(s => 
        s.code === sku.code || 
        (s.color === sku.color && s.size === sku.size)
      );
      skuInventoryQty = matchedSku?.quantity || 0;
    }
    
    let masterProductSku = null;
    if (product.skus && sku && sku.code) {
      masterProductSku = product.skus.find(s => s.code === sku.code);
    }
    const skuImage = masterProductSku?.image_path || masterProductSku?.image || sku?.image_path || sku?.image || product.image || '';
    
    // 添加到出库列表
    setTableData([...tableData, {
      key: Date.now().toString(),
      productId: product._id,
      productCode: product.code,
      productName: product.name,
      skuCode: sku?.code || null,
      skuColor: sku?.color || null,
      skuSize: sku?.size || null,
      unit: product.unit || '件',
      location: bestLocation.locationCode,
      locationName: bestLocation.locationName || bestLocation.locationCode,
      quantity: 1,
      maxQuantity: sku?.code ? skuInventoryQty : bestLocation.quantity,
      image: product.image || null,
      skuImage,
    }]);
    
    message.success(`已添加: ${product.name} ${sku ? `(${sku.color} ${sku.size})` : ''}`);
    return true;
  };

  // 显示SKU选择器
  const showSkuSelector = async (product) => {
    setCurrentProduct(product);
      
      // 查找库存
    const productInventory = allInventory.find(i => i.productCode === product.code);
    
    // 构建SKU选项
    let skuOpts = [];
    
    if (product.skus && product.skus.length > 0) {
      // 获取所有SKU
      const allSkus = product.skus.map(sku => {
        // 确保SKU编码使用"商品编码-颜色-尺码"格式
        const skuCode = sku.code.startsWith(product.code) 
          ? sku.code 
          : `${product.code}-${sku.color}-${sku.size}`;
        
        return {
          ...sku,
          code: skuCode,
          hasInventory: false,
          totalQuantity: 0,
          locations: []
        };
      });
      
      // 如果有库存数据，检查每个SKU的库存情况
      if (productInventory && productInventory.locations) {
        // 遍历每个库位
        productInventory.locations.forEach(loc => {
          if (loc.skus && Array.isArray(loc.skus)) {
            // 遍历库位中的每个SKU
            loc.skus.forEach(locSku => {
              // 找到匹配的SKU
              const matchingSku = allSkus.find(s => 
                s.code === locSku.code || 
                (s.color === locSku.color && s.size === locSku.size)
              );
              
              if (matchingSku && locSku.quantity > 0) {
                matchingSku.hasInventory = true;
                matchingSku.totalQuantity += locSku.quantity;
                matchingSku.locations.push({
                  locationCode: loc.locationCode,
                  quantity: locSku.quantity
                });
              }
            });
          }
        });
      }
      
      // 只保留有库存的SKU
      const skusWithInventory = allSkus.filter(sku => sku.hasInventory);
      
      // 如果有SKU有库存，使用这些SKU
      if (skusWithInventory.length > 0) {
        skuOpts = skusWithInventory.map(sku => ({
          value: sku.code,
          label: `${sku.color || ''} ${sku.size || ''} (${sku.code}) - 库存:${sku.totalQuantity}`,
          sku: sku
        }));
      } else {
        // 提示没有SKU有库存
        message.warning(`没有找到 ${product.name || product.code} 的任何SKU库存`);
      }
    }
    
    // 如果是1008商品或没有SKU，添加硬编码的选项
    if ((product.code === "1008" || (product.has_sku && (!product.skus || product.skus.length === 0))) && skuOpts.length === 0) {
      // 对于1008商品，尝试从库存中查找SKU
      const defaultSkus = [
        {
          code: `${product.code}-黑色-M`,
          color: "黑色",
          size: "M",
          hasInventory: false,
          totalQuantity: 0,
          locations: []
        },
        {
          code: `${product.code}-红色-M`,
          color: "红色",
          size: "M",
          hasInventory: false,
          totalQuantity: 0,
          locations: []
        },
        {
          code: `${product.code}-黑色-L`,
          color: "黑色",
          size: "L",
          hasInventory: false,
          totalQuantity: 0,
          locations: []
        }
      ];
      
      // 检查库存中是否有这些SKU
      if (productInventory && productInventory.locations) {
        productInventory.locations.forEach(loc => {
          if (loc.skus && Array.isArray(loc.skus)) {
            loc.skus.forEach(locSku => {
              const matchingSku = defaultSkus.find(s => 
                s.code === locSku.code || 
                (s.color === locSku.color && s.size === locSku.size)
              );
              
              if (matchingSku && locSku.quantity > 0) {
                matchingSku.hasInventory = true;
                matchingSku.totalQuantity += locSku.quantity;
                matchingSku.locations.push({
                  locationCode: loc.locationCode,
                  quantity: locSku.quantity
                });
              }
            });
          }
        });
      }
      
      // 只保留有库存的SKU
      const defaultSkusWithInventory = defaultSkus.filter(sku => sku.hasInventory);
      
      if (defaultSkusWithInventory.length > 0) {
        skuOpts = defaultSkusWithInventory.map(sku => ({
          value: sku.code,
          label: `${sku.color || ''} ${sku.size || ''} (${sku.code}) - 库存:${sku.totalQuantity}`,
          sku: sku
        }));
      } else {
        message.warning(`${product.name || product.code} 没有任何SKU库存`);
      }
    }
    
    if (skuOpts.length === 0) {
      // 如果没有找到任何有库存的SKU，提示并返回
      message.warning(`${product.name || product.code} 没有可出库的SKU库存`);
      return false;
    }
    
    // 按库存数量降序排序
    skuOpts.sort((a, b) => b.sku.totalQuantity - a.sku.totalQuantity);
    
    setSkuOptions(skuOpts);
    setSelectedSku(null);
    setSkuSelectVisible(true);
    
    return false; // 中断流程，等待用户选择
  };

  // 处理SKU选择确认
  const handleSkuSelect = async () => {
    if (!selectedSku || !currentProduct) {
      message.warning('请选择一个款式');
      return;
    }
    
    const selectedSkuObj = skuOptions.find(option => option.value === selectedSku)?.sku;
    if (!selectedSkuObj) {
      message.warning('无效的SKU');
      return;
    }
    
    // 添加选择的商品和SKU
    await addProductWithSku(currentProduct, selectedSkuObj);
    
    // 关闭SKU选择
    setSkuSelectVisible(false);
    
    // 清空输入框并聚焦
    setInputCode('');
    document.getElementById('scanInput').focus();
  };
  
  // 当用户改变款式选择
  const handleStyleChange = (styleCode) => {
    setSelectedStyle(styleCode);
    
    // 找到对应的产品
    const product = suggestedProducts.find(p => p.code === styleCode);
    if (!product) return;
    
    // 获取该产品的所有颜色选项
    const colorSet = new Set();
    product.skus.forEach(sku => {
      if (sku.color) colorSet.add(sku.color);
    });
    
    // 转换为下拉选项格式
    const colors = Array.from(colorSet).map(color => ({
      value: color,
      label: color
    }));
    
    // 更新颜色选项
    setColorOptions(colors);
    
    // 默认选择第一个颜色或保持当前选择
    const newColor = colors.find(c => c.value === selectedColor)
      ? selectedColor
      : (colors.length > 0 ? colors[0].value : null);
    
    setSelectedColor(newColor);
    
    // 更新尺码选项
    updateSizeOptions(product, newColor);
    
    // 更新库存信息
    setSuggestedInventory(product.inventory);
  };

  // 当用户改变颜色选择
  const handleColorChange = (color) => {
    setSelectedColor(color);
    
    // 找到对应的产品
    const product = suggestedProducts.find(p => p.code === selectedStyle);
    if (!product) return;
    
    // 更新尺码选项
    updateSizeOptions(product, color);
  };

  // 更新尺码选项
  const updateSizeOptions = (product, color) => {
    // 获取该颜色的所有尺码选项
    const sizeSet = new Set();
    product.skus
      .filter(sku => !color || sku.color === color)
      .forEach(sku => {
        if (sku.size) sizeSet.add(sku.size);
      });
    
    // 转换为下拉选项格式
    const sizes = Array.from(sizeSet).map(size => ({
      value: size,
      label: size
    }));
    
    // 更新尺码选项
    setSizeOptions(sizes);
    
    // 默认选择第一个尺码或保持当前选择
    const newSize = sizes.find(s => s.value === selectedSize)
      ? selectedSize
      : (sizes.length > 0 ? sizes[0].value : null);
    
    setSelectedSize(newSize);
  };

  // 确认选择推荐商品
  const confirmProductSelection = async () => {
    if (!selectedStyle) {
      message.warning('请选择商品');
      return;
    }
    
    // 找到对应的产品
    const product = suggestedProducts.find(p => p.code === selectedStyle);
    if (!product) {
      message.warning('无法找到选择的商品');
      return;
    }
    
    // 检查是否是SKU商品
    let sku = null;
    if (product.has_sku && product.skus && product.skus.length > 0) {
      // 需要检查颜色和尺码
      if (!selectedColor || !selectedSize) {
        message.warning('请选择完整的颜色和尺码信息');
        return;
      }
      
      // 查找对应的SKU
      sku = product.skus.find(sku => 
        sku.color === selectedColor && sku.size === selectedSize
      );
      
      if (!sku) {
        message.warning('无法找到对应的SKU');
        return;
      }
    }
    
    // 检查库存
    const inventory = product.inventory;
    if (!inventory) {
      message.warning('该商品无库存信息');
      return;
    }
    
    // 查找商品库存
    const productInventory = allInventory.find(i => i.productCode === product.code);
    
    if (!productInventory || !productInventory.locations || productInventory.locations.length === 0) {
      message.warning(`${product.name} 无库存`);
      return;
    }
    
    // 获取所有有库存的位置
    const availableLocations = productInventory.locations
      .filter(loc => loc.quantity > 0)
      .map(loc => ({
        value: loc.locationCode,
        label: `${loc.locationCode} (${loc.quantity}件)`,
        quantity: loc.quantity
      }));
    
    if (availableLocations.length === 0) {
      message.warning(`${product.name} 无可用库存`);
      return;
    }
    
    // 默认选择第一个位置
      const loc = productInventory.locations[0];
      const location = locations.find(l => l.code === loc.locationCode);
      
    // 创建新商品条目
    const newItem = {
      key: `${product.code}-${Date.now()}`,
      productCode: product.code,
      productName: product.name || product.code,
          unit: product.unit || '件',
          quantity: 1,
          location: loc.locationCode,
          product_id: product.id || product._id,
          location_id: location ? (location.id || location._id) : null,
          image: product.image_path || product.image || '',
      availableLocations: availableLocations,
      maxQuantity: loc.quantity
    };
    
    // 如果有SKU信息，添加到商品条目中
    if (sku) {
      newItem.skuCode = sku.code;
      newItem.skuColor = sku.color;
      newItem.skuSize = sku.size;
    }
    
    // 添加到表格数据
    setTableData(prevData => [...prevData, {
      ...newItem,
      availableLocations: newItem.availableLocations || []
    }]);
    
    // 根据是否有SKU显示不同的成功提示
    if (sku) {
      message.success({
        content: `已添加 ${product.name} (${sku.color} ${sku.size})`,
        icon: messageConfig.success.icon
      });
    } else {
      message.success({
        content: `已添加 ${product.name}`,
        icon: messageConfig.success.icon
      });
    }
    
    // 关闭弹窗
    setProductSuggestionVisible(false);
    
    // 清空输入
    setInputCode('');
  };

  // 更新库位选择处理函数
  const handleLocationChange = (code, newLocation) => {
    setTableData(prevData => prevData.map(item => {
      if (item.productCode === code) {
        // 找到对应位置的最大可用数量
        const locationInfo = item.availableLocations.find(loc => loc.value === newLocation);
        
        // 如果当前数量超过了新位置的最大数量，自动调整数量
        let newQuantity = item.quantity;
        if (locationInfo && locationInfo.quantity < item.quantity) {
          newQuantity = locationInfo.quantity;
          // 使用setTimeout避免在状态更新过程中显示消息
          setTimeout(() => {
            message.warning(`数量已自动调整为该库位最大可用数量: ${locationInfo.quantity}`);
          }, 100);
        }
        
        return {
          ...item,
          location: newLocation,
          maxQuantity: locationInfo ? locationInfo.quantity : item.maxQuantity,
          quantity: newQuantity
        };
      }
      return item;
    }));
    
    message.success({
      content: "已更改货位",
      icon: messageConfig.success.icon
    });
  };
  
  // 确认出库处理函数
  const handleConfirmOutbound = async () => {
    if (tableData.length === 0) {
      message.warning('没有选择任何商品');
      return;
    }
    
    // 首先验证所有商品的数量是否合法
    for (const item of tableData) {
      if (item.quantity <= 0) {
        message.warning(`商品 ${item.productName} 数量必须大于0`);
        return;
      }
      if (item.quantity > item.maxQuantity) {
        message.warning(`商品 ${item.productName} 出库数量(${item.quantity})超过了可用数量(${item.maxQuantity})`);
        return;
      }
    }
    
    // 更新库存并验证出库数量限制
    try {
      // 获取最新库存数据
      await fetchInventory();
      
      // 根据最新库存重新检查数量限制
      for (const item of tableData) {
        // 查找商品库存
        const productInventory = allInventory.find(i => i.productCode === item.productCode);
        if (!productInventory || !productInventory.locations) {
          message.warning(`商品 ${item.productName} 无库存数据`);
          return;
        }
        
        // 查找选定库位的库存
        const locationInventory = productInventory.locations.find(l => l.locationCode === item.location);
        if (!locationInventory) {
          message.warning(`商品 ${item.productName} 在选定库位没有库存`);
          return;
        }
        
        // 对于SKU商品，检查SKU库存
        if (item.skuCode) {
          let skuQuantity = 0;
          
          if (locationInventory.skus && Array.isArray(locationInventory.skus)) {
            // 首先尝试精确匹配SKU编码
            const exactMatch = locationInventory.skus.find(s => s.code === item.skuCode);
            if (exactMatch) {
              skuQuantity = exactMatch.quantity;
            } else if (item.skuColor && item.skuSize) {
              // 尝试匹配颜色和尺码
              const colorSizeMatch = locationInventory.skus.find(s => 
                s.color === item.skuColor && 
                s.size === item.skuSize
              );
              if (colorSizeMatch) {
                skuQuantity = colorSizeMatch.quantity;
              }
            }
          }
          
          if (item.quantity > skuQuantity) {
            message.warning(`商品 ${item.productName} (${item.skuColor}-${item.skuSize}) 出库数量(${item.quantity})超过了可用数量(${skuQuantity})`);
            return;
          }
        } else {
          // 非SKU商品，直接检查库位总库存
          if (item.quantity > locationInventory.quantity) {
            message.warning(`商品 ${item.productName} 出库数量(${item.quantity})超过了可用数量(${locationInventory.quantity})`);
            return;
          }
        }
      }
      
      setLoading(true);
      
      // 处理每个商品的出库
      for (const item of tableData) {
        try {
          // 调用API执行出库操作
          const outboundData = {
            product_code: item.productCode,
            location_code: item.location,
            quantity: item.quantity
          };
          
          // 如果有SKU信息，添加到出库数据中
          if (item.skuCode) {
            outboundData.sku_code = item.skuCode;
            outboundData.sku_color = item.skuColor;
            outboundData.sku_size = item.skuSize;
          }
          
          await api.post('/outbound', outboundData);
          
          message.success({
            content: `商品 ${item.productName} ${item.skuColor && item.skuSize ? `(${item.skuColor}-${item.skuSize})` : ''} 出库成功`,
            icon: messageConfig.success.icon
          });
        } catch (error) {
          console.error(`出库商品 ${item.productName} 失败:`, error);
          message.error(`商品 ${item.productName} 出库失败: ${error.response?.data?.message || error.message}`);
          // 继续处理其他商品
        }
      }
      
      // 重新获取库存数据
      await fetchInventory();
      
      // 清空出库列表
      setTableData([]);
      message.success({
        content: '出库操作完成',
        icon: messageConfig.success.icon
      });
    } catch (error) {
      console.error('出库操作失败:', error);
      message.error('出库操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '8px' }}>
      <MobileNavBar currentPage="outbound" />
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px' 
      }}>
      {/* 扫码区域 */}
      <div style={{ ...getStyle('compactLayout') }}>
        <Input.TextArea
          id="scanInput"
          placeholder="商品条码或手动输入 (支持多行粘贴)"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleScan();
            }
          }}
          style={{ 
            width: '100%', 
            resize: 'none', 
            height: '65px', 
            fontSize: '14px',
            border: '1px solid #e8e8e8',
            borderRadius: '4px',
            marginBottom: '2px'
          }}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </div>
      
      {/* 选中的商品列表 */}
      <List
        header={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '2px',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>出库商品({tableData.length})</span>
            {tableData.length > 0 && (
              <Button 
                type="primary" 
                size="large"
                style={{ width: '100%', height: 48, fontSize: 18, marginBottom: 8 }}
                onClick={handleConfirmOutbound}
              >
                确认出库
              </Button>
            )}
          </div>
        }
        style={{ padding: '0' }}
        dataSource={tableData}
        renderItem={item => (
          <List.Item
            style={{ display: 'flex', alignItems: 'center' }}
            actions={[]}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, maxWidth: 320, minWidth: 0 }}>
              <div style={{ marginRight: 12, width: 65, height: 65, borderRadius: 4, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => {
                  const img = item.skuImage || item.image;
                  if (img) setPreviewImage(getFullImageUrl(img));
                }}
              >
                {item.skuImage || item.image ? (
                  <img src={getFullImageUrl(item.skuImage || item.image)} alt={item.productName} style={{ width: 65, height: 65, objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: '#bbb', fontSize: 18 }}>无图</span>
                )}
              </div>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                    <span style={{ 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      maxWidth: '100%'
                    }}>
                      {item.productName} {item.skuColor && item.skuSize ? `(${item.skuColor}-${item.skuSize})` : ''}
                    </span>
                  </div>
                }
                description={
                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '40px' }}>库位:</span>
                      <Select
                        value={item.location}
                        onChange={value => handleLocationChange(item.productCode, value)}
                        style={{ flex: 1, fontSize: '12px' }}
                        size="small"
                        dropdownMatchSelectWidth={false}
                      >
                        {(item.availableLocations || []).map(loc => (
                          <Option key={loc.value} value={loc.value}>{loc.label}</Option>
                        ))}
                      </Select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '40px' }}>数量:</span>
                      <InputNumber 
                        min={1} 
                        max={item.maxQuantity}
                        value={item.quantity} 
                        onChange={value => {
                          setTableData(prevData => prevData.map(d => {
                            if (d.key === item.key) {
                              return { ...d, quantity: value };
                            }
                            return d;
                          }));
                        }}
                        style={{ width: '70px', height: '24px' }}
                        size="small"
                      />
                      <span style={{ marginLeft: '4px', color: '#888' }}>
                        (最大: {item.maxQuantity})
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
            <Button 
              icon={<DeleteOutlined />} 
              danger
              onClick={() => handleDelete(item.key)}
              size="small"
              style={{ marginLeft: 'auto' }}
            />
          </List.Item>
        )}
      />
      
      {/* 商品建议弹窗 */}
      <Modal
        title="选择商品"
        open={productSuggestionVisible}
        footer={null}
        onCancel={() => setProductSuggestionVisible(false)}
      >
        <div>
          <p>找到以下匹配商品:</p>
          
          {/* 商品样式选择 */}
          {styleOptions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p>选择款式:</p>
              <Select
                style={{ width: '100%' }}
                value={selectedStyle}
                onChange={handleStyleChange}
                placeholder="请选择款式"
              >
                {styleOptions.map(style => (
                  <Option key={style.code} value={style.code}>
                    {style.name}
                  </Option>
                ))}
              </Select>
            </div>
          )}
          
          {/* 颜色选择 */}
          {colorOptions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p>选择颜色:</p>
              <Select
                style={{ width: '100%' }}
                value={selectedColor}
                onChange={handleColorChange}
                placeholder="请选择颜色"
              >
                {colorOptions.map(color => (
                  <Option key={color} value={color}>
                    {color}
                  </Option>
                ))}
              </Select>
            </div>
          )}
          
          {/* 尺码选择 */}
          {sizeOptions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p>选择尺码:</p>
              <Select
                style={{ width: '100%' }}
                value={selectedSize}
                onChange={value => setSelectedSize(value)}
                placeholder="请选择尺码"
              >
                {sizeOptions.map(size => (
                  <Option key={size} value={size}>
                    {size}
                  </Option>
                ))}
              </Select>
            </div>
          )}
          
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setProductSuggestionVisible(false)}>
              取消
            </Button>
            <Button
              type="primary"
              disabled={!selectedStyle || (colorOptions.length > 0 && !selectedColor) || (sizeOptions.length > 0 && !selectedSize)}
              onClick={confirmProductSelection}
            >
              确认
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* 库存信息弹窗 */}
      {suggestedInventory && (
        <Modal
          title={`${suggestedInventory.productName || '商品'} 库存分布`}
          open={!!suggestedInventory}
          footer={[
            <Button key="close" onClick={() => setSuggestedInventory(null)}>
              关闭
            </Button>
          ]}
          onCancel={() => setSuggestedInventory(null)}
        >
          <List
            size="small"
            dataSource={suggestedInventory.locations || []}
            renderItem={loc => (
              <List.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>{loc.locationCode}</span>
                  <span>库存: {loc.quantity}</span>
                </div>
              </List.Item>
            )}
          />
        </Modal>
      )}
      
      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)}>
        <img src={previewImage} alt="预览" style={{ width: '100%' }} />
      </Modal>
      </div>
    </div>
  );
};

export default MobileOutbound; 