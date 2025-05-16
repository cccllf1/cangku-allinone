import React, { useState, useEffect } from 'react';
import { 
  Button, Input, message, Select, List, Card, 
  Modal, Form, Tag, Space, Empty, Spin
} from 'antd';
import { 
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, 
  SearchOutlined, SaveOutlined, LogoutOutlined, ScanOutlined
} from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';
import '../mobile.css';

const { Option } = Select;

const MobileExternalCodes = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [externalCodes, setExternalCodes] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    message.success('退出成功');
    navigate('/login');
  };

  // 获取所有产品
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('获取产品列表失败:', error);
      message.error('获取产品列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取指定产品的外部条码
  const fetchExternalCodes = async (productId) => {
    if (!productId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/products/${productId}/external-codes`);
      setExternalCodes(response.data || []);
    } catch (error) {
      console.error('获取外部条码失败:', error);
      message.error('获取外部条码失败');
      setExternalCodes([]);
    } finally {
      setLoading(false);
    }
  };

  // 选择产品时加载其外部条码
  const handleProductSelect = (productId) => {
    setSelectedProduct(productId);
    fetchExternalCodes(productId);
  };

  // 添加外部条码
  const handleAddExternalCode = async (values) => {
    if (!selectedProduct) {
      message.warning('请先选择一个产品');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/products/${selectedProduct}/external-codes`, values);
      message.success('添加外部条码成功');
      setAddModalVisible(false);
      form.resetFields();
      
      // 重新加载外部条码
      fetchExternalCodes(selectedProduct);
    } catch (error) {
      console.error('添加外部条码失败:', error);
      if (error.response?.status === 400) {
        message.error(error.response.data.message || '添加失败');
      } else {
        message.error('添加外部条码失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 删除外部条码
  const handleDeleteExternalCode = async (code) => {
    if (!selectedProduct) return;
    
    try {
      setLoading(true);
      await api.delete(`/products/${selectedProduct}/external-codes/${code}`);
      message.success('删除外部条码成功');
      
      // 重新加载外部条码
      fetchExternalCodes(selectedProduct);
    } catch (error) {
      console.error('删除外部条码失败:', error);
      message.error('删除外部条码失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索外部条码
  const handleSearch = async () => {
    if (!searchValue.trim()) {
      message.warning('请输入要搜索的条码');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/products/external-code/${searchValue.trim()}`);
      if (response.data) {
        // 找到了对应的产品
        message.success(`找到条码: ${searchValue}，对应产品: ${response.data.name}`);
        setSelectedProduct(response.data.id);
        fetchExternalCodes(response.data.id);
        
        // 清空搜索框
        setSearchValue('');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        message.warning('未找到对应此条码的产品');
      } else {
        console.error('搜索条码失败:', error);
        message.error('搜索失败');
      }
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
      handleSearch();
    }, 300);
  };

  // 初始化加载
  useEffect(() => {
    fetchProducts();
    
    // 检查URL参数是否有产品ID
    const params = new URLSearchParams(location.search);
    const productId = params.get('product_id');
    if (productId) {
      setSelectedProduct(productId);
      fetchExternalCodes(productId);
    }
  }, [location.search]);

  // 查找当前选中的产品名称
  const selectedProductName = selectedProduct
    ? products.find(p => p.id === selectedProduct)?.name || '未知产品'
    : '未选择';

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="externalCodes" />

      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="输入外部条码搜索对应产品"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          style={{ marginBottom: 8 }}
          suffix={
            <Space>
              <Button 
                type="primary" 
                icon={<ScanOutlined />} 
                onClick={openScanner}
                size="small"
              />
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
                size="small"
              />
            </Space>
          }
        />
        <div style={{ fontSize: 12, color: '#999' }}>
          直接扫描或输入外部条码可查询对应产品
        </div>
      </div>

      {/* 产品选择 */}
      <div style={{ marginBottom: 16 }}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择产品"
          value={selectedProduct}
          onChange={handleProductSelect}
          showSearch
          filterOption={(input, option) =>
            option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
        >
          {products.map(product => (
            <Option key={product.id} value={product.id}>
              {product.name} ({product.code})
            </Option>
          ))}
        </Select>
      </div>

      {/* 选中的产品信息 */}
      {selectedProduct && (
        <Card 
          size="small"
          title={`${selectedProductName} 的外部条码`}
          extra={
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              size="small"
              onClick={() => setAddModalVisible(true)}
            >
              添加
            </Button>
          }
          style={{ marginBottom: 16 }}
        >
          {loading ? (
            <div style={{textAlign: 'center', padding: '20px 0'}}>
              <Spin />
            </div>
          ) : externalCodes.length === 0 ? (
            <Empty description="暂无外部条码" />
          ) : (
            <List
              dataSource={externalCodes}
              renderItem={item => (
                <List.Item
                  key={item.code}
                  actions={[
                    <Button 
                      type="text" 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={() => handleDeleteExternalCode(item.code)}
                    />
                  ]}
                >
                  <List.Item.Meta
                    title={<Tag color="blue">{item.code}</Tag>}
                    description={
                      <div>
                        <div>来源: {item.source || '-'}</div>
                        {item.description && <div>描述: {item.description}</div>}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      {/* 添加外部条码弹窗 */}
      <Modal
        title="添加外部条码"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddExternalCode}
        >
          <Form.Item
            name="code"
            label="外部条码"
            rules={[{ required: true, message: '请输入外部条码' }]}
          >
            <Input placeholder="输入客户的商品条码" />
          </Form.Item>
          <Form.Item
            name="source"
            label="来源"
            initialValue="客户退货"
          >
            <Input placeholder="如: 客户A, 供应商B等" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="可选，添加条码的其他描述信息" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              icon={<SaveOutlined />}
              htmlType="submit" 
              loading={loading}
              block
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 扫码器Modal */}
      <Modal
        title="扫描外部条码"
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

export default MobileExternalCodes; 