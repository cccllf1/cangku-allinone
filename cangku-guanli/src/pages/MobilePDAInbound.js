import React, { useEffect, useState, useRef } from 'react';
import { Button, Input, message, Card, Space, Form, InputNumber, Select, Modal, Typography, QRCode } from 'antd';
import { ScanOutlined, DeleteOutlined, SaveOutlined, WifiOutlined, DisconnectOutlined, ClearOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';
import theme, { getStyle, messageConfig } from '../styles/theme';
import './MobilePDAInbound.css';

const { Option } = Select;
const { Title, Text } = Typography;

const MobilePDAInbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  // PDA连接相关状态
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionQRCode, setConnectionQRCode] = useState('');
  const [scanResult, setScanResult] = useState('');
  const wsRef = useRef(null);
  
  // 初始化WebSocket连接
  const initWebSocket = () => {
    // 生成6位房间号
    const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    setRoomId(newRoomId);
    
    // 生成PDA扫码页面的链接
    const pdaUrl = `${window.location.protocol}//${window.location.host}/mobile-scanner?room=${newRoomId}&type=pda-inbound`;
    setConnectionQRCode(pdaUrl);
    
    // 创建WebSocket连接（这里先模拟，实际需要后端支持）
    try {
      // wsRef.current = new WebSocket(`ws://${window.location.hostname}:3001`);
      // 目前先模拟连接状态
      console.log('WebSocket连接已创建，房间号:', newRoomId);
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      message.error('连接服务器失败');
    }
  };
  
  // 模拟PDA连接（实际项目中通过WebSocket实现）
  const simulatePDAConnection = () => {
    setTimeout(() => {
      setIsConnected(true);
      setShowConnectionModal(false);
      message.success('PDA已连接！可以开始扫码入库');
    }, 1000);
  };
  
  // 模拟接收扫码结果（实际通过WebSocket接收）
  const simulateReceiveScan = (code) => {
    setScanResult(code);
    handleScanReceived(code);
  };
  
  // 处理接收到的扫码结果
  const handleScanReceived = async (barcode) => {
    if (!barcode) return;
    
    console.log('接收到扫码结果:', barcode);
    message.info(`PDA扫码结果: ${barcode}`);
    
    try {
      await handleProductScan(barcode);
    } catch (error) {
      console.error('处理扫码结果失败:', error);
      message.error('处理扫码失败');
    }
  };
  
  // 处理商品扫码
  const handleProductScan = async (code) => {
    if (!code) return;
    
    try {
      setLoading(true);
      
      // 尝试通过商品编码获取商品信息
      let response;
      try {
        response = await api.get(`/products/code/${code}`);
      } catch (error) {
        // 如果直接获取失败，尝试通过外部条码查找
        try {
          const externalResponse = await api.get(`/external-codes/product/${code}`);
          if (externalResponse.data && externalResponse.data.product_code) {
            response = await api.get(`/products/code/${externalResponse.data.product_code}`);
          }
        } catch (externalError) {
          message.error(`未找到商品: ${code}`);
          return;
        }
      }
      
      const product = response.data;
      if (!product) {
        message.error(`商品不存在: ${code}`);
        return;
      }
      
      // 检查是否有SKU
      if (product.has_sku && product.skus && product.skus.length > 0) {
        // 有SKU的情况，需要选择具体SKU
        await handleProductWithSKU(product, code);
      } else {
        // 没有SKU的情况，直接添加
        await addProductToTable(product, null, code);
      }
      
    } catch (error) {
      console.error('处理商品扫码失败:', error);
      message.error('处理扫码失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理有SKU的商品
  const handleProductWithSKU = async (product, scannedCode) => {
    // 检查扫码结果是否已经包含SKU信息
    const isFullSkuCode = scannedCode.includes('-') && 
                         scannedCode.split('-').length >= 3;
    
    if (isFullSkuCode) {
      // 扫码结果已包含SKU信息，直接解析
      const sku = product.skus.find(s => s.code === scannedCode || 
                                    `${product.code}-${s.color}-${s.size}` === scannedCode);
      if (sku) {
        await addProductToTable(product, sku, scannedCode);
      } else {
        message.error(`未找到对应的SKU: ${scannedCode}`);
      }
    } else {
      // 只扫了商品编码，需要手动选择SKU
      message.warning(`商品${product.name}有多个规格，请在手机上选择具体SKU`);
      // 这里可以发送SKU选择请求到手机端
    }
  };
  
  // 添加商品到入库表格
  const addProductToTable = async (product, sku = null, scannedCode) => {
    const itemCode = sku ? (sku.code || `${product.code}-${sku.color}-${sku.size}`) : product.code;
    const itemName = sku ? `${product.name} ${sku.color} ${sku.size}` : product.name;
    
    // 检查是否已经存在
    const existingIndex = tableData.findIndex(item => item.code === itemCode);
    
    if (existingIndex >= 0) {
      // 已存在，增加数量
      const newTableData = [...tableData];
      newTableData[existingIndex].quantity += 1;
      setTableData(newTableData);
      message.success(`${itemName} 数量+1，当前数量: ${newTableData[existingIndex].quantity}`);
    } else {
      // 新商品，添加到表格
      const newItem = {
        key: tableData.length + 1,
        code: itemCode,
        name: itemName,
        quantity: 1,
        location: selectedLocation || '无货位',
        productCode: product.code,
        sku: sku,
        has_sku: product.has_sku
      };
      
      setTableData([...tableData, newItem]);
      message.success(`已添加: ${itemName}`);
    }
  };
  
  // 获取库位信息
  useEffect(() => {
    const fetchData = async () => {
      try {
        const locationsRes = await api.get('/locations/');
        const allLocations = locationsRes.data;
        setLocations(allLocations);
        
        setLocationOptions([
          { value: "无货位", label: "无货位" },
          ...allLocations.map(loc => ({
            value: loc.code,
            label: loc.code
          }))
        ]);
        
      } catch (error) {
        console.error('获取数据失败:', error);
        message.error('获取数据失败');
      }
    };
    
    fetchData();
  }, []);
  
  // 移除商品
  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
    message.success('已移除');
  };
  
  // 确认入库
  const handleConfirmInbound = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    
    try {
      setLoading(true);
      
      for (const item of tableData) {
        const inboundData = {
          product_code: item.productCode,
          sku_code: item.sku ? item.sku.code : null,
          location_code: item.location === '无货位' ? null : item.location,
          quantity: item.quantity,
          date: new Date().toISOString().split('T')[0]
        };
        
        await api.post('/inbound/', inboundData);
      }
      
      message.success(`成功入库 ${tableData.length} 种商品`);
      setTableData([]);
      form.resetFields();
      
    } catch (error) {
      console.error('入库失败:', error);
      message.error('入库失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // 清空表格
  const handleClearTable = () => {
    setTableData([]);
    message.info('已清空入库列表');
  };
  
  // 开始PDA连接
  const startPDAConnection = () => {
    initWebSocket();
    setShowConnectionModal(true);
  };
  
  // 断开连接
  const disconnectPDA = () => {
    setIsConnected(false);
    setRoomId('');
    if (wsRef.current) {
      wsRef.current.close();
    }
    message.info('PDA已断开连接');
  };

  return (
    <div style={{ padding: '8px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <MobileNavBar currentPage="pdaInbound" />
      
      {/* PDA连接状态 */}
      <Card className="connection-status-card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: '16px' }}>
              {isConnected ? (
                <><WifiOutlined style={{ color: '#52c41a' }} /> PDA已连接</>
              ) : (
                <>📱 等待PDA连接</>
              )}
            </Text>
            {roomId && <div style={{ fontSize: '12px', color: '#666' }}>房间号: {roomId}</div>}
          </div>
          <Space>
            {isConnected ? (
              <Button 
                danger 
                size="small" 
                icon={<DisconnectOutlined />}
                onClick={disconnectPDA}
              >
                断开
              </Button>
            ) : (
              <Button 
                type="primary" 
                icon={<ScanOutlined />}
                onClick={startPDAConnection}
              >
                连接PDA
              </Button>
            )}
          </Space>
        </div>
        
        {scanResult && (
          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0f8f0', borderRadius: '4px' }}>
            <Text style={{ fontSize: '12px', color: '#666' }}>最新扫码: </Text>
            <Text code>{scanResult}</Text>
          </div>
        )}
      </Card>
      
      {/* 默认库位选择 */}
      <Card style={{ marginBottom: '12px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>默认库位</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="选择默认库位"
            value={selectedLocation}
            onChange={setSelectedLocation}
            options={locationOptions}
            size="large"
          />
        </Space>
      </Card>
      
      {/* 入库商品列表 */}
      <Card title={`入库商品 (${tableData.length})`} style={{ marginBottom: '12px' }}>
        {tableData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            使用PDA扫码添加商品
          </div>
        ) : (
          <div className="inbound-list">
            {tableData.map((item, index) => (
              <Card 
                key={item.key} 
                size="small" 
                style={{ marginBottom: '8px' }}
                extra={
                  <Button 
                    danger 
                    size="small" 
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(item.key)}
                  />
                }
              >
                <div>
                  <Text strong>{item.name}</Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    编码: {item.code} | 数量: {item.quantity} | 库位: {item.location}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
      
      {/* 操作按钮 */}
      <Card>
        <Space style={{ width: '100%' }} direction="vertical">
          <Space style={{ width: '100%' }}>
            <Button 
              type="primary" 
              icon={<SaveOutlined />}
              loading={loading}
              onClick={handleConfirmInbound}
              style={{ flex: 1 }}
              size="large"
              disabled={tableData.length === 0}
            >
              确认入库 ({tableData.length})
            </Button>
            <Button 
              icon={<ClearOutlined />}
              onClick={handleClearTable}
              disabled={tableData.length === 0}
              size="large"
            >
              清空
            </Button>
          </Space>
          
          {/* 测试按钮（开发时用） */}
          {!isConnected && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '12px' }}>
              <Text style={{ fontSize: '12px', color: '#999', marginBottom: '8px', display: 'block' }}>
                测试功能（开发用）:
              </Text>
              <Space wrap>
                <Button size="small" onClick={() => simulateReceiveScan('129092')}>
                  测试商品码
                </Button>
                <Button size="small" onClick={() => simulateReceiveScan('129092-红色-L')}>
                  测试SKU码
                </Button>
                <Button size="small" onClick={simulatePDAConnection}>
                  模拟连接
                </Button>
              </Space>
            </div>
          )}
        </Space>
      </Card>
      
      {/* PDA连接二维码模态框 */}
      <Modal
        title="PDA扫码连接"
        open={showConnectionModal}
        footer={null}
        onCancel={() => setShowConnectionModal(false)}
        centered
      >
        <div style={{ textAlign: 'center' }}>
          <Title level={4}>用PDA扫描此二维码连接</Title>
          <div style={{ padding: '20px' }}>
            {connectionQRCode && (
              <QRCode value={connectionQRCode} size={200} />
            )}
          </div>
          <Text style={{ color: '#666' }}>
            扫码后PDA将自动连接到此设备
          </Text>
          <div style={{ marginTop: '16px' }}>
            <Button type="primary" onClick={simulatePDAConnection}>
              模拟连接成功（测试用）
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MobilePDAInbound; 