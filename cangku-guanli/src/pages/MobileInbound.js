import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Form, InputNumber, Select, Modal } from 'antd';
import { ScanOutlined, DeleteOutlined, SaveOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';

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
        const allLocations = locationsRes.data;
        setLocations(allLocations);
        
        // 创建库位选项
        setLocationOptions(
          allLocations.map(loc => ({
            value: loc.code,
            label: loc.code
          }))
        );
        
        // 不自动选择默认库位，让用户手动选择
        setSelectedLocation("");
        
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
            const matchingSku = product.skus.find(sku => sku.code === code);
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
      
      // 检查是否是完整的SKU编码
      const { isFullSku, product: fullProduct, sku: matchingSku } = await isFullSkuCode(inputCode);
      
      if (isFullSku && fullProduct) {
        // 如果是完整的SKU编码，直接添加
        const location = locations.find(l => l.code === selectedLocation);
        if (!location) {
          message.warning('请先选择库位');
          return;
        }
        
        // 添加到表格
        const newItem = {
          key: `${inputCode}-${Date.now()}`,
          productCode: fullProduct.code,
          productName: fullProduct.name || fullProduct.code,
          unit: fullProduct.unit || '件',
          quantity: 1,
          location: selectedLocation,
          product_id: fullProduct.id || fullProduct._id,
          location_id: location ? (location.id || location._id) : null,
          image: fullProduct.image_path || fullProduct.image || '',
          fullSkuCode: matchingSku ? matchingSku.code : null,
          skuColor: matchingSku ? matchingSku.color : null,
          skuSize: matchingSku ? matchingSku.size : null,
        };
        
        // 检查是否已存在相同的商品+SKU组合
        const existItem = tableData.find(item => 
          item.productCode === fullProduct.code && 
          item.location === selectedLocation &&
          item.fullSkuCode === (matchingSku ? matchingSku.code : null)
        );
        
        if (existItem) {
          // 已存在则增加数量
          setTableData(tableData.map(item => 
            (item.key === existItem.key) 
              ? {...item, quantity: item.quantity + 1}
              : item
          ));
          message.success(`${fullProduct.name} ${matchingSku ? `(${matchingSku.color} ${matchingSku.size})` : ''} 数量+1`);
        } else {
          // 不存在则添加新条目
          setTableData([...tableData, newItem]);
          message.success(`已添加 ${fullProduct.name} ${matchingSku ? `(${matchingSku.color} ${matchingSku.size})` : ''}`);
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
        const location = locations.find(l => l.code === selectedLocation);
        if (!location) {
          message.warning('请先选择库位');
          return;
        }

        // 显示找到的外部条码信息
        message.info(`识别到外部条码: ${inputCode}，对应商品: ${externalProduct.name}`);
        
        // 添加到表格
        const newItem = {
          key: `${externalProduct.code}-${Date.now()}`,
          productCode: externalProduct.code,
          productName: externalProduct.name || externalProduct.code,
          unit: externalProduct.unit || '件',
          quantity: 1,
          location: selectedLocation,
          product_id: externalProduct.id || externalProduct._id,
          location_id: location ? (location.id || location._id) : null,
          image: externalProduct.image_path || externalProduct.image || '',
          fullSkuCode: null,
          skuColor: null,
          skuSize: null,
          externalCode: inputCode,
          externalSource: externalCode.source || '客户退货'
        };
        
        // 检查是否已存在相同的商品
        const existItem = tableData.find(item => 
          item.productCode === externalProduct.code && 
          item.location === selectedLocation &&
          !item.fullSkuCode
        );
        
        if (existItem) {
          // 已存在则增加数量
          setTableData(tableData.map(item => 
            (item.key === existItem.key) 
              ? {...item, quantity: item.quantity + 1}
              : item
          ));
          message.success(`${externalProduct.name} 数量+1 (外部码: ${inputCode})`);
        } else {
          // 不存在则添加新条目
          setTableData([...tableData, newItem]);
          message.success(`已添加 ${externalProduct.name} (外部码: ${inputCode})`);
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
        // 如果商品不存在，自动创建
        if (error.response?.status === 404) {
          try {
            const createResponse = await api.post('/products', {
              code: inputCode,
              name: inputCode,
              unit: '件'
            });
            product = createResponse.data;
            message.success(`自动创建商品: ${inputCode}`);
          } catch (createError) {
            message.error('创建商品失败');
            throw createError;
          }
        } else {
          throw error;
        }
      }
      
      if (!product) {
        message.warning('未找到商品');
        return;
      }
      
      // 如果产品有SKU，显示SKU选择界面
      if (product.has_sku && product.skus && product.skus.length > 0) {
        setCurrentProduct(product);
        setSkuOptions(product.skus.map(sku => ({
          value: sku.code,
          label: `${sku.color || ''} ${sku.size || ''} (${sku.code})`,
          sku: sku
        })));
        setSelectedSku(null);
        setSkuSelectVisible(true);
        return;
      }
      
      // 查找选中的库位
      const location = locations.find(l => l.code === selectedLocation);
      if (!location) {
        message.warning('请先选择库位');
        return;
      }
      
      // 检查是否已存在
      const existItem = tableData.find(item => 
        item.productCode === inputCode && item.location === selectedLocation && !item.fullSkuCode);
      
      if (existItem) {
        // 已存在则增加数量
        setTableData(tableData.map(item => 
          (item.productCode === inputCode && item.location === selectedLocation && !item.fullSkuCode) 
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
          location: selectedLocation,
          product_id: product.id || product._id,
          location_id: location ? (location.id || location._id) : null,
          image: product.image_path || product.image || '',
          fullSkuCode: null,
          skuColor: null,
          skuSize: null,
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
    const location = locations.find(l => l.code === selectedLocation);
    if (!location) {
      message.warning('请先选择库位');
      setSkuSelectVisible(false);
      return;
    }
    
    // 检查是否已存在相同的SKU
    const existItem = tableData.find(item => 
      item.productCode === currentProduct.code && 
      item.fullSkuCode === selectedSkuObj.code &&
      item.location === selectedLocation
    );
    
    if (existItem) {
      // 已存在则增加数量
      setTableData(tableData.map(item => 
        (item.key === existItem.key) 
          ? {...item, quantity: item.quantity + 1}
          : item
      ));
      message.success(`${currentProduct.name} (${selectedSkuObj.color} ${selectedSkuObj.size}) 数量+1`);
    } else {
      // 不存在则添加新条目
      setTableData([...tableData, {
        key: `${currentProduct.code}-${selectedSkuObj.code}-${Date.now()}`,
        productCode: currentProduct.code,
        productName: currentProduct.name || currentProduct.code,
        unit: currentProduct.unit || '件',
        quantity: 1,
        location: selectedLocation,
        product_id: currentProduct.id || currentProduct._id,
        location_id: location ? (location.id || location._id) : null,
        image: currentProduct.image_path || currentProduct.image || '',
        fullSkuCode: selectedSkuObj.code,
        skuColor: selectedSkuObj.color,
        skuSize: selectedSkuObj.size,
      }]);
      message.success(`已添加 ${currentProduct.name} (${selectedSkuObj.color} ${selectedSkuObj.size})`);
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

  return (
    <div style={{ padding: '10px' }}>
      <MobileNavBar currentPage="inbound" />

      {/* 库位选择和扫码输入框 */}
      <Card 
        title="入库操作" 
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
          }}>第一步：选择货架位置</label>
          <Select
            style={{ width: '100%', marginBottom: 16 }}
            placeholder="请选择存放货架位置"
            value={selectedLocation}
            onChange={setSelectedLocation}
            options={locationOptions}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 4,
            fontWeight: 'bold',
            fontSize: '14px',
            color: '#333'
          }}>第二步：扫描或输入商品编码</label>
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
                  icon={<SearchOutlined />} 
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
          }}>提示：先选择货架位置，再扫描商品</div>
        </div>
        
        {/* 商品入库图示 */}
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
            }}>1. 选择货架</div>
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
            }}>2. 扫商品</div>
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
            <span style={{ fontWeight: 'bold' }}>已选商品({tableData.length})</span>
            {tableData.length > 0 && (
              <Button 
                type="primary" 
                onClick={handleConfirmInbound}
                loading={loading}
                icon={<SaveOutlined />}
              >
                保存入库
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
                  <span>{item.productName} {item.skuColor && item.skuSize ? `(${item.skuColor}-${item.skuSize})` : ''}</span>
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
      
      {/* SKU选择弹窗 */}
      <Modal
        title="选择SKU"
        open={skuSelectVisible}
        onCancel={() => setSkuSelectVisible(false)}
        footer={[
          <Button key="back" onClick={() => setSkuSelectVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSkuSelect}>
            确认
          </Button>
        ]}
      >
        {currentProduct && (
          <div>
            <h3>{currentProduct.name}</h3>
            <Select
              style={{ width: '100%' }}
              placeholder="选择SKU"
              onChange={(value) => setSelectedSku(value)}
              value={selectedSku}
            >
              {skuOptions.map(sku => (
                <Option key={sku.code} value={sku.code}>
                  {sku.color} - {sku.size} (编码: {sku.code})
                </Option>
              ))}
            </Select>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MobileInbound; 