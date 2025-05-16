import React, { useEffect, useState } from 'react';
import { Table, Button, Input, List, Card, Space, Badge, Tag, Modal, InputNumber, message } from 'antd';
import { ScanOutlined, SearchOutlined, SaveOutlined, EditOutlined, LogoutOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';

const MobileInventory = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editValue, setEditValue] = useState(0);
  const [inoutModalVisible, setInoutModalVisible] = useState(false);
  const [inoutType, setInoutType] = useState('');
  const [inoutLocation, setInoutLocation] = useState(null);
  const [inoutQuantity, setInoutQuantity] = useState(1);
  const [scannerVisible, setScannerVisible] = useState(false);
  const navigate = useNavigate();

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
      
      // 获取所有商品
      const productsRes = await api.get('/products/');
      const productsList = productsRes.data;
      
      // 创建商品映射表
      const productsMap = {};
      productsList.forEach(product => {
        productsMap[product.code] = product;
      });
      
      // 获取库存数据
      const response = await api.get('/inventory/');
      
      // 处理库存数据，添加图片信息
      const processedData = response.data.map(item => {
        const productInfo = productsMap[item.productCode];
        if (productInfo) {
          item.image = productInfo.image_path || productInfo.image || '';
        }
        return item;
      });
      
      setData(processedData);
      setFilteredData(processedData);
    } catch (error) {
      console.error('获取库存失败:', error);
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
    
    const filtered = data.filter(item => 
      (item.productCode && item.productCode.includes(searchValue)) || 
      (item.productName && item.productName.includes(searchValue))
    );
    
    setFilteredData(filtered);
    
    if (filtered.length === 0) {
      message.info('未找到匹配商品');
    }
  };

  // 处理扫码搜索
  const handleScan = async () => {
    if (!searchValue) return;
    
    try {
      const filtered = data.filter(item => 
        item.productCode === searchValue
      );
      
      if (filtered.length > 0) {
        setFilteredData(filtered);
        showProductDetail(filtered[0]);
      } else {
        message.warning('未找到商品');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      message.error('搜索失败');
    }
  };

  // 显示商品详情
  const showProductDetail = (product) => {
    setCurrentProduct(product);
    setDetailVisible(true);
  };

  // 开始编辑库位数量
  const startEdit = (location, quantity) => {
    setEditingLocation(location);
    setEditValue(quantity);
  };

  // 保存盘点结果
  const saveLocationQuantity = async () => {
    if (!currentProduct || !editingLocation) return;
    
    try {
      setLoading(true);
      
      // 调用API保存数量
      await api.post('/inventory/adjust', {
        productId: currentProduct._id,
        locationCode: editingLocation,
        quantity: editValue
      });
      
      // 更新本地数据
      const updatedProduct = {...currentProduct};
      const locationIndex = updatedProduct.locations.findIndex(
        loc => loc.locationCode === editingLocation
      );
      
      if (locationIndex >= 0) {
        updatedProduct.locations[locationIndex].quantity = editValue;
        updatedProduct.quantity = updatedProduct.locations.reduce(
          (sum, loc) => sum + loc.quantity, 0
        );
      }
      
      // 更新状态
      setCurrentProduct(updatedProduct);
      
      // 更新主数据列表
      const updatedData = [...data];
      const productIndex = updatedData.findIndex(p => p._id === currentProduct._id);
      if (productIndex >= 0) {
        updatedData[productIndex] = updatedProduct;
        setData(updatedData);
        setFilteredData(
          filteredData.map(item => 
            item._id === updatedProduct._id ? updatedProduct : item
          )
        );
      }
      
      message.success('盘点成功');
      setEditingLocation(null);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
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
  };

  // 处理入库或出库操作
  const handleInoutOperation = async () => {
    if (!currentProduct || !inoutLocation || !inoutQuantity) return;
    
    try {
      setLoading(true);
      
      const endpoint = inoutType === 'in' ? '/inbound/' : '/outbound/';
      const requestData = {
        product_id: currentProduct._id,
        location_code: inoutLocation.locationCode,
        quantity: inoutQuantity
      };
      
      console.log('请求数据:', requestData);
      
      // 调用API进行入库或出库
      const response = await api.post(endpoint, requestData);
      console.log('API响应:', response.data);
      
      // 重新加载当前商品库存数据
      await loadInventory();
      
      // 更新当前查看的商品详情
      if (currentProduct) {
        const updatedData = [...data];
        const productIndex = updatedData.findIndex(p => p._id === currentProduct._id);
        if (productIndex >= 0) {
          setCurrentProduct(updatedData[productIndex]);
        }
      }
      
      message.success(inoutType === 'in' ? '入库成功' : '出库成功');
      setInoutModalVisible(false);
    } catch (error) {
      console.error('操作失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    } finally {
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

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="inventory" />
      
      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="商品编码或名称"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleScan}
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
          <Card 
            size="small" 
            style={{ marginBottom: 8 }}
            onClick={() => showProductDetail(item)}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {item.image ? (
                <img 
                  src={item.image} 
                  alt={item.productName} 
                  style={{ width: 48, height: 48, marginRight: 8, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: 48, height: 48, background: '#eee', marginRight: 8 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                <div style={{ fontSize: 12, color: '#888' }}>编码: {item.productCode}</div>
                <div>
                  <Tag color="blue">总库存: {item.quantity}</Tag>
                  <Tag color="green">库位: {item.locations ? item.locations.length : 0}</Tag>
                </div>
              </div>
            </div>
          </Card>
        )}
      />
      
      {/* 详情弹窗 */}
      <Modal
        title="商品详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
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
              {currentProduct.image ? (
                <img 
                  src={currentProduct.image} 
                  alt={currentProduct.productName} 
                  style={{ width: 80, height: 80, marginRight: 16, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: 80, height: 80, background: '#eee', marginRight: 16 }} />
              )}
              <div>
                <h3>{currentProduct.productName}</h3>
                <div>编码: {currentProduct.productCode}</div>
                <div>单位: {currentProduct.unit}</div>
                <div>总库存: {currentProduct.quantity}</div>
              </div>
            </div>
            
            <h4>库位明细</h4>
            {currentProduct.locations && currentProduct.locations.length > 0 ? (
              <List
                dataSource={currentProduct.locations}
                renderItem={loc => (
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div><strong>库位: {loc.locationCode}</strong></div>
                        <div>名称: {loc.locationName || '-'}</div>
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
                              icon={<EditOutlined />}
                              size="small"
                              style={{ marginBottom: 4 }}
                              onClick={e => {
                                e.stopPropagation();
                                startEdit(loc.locationCode, loc.quantity);
                              }}
                            >
                              盘点
                            </Button>
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              size="small"
                              style={{ marginBottom: 4 }}
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
                              size="small"
                              onClick={e => {
                                e.stopPropagation();
                                showInoutModal('out', loc.locationCode, loc.locationName, loc.quantity);
                              }}
                            >
                              出库
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
                无库位明细
              </div>
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
            <p><strong>库位:</strong> {inoutLocation.locationCode} {inoutLocation.locationName || ''}</p>
            <p><strong>当前库存:</strong> {inoutLocation.currentQty} {currentProduct.unit || '件'}</p>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                {inoutType === 'in' ? '入库' : '出库'}数量:
              </label>
              <InputNumber
                min={1}
                value={inoutQuantity}
                onChange={value => setInoutQuantity(value)}
                style={{ width: '100%' }}
                autoFocus
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