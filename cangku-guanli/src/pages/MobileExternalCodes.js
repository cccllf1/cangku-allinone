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
  const [skuList, setSkuList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [externalCodes, setExternalCodes] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [inputCode, setInputCode] = useState('');
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

  // 获取所有SKU
  const fetchAllSkus = async () => {
      setLoading(true);
    try {
      const productsRes = await api.get('/products/');
      const products = productsRes.data || [];
      const allSkus = [];
      products.forEach(product => {
        if (product.skus && product.skus.length > 0) {
          product.skus.forEach(sku => {
            allSkus.push({
              sku_code: sku.sku_code || sku.code,
              product_code: product.product_code || product.code,
              product_name: product.product_name || product.name,
              sku_color: sku.sku_color || sku.color,
              sku_size: sku.sku_size || sku.size,
              image_path: sku.image_path || sku.image || product.image_path || product.image || '',
            });
          });
        }
      });
      setSkuList(allSkus);
    } catch (error) {
      message.error('获取SKU列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 查询SKU的外部条码
  const fetchExternalCodes = async (sku_code) => {
    if (!sku_code) return;
      setLoading(true);
    try {
      const res = await api.get(`/sku/${sku_code}/external-codes`);
      setExternalCodes(res.data || []);
    } catch (error) {
      message.error('获取外部条码失败');
      setExternalCodes([]);
    } finally {
      setLoading(false);
    }
  };

  // 选择SKU
  const handleSkuSelect = (sku_code) => {
    const sku = skuList.find(s => s.sku_code === sku_code);
    setSelectedSku(sku);
    fetchExternalCodes(sku_code);
  };

  // 添加外部条码
  const handleAddExternalCode = async () => {
    if (!selectedSku || !inputCode.trim()) {
      message.warning('请选择SKU并输入外部条码');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/sku/${selectedSku.sku_code}/external-codes`, { external_code: inputCode.trim() });
      message.success('添加外部条码成功');
      setInputCode('');
      fetchExternalCodes(selectedSku.sku_code);
    } catch (error) {
        message.error('添加外部条码失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除外部条码
  const handleDeleteExternalCode = async (code) => {
    if (!selectedSku) return;
    setLoading(true);
    try {
      await api.delete(`/sku/${selectedSku.sku_code}/external-codes/${code}`);
      message.success('删除外部条码成功');
      fetchExternalCodes(selectedSku.sku_code);
    } catch (error) {
      message.error('删除外部条码失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索SKU
  const filteredSkus = skuList.filter(sku => {
    const v = searchValue.trim().toLowerCase();
    return (
      sku.sku_code.toLowerCase().includes(v) ||
      (sku.product_code && sku.product_code.toLowerCase().includes(v)) ||
      (sku.product_name && sku.product_name.toLowerCase().includes(v)) ||
      (sku.sku_color && sku.sku_color.toLowerCase().includes(v)) ||
      (sku.sku_size && sku.sku_size.toLowerCase().includes(v))
    );
  });

  // 扫码
  const handleScan = () => {
    if (!inputCode.trim()) {
      message.warning('请输入外部条码');
      return;
    }
    handleAddExternalCode();
  };

  // 初始化加载
  useEffect(() => {
    fetchAllSkus();
    
    // 检查URL参数是否有产品ID
    const params = new URLSearchParams(location.search);
    const productId = params.get('product_id');
    if (productId) {
      setSelectedSku(productId);
      fetchExternalCodes(productId);
    }
  }, [location.search]);

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="externalCodes" />

      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索SKU（商品名/编码/SKU码/颜色/尺码）"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          allowClear
          style={{ marginBottom: 8 }}
        />
        <List
          bordered
          dataSource={filteredSkus}
          loading={loading}
          style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8 }}
          renderItem={sku => (
            <List.Item
              style={{ cursor: 'pointer', background: selectedSku && selectedSku.sku_code === sku.sku_code ? '#e6f7ff' : undefined }}
              onClick={() => handleSkuSelect(sku.sku_code)}
            >
            <Space>
                <span><b>{sku.product_name}</b> ({sku.product_code})</span>
                <Tag color="blue">{sku.sku_color}</Tag>
                <Tag color="green">{sku.sku_size}</Tag>
                <Tag color="purple">{sku.sku_code}</Tag>
            </Space>
            </List.Item>
          )}
        />
      </div>

      {/* 选中的SKU信息 */}
      {selectedSku && (
        <Card title={<span>SKU信息</span>} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            {selectedSku.image_path && <img src={selectedSku.image_path} alt="sku" style={{ width: 60, height: 60, objectFit: 'contain', marginRight: 16 }} />}
            <div>
              <div><b>{selectedSku.product_name}</b> ({selectedSku.product_code})</div>
              <div>SKU编码: <Tag color="purple">{selectedSku.sku_code}</Tag></div>
              <div>颜色: <Tag color="blue">{selectedSku.sku_color}</Tag> 尺码: <Tag color="green">{selectedSku.sku_size}</Tag></div>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <Input.TextArea
              placeholder="扫描外部条码或手动输入"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              style={{ marginBottom: 8 }}
              onPressEnter={handleScan}
            />
            <Button type="primary" onClick={handleScan}>
              确认
            </Button>
          </div>
        </Card>
      )}

      {/* 已绑定外部条码 */}
      {selectedSku && (
        <Card title={<span>已绑定外部条码</span>}>
            <List
              dataSource={externalCodes}
            loading={loading}
            locale={{ emptyText: <Empty description="暂无外部条码" /> }}
            renderItem={code => (
              <List.Item actions={[<Button icon={<DeleteOutlined />} danger size="small" onClick={() => handleDeleteExternalCode(code.external_code || code)} />]}>
                <span style={{ fontSize: 16 }}>{code.external_code || code}</span>
                </List.Item>
              )}
            />
        </Card>
      )}
    </div>
  );
};

export default MobileExternalCodes; 