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
  const [addExternalCodeValue, setAddExternalCodeValue] = useState('');
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
              skuCode: sku.code,
              productCode: product.code,
              productName: product.name,
              color: sku.color,
              size: sku.size,
              image: sku.image || product.image || '',
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
  const fetchExternalCodes = async (skuCode) => {
    if (!skuCode) return;
      setLoading(true);
    try {
      const res = await api.get(`/sku/${skuCode}/external-codes`);
      setExternalCodes(res.data || []);
    } catch (error) {
      message.error('获取外部条码失败');
      setExternalCodes([]);
    } finally {
      setLoading(false);
    }
  };

  // 选择SKU
  const handleSkuSelect = (skuCode) => {
    const sku = skuList.find(s => s.skuCode === skuCode);
    setSelectedSku(sku);
    fetchExternalCodes(skuCode);
  };

  // 添加外部条码
  const handleAddExternalCode = async () => {
    if (!selectedSku || !addExternalCodeValue.trim()) {
      message.warning('请选择SKU并输入外部条码');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/sku/${selectedSku.skuCode}/external-codes`, { external_code: addExternalCodeValue.trim() });
      message.success('添加外部条码成功');
      setAddExternalCodeValue('');
      fetchExternalCodes(selectedSku.skuCode);
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
      await api.delete(`/sku/${selectedSku.skuCode}/external-codes/${code}`);
      message.success('删除外部条码成功');
      fetchExternalCodes(selectedSku.skuCode);
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
      sku.skuCode.toLowerCase().includes(v) ||
      (sku.productCode && sku.productCode.toLowerCase().includes(v)) ||
      (sku.productName && sku.productName.toLowerCase().includes(v)) ||
      (sku.color && sku.color.toLowerCase().includes(v)) ||
      (sku.size && sku.size.toLowerCase().includes(v))
    );
  });

  // 扫码
  const openScanner = () => setScannerVisible(true);
  const handleScanResult = (barcode) => {
    if (!barcode) return;
    setAddExternalCodeValue(barcode);
    setScannerVisible(false);
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
              style={{ cursor: 'pointer', background: selectedSku && selectedSku.skuCode === sku.skuCode ? '#e6f7ff' : undefined }}
              onClick={() => handleSkuSelect(sku.skuCode)}
            >
            <Space>
                <span><b>{sku.productName}</b> ({sku.productCode})</span>
                <Tag color="blue">{sku.color}</Tag>
                <Tag color="green">{sku.size}</Tag>
                <Tag color="purple">{sku.skuCode}</Tag>
            </Space>
            </List.Item>
          )}
        />
      </div>

      {/* 选中的SKU信息 */}
      {selectedSku && (
        <Card title={<span>SKU信息</span>} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            {selectedSku.image && <img src={selectedSku.image} alt="sku" style={{ width: 60, height: 60, objectFit: 'contain', marginRight: 16 }} />}
            <div>
              <div><b>{selectedSku.productName}</b> ({selectedSku.productCode})</div>
              <div>SKU编码: <Tag color="purple">{selectedSku.skuCode}</Tag></div>
              <div>颜色: <Tag color="blue">{selectedSku.color}</Tag> 尺码: <Tag color="green">{selectedSku.size}</Tag></div>
            </div>
          </div>
          <div>
            <Input.Group compact>
              <Input
                style={{ width: '60%' }}
                placeholder="输入/扫码外部条码"
                value={addExternalCodeValue}
                onChange={e => setAddExternalCodeValue(e.target.value)}
                onPressEnter={handleAddExternalCode}
              />
              <Button icon={<ScanOutlined />} onClick={openScanner}>扫码</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddExternalCode}>添加</Button>
            </Input.Group>
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

      {/* 扫码器Modal */}
      <Modal
        title="扫码外部条码"
        open={scannerVisible}
        onCancel={() => setScannerVisible(false)}
        footer={null}
      >
        <BarcodeScannerComponent onScan={handleScanResult} onClose={() => setScannerVisible(false)} />
      </Modal>
    </div>
  );
};

export default MobileExternalCodes; 