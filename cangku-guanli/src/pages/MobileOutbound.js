import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Form, InputNumber, Select, Modal } from 'antd';
import { ScanOutlined, DeleteOutlined, SaveOutlined, LogoutOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';

const MobileOutbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
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
      console.log('获取库存成功', inventory.length);
    } catch (error) {
      console.error('获取库存失败', error);
    }
  };

  // 移除商品
  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
    message.success('已移除');
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
      // 查找商品
      const response = await api.get(`/products/code/${inputCode}`);
      const product = response.data;
      
      if (!product) {
        message.warning('未找到商品');
        return;
      }
      
      // 查找库存
      const inventoryRes = await api.get('/inventory/');
      const inventory = inventoryRes.data;
      const productInventory = inventory.find(i => i.productCode === inputCode);
      
      if (!productInventory || !productInventory.locations || productInventory.locations.length === 0) {
        message.warning('该商品无库存');
        return;
      }
      
      // 添加到表格
      const loc = productInventory.locations[0];
      const location = locations.find(l => l.code === loc.locationCode);
      
      // 检查是否已存在
      const existItem = tableData.find(item => 
        item.productCode === inputCode && item.location === loc.locationCode);
      
      if (existItem) {
        // 已存在则增加数量
        setTableData(tableData.map(item => 
          (item.productCode === inputCode && item.location === loc.locationCode) 
            ? {...item, quantity: item.quantity + 1}
            : item
        ));
        message.success(`${product.name} 数量+1`);
      } else {
        // 不存在则添加新条目
        setTableData([...tableData, {
          key: `${inputCode}-${Date.now()}`,
          productCode: inputCode,
          productName: product.name || inputCode,
          unit: product.unit || '件',
          quantity: 1,
          location: loc.locationCode,
          product_id: product.id || product._id,
          location_id: location ? (location.id || location._id) : null,
          image: product.image_path || product.image || '',
        }]);
        message.success(`已添加 ${product.name}`);
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

  // 确认出库
  const handleConfirmOutbound = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    
    try {
      setLoading(true);
      
      for (const item of tableData) {
        await api.post('/outbound/', {
          product_id: item.product_id,
          location_code: item.location,
          quantity: item.quantity,
        });
      }
      
      message.success('出库成功');
      setTableData([]);
    } catch (e) {
      console.error('出库失败:', e);
      message.error('出库失败: ' + (e.response?.data?.message || e.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <MobileNavBar currentPage="outbound" />
      
      {/* 扫码区域 */}
      <Card 
        title="出库操作" 
        style={{ marginBottom: 16 }}
        extra={<Button icon={<ScanOutlined />} onClick={openScanner}>扫码</Button>}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 4,
            fontWeight: 'bold',
            fontSize: '14px',
            color: '#333'
          }}>扫描或输入商品编码</label>
          <div style={{ display: 'flex' }}>
            <Input
              id="scanInput"
              placeholder="扫描商品条码或手动输入"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onPressEnter={handleScan}
              style={{ flex: 1 }}
              suffix={
                <Button 
                  type="primary" 
                  icon={<ScanOutlined />} 
                  onClick={handleScan}
                  style={{ marginRight: -12 }}
                />
              }
            />
          </div>
          <div style={{ 
            marginTop: 4, 
            fontSize: '12px', 
            color: '#888'
          }}>提示：系统将自动查找商品库存</div>
        </div>
        
        {/* 出库流程图示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 8,
          marginBottom: 12,
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px'
          }}>
            <div style={{
              padding: '4px 8px',
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '4px',
              marginRight: 8
            }}>1. 扫商品</div>
            <div style={{
              fontSize: '16px',
              margin: '0 8px'
            }}>→</div>
            <div style={{
              padding: '4px 8px',
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '4px',
              marginRight: 8
            }}>2. 确认数量</div>
            <div style={{
              fontSize: '16px',
              margin: '0 8px'
            }}>→</div>
            <div style={{
              padding: '4px 8px',
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '4px'
            }}>3. 保存</div>
          </div>
        </div>
      </Card>
      
      {/* 选中的商品列表 */}
      <List
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>出库商品({tableData.length})</span>
            {tableData.length > 0 && (
              <Button 
                type="primary" 
                onClick={handleConfirmOutbound}
                loading={loading}
                icon={<SaveOutlined />}
              >
                确认出库
              </Button>
            )}
          </div>
        }
        dataSource={tableData}
        renderItem={item => (
          <List.Item
            actions={[
              <Button 
                icon={<DeleteOutlined />} 
                danger
                onClick={() => handleDelete(item.key)}
              />
            ]}
          >
            <List.Item.Meta
              title={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>{item.productName}</span>
                </div>
              }
              description={
                <div>
                  <div>编码: {item.productCode}</div>
                  <div>数量: 
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
                      style={{ width: 60, marginLeft: 8 }}
                    /> {item.unit}
                  </div>
                  <div>位置: <span style={{ color: '#1890ff' }}>{item.location}</span></div>
                </div>
              }
            />
          </List.Item>
        )}
        locale={{ emptyText: "尚未添加商品" }}
      />
      
      {/* 扫码弹窗 */}
      <Modal
        title="扫描商品条码"
        open={scannerVisible}
        onCancel={() => setScannerVisible(false)}
        footer={null}
        width="95%"
        bodyStyle={{ padding: 0 }}
      >
        <BarcodeScannerComponent onScan={handleScanResult} onClose={() => setScannerVisible(false)} />
      </Modal>
    </div>
  );
};

export default MobileOutbound; 