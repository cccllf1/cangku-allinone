import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { Button, List, Toast, Table, Input, message, Form, Select, Image, Modal } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

const Outbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState([]);
  const [locationInputValue, setLocationInputValue] = useState('');
  const [multiInput, setMultiInput] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取所有库位
        const locationsRes = await axios.get('/api/locations/');
        const allLocations = locationsRes.data;
        setLocations(allLocations);

        // 获取库存明细
        const inventoryRes = await axios.get('/api/inventory/');
        const inventory = inventoryRes.data;

        // 计算每个库位的总库存
        const locationQuantities = {};
        inventory.forEach(item => {
          if (Array.isArray(item.locations)) {
            item.locations.forEach(loc => {
              if (loc.locationCode) {
                locationQuantities[loc.locationCode] = (locationQuantities[loc.locationCode] || 0) + (loc.quantity || 0);
              }
            });
          }
        });

        // 按库存量升序排序库位
        const sortedLocations = [...allLocations].sort((a, b) => {
          const qtyA = locationQuantities[a.code] || 0;
          const qtyB = locationQuantities[b.code] || 0;
          return qtyA - qtyB;
        });

        // 更新库位选项，包含库存量信息
        setLocationOptions(sortedLocations.map(loc => ({
          value: loc.code,
          label: `${loc.code} (库存: ${locationQuantities[loc.code] || 0})`,
          quantity: locationQuantities[loc.code] || 0
        })));
      } catch (error) {
        console.error('获取数据失败:', error);
        message.error('获取数据失败');
      }
    };

    fetchData();
  }, []);

  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
  };

  const handleQuantityChange = (value, key) => {
    setTableData(tableData.map(item => item.key === key ? { ...item, quantity: value } : item));
  };

  const handleConfirmOutbound = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    try {
      setLoading(true);
      for (const item of tableData) {
        await axios.post('/api/outbound/', {
          product_id: Number(item.product_id),
          location_id: Number(item.location_id),
          quantity: item.quantity,
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
      message.success('出库成功');
      setTableData([]);
    } catch (e) {
      message.error('出库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMultiInputChange = (e) => {
    setMultiInput(e.target.value);
  };

  const handleBatchAdd = async () => {
    const codes = multiInput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (codes.length === 0) return;
    const codeCount = {};
    codes.forEach(code => {
      codeCount[code] = (codeCount[code] || 0) + 1;
    });
    let newTableData = [...tableData];

    // 获取库存明细
    let inventoryList = [];
    try {
      const inventoryRes = await axios.get('/api/inventory/');
      inventoryList = inventoryRes.data;
    } catch (e) {
      message.error('获取库存明细失败');
      return;
    }

    for (const [code, count] of Object.entries(codeCount)) {
      // 找到该商品的分库位库存明细
      const inv = inventoryList.find(item => item.productCode === code);
      if (!inv || !Array.isArray(inv.locations) || inv.locations.length === 0) {
        message.warning(`${code} 没有分库位库存明细，无法自动分配`);
        continue;
      }
      // 按库存升序
      const sortedLocs = [...inv.locations].sort((a, b) => a.quantity - b.quantity);
      let remain = count;
      for (const loc of sortedLocs) {
        if (remain <= 0) break;
        const useQty = Math.min(loc.quantity, remain);
        if (useQty > 0) {
          newTableData.push({
            key: `${code}-${loc.locationCode}`,
            productCode: code,
            productName: inv.productName || code,
            unit: inv.unit || '件',
            quantity: useQty,
            location: loc.locationCode,
            product_id: inv.product_id || null,
            location_id: loc.location_id || null
          });
          remain -= useQty;
        }
      }
      if (remain > 0) {
        message.warning(`${code} 库存不足，缺${remain}件`);
      }
    }
    setTableData(newTableData);
    setMultiInput('');
  };

  const handleTableLocationChange = (value, key) => {
    let loc = locations.find(l => l.code === value);
    setTableData(tableData.map(item => {
      if (item.key === key) {
        return {
          ...item,
          location: value,
          location_id: loc ? loc.id : null,
        };
      }
      return item;
    }));
  };

  const handlePreview = (imgUrl) => {
    setPreviewImage(imgUrl);
    setPreviewVisible(true);
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'image',
      key: 'image',
      render: (img, record) => img ? (
        <Image
          width={48}
          src={img}
          style={{ cursor: 'pointer' }}
          preview={false}
          onClick={() => handlePreview(img)}
        />
      ) : <span style={{ color: '#aaa' }}>无图</span>
    },
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (text, record) => (
      <Input
        type="number"
        min={1}
        value={record.quantity}
        style={{ width: 60 }}
        onChange={e => handleQuantityChange(Number(e.target.value), record.key)}
      />
    ) },
    { title: '库位', dataIndex: 'location', key: 'location', render: (text, record) => (
      <Select
        showSearch
        allowClear
        value={record.location}
        style={{ width: 120 }}
        options={locationOptions}
        onChange={value => handleTableLocationChange(value, record.key)}
        placeholder="请选择或输入库位"
      />
    ) },
    { title: '操作', key: 'action', render: (_, record) => (
      <Button danger size="small" onClick={() => handleDelete(record.key)}>删除</Button>
    ) },
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h1>出库管理</h1>
        <Form form={form} layout="vertical">
          <Form.Item label="商品编码">
            <Input.TextArea
              value={multiInput}
              onChange={handleMultiInputChange}
              placeholder="可粘贴多行商品编码，每行一个，回车或按钮批量加入"
              autoSize={{ minRows: 2, maxRows: 6 }}
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleBatchAdd(); } }}
            />
            <Button htmlType="button" onClick={handleBatchAdd} style={{ marginTop: 8 }}>确认</Button>
          </Form.Item>
        </Form>
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" block onClick={handleConfirmOutbound} loading={loading}>确认出库</Button>
      </div>
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={600}
      >
        <Image src={previewImage} style={{ width: '100%' }} />
      </Modal>
    </div>
  );
};

function OutboundNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div style={{ background: '#eee', padding: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
      <Button
        type={location.pathname === '/inventory' ? 'primary' : 'default'}
        style={{ marginRight: 8 }}
        onClick={() => navigate('/inventory')}
      >
        库存
      </Button>
      <Button
        type={location.pathname === '/inbound' ? 'primary' : 'default'}
        style={{ marginRight: 8 }}
        onClick={() => navigate('/inbound')}
      >
        入库
      </Button>
      <Button
        type={location.pathname === '/outbound' ? 'primary' : 'default'}
        style={{ marginRight: 8 }}
        onClick={() => navigate('/outbound')}
      >
        出库
      </Button>
    </div>
  );
}

export default Outbound;
