import React, { useEffect, useState } from 'react';
import { Table, Button, Input, List, Card, Space, Badge, Tag, Modal, InputNumber, message, Collapse } from 'antd';
import { ScanOutlined, SearchOutlined, SaveOutlined, EditOutlined, LogoutOutlined, PlusOutlined, MinusOutlined, CaretRightOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';

// Add getFullImageUrl function if not already present
const getFullImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  // Assuming the backend serves static files from the root or a specific path
  // and the paths in the database are relative to that static root.
  // If your backend is on a different port/domain for static files, adjust baseUrl.
  const baseUrl = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
  return baseUrl + cleanPath;
};

function handleScan() {}

const MobileInventory = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editValue, setEditValue] = useState(0);
  const [editingSkuContext, setEditingSkuContext] = useState({ productId: null, skuCode: null });
  const [inoutModalVisible, setInoutModalVisible] = useState(false);
  const [inoutType, setInoutType] = useState('');
  const [inoutLocation, setInoutLocation] = useState(null);
  const [inoutQuantity, setInoutQuantity] = useState(1);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);
  const [expandedSku, setExpandedSku] = useState(null);
  const navigate = useNavigate();

  const handleScan = () => {
    window.alert('handleScan here!');
  };

  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    message.success('退出成功');
    navigate('/login');
  };

  // 加载库存数据
  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      
      const productsRes = await api.get('/products/');
      const productsList = productsRes.data;
      const productsMap = {};
      productsList.forEach(product => {
        if (product._id) {
          productsMap[product._id] = product;
        }
        if (product.code) {
          productsMap[product.code] = product;
        }
      });
      
      const response = await api.get('/inventory/');
      console.log('原始库存数据 (from /inventory/):', response.data);
      const inventoryData = response.data;
      
      const processedData = inventoryData.map(inventoryItem => {
        const allSkusMap = new Map();
        let parentProductDetails = productsMap[inventoryItem.product_id] || productsMap[inventoryItem.productCode];
        if (!parentProductDetails) {
          parentProductDetails = productsList.find(p => p._id === inventoryItem.product_id || p.code === inventoryItem.productCode);
        }

        if (inventoryItem.locations && Array.isArray(inventoryItem.locations)) {
          inventoryItem.locations.forEach(location => {
            if (location.skus && Array.isArray(location.skus)) {
              location.skus.forEach(skuInLocation => {
                if (skuInLocation.quantity > 0) {
                  let skuImage = '';
                  if (parentProductDetails) {
                    const specificSkuData = parentProductDetails.skus?.find(s => s.code === skuInLocation.code);
                    if (specificSkuData?.image_path) {
                      skuImage = specificSkuData.image_path;
                    } else if (specificSkuData?.image) {
                      skuImage = specificSkuData.image;
                    } else if (parentProductDetails.image_path) {
                      skuImage = parentProductDetails.image_path;
                    } else if (parentProductDetails.image) {
                      skuImage = parentProductDetails.image;
                    }
                  }
                  if (!skuImage && inventoryItem.image_path) {
                    skuImage = inventoryItem.image_path;
                  }
                  if (!skuImage && inventoryItem.image) {
                    skuImage = inventoryItem.image;
                  }

                  if (allSkusMap.has(skuInLocation.code)) {
                    const existingSku = allSkusMap.get(skuInLocation.code);
                    existingSku.totalQuantity += skuInLocation.quantity;
                    existingSku.detailsByLocation.push({
                      location_id: location.location_id,
                      locationCode: location.locationCode,
                      locationName: location.locationName,
                      quantity: skuInLocation.quantity
                    });
                    // Ensure image is set if this instance provides a better one (though unlikely if already set)
                    if (!existingSku.image && skuImage) existingSku.image = skuImage;
                  } else {
                    allSkusMap.set(skuInLocation.code, {
                      code: skuInLocation.code,
                      color: skuInLocation.color,
                      size: skuInLocation.size,
                      parentProductCode: inventoryItem.productCode,
                      parentProductName: inventoryItem.productName,
                      totalQuantity: skuInLocation.quantity,
                      unit: inventoryItem.unit || parentProductDetails?.unit || '件',
                      image: skuImage, // Use the derived skuImage
                      detailsByLocation: [{
                        location_id: location.location_id,
                        locationCode: location.locationCode,
                        locationName: location.locationName,
                        quantity: skuInLocation.quantity
                      }]
                    });
                  }
                }
              });
            }
          });
        }
        
        return {
          ...inventoryItem, 
          key: inventoryItem._id || inventoryItem.productCode, 
          // Ensure main product image is also processed by getFullImageUrl later in render
          image: parentProductDetails?.image_path || parentProductDetails?.image || inventoryItem.image_path || inventoryItem.image || '', 
          skuList: Array.from(allSkusMap.values()),
        };
      });

      console.log('处理后的数据 (processedData for MobileInventory):', processedData);
      setData(processedData);
      setFilteredData(processedData);
    } catch (error) {
      console.error('获取库存失败 (MobileInventory):', error);
      message.error('获取库存失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索商品
  const handleSearch = () => {
    if (!searchValue) {
      setFilteredData(data);
      return;
    }
    
    const filtered = data.filter(item => {
      // 基本匹配：商品编码或名称
      const basicMatch = (item.productCode && item.productCode.includes(searchValue)) || 
                         (item.productName && item.productName.includes(searchValue));
                         
      // SKU匹配：检查是否匹配某个SKU代码或颜色尺码
      let skuMatch = false;
      if (item.isSku) {
        skuMatch = (item.color && item.color.includes(searchValue)) || 
                   (item.size && item.size.includes(searchValue));
      } else if (item.skus && item.skus.length > 0) {
        skuMatch = item.skus.some(sku => 
          (sku.code && sku.code.includes(searchValue)) ||
          (sku.color && sku.color.includes(searchValue)) ||
          (sku.size && sku.size.includes(searchValue))
        );
      }
      
      return basicMatch || skuMatch;
    });
    
    setFilteredData(filtered);
    
    if (filtered.length === 0) {
      message.info('未找到匹配商品');
    }
  };

  // 处理扫码录入
  const handleBarcodeInput = (e) => {
    const value = e.target.value.trim();
    setInputCode(value);
    
    if (value.length >= 3) {
      // 检查是否是SKU编码（包含-符号）
      if (value.includes('-')) {
        // 直接作为SKU处理
        setScanning(true);
        searchInventoryBySku(value);
      } else {
        // 作为普通商品编码处理
        setShowSuggestions(true);
        searchProducts(value);
      }
    } else {
      setShowSuggestions(false);
    }
  };
  
  // 通过SKU编码搜索库存
  const searchInventoryBySku = async (skuCode) => {
    try {
      // 提取基础商品编码
      const baseProductCode = skuCode.split('-')[0];
      
      // 首先尝试获取基础商品信息
      const productResponse = await api.get(`/products/code/${baseProductCode}`);
      
      if (productResponse.data) {
        const product = productResponse.data;
        
        // 在产品的SKU中查找
        const matchingSku = product.skus?.find(sku => sku.code === skuCode);
        
        if (matchingSku) {
          console.log('找到匹配的SKU:', matchingSku);
          
          // 查找该SKU的库存信息
          const inventoryResponse = await api.get(`/inventory?productCode=${baseProductCode}`);
      
          if (inventoryResponse.data && inventoryResponse.data.length > 0) {
            // 构建SKU库存信息
            const inv = inventoryResponse.data[0];
            const skuInventory = {
              _id: inv._id,
              productCode: skuCode,
              productName: `${product.name} (${matchingSku.color} ${matchingSku.size})`,
              quantity: 0,
              originalProductCode: product.code,
              originalProductName: product.name,
              locations: [],
              matchedSku: skuCode,
              skuInfo: matchingSku
            };
            
            // 遍历所有库位，查找SKU库存
            inv.locations.forEach(loc => {
              if (loc.skus && loc.skus.length > 0) {
                const skuLoc = loc.skus.find(s => s.code === skuCode);
                if (skuLoc) {
                  // 添加到库存位置列表
                  skuInventory.locations.push({
                    ...loc,
                    quantity: skuLoc.quantity
                  });
                  // 累加总库存
                  skuInventory.quantity += skuLoc.quantity;
                }
              }
            });
            
            // 显示找到的SKU库存
            setCurrentProduct(skuInventory);
            setShowSuggestions(false);
            setScanning(false);
            setInputCode('');
            return;
          }
        }
      }
      
      // 如果没找到SKU，尝试作为产品编码查找
      setShowSuggestions(true);
      searchProducts(baseProductCode);
    } catch (error) {
      console.error('搜索SKU失败:', error);
      setScanning(false);
      message.error('SKU查询失败');
    }
  };

  // 显示商品详情
  const showProductDetail = (product) => {
    // 保存当前搜索的SKU代码，用于突出显示
    const searchingSku = searchValue;
    
    // 如果是通过SKU搜索的，找到对应的SKU并标记
    if (searchingSku && product.skus && product.skus.length > 0) {
      const matchedSku = product.skus.find(sku => sku.code === searchingSku);
      if (matchedSku) {
        product.matchedSku = matchedSku.code;
      }
    }
    
    setCurrentProduct(product);
    setDetailVisible(true);
  };

  // 新的 startEdit，可以处理主商品和SKU的库存编辑
  const startEdit = (productId, locationCode, quantity, skuCode = null) => {
    setEditingLocation(locationCode); 
    setEditValue(quantity);         
    if (skuCode) {
      setEditingSkuContext({ productId: productId, skuCode: skuCode });
      const mainProduct = data.find(p => p._id === productId);
      if (mainProduct) setCurrentProduct(mainProduct); // Keep currentProduct relevant if needed for UI
    } else {
      setEditingSkuContext({ productId: productId, skuCode: null });
      const mainProduct = data.find(p => p._id === productId);
      if (mainProduct) setCurrentProduct(mainProduct);
    }
    // Here you would typically show an input field or modal for editing 'editValue'
    // For example, by setting another state like: setIsEditInputVisible(true);
  };

  // 保存盘点结果
  const saveLocationQuantity = async () => {
    if (!editingLocation || (editingSkuContext.productId === null && !currentProduct?._id) ) {
      message.error("无法确定要保存的产品或货位信息");
      return;
    }

    const targetProductId = editingSkuContext.productId || currentProduct._id;
    const targetSkuCode = editingSkuContext.skuCode;

    try {
      setLoading(true);
      
      const payload = {
        productId: targetProductId, 
        locationCode: editingLocation,
        quantity: editValue
      };

      if (targetSkuCode) {
        payload.sku_code = targetSkuCode;
      }
      
      console.log('Sending to /inventory/adjust:', payload); 
      await api.post('/inventory/adjust', payload);
      
      const newData = data.map(prod => {
        if (prod._id === targetProductId) {
          const updatedProd = { ...prod };
          let overallProductQuantityChanged = false;

          updatedProd.locations = prod.locations.map(loc => {
            if (loc.locationCode === editingLocation) {
              const updatedLoc = { ...loc };
              if (targetSkuCode) {
                if (!updatedLoc.skus) updatedLoc.skus = [];
                let skuFoundInLoc = false;
                updatedLoc.skus = updatedLoc.skus.map(sku => {
                  if (sku.code === targetSkuCode) {
                    skuFoundInLoc = true;
                    return { ...sku, quantity: editValue };
                  }
                  return sku;
                });
                if (!skuFoundInLoc && editValue > 0) {
                   console.warn(`SKU ${targetSkuCode} was not found in location ${editingLocation} during local update, but quantity was adjusted.`);
                }
                updatedLoc.quantity = updatedLoc.skus.reduce((sum, sku) => sum + sku.quantity, 0);
              } else {
                updatedLoc.quantity = editValue;
              }
              overallProductQuantityChanged = true;
              return updatedLoc;
            }
            return loc;
          });

          if (targetSkuCode && updatedProd.skuList) {
              updatedProd.skuList = updatedProd.skuList.map(uiSku => {
                  if (uiSku.code === targetSkuCode) {
                      const updatedUiSku = { ...uiSku, totalQuantity: 0, detailsByLocation: [] };
                      updatedProd.locations.forEach(loc => {
                          const skuInLoc = loc.skus?.find(s => s.code === targetSkuCode);
                          if (skuInLoc && skuInLoc.quantity > 0) {
                              updatedUiSku.totalQuantity += skuInLoc.quantity;
                              updatedUiSku.detailsByLocation.push({
                                  locationCode: loc.locationCode,
                                  locationName: loc.locationName,
                                  quantity: skuInLoc.quantity
                              });
                          }
                      });
                      return updatedUiSku;
                  }
                  return uiSku;
              });
          }

          if(overallProductQuantityChanged){
            updatedProd.quantity = updatedProd.locations.reduce((sum, loc) => sum + loc.quantity, 0);
          }
          return updatedProd;
        }
        return prod;
      });

      setData(newData);
      // Update filteredData carefully
      // This ensures that if a filter is active, it's reapplied, or simply map existing filtered items
      const currentFilteredIds = new Set(filteredData.map(item => item._id));
      const newFilteredData = newData.filter(item => currentFilteredIds.has(item._id));
      setFilteredData(newFilteredData);
      
      const newlyUpdatedCurrentProduct = newData.find(p => p._id === (editingSkuContext.productId || currentProduct?._id ));
      if(newlyUpdatedCurrentProduct) {
          setCurrentProduct(newlyUpdatedCurrentProduct);
      }

      message.success('盘点成功');
      setEditingLocation(null); 
      setEditingSkuContext({ productId: null, skuCode: null }); 
      // setIsEditInputVisible(false); // Hide your edit input/modal

    } catch (error) {
      console.error('保存失败:', error.response?.data || error.message);
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 显示入库/出库弹窗
  const showInoutModal = (type, locationCode, locationName, currentQty) => {
    setInoutType(type);
    setInoutLocation({
      locationCode,
      locationName,
      currentQty
    });
    setInoutQuantity(1);
    setInoutModalVisible(true);

    // 记录当前操作的SKU
    console.log('当前操作SKU:', selectedSku);
  };

  // 处理入库或出库操作
  const handleInoutOperation = async () => {
    if (!currentProduct || !inoutLocation || !inoutQuantity) return;
    
    try {
      setLoading(true);
      
      const endpoint = inoutType === 'in' ? '/inbound/' : '/outbound/';
      
      // 确定操作的SKU代码
      let skuCode = '';
      let skuColor = '';
      let skuSize = '';
      
      if (selectedSku) {
        skuCode = selectedSku;
        
        // 尝试从当前产品中查找SKU信息
        if (currentProduct.skus) {
          const matchingSku = currentProduct.skus.find(sku => sku.code === selectedSku);
          if (matchingSku) {
            skuColor = matchingSku.color;
            skuSize = matchingSku.size;
          }
        }
      } else if (currentProduct.matchedSku) {
        skuCode = currentProduct.matchedSku;
        
        // 如果有SKU信息
        if (currentProduct.skuInfo) {
          skuColor = currentProduct.skuInfo.color;
          skuSize = currentProduct.skuInfo.size;
        }
      }
      
      console.log(`${inoutType === 'in' ? '入库' : '出库'}操作，SKU:`, skuCode);
      console.log('库位信息:', inoutLocation);
      
      // 确保SKU代码格式正确
      if (skuCode && !skuCode.startsWith(currentProduct.productCode) && !skuCode.startsWith(currentProduct.originalProductCode || '')) {
        const baseCode = currentProduct.originalProductCode || currentProduct.productCode;
        skuCode = `${baseCode}-${skuCode}`;
      }
      
      // 构建基本请求数据
      const requestData = {
        product_id: currentProduct._id,
        productCode: currentProduct.originalProductCode || currentProduct.productCode,
        location_code: inoutLocation.locationCode,
        quantity: inoutQuantity
      };
      
      // 如果操作的是SKU
      if (skuCode) {
        requestData.skuCode = skuCode;
        requestData.sku_color = skuColor;
        requestData.sku_size = skuSize;
        requestData.notes = `SKU: ${skuCode}`;
      }
      
      console.log('请求数据:', requestData);
      
      // 调用API进行入库或出库
      try {
      const response = await api.post(endpoint, requestData);
      console.log('API响应:', response.data);
        
        // 成功处理
        message.success(inoutType === 'in' ? '入库成功' : '出库成功');
        setInoutModalVisible(false);
      
      // 重新加载当前商品库存数据
      await loadInventory();
      
      // 更新当前查看的商品详情
      if (currentProduct) {
          // 保存是否在查看SKU
          const isViewingSku = !!currentProduct.matchedSku;
          const currentSkuCode = currentProduct.matchedSku;
          
          // 如果是查看SKU，重新获取SKU信息
          if (isViewingSku && currentSkuCode) {
            searchInventoryBySku(currentSkuCode);
          } else {
            // 普通商品，更新数据
        const updatedData = [...data];
        const productIndex = updatedData.findIndex(p => p._id === currentProduct._id);
        if (productIndex >= 0) {
          setCurrentProduct(updatedData[productIndex]);
        }
      }
        }
      } catch (error) {
        console.error('API调用失败:', error);
        message.error(error.response?.data?.message || '操作失败');
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error('处理出入库失败:', error);
      message.error('操作失败');
      setLoading(false);
    }
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
      handleScan();
    }, 300);
  };

  // 处理SKU点击
  const handleSkuClick = (skuCode) => {
    setSelectedSku(skuCode);
  };

  // 获取SKU对应的库位
  const getSkuLocations = (skuCode) => {
    if (!currentProduct) return [];
    // 1. 先在当前商品的skus里找
    let sku = currentProduct.skus && currentProduct.skus.find(s => s.code === skuCode);
    if (sku && sku.locations) return sku.locations;
    // 2. 再全局data里找SKU独立行
    const globalSku = data.find(item => item.isSku && item.code === skuCode);
    if (globalSku && globalSku.locations) return globalSku.locations;
    return [];
  };

  // 根据SKU代码获取颜色和尺码信息
  const parseSkuCode = (skuCode) => {
    if (!skuCode || !skuCode.includes('-')) {
      return { color: '', size: '' };
    }
    
    const parts = skuCode.split('-');
    if (parts.length >= 3) {
      return {
        category: parts[0],
        color: parts[1],
        size: parts[2]
      };
    }
    
    return { color: '', size: '' };
  };

  // 按颜色对SKU进行分组
  const groupSkusByColor = (skuList) => {
    if (!skuList || skuList.length === 0) return {};
    
    const colorGroups = {};
    
    skuList.forEach(sku => {
      const { color } = parseSkuCode(sku.code);
      
      if (color) {
        if (!colorGroups[color]) {
          colorGroups[color] = [];
        }
        colorGroups[color].push(sku);
      }
    });
    
    return colorGroups;
  };

  const handleExpand = (productCode) => {
    setExpandedRows(prev =>
      prev.includes(productCode)
        ? prev.filter(code => code !== productCode)
        : [...prev, productCode]
    );
  };

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="inventory" />
      
      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="商品编码或名称"
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
      
      {/* 商品列表 */}
      <div className="product-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>加载中...</div>
        ) : filteredData.length > 0 ? (
          filteredData.map(item => {
            // 计算各个颜色的合计数量
            const colorQuantities = {};
            if (item.skuList && item.skuList.length > 0) {
              item.skuList.forEach(sku => {
                const color = sku.color || '未知';
                colorQuantities[color] = (colorQuantities[color] || 0) + (sku.totalQuantity || 0);
              });
            }
            
            return (
              <div key={item.key || item.productCode} className="product-item" onClick={() => showProductDetail(item)}>
                <div className="product-info-section">
                  <div className="product-code">{item.productCode}</div>
                  <div className="product-info">
                    <span>{item.skuList ? item.skuList.length : 0}款式</span>
                    <span>{item.locations ? item.locations.length : 0}库位</span>
                  </div>
                  <div className="product-total">合计{item.quantity || 0}{item.unit || '件'}</div>
                </div>
                {Object.keys(colorQuantities).length > 0 && (
                  <div className="product-color-section">
                    {Object.entries(colorQuantities)
                      .sort(([,a], [,b]) => a - b) // 按数量升序排列
                      .map(([color, quantity], index) => (
                      <div key={`${color}-${index}`} className="color-quantity-item">
                        <div 
                          style={{ 
                            width: '60px', 
                            height: '60px', 
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
                          {/* 显示该颜色的第一个SKU图片 */}
                          {(() => {
                            const firstSkuOfColor = item.skuList?.find(sku => sku.color === color);
                            const imagePath = firstSkuOfColor?.image || item.image;
                            return imagePath ? (
                              <img 
                                src={getFullImageUrl(imagePath)} 
                                alt={color}
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
                            ) : null;
                          })()}
                          <div 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              backgroundColor: '#f0f0f0',
                              display: (() => {
                                const firstSkuOfColor = item.skuList?.find(sku => sku.color === color);
                                const imagePath = firstSkuOfColor?.image || item.image;
                                return imagePath ? 'none' : 'flex';
                              })(),
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
                            {color.substring(0, 2)}
                          </div>
                        </div>
                        <div className="color-tag">{color}</div>
                        <div className="color-quantity">{quantity}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#999' }}>
            暂无商品信息
          </div>
        )}
      </div>
      
      {/* 商品详情弹窗 */}
      <Modal
        title={`商品详情: ${currentProduct?.productName || currentProduct?.productCode}`}
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setCurrentProduct(null);
          setSelectedSku(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailVisible(false);
            setCurrentProduct(null);
            setSelectedSku(null);
          }}>
            关闭
          </Button>
        ]}
        bodyStyle={{ 
          maxHeight: '70vh', 
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {currentProduct && (
          <div>
            {/* 展开内容：SKU明细 from currentProduct.skuList，改为颜色-尺码二级折叠 */}
            {currentProduct.skuList && currentProduct.skuList.length > 0 ? (
              Object.entries(groupSkusByColor(currentProduct.skuList)).map(([color, skus]) => (
                <Collapse key={color} bordered={false} style={{ background: '#fafbfc', marginBottom: 8 }}>
                  <Collapse.Panel
                    key={color}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Tag color="blue" style={{ fontSize: 16 }}>{color}</Tag>
                        <span style={{ marginLeft: 8, color: '#888' }}>共{skus.length}款</span>
                        <span style={{ marginLeft: 16, color: '#52c41a', fontWeight: 500, fontSize: 14 }}>
                          总库存: {skus.reduce((sum, sku) => sum + (sku.totalQuantity || 0), 0)}
                        </span>
                      </div>
                    }
                  >
                      <List
                        size="small"
                        dataSource={skus}
                        renderItem={sku => (
                          <List.Item style={{ display: 'block', marginLeft: 16, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: expandedSku === sku.code ? 8 : 0 }}>
                              <div style={{ marginRight: 8, width: 75, height: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                                <img
                                  src={getFullImageUrl(sku.image || item.image || '')}
                                  alt={sku.code}
                                  style={{ width: 75, height: 75, objectFit: 'contain', borderRadius: 2, background: '#f5f5f5' }}
                                />
                              </div>
                              <div>
                                <Tag color="green">{sku.size}</Tag>
                                <Tag color="blue">{sku.code}</Tag>
                                <Tag color="orange" style={{ marginTop: 2 }}>{sku.totalQuantity} {sku.unit || '件'}</Tag>
                              </div>
                              <Button
                                size="small"
                                type={expandedSku === sku.code ? 'primary' : 'default'}
                                style={{ marginLeft: 'auto' }}
                                onClick={e => {
                                  const nextState = expandedSku === sku.code ? null : sku.code;
                                  setExpandedSku(nextState);
                                }}
                              >
                                {expandedSku === sku.code ? '收起库位' : '库位详情'}
                              </Button>
                            </div>
                            {/* SKU的库位详情 (条件渲染) */}
                            {expandedSku === sku.code && (
                              sku.detailsByLocation && sku.detailsByLocation.length > 0 ? (
                                <List
                                  size="small"
                                  dataSource={sku.detailsByLocation}
                                  header={<div style={{fontWeight: 'bold', paddingLeft: 16}}>库位分布:</div>}
                                  renderItem={locDetail => (
                                    <List.Item style={{ paddingLeft: 16, borderBlockStart: 'none' }}>
                                      <Card size="small" style={{ width: '100%', background: '#fafafa' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div style={{ flexGrow: 1, marginRight: 8 }}>
                                            <div><strong>{locDetail.locationCode}</strong> ({locDetail.locationName || '-'})</div>
                                            {editingLocation === locDetail.locationCode && 
                                             editingSkuContext.skuCode === sku.code && 
                                             editingSkuContext.productId === item._id ? (
                                              <InputNumber
                                                size="small"
                                                min={0}
                                                value={editValue}
                                                onChange={value => setEditValue(value ?? 0)}
                                                style={{ marginTop: 4, width: '100px' }}
                                                autoFocus
                                              />
                                            ) : (
                                              <Tag color="purple" style={{ marginTop: 4 }}>数量: {locDetail.quantity} {sku.unit || '件'}</Tag>
                                            )}
                                          </div>
                                          {editingLocation === locDetail.locationCode && 
                                           editingSkuContext.skuCode === sku.code && 
                                           editingSkuContext.productId === item._id ? (
                                            <Space direction="vertical" size={4}>
                                              <Button
                                                type="primary"
                                                size="small"
                                                icon={<SaveOutlined />}
                                                onClick={saveLocationQuantity}
                                                loading={loading}
                                              >
                                                保存
                                              </Button>
                                              <Button
                                                size="small"
                                                onClick={() => {
                                                  setEditingLocation(null);
                                                  setEditingSkuContext({ productId: null, skuCode: null });
                                                }}
                                              >
                                                取消
                                              </Button>
                                            </Space>
                                          ) : (
                                            <Space direction="vertical" size={4}>
                                              <Button
                                                icon={<PlusOutlined />}
                                                size="small"
                                                type="primary"
                                                onClick={() => {
                                                  setCurrentProduct(item);
                                                  setSelectedSku(sku.code);
                                                  showInoutModal('in', locDetail.locationCode, locDetail.locationName, locDetail.quantity);
                                                }}
                                              >
                                                入库
                                              </Button>
                                              <Button
                                                icon={<MinusOutlined />}
                                                size="small"
                                                danger
                                                onClick={() => {
                                                  setCurrentProduct(item);
                                                  setSelectedSku(sku.code);
                                                  showInoutModal('out', locDetail.locationCode, locDetail.locationName, locDetail.quantity);
                                                }}
                                              >
                                                出库
                                              </Button>
                                              <Button
                                                icon={<EditOutlined />}
                                                size="small"
                                                onClick={() => {
                                                  startEdit(item._id, locDetail.locationCode, locDetail.quantity, sku.code);
                                                }}
                                              >
                                                盘点
                                              </Button>
                                            </Space>
                                          )}
                                        </div>
                                      </Card>
                                    </List.Item>
                                  )}
                                />
                              ) : (
                                <div style={{ color: '#888', padding: '8px 0 8px 16px' }}>此SKU无具体库位库存</div>
                              )
                            )}
                          </List.Item>
                        )}
                      />
                    </Collapse.Panel>
                  </Collapse>
                ))
              ) : (
                <div style={{ padding: '10px 20px', color: '#888' }}>该商品无SKU明细</div>
              )}
            </Collapse.Panel>
          </Collapse>
        )}
      />
      
      {/* 详情弹窗 */}
      <Modal
        title="商品详情"
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedSku(null); // 重置选中的SKU
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailVisible(false);
            setSelectedSku(null); // 重置选中的SKU
          }}>
            关闭
          </Button>
        ]}
        width="100%"
        style={{ top: 0 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        {currentProduct && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              {currentProduct.image && getFullImageUrl(currentProduct.image) ? (
                <img 
                  src={getFullImageUrl(currentProduct.image)} 
                  alt={currentProduct.productName} 
                  style={{ width: 80, height: 80, marginRight: 16, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: 80, height: 80, background: '#eee', marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '12px' }}>无主图</div>
              )}
              <div>
                <h3>{currentProduct.productName}</h3>
                <div>编码: {currentProduct.productCode}</div>
                <div>单位: {currentProduct.unit}</div>
                <div>总库存: {currentProduct.quantity}</div>
              </div>
            </div>
            
            {/* 如果已选择SKU，显示该SKU的库位明细 */}
            {selectedSku ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4>SKU: {selectedSku} 的库位明细</h4>
                  <Button type="link" onClick={() => setSelectedSku(null)}>返回</Button>
                </div>
                
                {(() => {
                  const skuLocations = getSkuLocations(selectedSku);
                  
                  // 找到该SKU对象
                  const skuObj = currentProduct.skus && 
                                currentProduct.skus.find(s => s.code === selectedSku);
                  
                  const skuTotalQty = skuObj ? skuObj.quantity : 0;
                  const { color, size } = parseSkuCode(selectedSku);
                  
                  return (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="purple">分类: {currentProduct.productCode}</Tag>
                          {color && <Tag color="blue">颜色: {color}</Tag>}
                          {size && <Tag color="green">尺码: {size}</Tag>}
                        </div>
                        <Tag color="orange">总库存: {skuTotalQty} {currentProduct.unit || '件'}</Tag>
                      </div>
                      
                      {skuLocations && skuLocations.length > 0 ? (
                        <List
                          dataSource={skuLocations}
                          renderItem={loc => (
                            <Card size="small" style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div><strong>库位: {loc.locationCode}</strong></div>
                                  <div>名称: {loc.locationName || '-'}</div>
                                  {loc.notes && <div>备注: {loc.notes}</div>}
                                </div>
                                
                                {editingLocation === loc.locationCode ? (
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <InputNumber
                                      min={0}
                                      value={editValue}
                                      onChange={value => setEditValue(value)}
                                      style={{ width: 80 }}
                                      autoFocus
                                    />
                                    <Space style={{ marginLeft: 8 }}>
                                      <Button 
                                        type="primary" 
                                        size="small"
                                        onClick={saveLocationQuantity}
                                        loading={loading}
                                      >
                                        保存
                                      </Button>
                                      <Button 
                                        size="small"
                                        onClick={() => setEditingLocation(null)}
                                      >
                                        取消
                                      </Button>
                                    </Space>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex' }}>
                                    <div style={{ marginRight: 8 }}>
                                      <Badge 
                                        count={loc.quantity} 
                                        overflowCount={9999}
                                        style={{ backgroundColor: '#52c41a' }}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                      <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        size="large"
                                        style={{ width: 60, height: 30, fontSize: 16, marginBottom: 8 }}
                                        onClick={e => {
                                          e.stopPropagation();
                                          showInoutModal('in', loc.locationCode, loc.locationName, loc.quantity);
                                        }}
                                      >
                                        入库
                                      </Button>
                                      <Button
                                        danger
                                        icon={<MinusOutlined />}
                                        size="large"
                                        style={{ width: 60, height: 30, fontSize: 16, marginBottom: 8 }}
                                        onClick={e => {
                                          e.stopPropagation();
                                          showInoutModal('out', loc.locationCode, loc.locationName, loc.quantity);
                                        }}
                                      >
                                        出库
                                      </Button>
                                      <Button
                                        icon={<EditOutlined />}
                                        size="large"
                                        style={{ width: 60, height: 30, fontSize: 16, marginBottom: 8 }}
                                        onClick={e => {
                                          e.stopPropagation();
                                          startEdit(currentProduct._id, loc.locationCode, loc.quantity, loc.skus?.find(s => s.code === selectedSku)?.code);
                                        }}
                                      >
                                        盘点
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </Card>
                          )}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                          该SKU无库位明细
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              /* 层级显示SKU和库位 */
              <>
                {currentProduct.skus && currentProduct.skus.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <Tag color="purple">分类编码: {currentProduct.productCode}</Tag>
                      <Tag color="orange">总库存: {currentProduct.quantity} {currentProduct.unit || '件'}</Tag>
                    </div>
                    {/* 按颜色分组显示SKU */}
                    {Object.entries(groupSkusByColor(currentProduct.skus)).map(([color, sizeSkus]) => {
                      // 计算这个颜色下的总库存
                      const colorTotalQty = sizeSkus.reduce((sum, sku) => sum + (sku.quantity || 0), 0);
                      return (
                        <Card 
                          key={color} 
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{color}</span>
                              <span style={{ color: '#1890ff' }}>{colorTotalQty} {currentProduct.unit || '件'}</span>
                            </div>
                          }
                          style={{ marginBottom: 16 }}
                          headStyle={{ backgroundColor: '#f5f5f5' }}
                        >
                          {/* Add logic to display color group image here if available */}
                          {/* This assumes parentProductDetails might have a specific image for a color, or we use the main product image */}
                          {/* For simplicity, let's find if any SKU in this color group has an image, or use currentProduct.image */}
                          {(() => {
                            const colorGroupImage = sizeSkus.find(s => s.image)?.image || currentProduct.image;
                            return (
                              colorGroupImage && getFullImageUrl(colorGroupImage) ? (
                                <div style={{ marginBottom: 8, width: 60, height: 60, border: '1px solid #eee', overflow: 'hidden', display:'flex', justifyContent:'center', alignItems:'center'}}>
                                   <img src={getFullImageUrl(colorGroupImage)} alt={color} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
                                </div>
                              ) : (
                                <div style={{ marginBottom: 8, width: 60, height: 60, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '10px' }}>无图</div>
                              )
                            );
                          })()}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {sizeSkus.map((item) => {
                              const hasLocations = item.locations && item.locations.length > 0;
                              const { size } = parseSkuCode(item.code);
                              return (
                                <Button
                                  key={item.code}
                                  type={item.quantity > 0 ? "primary" : "default"}
                                  style={{ 
                                    margin: '4px',
                                    borderColor: hasLocations ? '#1890ff' : '#d9d9d9',
                                    opacity: item.quantity > 0 ? 1 : 0.6
                                  }}
                                  onClick={() => handleSkuClick(item.code)}
                                >
                                  {size || item.code.split('-').pop()} - {item.quantity || 0} {currentProduct.unit || '件'}
                                </Button>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                    无SKU明细
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
      
      {/* 入库/出库弹窗 */}
      <Modal
        title={inoutType === 'in' ? '入库操作' : '出库操作'}
        open={inoutModalVisible}
        onCancel={() => setInoutModalVisible(false)}
        onOk={handleInoutOperation}
        confirmLoading={loading}
      >
        {currentProduct && inoutLocation && (
          <div>
            <p><strong>商品:</strong> {currentProduct.productName}</p>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ marginRight: 8, fontWeight: 'bold' }}>库位:</div>
              <div>{inoutLocation.locationCode} {inoutLocation.locationName || ''}</div>
            </div>
            <p><strong>当前库存:</strong> {inoutLocation.currentQty} {currentProduct.unit || '件'}</p>
            
            {/* 显示当前操作的SKU */}
            {selectedSku ? (
              <p><strong>SKU:</strong> <Tag color="blue">{selectedSku}</Tag></p>
            ) : (
              <div style={{ marginBottom: 16, color: '#ff4d4f' }}>
                <p>未选择具体SKU，将对主产品进行操作</p>
                {currentProduct.skus && currentProduct.skus.length > 0 && (
                  <p>提示: 返回选择特定SKU可以更准确地管理库存</p>
                )}
              </div>
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
            
            {inoutType === 'out' && inoutQuantity > inoutLocation.currentQty && (
              <div style={{ color: '#ff4d4f' }}>
                警告: 出库数量大于当前库存
              </div>
            )}
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
    </div>
  );
};

export default MobileInventory; 