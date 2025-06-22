import React, { useEffect, useState, useRef } from 'react';
import { Button, Input, message, List, Card, Space, Modal, Badge, Tag, Form, Select, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, MinusOutlined, SearchOutlined, ScanOutlined, RightOutlined } from '@ant-design/icons';
import api from '../api/auth';
import MobileNavBar from '../components/MobileNavBar';
import { getFullImageUrl } from '../utils/imageUtils';
import { showResultModal } from '../components/ResultModal';

// 颜色背景辅助
const getColorBackground = (colorName) => {
  const colorMap = {
    '黄色': '#fff9c4', '绿色': '#d9f7be', '粉色': '#ffadd2', '蓝色': '#bae7ff',
    '黑色': '#f0f0f0', '卡其色': '#f6ffed', '红色': '#ffccc7', '白色': '#ffffff',
    '灰色': '#f5f5f5', '默认颜色': '#f0f0f0'
  };
  return colorMap[colorName] || '#f0f0f0';
};

const MobileInventory = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [skuDetailVisible, setSkuDetailVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [expandedSkuKey, setExpandedSkuKey] = useState(null);
  const [expandedLocationKey, setExpandedLocationKey] = useState(null);
  const [actionVisibleKey, setActionVisibleKey] = useState(null);
  const [warehouseActionVisible, setWarehouseActionVisible] = useState(false);
  const [warehouseActionType, setWarehouseActionType] = useState('');
  const [selectedSku, setSelectedSku] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationOptions, setLocationOptions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  // 用于存储每个商品图片区的ref
  const imgListRefs = useRef({});
  const [sortKey, setSortKey] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc/asc

  // === 尺码排序辅助函数 ===
  const sizePriority = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];
  const getSizeRank = (sizeName) => {
    if (!sizeName) return 9999;
    const upper = String(sizeName).toUpperCase();
    const idx = sizePriority.indexOf(upper);
    if (idx !== -1) return idx;
    // 如果包含数字，如 28、30 之类，则按数字大小排序
    const numMatch = upper.match(/\d+/);
    if (numMatch) return 100 + parseInt(numMatch[0], 10);
    return 9999;
  };

  useEffect(() => {
    loadInventory();
    fetchCurrentUser();
  }, []);

  // 自动滚动到最右
  useEffect(() => {
    const scrollAllToRight = () => {
      Object.values(imgListRefs.current).forEach(ref => {
        if (ref && ref.scrollWidth > ref.clientWidth) {
          ref.scrollLeft = ref.scrollWidth;
        }
      });
    };
    scrollAllToRight();
    window.addEventListener('resize', scrollAllToRight);
    return () => window.removeEventListener('resize', scrollAllToRight);
  }, [filteredProducts.length]);

  const loadInventory = async () => {
    setLoading(true);
    try {
          const res = await api.get('products', { params: { page: 1, page_size: 1000 } });
    const list = res.data.data?.products || [];
      setProducts(list);
      setFilteredProducts(list);
    } catch (e) {
      message.error('获取库存数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setCurrentUser(res.data.data);
    } catch (e) {
      message.error('获取当前用户信息失败');
    }
  };

  const handleSearch = () => {
    if (!searchValue) {
      setFilteredProducts(products);
      return;
    }
    const filtered = products.filter(product =>
      (product.product_name && product.product_name.includes(searchValue)) ||
      (product.product_code && product.product_code.includes(searchValue))
    );
    setFilteredProducts(filtered);
    if (filtered.length === 0) message.info('未找到匹配商品');
  };

  // SKU详情弹窗
  const showSkuDetail = (product, e) => {
    if (e) e.stopPropagation();
    setSelectedProduct(product);
    setSkuDetailVisible(true);
  };

  // 1. fetchLocations: 拉取所有可选库位，支持新建库位。
  const fetchLocations = async (defaultLoc = '无货位', sku = null) => {
    setLoadingLocations(true);
    try {
      let options = [];
      if (sku && sku.product_code) {
        // 拉取该SKU的历史库位和库存
        const pcode = sku.product_code.split('-')[0];
        const res = await api.get('products', { params: { search: pcode, page_size: 1 } });
        const prodData = (res.data.data?.products || [])[0];
        if (prodData && prodData.colors) {
          prodData.colors.forEach(col => {
            col.sizes.forEach(sz => {
              if (sz.sku_code === sku.product_code) {
                (sz.locations || []).forEach(loc => {
                  options.push({
                    value: loc.location_code,
                    label: `${loc.location_code}（库存: ${loc.stock_quantity}）`
                  });
                });
              }
            });
          });
        }
      }
      // 拉取所有库位，补充到options
      const allLocRes = await api.get('/locations/');
      const allLocs = (allLocRes.data.data || []).map(loc => loc.location_code);
      allLocs.forEach(code => {
        if (!options.some(opt => opt.value === code)) {
          options.push({ value: code, label: code });
        }
      });
      // 默认库位
      if (!options.some(opt => opt.value === defaultLoc)) {
        options = [{ value: defaultLoc, label: defaultLoc }, ...options];
      }
      setLocationOptions(options);
      setLoadingLocations(false);
    } catch (error) {
      message.error('获取库位失败');
      setLoadingLocations(false);
    }
  };

  // 2. showWarehouseAction: 弹出入库/出库/盘点操作弹窗，支持选货位。
  const showWarehouseAction = (type, sku, defaultLoc = '无货位') => {
    setWarehouseActionType(type);
    setSelectedSku(sku);
    fetchLocations(defaultLoc, sku);
    setWarehouseActionVisible(true);
    if (type === 'adjust') {
      setQuantity(sku.currentStock || 0);
      setSelectedLocation(sku.location_code || defaultLoc);
    } else {
      setQuantity(1);
      setSelectedLocation(sku.location_code || defaultLoc);
    }
  };

  // 3. handleWarehouseAction: 执行入库/出库/盘点API操作。
  const handleWarehouseAction = async () => {
    if (!selectedSku || !locationOptions.length) {
      message.warning('请选择SKU和货位');
      return;
    }
    if (!selectedSku.sku_code) {
      message.error('缺少 sku_code 字段，无法操作');
      return;
    }
    if (quantity <= 0) {
      message.warning('数量必须大于0');
      return;
    }
    
    try {
      setLoading(true);
      let endpoint = '/outbound/';
      if (warehouseActionType === 'inbound') endpoint = '/inbound/';
      else if (warehouseActionType === 'adjust') endpoint = '/inventory/adjust';
      
      let payload = {};
      if (warehouseActionType === 'inbound') {
        payload = {
          sku_code: selectedSku.sku_code,
          location_code: selectedLocation,
          inbound_quantity: Number(quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端入库操作'
        };
      } else if (warehouseActionType === 'outbound') {
        payload = {
          sku_code: selectedSku.sku_code,
          location_code: selectedLocation,
          outbound_quantity: Number(quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端出库操作'
        };
      } else if (warehouseActionType === 'adjust') {
        payload = {
          sku_code: selectedSku.sku_code,
          location_code: selectedLocation,
          target_quantity: Number(quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端库存调整'
        };
      }
      
      console.log('=== 发起仓库操作 ===');
      console.log('操作类型:', warehouseActionType);
      console.log('请求数据:', JSON.stringify(payload, null, 2));
      
      const response = await api.post(endpoint, payload);
      
      console.log('=== 仓库操作成功 ===');
      console.log('响应数据:', JSON.stringify(response.data, null, 2));
      
      // === 弹窗结果 ===
      const inventoryObj = response.data?.inventory || response.data?.data;
      const opLabel = warehouseActionType === 'inbound' ? '入库' : warehouseActionType === 'outbound' ? '出库' : '盘点';
      if (inventoryObj) {
        const { sku_location_quantity, sku_total_quantity, inbound_quantity, outbound_quantity, target_quantity, sku_code } = inventoryObj;
        const operation_quantity = inbound_quantity || outbound_quantity || target_quantity || Number(quantity);
        showResultModal({
          success: true,
          operation: opLabel,
          sku_code: sku_code || selectedSku.sku_code,
          operation_quantity,
          sku_location_quantity,
          sku_total_quantity,
        });
      } else {
        showResultModal({
          success: true,
          operation: opLabel,
          sku_code: selectedSku.sku_code,
          operation_quantity: Number(quantity),
        });
      }

      // 先刷新主列表数据
      console.log('=== 开始刷新主列表数据 ===');
      await loadInventory();
      
      // 如果有打开的SKU详情弹窗，需要更新其数据
      if (selectedProduct && selectedProduct.product_code) {
        console.log('=== 开始刷新SKU详情弹窗数据 ===');
        console.log('当前选中产品:', selectedProduct.product_code);
        
        try {
          // 重新获取商品详情，获取最新的SKU和库存信息
          const resDetail = await api.get('products', { 
            params: { search: selectedProduct.product_code, page_size: 1 } 
          });
          const updatedProduct = (resDetail.data.data?.products || [])[0];
          
          if (updatedProduct) {
            console.log('获取到更新后的商品数据:', {
              product_code: updatedProduct.product_code,
              product_total_quantity: updatedProduct.product_total_quantity,
              colors_count: updatedProduct.colors?.length || 0
            });
            
            // 直接使用最新的商品数据更新SKU详情弹窗
            setSelectedProduct(updatedProduct);
            console.log('=== SKU详情弹窗数据刷新完成 ===');
          } else {
            console.log('未找到更新后的商品数据');
          }
        } catch (err) {
          console.error('刷新SKU详情失败:', err);
          message.warning('操作成功，但刷新详情失败，请手动关闭详情弹窗重新打开');
        }
      }
      
    } catch (error) {
      console.error('=== 仓库操作失败 ===');
      console.error('错误详情:', error);
      
      let errorMessage = error.response?.data?.error_message || error.response?.data?.message || error.message || '操作失败';

      const opLabel = warehouseActionType === 'inbound' ? '入库' : warehouseActionType === 'outbound' ? '出库' : '盘点';
      showResultModal({
        success: false,
        operation: opLabel,
        sku_code: selectedSku?.sku_code,
        error_message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // 4. handleClearStock: 清库存API操作。
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
      
      console.log('=== 发起清库存操作 ===');
      console.log('请求数据:', JSON.stringify(requestData, null, 2));
      
      const response = await api.post('/inventory/adjust', requestData);
      
      console.log('=== 清库存操作成功 ===');
      console.log('响应数据:', JSON.stringify(response.data, null, 2));
      
      message.success('清库存成功');
      
      // 先刷新主列表数据
      console.log('=== 开始刷新主列表数据 ===');
      await loadInventory();
      
      // 如果有打开的SKU详情弹窗，需要更新其数据
      if (selectedProduct && selectedProduct.product_code) {
        console.log('=== 开始刷新SKU详情弹窗数据 ===');
        console.log('当前选中产品:', selectedProduct.product_code);
        
        try {
          // 重新获取商品详情，获取最新的SKU和库存信息
          const resDetail = await api.get('products', { 
            params: { search: selectedProduct.product_code, page_size: 1 } 
          });
          const updatedProduct = (resDetail.data.data?.products || [])[0];
          
          if (updatedProduct) {
            console.log('获取到更新后的商品数据:', {
              product_code: updatedProduct.product_code,
              product_total_quantity: updatedProduct.product_total_quantity,
              colors_count: updatedProduct.colors?.length || 0
            });
            
            // 直接使用最新的商品数据更新SKU详情弹窗
            setSelectedProduct(updatedProduct);
            console.log('=== 清库存后SKU详情弹窗数据刷新完成 ===');
          } else {
            console.log('未找到更新后的商品数据');
          }
        } catch (err) {
          console.error('刷新SKU详情失败:', err);
          message.warning('清库存成功，但刷新详情失败，请手动关闭详情弹窗重新打开');
        }
      }
      
    } catch (error) {
      console.error('=== 清库存操作失败 ===');
      console.error('错误详情:', error);
      
      let errorMessage = '清库存失败';
      if (error.response?.data?.error_message) {
        errorMessage = error.response.data.error_message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 5. handleClearStockWithConfirm: 清库存二次确认弹窗。
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

  const handleSort = (key) => {
    let order = sortOrder;
    if (sortKey === key) {
      order = order === 'desc' ? 'asc' : 'desc';
      setSortOrder(order);
    } else {
      setSortKey(key);
      setSortOrder('desc');
      order = 'desc';
    }
    let sorted = [...filteredProducts];
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (key === 'product_code') {
        aVal = a.product_code || '';
        bVal = b.product_code || '';
        return order === 'desc' ? bVal.localeCompare(aVal, 'zh-Hans-CN') : aVal.localeCompare(bVal, 'zh-Hans-CN');
      } else {
        aVal = a[key] ?? 0;
        bVal = b[key] ?? 0;
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      }
    });
    setFilteredProducts(sorted);
  };

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="inventory" />
      <div style={{ marginBottom: 2 }}>
        <Input
          placeholder="商品编码或名称"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          suffix={
            <Space>
              <Button type="primary" icon={<ScanOutlined />} />
              <Button icon={<SearchOutlined />} onClick={handleSearch} />
            </Space>
          }
          style={{ width: '100%' }}
        />
      </div>
      {/* 排序按钮组，放在搜索框下方，4个按钮平均分配宽度 */}
      <div style={{ display: 'flex', width: '100%', marginBottom: 6, marginTop: 0, gap: 6, height: 30, alignItems: 'center' }}>
        <Button
          type={sortKey === 'product_code' ? 'primary' : 'default'}
          onClick={() => handleSort('product_code')}
          style={{ flex: 1, height: 30, lineHeight: '20px', fontSize: 13, padding: 0 }}
        >
          商品编码{sortKey === 'product_code' ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
        </Button>
        <Button
                  type={sortKey === 'product_total_quantity' ? 'primary' : 'default'}
        onClick={() => handleSort('product_total_quantity')}
          style={{ flex: 1, height: 30, lineHeight: '20px', fontSize: 13, padding: 0 }}
        >
          商品库存{sortKey === 'product_total_quantity' ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
        </Button>
        <Button
          type={sortKey === 'sku_count' ? 'primary' : 'default'}
          onClick={() => handleSort('sku_count')}
          style={{ flex: 1, height: 30, lineHeight: '20px', fontSize: 13, padding: 0 }}
        >
          SKU数量{sortKey === 'sku_count' ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
        </Button>
        <Button
          type={sortKey === 'color_count' ? 'primary' : 'default'}
          onClick={() => handleSort('color_count')}
          style={{ flex: 1, height: 30, lineHeight: '20px', fontSize: 13, padding: 0 }}
        >
          颜色数量{sortKey === 'color_count' ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
        </Button>
      </div>
      <List
        loading={loading}
        dataSource={filteredProducts}
        renderItem={product => (
          <Card
            style={{ marginBottom: 8 }}
            size="small"
            onClick={e => product.has_sku ? showSkuDetail(product, e) : null}
            hoverable={product.has_sku}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {/* 左侧信息区 */}
              <div style={{ width: 120, minWidth: 120, maxWidth: 120, textAlign: 'left', marginRight: 8, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_name || product.product_code}</div>
                <div style={{ color: '#666', fontSize: '0.95em', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>编码: {product.product_code}</div>
                <div style={{ color: '#888', fontSize: '0.95em', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {product.category && product.category.length > 0 && (
                    <span style={{ marginLeft: 0 }}>
                      分类: {Array.isArray(product.category) ? product.category.join(', ') : product.category}
                    </span>
                  )}
                  <Badge count={`合计:${product.product_total_quantity ?? 0}`} style={{ backgroundColor: '#2db7f5', marginLeft: 8 }} />
                  <span style={{ marginLeft: 8, color: '#faad14' }}>
                    库位: {product.location_count ?? 0}
                  </span>
                </div>
              </div>
              {/* 中间图片区域，靠右溢出，图片不被压缩，自动滚动到最右 */}
              <div
                className="img-list-outer"
                style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', margin: '0 8px', paddingBottom: 2 }}
                ref={el => { if (el) imgListRefs.current[product.product_code] = el; }}
              >
                <div className="img-list-inner" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', minWidth: 'max-content', gap: 4, alignItems: 'center' }}>
                  {product.skus && product.skus.length > 0 && product.skus.some(sku => sku.image_path)
                    ? (() => {
                        // 构建 sku_code -> sku_total_quantity map
                        const skuQtyMap = {};
                        if (product.colors) {
                          product.colors.forEach(col => {
                            (col.sizes || []).forEach(sz => {
                              skuQtyMap[sz.sku_code] = sz.sku_total_quantity;
                            });
                          });
                        }
                        // 按图片分组（同图片的SKU归为一组）
                        const imgMap = {};
                        product.skus.filter(sku => sku.image_path).forEach(sku => {
                          if (!imgMap[sku.image_path]) imgMap[sku.image_path] = [];
                          imgMap[sku.image_path].push(sku);
                        });
                        let imgEntries = Object.entries(imgMap);
                        // 按件数从小到大排序，件数多的图片靠右
                        imgEntries.sort((a, b) => {
                          const aQty = a[1].reduce((sum, sku) => sum + (skuQtyMap[sku.sku_code] || 0), 0);
                          const bQty = b[1].reduce((sum, sku) => sum + (skuQtyMap[sku.sku_code] || 0), 0);
                          return aQty - bQty;
                        });
                        return imgEntries.map(([imgPath, skuList], idx) => {
                          // 用skuQtyMap统计真实库存
                          const totalQty = skuList.reduce((sum, sku) => sum + (skuQtyMap[sku.sku_code] || 0), 0);
                          return (
                            <div key={imgPath+idx} style={{ position: 'relative', width: 65, height: 65, borderRadius: 6, overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 65px' }}>
                              <img
                                src={getFullImageUrl(imgPath)}
                                alt={product.product_name || product.product_code}
                                style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
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
              </div>
            </div>
          </Card>
        )}
      />
      {/* SKU详情弹窗 */}
      <Modal
        title={selectedProduct ? `${selectedProduct.product_name || selectedProduct.product_code} 的SKU款式` : ''}
        open={skuDetailVisible}
        onCancel={() => setSkuDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSkuDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width="100%"
        style={{ top: 0 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        {selectedProduct && (
          <div>
            {/* 颜色分组 */}
            {(selectedProduct.colors || []).map((group, idx) => (
              <Card key={group.color+idx} size="small" style={{ marginBottom: 16, borderRadius: 10, boxShadow: '0 1px 4px #f0f1f2', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 8 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 16 }}>{group.color}</span>
                  <span style={{ color: '#52c41a', fontWeight: 500, fontSize: 14 }}>总库存: {group.color_total_quantity || group.sizes.reduce((sum, sz) => sum + (sz.sku_total_quantity || 0), 0)}</span>
                  <span style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>尺码列表:</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {/* 颜色图片（如有） */}
                  {group.image_path && (
                    <div style={{ flex: '0 0 100px', marginRight: 16 }}>
                      <div style={{ width: 100, height: 100, backgroundColor: getColorBackground(group.color), display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '2px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                        <img src={getFullImageUrl(group.image_path)} alt={group.color} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    </div>
                  )}
                  {/* 尺码列表 */}
                  <div style={{ flex: 1 }}>
                    {[...group.sizes].sort((a, b) => getSizeRank(a.sku_size) - getSizeRank(b.sku_size)).map((size, idx2) => {
                      const skuKey = `${group.color}-${size.sku_size}-${size.sku_code}`;
                      const isExpanded = expandedSkuKey === skuKey;
                      return (
                        <div key={size.sku_code+idx2} style={{ marginBottom: 8, padding: '4px 8px', border: '1px solid #1890ff', borderRadius: 8, backgroundColor: '#f5fbff', cursor: 'pointer' }}
                          onClick={() => setExpandedSkuKey(isExpanded ? null : skuKey)}
                        >
                          {/* SKU信息行 */}
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px', marginRight: 8 }}>
                              {size.sku_size}
                            </Tag>
                            <div style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#52c41a', fontWeight: 600 }}>
                                {size.sku_total_quantity}件
                              </span>
                              <span style={{ marginLeft: 8, color: '#8c8c8c' }}>
                                占{Array.isArray(size.locations) ? size.locations.length : 0}位
                            </span>
                            </div>
                            <RightOutlined style={{ color: '#999', fontSize: 16, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                          </div>
                          {/* 展开时显示库位、操作按钮、选货位入库 */}
                          {isExpanded && (
                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
                              {/* 库位列表 */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {(size.locations || []).map(loc => {
                                  const locKey = `${size.sku_code}-${loc.location_code}`;
                                  const isLocExpanded = expandedLocationKey === locKey;
                                  return (
                                    <div key={loc.location_code} style={{ marginBottom: 8 }}>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          background: '#f5f5f5',
                                          border: '1px solid #91d5ff',
                                          borderRadius: 4,
                                          padding: '4px 8px',
                                          cursor: 'pointer',
                                          userSelect: 'none'
                                        }}
                                        onClick={e => {
                                          e.stopPropagation();
                                          setExpandedLocationKey(isLocExpanded ? null : locKey);
                                        }}
                                      >
                                        <span>{loc.location_code}</span>
                                        <span style={{ color: '#52c41a', marginLeft: 8 }}>{loc.stock_quantity}件</span>
                                      </div>
                                      {isLocExpanded && (
                                        <div style={{ display: 'flex', gap: 4, marginTop: 8, marginLeft: 0 }}>
                                          <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} size="small" onClick={e => { e.stopPropagation(); showWarehouseAction('inbound', { ...size, product_code: selectedProduct.product_code, sku_code: size.sku_code, sku_color: group.color, sku_size: size.sku_size, location_code: loc.location_code }, loc.location_code); }}>入库</Button>
                                          <Button danger size="small" style={{ background: '#fff1f0', borderColor: '#ff4d4f', color: '#ff4d4f' }} onClick={e => { e.stopPropagation(); showWarehouseAction('outbound', { ...size, product_code: selectedProduct.product_code, sku_code: size.sku_code, sku_color: group.color, sku_size: size.sku_size, location_code: loc.location_code }, loc.location_code); }}>出库</Button>
                                          <Button size="small" style={{ background: '#fadb14', borderColor: '#fadb14', color: '#000' }} onClick={e => { e.stopPropagation(); showWarehouseAction('adjust', { ...size, product_code: selectedProduct.product_code, sku_code: size.sku_code, sku_color: group.color, sku_size: size.sku_size, location_code: loc.location_code, currentStock: loc.stock_quantity }, loc.location_code); }}>盘点</Button>
                                          <Button danger size="small" style={{ background: '#ff4d4f', borderColor: '#ff4d4f', fontWeight: 'bold', marginLeft: 8 }} onClick={e => { e.stopPropagation(); handleClearStockWithConfirm({ ...size, product_code: selectedProduct.product_code, sku_code: size.sku_code, sku_color: group.color, sku_size: size.sku_size }, loc.location_code); }} title="此操作不可恢复，请谨慎操作">清库存</Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {/* 选货位入库按钮紧贴库位列表底部 */}
                              <Button
                                type="primary"
                                size="small"
                                style={{ background: '#1890ff', borderColor: '#1890ff', marginTop: 0, width: '100%' }}
                                onClick={async e => {
                                  e.stopPropagation();
                                  setSelectedSku({
                                    ...size,
                                    product_code: selectedProduct.product_code,
                                    sku_code: size.sku_code,
                                    sku_color: group.color,
                                    sku_size: size.sku_size
                                  });
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
            ))}
          </div>
        )}
      </Modal>
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
                <div style={{ marginBottom: 8, color: '#fa8c16' }}>
                  当前库存: {selectedSku.currentStock ?? ''} 件
                </div>
              )}
              {warehouseActionType === 'adjust' ? (
                <Form.Item label="货位">
                  <Input value={selectedSku.location_code} disabled />
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
    </div>
  );
};

export default MobileInventory; 