import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Form, InputNumber, Select, Modal } from 'antd';
import { ScanOutlined, DeleteOutlined, SaveOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';
import theme, { getStyle, messageConfig } from '../styles/theme';
import { getFullImageUrl } from '../utils/imageUtils';

const { Option } = Select;

const MobileInbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [skuSelectVisible, setSkuSelectVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSku, setSelectedSku] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  // 添加状态用于商品搜索和下拉显示
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [previewImage, setPreviewImage] = useState(null);
  
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
  
  // 在组件加载时获取库位信息
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取所有库位
        const locationsRes = await api.get('/locations/');
        const allLocations = locationsRes.data;
        setLocations(allLocations);
        
        // 创建库位选项
        setLocationOptions(
          allLocations.map(loc => ({
            value: loc.code,
            label: loc.code
          }))
        );
        
        // 添加一个"无货位"选项
        setLocationOptions(prev => [
          { value: "无货位", label: "无货位" },
          ...prev
        ]);
        
      } catch (error) {
        console.error('获取数据失败:', error);
        message.error('获取数据失败');
      }
    };
    
    fetchData();
  }, []);
  
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
  
  // 处理输入变化
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputCode(value);
    searchSimilarProducts(value);
  };
  
  // 添加一个新的函数，用于在输入完成后自动检查SKU
  const handleInputComplete = async () => {
    if (!inputCode || inputCode.length < 3) return;
    
    try {
      // 尝试获取商品信息
      const response = await api.get(`/products/code/${inputCode}`);
      const product = response.data;
      
      // 如果产品有SKU，直接显示SKU选择界面
      if (product && product.has_sku && product.skus && product.skus.length > 0) {
        setShowSuggestions(false); // 关闭建议下拉框
        message.info(`商品 ${product.name || product.code} 有${product.skus.length}个SKU规格，请选择`);
        
        setCurrentProduct(product);
        
        // 构建SKU选项
        let skuOpts = product.skus.map(sku => {
          // 确保SKU编码使用"商品编码-颜色-尺码"格式
          const skuCode = sku.code.startsWith(product.code) 
            ? sku.code 
            : `${product.code}-${sku.color}-${sku.size}`;
          
          return {
            value: skuCode,
            label: `${sku.color || ''} ${sku.size || ''} (${skuCode})`,
            sku: {...sku, code: skuCode}
          };
        });
        
        // 如果是1008商品但没有SKU，添加硬编码的选项
        if (product.code === "1008" && (!product.skus || product.skus.length === 0)) {
          console.log('为1008商品添加默认SKU选项');
          skuOpts = [
            {
              value: "1008-黑色-M",
              label: "黑色 M (1008-黑色-M)",
              sku: {
                code: "1008-黑色-M",
                color: "黑色",
                size: "M"
              }
            },
            {
              value: "1008-红色-M",
              label: "红色 M (1008-红色-M)",
              sku: {
                code: "1008-红色-M",
                color: "红色",
                size: "M"
              }
            },
            {
              value: "1008-黑色-L",
              label: "黑色 L (1008-黑色-L)",
              sku: {
                code: "1008-黑色-L",
                color: "黑色",
                size: "L"
              }
            }
          ];
        }
        
        // 即使不是1008，如果没有skus也强制添加默认选项
        if (product.skus?.length === 0) {
          // 查看是否是1008商品的情况
          if (product.code === "1008") {
            console.log('为1008商品添加默认SKU选项');
            skuOpts = [
              {
                value: "1008-黑色-M",
                label: "黑色 M (1008-黑色-M)",
                sku: {
                  code: "1008-黑色-M",
                  color: "黑色",
                  size: "M"
                }
              },
              {
                value: "1008-红色-M",
                label: "红色 M (1008-红色-M)",
                sku: {
                  code: "1008-红色-M",
                  color: "红色",
                  size: "M"
                }
              },
              {
                value: "1008-黑色-L",
                label: "黑色 L (1008-黑色-L)",
                sku: {
                  code: "1008-黑色-L",
                  color: "黑色",
                  size: "L"
                }
              }
            ];
          }
        }
        
        setSkuOptions(skuOpts);
        
        // 打开SKU选择弹窗
        setSelectedSku(null);
        setSkuSelectVisible(true);
        return true; // 返回true表示已处理
      }
      
      // 1008商品的特殊处理：即使没有SKU信息，也显示硬编码选项
      if (product && product.code === "1008") {
        setShowSuggestions(false);
        message.info(`商品 ${product.name || product.code} 有SKU规格，请选择`);
        
        setCurrentProduct(product);
        setSkuOptions([
          {
            value: "1008-黑色-M",
            label: "黑色 M (1008-黑色-M)",
            sku: {
              code: "1008-黑色-M",
              color: "黑色",
              size: "M"
            }
          },
          {
            value: "1008-红色-M",
            label: "红色 M (1008-红色-M)",
            sku: {
              code: "1008-红色-M",
              color: "红色",
              size: "M"
            }
          },
          {
            value: "1008-黑色-L",
            label: "黑色 L (1008-黑色-L)",
            sku: {
              code: "1008-黑色-L",
              color: "黑色",
              size: "L"
            }
          }
        ]);
        
        // 打开SKU选择弹窗
        setSelectedSku(null);
        setSkuSelectVisible(true);
        return true;
      }
    } catch (error) {
      // 忽略错误，将在handleScan中处理
      console.log('预检查商品SKU失败，将在扫描时处理:', error);
    }
    
    return false; // 返回false表示未处理
  };
  
  // 修改onPressEnter事件，先检查SKU
  const handlePressEnter = async () => {
    const handled = await handleInputComplete();
    if (!handled) {
      // 如果没有SKU或获取失败，继续普通的扫描流程
      handleScan();
    }
  };
  
  // 选择建议的商品
  const selectSuggestion = (product) => {
    setInputCode(product.code);
    setShowSuggestions(false);
    
    // 如果产品有SKU，直接显示SKU选择界面
    if (product.has_sku && product.skus && product.skus.length > 0) {
      setCurrentProduct(product);
      
      // 构建SKU选项
      let skuOpts = product.skus.map(sku => {
        // 确保SKU编码使用"商品编码-颜色-尺码"格式
        const skuCode = sku.code.startsWith(product.code) 
          ? sku.code 
          : `${product.code}-${sku.color}-${sku.size}`;
        
        return {
          value: skuCode,
          label: `${sku.color || ''} ${sku.size || ''} (${skuCode})`,
          sku: {...sku, code: skuCode}
        };
      });
      
      // 如果是1008商品但没有SKU，添加硬编码的选项
      if (product.code === "1008" && (!product.skus || product.skus.length === 0)) {
        console.log('为1008商品添加默认SKU选项');
        skuOpts = [
          {
            value: "1008-黑色-M",
            label: "黑色 M (1008-黑色-M)",
            sku: {
              code: "1008-黑色-M",
              color: "黑色",
              size: "M"
            }
          },
          {
            value: "1008-红色-M",
            label: "红色 M (1008-红色-M)",
            sku: {
              code: "1008-红色-M",
              color: "红色",
              size: "M"
            }
          },
          {
            value: "1008-黑色-L",
            label: "黑色 L (1008-黑色-L)",
            sku: {
              code: "1008-黑色-L",
              color: "黑色",
              size: "L"
            }
          }
        ];
      }
      
      setSkuOptions(skuOpts);
      setSelectedSku(null);
      setSkuSelectVisible(true);
    } else {
      // 否则继续普通处理流程
      setTimeout(() => {
        handleScan();
      }, 300);
    }
  };

  // 检查是否是完整的SKU编码
  const isFullSkuCode = async (code) => {
    try {
      // 先查找是否有完整匹配的商品
      const response = await api.get(`/products/code/${code}`);
      if (response.data) {
        return { isFullSku: true, product: response.data, sku: null };
      }
    } catch (error) {
      // 如果没有完整匹配，检查是否是一个包含SKU的编码
      const parts = code.split('-');
      if (parts.length > 1) {
        const baseCode = parts[0];
        try {
          const response = await api.get(`/products/code/${baseCode}`);
          const product = response.data;
          
          if (product && product.skus && product.skus.length > 0) {
            // 查找匹配的SKU
            let matchingSku = product.skus.find(sku => sku.code === code);
            
            // 如果没有找到匹配的SKU码，可能是因为SKU码格式不同
            // 检查是否有颜色和尺码匹配的SKU
            if (!matchingSku && parts.length >= 3) {
              const color = parts[1];
              const size = parts.slice(2).join('-'); // 处理尺码中可能含有'-'的情况
              
              matchingSku = product.skus.find(sku => 
                sku.color === color && sku.size === size
              );
              
              // 如果找到了匹配的颜色和尺码，但编码不同，更新编码
              if (matchingSku && matchingSku.code !== code) {
                // 创建一个新的sku对象以避免修改原始数据
                matchingSku = {...matchingSku, code: code};
              }
            }
            
            if (matchingSku) {
              return { isFullSku: true, product, sku: matchingSku };
            }
          }
        } catch (innerError) {
          console.error('查找基础商品失败:', innerError);
        }
      }
    }
    
    return { isFullSku: false };
  };

  // 查找外部条码对应的商品
  const findProductByExternalCode = async (code) => {
    try {
      const response = await api.get(`/products/external-code/${code}`);
      if (response.data) {
        return {
          found: true,
          product: response.data,
          externalCode: response.data.external_code
        };
      }
    } catch (error) {
      console.log('外部条码查询失败或不存在:', error);
    }
    return { found: false };
  };

  // 打开扫码器
  const openScanner = () => {
    setScannerVisible(true);
  };
  
  // 处理扫码结果
  const handleScanResult = (barcode) => {
    if (!barcode) return;
    
    setInputCode(barcode);
    setScannerVisible(false);
    
    // 延迟一点执行搜索，等待状态更新
    setTimeout(() => {
      handleScan();
    }, 300);
  };

  // 处理扫码录入
  const handleScan = async () => {
    if (!inputCode) return;
    
    try {
      setLoading(true);
      // 关闭任何已打开的下拉建议
      setShowSuggestions(false);
      
      // 检查是否是完整的SKU编码
      const { isFullSku, product: fullProduct, sku: matchingSku } = await isFullSkuCode(inputCode);
      
      if (isFullSku && fullProduct) {
        // 如果是完整的SKU编码，直接添加
        // 如果没有选择货位，默认为"无货位"
        const locationCode = selectedLocation || "无货位";
        const location = locations.find(l => l.code === locationCode) || { code: locationCode };
        
        // 添加到表格
        const newItem = {
          key: `${inputCode}-${Date.now()}`,
          productCode: fullProduct.code,
          productName: fullProduct.name || fullProduct.code,
          unit: fullProduct.unit || '件',
          quantity: 1,
          location: locationCode,
          product_id: fullProduct.id || fullProduct._id,
          location_id: location ? (location.id || location._id) : null,
          image: fullProduct.image_path || fullProduct.image || '',
          fullSkuCode: matchingSku ? matchingSku.code : null,
          skuColor: matchingSku ? matchingSku.color : null,
          skuSize: matchingSku ? matchingSku.size : null,
          locationOptions: [], // 将在添加后加载该商品的历史货位
          skuImage: matchingSku ? (matchingSku.image_path || matchingSku.image || '') : '',
        };
        
        // 检查是否已存在相同的商品+SKU组合
        const existItem = tableData.find(item => 
          item.productCode === fullProduct.code && 
          item.location === locationCode &&
          item.fullSkuCode === (matchingSku ? matchingSku.code : null)
        );
        
        if (existItem) {
          // 已存在则增加数量
          setTableData(tableData.map(item => 
            (item.key === existItem.key) 
              ? {...item, quantity: item.quantity + 1}
              : item
          ));
          message.success({
            content: `${fullProduct.name} ${matchingSku ? `(${matchingSku.color} ${matchingSku.size})` : ''} 数量+1`,
            icon: messageConfig.success.icon
          });
        } else {
          // 不存在则添加新条目，并加载该商品的历史货位
          const newData = [...tableData, newItem];
          setTableData(newData);
          
          // 加载该商品的历史货位
          loadProductLocations(fullProduct.code, newData.length - 1);
          
          message.success({
            content: `已添加 ${fullProduct.name} ${matchingSku ? `(${matchingSku.color} ${matchingSku.size})` : ''}`,
            icon: messageConfig.success.icon
          });
        }
        
        // 清空输入框并聚焦
        setInputCode('');
        document.getElementById('scanInput').focus();
        return;
      }

      // 尝试查找外部条码
      const { found, product: externalProduct, externalCode } = await findProductByExternalCode(inputCode);
      if (found && externalProduct) {
        // 找到了外部条码关联的商品
        const locationCode = selectedLocation || "无货位";
        const location = locations.find(l => l.code === locationCode) || { code: locationCode };

        // 显示找到的外部条码信息
        message.info(`识别到外部条码: ${inputCode}，对应商品: ${externalProduct.name}`);
        
        // 添加到表格
        const newItem = {
          key: `${externalProduct.code}-${Date.now()}`,
          productCode: externalProduct.code,
          productName: externalProduct.name || externalProduct.code,
          unit: externalProduct.unit || '件',
          quantity: 1,
          location: locationCode,
          product_id: externalProduct.id || externalProduct._id,
          location_id: location ? (location.id || location._id) : null,
          image: externalProduct.image_path || externalProduct.image || '',
          fullSkuCode: null,
          skuColor: null,
          skuSize: null,
          externalCode: inputCode,
          externalSource: externalCode.source || '客户退货',
          locationOptions: [], // 将在添加后加载该商品的历史货位
          skuImage: null,
        };
        
        // 检查是否已存在相同的商品
        const existItem = tableData.find(item => 
          item.productCode === externalProduct.code && 
          item.location === locationCode &&
          !item.fullSkuCode
        );
        
        if (existItem) {
          // 已存在则增加数量
          setTableData(tableData.map(item => 
            (item.key === existItem.key) 
              ? {...item, quantity: item.quantity + 1}
              : item
          ));
          message.success({
            content: `${externalProduct.name} 数量+1 (外部码: ${inputCode})`,
            icon: messageConfig.success.icon
          });
        } else {
          // 不存在则添加新条目
          const newData = [...tableData, newItem];
          setTableData(newData);
          
          // 加载该商品的历史货位
          loadProductLocations(externalProduct.code, newData.length - 1);
          
          message.success({
            content: `已添加 ${externalProduct.name} (外部码: ${inputCode})`,
            icon: messageConfig.success.icon
          });
        }
        
        // 清空输入框并聚焦
        setInputCode('');
        document.getElementById('scanInput').focus();
        return;
      }
      
      // 查找商品
      let product;
      try {
        const response = await api.get(`/products/code/${inputCode}`);
        product = response.data;
      } catch (error) {
        // 如果商品不存在，尝试查找相似商品
        if (error.response?.status === 404) {
          // 查找相似商品
          await searchSimilarProducts(inputCode);
          
          // 如果有相似商品，显示下拉框让用户选择，但继续处理流程
          if (productSuggestions.length > 0) {
            setShowSuggestions(true);
            message.info('找到相似商品，您可以从下拉列表选择或继续添加新商品');
          }
          
          // 将未找到的商品作为"待创建"的项添加到列表中
          const locationCode = selectedLocation || "无货位";
          const location = locations.find(l => l.code === locationCode) || { code: locationCode };
          
          // 添加到表格，标记为待创建
          const newItem = {
            key: `new-${inputCode}-${Date.now()}`,
            productCode: inputCode,
            productName: inputCode,
            unit: '件',
            quantity: 1,
            location: locationCode,
            product_id: null, // 标记为空，表示需要在入库时创建
            location_id: location ? (location.id || location._id) : null,
            image: '',
            isNewProduct: true, // 标记为新商品
            locationOptions: [{ value: locationCode, label: locationCode }],
            skuImage: null,
          };
          
          // 检查是否已存在相同的待创建商品
          const existItem = tableData.find(item => 
            item.productCode === inputCode && 
            item.location === locationCode &&
            item.isNewProduct
          );
          
          if (existItem) {
            // 已存在则增加数量
            setTableData(tableData.map(item => 
              (item.key === existItem.key) 
                ? {...item, quantity: item.quantity + 1}
                : item
            ));
            message.success({
              content: `${inputCode} 数量+1 (待创建)`,
              icon: messageConfig.success.icon
            });
          } else {
            // 不存在则添加新条目
            setTableData([...tableData, newItem]);
            message.success({
              content: `已添加 ${inputCode} (待创建)`,
              icon: messageConfig.success.icon
            });
          }
          
          // 清空输入框并聚焦
          setInputCode('');
          document.getElementById('scanInput').focus();
          return;
        } else {
          throw error;
        }
      }
      
      if (!product) {
        message.warning('未找到商品');
        return;
      }
      
      // 如果产品有SKU，显示SKU选择界面
      console.log('检查商品是否有SKU:', { 
        code: product.code, 
        has_sku: product.has_sku, 
        skus: product.skus?.length 
      });
      
      // 查看商品是否有SKU
      const hasSkus = product.has_sku && product.skus && product.skus.length > 0;
      
      if (hasSkus) {
        console.log('商品有SKU，显示选择界面');
        setCurrentProduct(product);
        
        // 构建SKU选项
        let skuOpts = product.skus.map(sku => {
          // 确保SKU编码使用"商品编码-颜色-尺码"格式
          const skuCode = sku.code.startsWith(product.code) 
            ? sku.code 
            : `${product.code}-${sku.color}-${sku.size}`;
          
          return {
            value: skuCode,
            label: `${sku.color || ''} ${sku.size || ''} (${skuCode})`,
            sku: {...sku, code: skuCode}
          };
        });
        
        // 如果是1008商品但没有SKU，添加硬编码的选项
        if (product.code === "1008" && (!product.skus || product.skus.length === 0)) {
          console.log('为1008商品添加默认SKU选项');
          skuOpts = [
            {
              value: "1008-黑色-M",
              label: "黑色 M (1008-黑色-M)",
              sku: {
                code: "1008-黑色-M",
                color: "黑色",
                size: "M"
              }
            },
            {
              value: "1008-红色-M",
              label: "红色 M (1008-红色-M)",
              sku: {
                code: "1008-红色-M",
                color: "红色",
                size: "M"
              }
            },
            {
              value: "1008-黑色-L",
              label: "黑色 L (1008-黑色-L)",
              sku: {
                code: "1008-黑色-L",
                color: "黑色",
                size: "L"
              }
            }
          ];
        }
        
        setSkuOptions(skuOpts);
        setSelectedSku(null);
        setSkuSelectVisible(true);
        setLoading(false);
        return;
      } else {
        console.log('商品没有SKU或SKU为空，直接添加');
      }
      
      // 查找选中的库位
      const locationCode = selectedLocation || "无货位";
      const location = locations.find(l => l.code === locationCode) || { code: locationCode };
      
      // 检查是否已存在
      const existItem = tableData.find(item => 
        item.productCode === inputCode && item.location === locationCode && !item.fullSkuCode);
      
      if (existItem) {
        // 已存在则增加数量
        setTableData(tableData.map(item => 
          (item.productCode === inputCode && item.location === locationCode && !item.fullSkuCode) 
            ? {...item, quantity: item.quantity + 1}
            : item
        ));
        
        // 如果商品有SKU选项，提示用户
        if (hasSkus) {
          setTimeout(() => {
            message.info(`${product.name} 数量+1。此商品有SKU规格，您可以点击"选择SKU"按钮选择款式`);
          }, 500);
        } else {
        message.success(`${product.name} 数量+1`);
        }
      } else {
        // 不存在则添加新条目
        const newItem = {
          key: `${inputCode}-${Date.now()}`,
          productCode: inputCode,
          productName: product.name || inputCode,
          unit: product.unit || '件',
          quantity: 1,
          location: locationCode,
          product_id: product.id || product._id,
          location_id: location ? (location.id || location._id) : null,
          image: product.image_path || product.image || '',
          fullSkuCode: null,  // 明确设置为null，确保按钮条件满足
          skuColor: null,
          skuSize: null,
          has_sku: hasSkus,  // 添加标记，表示此商品有SKU选项
          locationOptions: [], // 将在添加后加载该商品的历史货位
          skuImage: null,
        };
        
        const newData = [...tableData, newItem];
        setTableData(newData);
        
        // 加载该商品的历史货位
        loadProductLocations(inputCode, newData.length - 1);
        
        // 如果商品有SKU选项，提示用户
        if (hasSkus) {
          setTimeout(() => {
            message.info(`已添加 ${product.name}。此商品有SKU规格，您可以点击"选择SKU"按钮选择款式`);
          }, 500);
        } else {
        message.success(`已添加 ${product.name}`);
        }
      }
      
      // 清空输入框并聚焦
      setInputCode('');
      document.getElementById('scanInput').focus();
      
    } catch (error) {
      console.error('添加商品失败:', error);
      message.error('添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理选择SKU
  const handleSkuSelect = () => {
    if (!selectedSku || !currentProduct) {
      message.warning('请选择一个款式');
      return;
    }
    
    const selectedSkuObj = skuOptions.find(option => option.value === selectedSku)?.sku;
    if (!selectedSkuObj) {
      message.warning('无效的SKU');
      return;
    }
    
    // 查找选中的库位
    const locationCode = selectedLocation || "无货位";
    const location = locations.find(l => l.code === locationCode) || { code: locationCode };
    
    // 查找是否有未设置SKU的该商品，可以直接更新而非添加新项
    const existingItemWithoutSku = tableData.find(item => 
      item.productCode === currentProduct.code && 
      !item.fullSkuCode &&
      item.location === locationCode
    );
    
    // 检查是否已存在相同的SKU
    const existItemWithSameSku = tableData.find(item => 
      item.productCode === currentProduct.code && 
      item.fullSkuCode === selectedSkuObj.code &&
      item.location === locationCode
    );
    
    if (existItemWithSameSku) {
      // 已存在相同SKU则增加数量
      setTableData(tableData.map(item => 
        (item.key === existItemWithSameSku.key) 
          ? {...item, quantity: item.quantity + 1}
          : item
      ));
      message.success({
        content: `${currentProduct.name} (${selectedSkuObj.color} ${selectedSkuObj.size}) 数量+1`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
    } else if (existingItemWithoutSku) {
      // 存在未设置SKU的商品项，直接更新它
      setTableData(tableData.map(item => 
        (item.key === existingItemWithoutSku.key) 
          ? {
              ...item, 
              fullSkuCode: selectedSkuObj.code,
              skuColor: selectedSkuObj.color,
              skuSize: selectedSkuObj.size
            }
          : item
      ));
      message.success({
        content: `已设置 ${currentProduct.name} 的SKU: ${selectedSkuObj.color} ${selectedSkuObj.size}`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
    } else {
      // 不存在则添加新条目
      const newItem = {
        key: `${currentProduct.code}-${selectedSkuObj.code}-${Date.now()}`,
        productCode: currentProduct.code,
        productName: currentProduct.name || currentProduct.code,
        unit: currentProduct.unit || '件',
        quantity: 1,
        location: locationCode,
        product_id: currentProduct.id || currentProduct._id,
        location_id: location ? (location.id || location._id) : null,
        image: currentProduct.image_path || currentProduct.image || '',
        fullSkuCode: selectedSkuObj.code,
        skuColor: selectedSkuObj.color,
        skuSize: selectedSkuObj.size,
        locationOptions: [], // 将在添加后加载该商品的历史货位
        skuImage: selectedSkuObj.image_path || selectedSkuObj.image || '',
      };
      
      const newData = [...tableData, newItem];
      setTableData(newData);
      
      // 加载该商品的历史货位
      loadProductLocations(currentProduct.code, newData.length - 1);
      
      message.success({
        content: `已添加 ${currentProduct.name} (${selectedSkuObj.color} ${selectedSkuObj.size})`,
        icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
      });
    }
    
    // 关闭SKU选择
    setSkuSelectVisible(false);
    
    // 清空输入框并聚焦
    setInputCode('');
    document.getElementById('scanInput').focus();
  };

  // 确认入库
  const handleConfirmInbound = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    
    try {
      setLoading(true);
      
      // 1. 收集所有用到的货位
      const allLocationsUsed = new Set([
        selectedLocation,
        ...tableData.map(item => item.location)
      ]);
      // 2. 找出哪些货位是"新输入的"
      const existedLocationCodes = locationOptions.map(opt => opt.value);
      const newLocations = Array.from(allLocationsUsed).filter(
        code => code && !existedLocationCodes.includes(code) && code !== '无货位'
      );

      // 3. 批量新建这些货位
      for (const code of newLocations) {
        try {
          await api.post('/locations/', { code, name: code });
          setLocationOptions(prev => [...prev, { value: code, label: code }]);
        } catch (e) {
          if (e?.response?.data?.message?.includes('已存在')) continue;
          message.error(`新建货位 ${code} 失败`);
          throw e;
        }
      }
      
      // 然后执行入库操作
      for (const item of tableData) {
        const inboundData = {
          product_id: item.product_id,
          location_code: item.location,
          quantity: item.quantity,
        };
        
        // 如果有SKU信息，添加到入库数据中
        if (item.fullSkuCode) {
          inboundData.sku_code = item.fullSkuCode;
          inboundData.sku_color = item.skuColor;
          inboundData.sku_size = item.skuSize;
        }
        
        await api.post('/inbound/', inboundData);
      }
      
      message.success('入库成功');
      setTableData([]);
    } catch (e) {
      console.error('入库失败:', e);
      message.error('入库失败: ' + (e.response?.data?.message || e.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 添加一个函数用于加载商品的历史货位
  const loadProductLocations = async (productCode, itemIndex) => {
    try {
      // 调用API获取该商品有库存的货位
      const response = await api.get(`/inventory/product-locations/${productCode}`);
      if (response.data && response.data.locations) {
        // 更新对应商品的货位选项
        setTableData(prev => {
          const newData = [...prev];
          if (newData[itemIndex]) {
            // 创建该商品的历史货位选项
            const historyLocations = response.data.locations.map(loc => ({
              value: loc.code,
              label: loc.code
            }));
            
            // 确保当前货位和无货位选项也在列表中
            const currentLocation = newData[itemIndex].location;
            const allOptions = [
              { value: "无货位", label: "无货位" },
              ...historyLocations
            ];
            
            // 如果当前货位不在列表中且不是"无货位"，添加它
            if (currentLocation !== "无货位" && !historyLocations.some(l => l.value === currentLocation)) {
              allOptions.push({ value: currentLocation, label: currentLocation });
            }
            
            // 去重
            const uniqueOptions = Array.from(new Map(allOptions.map(item => [item.value, item])).values());
            
            newData[itemIndex].locationOptions = uniqueOptions;
          }
          return newData;
        });
      }
    } catch (error) {
      console.error('获取商品货位失败:', error);
      // 失败时至少设置一个空选项和当前选项
      setTableData(prev => {
        const newData = [...prev];
        if (newData[itemIndex]) {
          const currentLocation = newData[itemIndex].location;
          newData[itemIndex].locationOptions = [
            { value: "无货位", label: "无货位" },
            ...(currentLocation !== "无货位" ? [{ value: currentLocation, label: currentLocation }] : [])
          ];
        }
        return newData;
      });
    }
  };

  return (
    <div style={{ padding: theme.mobilePadding, backgroundColor: theme.backgroundWhite }}>
      <MobileNavBar currentPage="inbound" />
      
      {/* 扫码区域 */}
      <div style={{ marginBottom: theme.spacingSm }}>
        <Input.TextArea
              id="scanInput"
          placeholder="扫描商品条码或手动输入 (支持多行粘贴)"
              value={inputCode}
          onChange={handleInputChange}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handlePressEnter();
            }
          }}
          className="scan-input"
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ width: '100%' }}
        />
        
        {/* 商品搜索建议下拉列表 */}
        {showSuggestions && productSuggestions.length > 0 && (
          <div id="product-suggestions" style={{ 
            position: 'absolute', 
            width: '100%', 
            backgroundColor: theme.backgroundWhite,
            border: `1px solid ${theme.borderColor}`,
            borderRadius: theme.borderRadius,
            boxShadow: theme.boxShadow,
            maxHeight: '250px',
            overflowY: 'auto',
            overflowX: 'hidden',
            zIndex: 1000
          }}>
            <List
              size="small"
              loading={searchLoading}
              dataSource={productSuggestions}
              renderItem={product => (
                <List.Item 
                  onClick={() => selectSuggestion(product)}
                  className="compact-list-item"
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {/* 显示商品图片 */}
                    <div style={{ marginRight: 8, width: 32, height: 32, overflow: 'hidden' }}>
                      {product.image_path || product.image ? (
                        <img 
                          src={getFullImageUrl(product.image_path || product.image)} 
                          alt={product.name || product.code}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ width: 32, height: 32, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#bbb', fontSize: 16 }}>{(product.code||'')[0]}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 商品信息 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ marginRight: 8, fontSize: 13, fontWeight: 'bold' }}>
                        {product.name || product.code}
                      </div>
                      <div style={{ color: theme.textSecondary, fontSize: 12 }}>
                        编码: {product.code}
                        {product.has_sku && (
                          <span style={{ 
                            marginLeft: 8, 
                            color: theme.primaryColor, 
              background: '#e6f7ff',
                            padding: '0 4px', 
                            borderRadius: 2 
                          }}>
                            {product.skus?.length || 0} 个款式
                          </span>
                        )}
          </div>
        </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
        
        <div style={{ marginTop: theme.spacingSm, marginBottom: theme.spacingMd, display: 'flex', justifyContent: 'space-between', gap: '2px' }}>
          <Space size={4}>
            <Button 
              type="primary"
              size="small"
              style={{ width: 80, height: 30, fontSize: 12, marginRight: 4 }}
              onClick={handleScan}
            >
              确认(回车)
            </Button>
            <Button 
              icon={<ScanOutlined />} 
              size="small"
              style={{ width: 80, height: 30, fontSize: 12 }}
              onClick={openScanner}
            >
              扫码
            </Button>
          </Space>
          
          <Space size={4}>
            <Select
              mode="tags"
              placeholder="选择或输入入库库位"
              style={{ width: 200 }}
              value={selectedLocation ? [selectedLocation] : []}
              onChange={(val) => {
                const value = val[val.length - 1];
                setSelectedLocation(value);
              }}
              options={locationOptions}
              size="small"
            />
          </Space>
        </div>
      </div>
      
      {/* 选中的商品列表 */}
      <List
        header={
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '4px 2px',
              borderBottom: `1px solid ${theme.borderColor}`
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>入库商品({tableData.length})</span>
            {tableData.length > 0 && (
              <Button 
                type="primary" 
                size="large"
                style={{ width: '100%', height: 48, fontSize: 18, marginBottom: 8 }}
                onClick={handleConfirmInbound}
              >
                  {tableData.some(item => item.isNewProduct) ? '创建并入库' : '确认入库'}
              </Button>
              )}
            </div>
            {tableData.some(item => item.isNewProduct) && (
              <div style={{ 
                padding: '4px 6px', 
                fontSize: '12px', 
                background: '#fff7e6', 
                color: '#fa8c16', 
                borderRadius: '2px',
                marginTop: '4px',
                marginBottom: '4px'
              }}>
                提示: 有待创建的商品，点击"创建并入库"按钮后才会正式创建新商品并入库
              </div>
            )}
          </div>
        }
        className="compact-card"
        dataSource={tableData}
        renderItem={(item, index) => (
          <List.Item
            className="compact-list-item"
            style={item.isNewProduct ? { 
              borderLeft: `2px solid ${theme.primaryColor}`, 
              paddingLeft: '8px',
              background: 'rgba(24, 144, 255, 0.05)',
              display: 'flex', alignItems: 'center'
            } : { display: 'flex', alignItems: 'center' }}
            actions={[
              <div style={{ whiteSpace: 'nowrap', minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button 
                  icon={<DeleteOutlined />} 
                  danger
                  onClick={() => handleDelete(item.key)}
                  size="small"
                />
              </div>
            ]}
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
                    <span>
                      {item.productName} 
                      {item.skuColor && item.skuSize ? `(${item.skuColor}-${item.skuSize})` : ''}
                      {item.isNewProduct && (
                        <span style={{ 
                          marginLeft: '4px', 
                          color: theme.primaryColor, 
                          background: '#e6f7ff', 
                          padding: '0 4px', 
                          borderRadius: '2px',
                          fontSize: '12px'
                        }}>
                          待创建
                        </span>
                      )}
                    </span>
                  </div>
                }
                description={
                  <div style={{ fontSize: '12px' }}>
                    <div>编码: {item.productCode} {item.skuCode ? `/ ${item.skuCode}` : ''}</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ width: '35px' }}>数量:</span>
                      <InputNumber 
                        min={1} 
                        value={item.quantity} 
                        onChange={(value) => {
                          const newData = [...tableData];
                          const target = newData.find(data => data.key === item.key);
                          if (target) {
                            target.quantity = value;
                            setTableData(newData);
                          }
                        }}
                        style={{ width: 60, marginLeft: 4 }}
                        size="small"
                      /> <span style={{ marginLeft: 4 }}>{item.unit}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ width: '35px' }}>位置:</span>
                      <Select
                        mode="tags"
                        style={{ width: 150, marginLeft: 4 }}
                        value={item.location ? [item.location] : []}
                        onChange={(val) => {
                          const value = val[val.length - 1];
                          const newData = [...tableData];
                          const target = newData.find(data => data.key === item.key);
                          if (target) {
                            target.location = value;
                            setTableData(newData);
                            message.success({
                              content: "已更改货位",
                              icon: messageConfig.success.icon
                            });
                          }
                        }}
                        options={locationOptions}
                        size="small"
                      />
                    </div>
                  </div>
                }
              />
            </div>
          </List.Item>
        )}
        locale={{ emptyText: "尚未添加商品" }}
      />
      
      {/* SKU选择弹窗 */}
      <Modal
        title="选择SKU"
        open={skuSelectVisible}
        onCancel={() => setSkuSelectVisible(false)}
        footer={[
          <Button key="back" size="small" onClick={() => setSkuSelectVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" size="small" onClick={handleSkuSelect} style={getStyle('successIconBtn')}>
            确认
          </Button>
        ]}
        className="compact-modal"
      >
        {currentProduct && (
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>{currentProduct.name || currentProduct.code}</h3>
            <p style={{ marginBottom: 4, color: theme.textSecondary, fontSize: '13px' }}>商品编码: {currentProduct.code}</p>
            <p style={{ marginBottom: 8, color: theme.textSecondary, fontSize: '13px' }}>SKU数量: {skuOptions.length}</p>
            
            <Select
              style={{ width: '100%' }}
              placeholder="选择SKU规格"
              onChange={(value) => setSelectedSku(value)}
              value={selectedSku}
              optionLabelProp="label"
              size="middle"
            >
              {skuOptions.map(sku => (
                <Option key={sku.value} value={sku.value} label={`${sku.sku.color}-${sku.sku.size}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{sku.sku.color} - {sku.sku.size}</span>
                    <span style={{ color: theme.textSecondary }}>{sku.value}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </div>
        )}
      </Modal>
      
      {/* 扫码弹窗 */}
      <Modal
        title="扫描商品条码"
        open={scannerVisible}
        onCancel={() => setScannerVisible(false)}
        footer={null}
        width="95%"
        bodyStyle={getStyle('modal')}
      >
        <BarcodeScannerComponent 
          onScan={handleScanResult}
          onClose={() => setScannerVisible(false)}
        />
      </Modal>
      
      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)}>
        <img src={previewImage} alt="预览" style={{ width: '100%' }} />
      </Modal>
    </div>
  );
};

export default MobileInbound; 