import React, { useEffect, useState, useRef } from 'react';
import { Table, Button, Input, List, Card, Space, Badge, Tag, Modal, InputNumber, message, Collapse } from 'antd';
import { ScanOutlined, SearchOutlined, SaveOutlined, EditOutlined, LogoutOutlined, PlusOutlined, MinusOutlined, CaretRightOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';
import './MobileInventory.css';

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
  const [expandedSkus, setExpandedSkus] = useState([]);
  const [locationActionsVisible, setLocationActionsVisible] = useState(false);
  const [currentActionSku, setCurrentActionSku] = useState('');
  const [currentActionLocation, setCurrentActionLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null); // 用于跟踪选中的库位
  const scrollRef = useRef(null);
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
        setSelectedLocation(null); // 清除选中的库位
      
        // 重新加载库存数据并更新当前商品
        await loadInventory();
        
        // 等待数据更新后，重新获取当前商品的最新信息
        setTimeout(async () => {
          try {
            const response = await api.get('/inventory/');
            const inventoryData = response.data;
            
            // 找到当前商品的最新数据
            const updatedProduct = inventoryData.find(item => 
              item._id === currentProduct._id || 
              item.productCode === currentProduct.productCode
            );
            
            if (updatedProduct) {
              // 重新处理SKU数据结构，与loadInventory中的逻辑保持一致
              const productsRes = await api.get('/products/');
              const productsList = productsRes.data;
              const productsMap = {};
              productsList.forEach(product => {
                if (product._id) productsMap[product._id] = product;
                if (product.code) productsMap[product.code] = product;
              });
              
              const allSkusMap = new Map();
              let parentProductDetails = productsMap[updatedProduct.product_id] || productsMap[updatedProduct.productCode];
              
              if (updatedProduct.locations && Array.isArray(updatedProduct.locations)) {
                updatedProduct.locations.forEach(location => {
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
                        if (!skuImage && updatedProduct.image_path) {
                          skuImage = updatedProduct.image_path;
                        }
                        if (!skuImage && updatedProduct.image) {
                          skuImage = updatedProduct.image;
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
                          if (!existingSku.image && skuImage) existingSku.image = skuImage;
                        } else {
                          allSkusMap.set(skuInLocation.code, {
                            code: skuInLocation.code,
                            color: skuInLocation.color,
                            size: skuInLocation.size,
                            parentProductCode: updatedProduct.productCode,
                            parentProductName: updatedProduct.productName,
                            totalQuantity: skuInLocation.quantity,
                            unit: updatedProduct.unit || parentProductDetails?.unit || '件',
                            image: skuImage,
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
              
              const processedProduct = {
                ...updatedProduct,
                key: updatedProduct._id || updatedProduct.productCode,
                image: parentProductDetails?.image_path || parentProductDetails?.image || updatedProduct.image_path || updatedProduct.image || '',
                skuList: Array.from(allSkusMap.values()),
              };
              
              setCurrentProduct(processedProduct);
            }
          } catch (error) {
            console.error('更新商品详情失败:', error);
          }
        }, 500);
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

  // 切换SKU展开状态 - 风琴式效果，同时只能展开一个
  const toggleSkuExpand = (skuCode) => {
    setExpandedSkus(prev =>
      prev.includes(skuCode)
        ? [] // 如果当前已展开，则收起（清空数组）
        : [skuCode] // 如果当前未展开，则只展开这一个（替换整个数组）
    );
  };

  // 显示库位操作按钮
  const showLocationActions = (skuCode, location) => {
    setCurrentActionSku(skuCode);
    setCurrentActionLocation(location);
    setLocationActionsVisible(true);
  };

  // 处理库位操作
  const handleLocationAction = (actionType) => {
    setLocationActionsVisible(false);
    
    if (actionType === 'count') {
      // 盘点操作 - 直接进入编辑模式
      setEditingLocation(currentActionLocation.locationCode || currentActionLocation.locationName); // 传递字符串而不是对象
      setEditValue(currentActionLocation.quantity);
      setEditingSkuContext({
        productId: currentProduct._id,
        skuCode: currentActionSku
      });
    } else {
      // 入库/出库操作
      setInoutLocation({
        ...currentActionLocation,
        currentQty: currentActionLocation.quantity
      });
      setInoutType(actionType);
      setInoutQuantity(1);
      setSelectedSku(currentActionSku); // 设置当前操作的SKU
      setInoutModalVisible(true);
    }
  };

  // 处理SKU操作（从展开的尺码按钮触发）
  const handleSkuOperation = (skuCode, actionType) => {
    setCurrentActionSku(skuCode);
    
    if (actionType === 'count') {
      // 盘点操作 - 对整个SKU进行盘点
      setEditingLocation('multi'); // 传递字符串而不是对象
      setCurrentActionLocation({
        locationCode: 'multi',
        locationName: '多库位',
        quantity: currentProduct.skuList?.find(s => s.code === skuCode)?.totalQuantity || 0
      });
      setEditValue(currentProduct.skuList?.find(s => s.code === skuCode)?.totalQuantity || 0);
      setEditingSkuContext({
        productId: currentProduct._id,
        skuCode: skuCode
      });
    } else {
      // 入库/出库操作
      setInoutLocation({
        locationCode: 'multi',
        locationName: '多库位',
        currentQty: currentProduct.skuList?.find(s => s.code === skuCode)?.totalQuantity || 0
      });
      setInoutType(actionType);
      setInoutQuantity(1);
      setSelectedSku(skuCode);
      setInoutModalVisible(true);
    }
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
      <List
        loading={loading}
        dataSource={filteredData}
                renderItem={item => (
          <div className="location-item" onClick={() => showProductDetail(item)}>
            <div className="location-info-section">
              <div className="location-code">{item.productCode}</div>
              <div className="location-info">
                <span>{item.skuList ? item.skuList.length : 0}款式</span>
                <span>{item.locations ? item.locations.length : 0}库位</span>
              </div>
              <div className="location-total">合计{item.quantity || 0}{item.unit || '件'}</div>
            </div>
            {item.skuList && item.skuList.length > 0 && (
              <div className="location-images-section" style={{ marginLeft: '-30px' }}>
                {(() => {
                  // 计算各个颜色的合计数量
                  const colorQuantities = {};
                  if (item.skuList && item.skuList.length > 0) {
                    item.skuList.forEach(sku => {
                      const color = sku.color || '未知';
                      colorQuantities[color] = (colorQuantities[color] || 0) + (sku.totalQuantity || 0);
                    });
                  }
                  
                  console.log('商品颜色数量:', colorQuantities); // 调试输出
                  return Object.entries(colorQuantities)
                    .sort(([,a], [,b]) => a - b) // 按数量升序排列，让数量最多的排在最右边
                    .map(([color, quantity], index) => {
                      // 找到该颜色的第一个SKU图片
                      const firstSkuOfColor = item.skuList?.find(sku => sku.color === color);
                      const imagePath = firstSkuOfColor?.image || item.image;
                      
                      return (
                        <div key={`${color}-${index}`} className="sku-item">
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
                              {imagePath ? '无图' : color.substring(0, 6)}
                            </div>
                          </div>
                          <div className="sku-size-tag">{color}</div>
                          <div className="sku-quantity">{quantity}</div>
                        </div>
                      );
                    });
                })()}
              </div>
            )}
          </div>
        )}
      />
      
      {/* 详情弹窗 */}
      <Modal
        title={currentProduct ? `${currentProduct.productCode} 的SKU款式` : "商品详情"}
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
        {currentProduct && currentProduct.skuList && (
          <div>
            {/* 按颜色分组显示SKU */}
            {Object.entries(groupSkusByColor(currentProduct.skuList)).map(([color, colorSkus]) => {
              // 计算该颜色的总库存
              const colorTotalQty = colorSkus.reduce((sum, sku) => sum + (sku.totalQuantity || 0), 0);
              // 找该颜色的第一个SKU图片
              const colorImage = colorSkus.find(sku => sku.image)?.image || currentProduct.image;
              
              return (
                                 <div key={color} style={{ marginBottom: 24 }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                     <div style={{ display: 'flex', alignItems: 'center' }}>
                       <span style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginRight: 12 }}>{color}</span>
                       <span style={{ color: '#52c41a', fontSize: 16, fontWeight: '500' }}>总库存: {colorTotalQty}</span>
                     </div>
                     <span style={{ fontSize: 14, fontWeight: '500', color: '#666' }}>尺码列表:</span>
                   </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {/* 颜色图片 */}
                    <div style={{ flexShrink: 0 }}>
                      {colorImage && getFullImageUrl(colorImage) ? (
                        <img 
                          src={getFullImageUrl(colorImage)} 
                          alt={color}
                          style={{ width: 120, height: 120, objectFit: 'contain', border: '1px solid #f0f0f0', borderRadius: 4 }}
                        />
                      ) : (
                        <div style={{ width: 120, height: 120, background: '#f5f5f5', border: '1px solid #f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                          无图片
                        </div>
                      )}
                    </div>
                    
                                         {/* 尺码列表 */}
                     <div style={{ flex: 1 }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                           {colorSkus.map((sku, index) => {
                             const { size } = parseSkuCode(sku.code);
                             const isSkuExpanded = expandedSkus.includes(sku.code);
                             return (
                               <div key={index}>
                                 <div 
                                   style={{
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'space-between',
                                     backgroundColor: isSkuExpanded ? '#e6f7ff' : '#f0f8ff',
                                     border: `1px solid ${isSkuExpanded ? '#1890ff' : '#1890ff'}`,
                                     borderRadius: 4,
                                     padding: '3px 6px',
                                     cursor: 'pointer',
                                     transition: 'all 0.3s',
                                     minHeight: '16px'
                                   }}
                                   onClick={() => toggleSkuExpand(sku.code)}
                                 >
                                   <span style={{ color: '#1890ff', fontWeight: '500', fontSize: '12px' }}>
                                     {size || 'M'}
                                   </span>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                     <span style={{ color: '#52c41a', fontWeight: '500', fontSize: '12px' }}>
                                       {sku.totalQuantity || 0}件
                                     </span>
                                     <span style={{ color: '#999', fontSize: '10px' }}>
                                       占{(sku.detailsByLocation && sku.detailsByLocation.length) || 0}位
                                     </span>
                                   </div>
                                   <span style={{ color: '#666', fontSize: '10px' }}>
                                     {isSkuExpanded ? '▼' : '▶'}
                                   </span>
                                 </div>
                                 
                                 {/* 展开显示库位明细 */}
                                 {isSkuExpanded && sku.detailsByLocation && (
                                   <div style={{ 
                                     marginLeft: 8, 
                                     marginTop: 2, 
                                     marginBottom: 2
                                   }}>
                                     {/* 库位列表 */}
                                     {sku.detailsByLocation.map((location, locIndex) => {
                                       const locationKey = `${sku.code}-${location.locationCode}`;
                                       const isLocationSelected = selectedLocation === locationKey;
                                       return (
                                         <div key={locIndex}>
                                           <div 
                                             style={{
                                               display: 'flex',
                                               alignItems: 'center',
                                               justifyContent: 'space-between',
                                               backgroundColor: isLocationSelected ? '#e6f7ff' : '#f8f8f8',
                                               border: `1px solid ${isLocationSelected ? '#1890ff' : '#e8e8e8'}`,
                                               borderRadius: 4,
                                               padding: '3px 6px',
                                               marginBottom: 2,
                                               cursor: 'pointer',
                                               transition: 'all 0.3s',
                                               minHeight: '16px'
                                             }}
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               setSelectedLocation(isLocationSelected ? null : locationKey);
                                             }}
                                           >
                                             <span style={{ fontSize: '12px', color: '#666' }}>
                                               库位：{location.locationCode || location.locationName || '无货位'}
                                             </span>
                                             <span style={{ color: '#52c41a', fontSize: '12px', fontWeight: '500' }}>
                                               {location.quantity}件
                                             </span>
                                           </div>
                                           
                                                                                        {/* 只有选中的库位才显示操作按钮 */}
                                             {isLocationSelected && (
                                               <div style={{ 
                                                 display: 'flex', 
                                                 gap: '6px', 
                                                 marginTop: 6,
                                                 marginBottom: 8,
                                                 justifyContent: 'center',
                                                 marginLeft: 8
                                               }}>
                                                 <Button
                                                   style={{ 
                                                     fontSize: '12px', 
                                                     height: '28px', 
                                                     padding: '0 12px',
                                                     backgroundColor: '#52c41a',
                                                     borderColor: '#52c41a',
                                                     color: 'white',
                                                     fontWeight: '500'
                                                   }}
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     setCurrentActionSku(sku.code);
                                                     setCurrentActionLocation(location);
                                                     handleLocationAction('in');
                                                   }}
                                                 >
                                                   入库
                                                 </Button>
                                                 
                                                 <Button
                                                   style={{ 
                                                     fontSize: '12px', 
                                                     height: '28px', 
                                                     padding: '0 12px',
                                                     backgroundColor: '#ff4d4f',
                                                     borderColor: '#ff4d4f',
                                                     color: 'white',
                                                     fontWeight: '500'
                                                   }}
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     setCurrentActionSku(sku.code);
                                                     setCurrentActionLocation(location);
                                                     handleLocationAction('out');
                                                   }}
                                                 >
                                                   出库
                                                 </Button>
                                                 
                                                 <Button
                                                   style={{ 
                                                     fontSize: '12px', 
                                                     height: '28px', 
                                                     padding: '0 12px',
                                                     backgroundColor: '#faad14',
                                                     borderColor: '#faad14',
                                                     color: 'white',
                                                     fontWeight: '500'
                                                   }}
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     setCurrentActionSku(sku.code);
                                                     setCurrentActionLocation(location);
                                                     handleLocationAction('count');
                                                   }}
                                                 >
                                                   盘点
                                                 </Button>
                                               </div>
                                             )}
                                         </div>
                                       );
                                     })}

                                   </div>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       </div>
                  </div>
                </div>
              );
            })}
            
            {/* 如果已选择SKU，显示该SKU的库位明细 - 保留原有逻辑但暂时隐藏 */}
            {false && selectedSku ? (
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
                              <span style={{ color: '#1890ff' }}>总库存: {colorTotalQty} {currentProduct.unit || '件'}</span>
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
                ) : null}
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

      {/* 库位操作按钮弹窗 */}
      <Modal
        title="库位操作"
        open={locationActionsVisible}
        onCancel={() => setLocationActionsVisible(false)}
        footer={null}
        width={280}
      >
        {currentActionLocation && (
          <div>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
                {currentActionLocation.locationCode || currentActionLocation.locationName}
              </div>
              <div style={{ color: '#52c41a', fontSize: 14 }}>
                当前库存: {currentActionLocation.quantity}件
              </div>
              <div style={{ color: '#1890ff', fontSize: 12, marginTop: 4 }}>
                SKU: {currentActionSku}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="large"
                onClick={() => handleLocationAction('count')}
                style={{ height: 50, fontSize: 16 }}
              >
                盘点
              </Button>
              
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large" 
                onClick={() => handleLocationAction('in')}
                style={{ height: 50, fontSize: 16, backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                入库
              </Button>
              
              <Button
                danger
                icon={<MinusOutlined />}
                size="large"
                onClick={() => handleLocationAction('out')}
                style={{ height: 50, fontSize: 16 }}
              >
                出库
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 盘点编辑Modal */}
      <Modal
        title="盘点库存"
        open={!!editingLocation}
        onCancel={() => {
          setEditingLocation(null);
          setEditingSkuContext({ productId: null, skuCode: null });
        }}
        onOk={saveLocationQuantity}
        confirmLoading={loading}
      >
        {editingLocation && currentProduct && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div><strong>商品:</strong> {currentProduct.productName}</div>
              <div><strong>库位:</strong> {editingLocation}</div>
              {editingSkuContext.skuCode && (
                <div><strong>SKU:</strong> <Tag color="blue">{editingSkuContext.skuCode}</Tag></div>
              )}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>实际库存数量:</strong>
              </label>
              <InputNumber
                min={0}
                value={editValue}
                onChange={value => setEditValue(value)}
                style={{ width: '100%' }}
                autoFocus
                placeholder="请输入实际库存数量"
              />
            </div>
            
            <div style={{ 
              backgroundColor: '#f6ffed', 
              border: '1px solid #b7eb8f',
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              color: '#52c41a'
            }}>
              <div>当前记录库存: {currentActionLocation?.quantity || 0}件</div>
              <div>
                调整数量: {editValue - (currentActionLocation?.quantity || 0) >= 0 ? '+' : ''}{editValue - (currentActionLocation?.quantity || 0)}件
              </div>
            </div>
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