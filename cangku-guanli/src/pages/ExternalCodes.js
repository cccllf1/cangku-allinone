import React, { useState, useEffect } from 'react';
import { 
  Table, Input, Button, Space, Modal, Form, Select, message, Card, Divider, Tag, Tooltip
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, SearchOutlined, LinkOutlined, HomeOutlined, ArrowLeftOutlined 
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/auth';

const { Search } = Input;
const { Option } = Select;

const ExternalCodes = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [externalCodes, setExternalCodes] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();

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

  // 外部条码表格列配置
  const columns = [
    {
      title: '外部条码',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteExternalCode(record.code)}
        />
      )
    }
  ];

  // 查找当前选中的产品名称
  const selectedProductName = selectedProduct
    ? products.find(p => p.id === selectedProduct)?.name || '未知产品'
    : '未选择';

  return (
    <div style={{ padding: '20px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<HomeOutlined />} 
          onClick={() => navigate('/inventory')}
        >
          返回首页
        </Button>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/products')}
        >
          返回产品管理
        </Button>
      </Space>

      <h2>外部条码管理</h2>
      
      <Card title="搜索外部条码" style={{ marginBottom: 16 }}>
        <Search
          placeholder="输入外部条码搜索对应产品"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onSearch={handleSearch}
          enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
          style={{ marginBottom: 16 }}
        />
        <div>
          <p>提示: 输入客户的商品条码，查找对应的系统内商品</p>
        </div>
      </Card>

      <Card title="选择产品" style={{ marginBottom: 16 }}>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="选择产品"
          optionFilterProp="children"
          value={selectedProduct}
          onChange={handleProductSelect}
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
      </Card>

      {selectedProduct && (
        <Card 
          title={`${selectedProductName} 的外部条码`}
          extra={
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              添加外部条码
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={externalCodes.map(ec => ({ ...ec, key: ec.code }))}
            loading={loading}
            pagination={false}
            locale={{ emptyText: '暂无外部条码' }}
          />
        </Card>
      )}

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
            <Input.TextArea placeholder="可选，添加条码的其他描述信息" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存
              </Button>
              <Button onClick={() => setAddModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExternalCodes; 