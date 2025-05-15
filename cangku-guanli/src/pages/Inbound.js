import React, { useEffect, useState, useRef } from 'react';
import { Table, Input, Button, Select, message, Popconfirm, Form, Modal, Image } from 'antd';
import axios from 'axios';
import Navbar from '../components/Navbar';

const Inbound = () => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const inputRef = useRef();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState([]);
  const [locationInputValue, setLocationInputValue] = useState('');
  const [multiInput, setMultiInput] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  useEffect(() => {
    axios.get('/api/products/').then(res => setProducts(res.data));
    axios.get('/api/locations/').then(res => setLocations(res.data));
  }, []);

  useEffect(() => {
    if (locations.length > 0 && selectedLocation === null) {
      setSelectedLocation(locations[0].id);
    }
  }, [locations, selectedLocation]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations/', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setLocations(data);
          setLocationOptions(data.map(loc => ({ value: loc.code, label: loc.code })));
        }
      } catch (error) {
        console.error('获取库位失败:', error);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    axios.get('/api/inventory/').then(res => {
      const inventory = res.data;
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
      const sortedLocations = [...locations].sort((a, b) => {
        const qtyA = locationQuantities[a.code] || 0;
        const qtyB = locationQuantities[b.code] || 0;
        return qtyA - qtyB;
      });
      setLocationOptions(sortedLocations.map(loc => ({ value: loc.code, label: loc.code })));
    });
  }, [locations]);

  const handleInputChange = (e) => {
    setInputCode(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && inputCode.trim()) {
      handleAddProduct();
    }
  };

  const handleAddProduct = () => {
    const code = inputCode.trim();
    if (!code) return;
    const product = products.find(p => p.code === code);
    if (!product) {
      message.error('未找到该商品编码');
      setInputCode('');
      return;
    }
    const existIdx = tableData.findIndex(item => item.product_code === code && item.location_id === selectedLocation);
    if (existIdx !== -1) {
      const newData = [...tableData];
      newData[existIdx].quantity += 1;
      setTableData(newData);
    } else {
      setTableData([
        ...tableData,
        {
          key: `${code}-${selectedLocation}`,
          product_id: product.id,
          product_code: product.code,
          product_name: product.name,
          unit: product.unit,
          quantity: 1,
          location_id: selectedLocation,
          location_name: locations.find(l => l.id === selectedLocation)?.name || '',
        }
      ]);
    }
    setInputCode('');
    inputRef.current?.focus();
  };

  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
  };

  const handleQuantityChange = (value, key) => {
    setTableData(tableData.map(item => item.key === key ? { ...item, quantity: value } : item));
  };

  const handleConfirmInbound = async () => {
    // 补全 id，字段名统一
    const fixedTableData = tableData.map(item => {
      const product = products.find(p => p.code === item.productCode || p.code === item.product_code);
      const location = locations.find(l => l.code === item.location);
      return {
        ...item,
        product_id: product ? product.id : null,
        location_id: location ? location.id : null,
      };
    });
    if (fixedTableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    if (fixedTableData.some(item => !item.product_id || !item.location_id)) {
      message.error('商品或库位未匹配到ID，请检查输入');
      return;
    }
    try {
      for (const item of fixedTableData) {
        await axios.post('/api/inbound/', {
          product_id: Number(item.product_id),
          location_id: Number(item.location_id),
          quantity: item.quantity,
          batch_number: '',
          notes: ''
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
      message.success('入库成功');
      setTableData([]);
    } catch (e) {
      message.error('入库失败');
    }
  };

  const handleLocationInputChange = (value) => {
    setLocationInputValue(value);
  };

  const handleLocationSelectChange = (value) => {
    setLocationInputValue(value);
  };

  const handleLocationBlur = () => {
    if (locationInputValue && !locationOptions.some(option => option.value === locationInputValue)) {
      setLocationOptions([...locationOptions, { value: locationInputValue, label: locationInputValue }]);
    }
  };

  const handleProductCodeChange = async (e) => {
    const code = e.target.value;
    if (code) {
      try {
        const response = await fetch(`/api/products/${code}/`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const product = await response.json();
          form.setFieldsValue({
            productName: product.name,
            unit: product.unit
          });
        } else if (response.status === 404) {
          const createResponse = await fetch('/api/products/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              code: code,
              name: code,
              unit: '件'
            })
          });
          
          if (createResponse.ok) {
            const newProduct = await createResponse.json();
            form.setFieldsValue({
              productName: newProduct.name,
              unit: newProduct.unit
            });
            message.success('自动创建新商品成功');
          } else {
            message.error('自动创建新商品失败');
          }
        }
      } catch (error) {
        console.error('获取或创建商品失败:', error);
        message.error('获取或创建商品失败');
      }
    }
  };

  const handleAddToTable = async () => {
    try {
      const values = await form.validateFields();
      const newItem = {
        key: Date.now(),
        productCode: values.productCode,
        productName: values.productName,
        location: values.location,
        quantity: values.quantity,
        unit: values.unit
      };
      setTableData([...tableData, newItem]);
      form.resetFields(['productCode', 'productName', 'quantity', 'unit']);
    } catch (error) {
      console.error('添加失败:', error);
    }
  };

  const handleBatchConfirm = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品到表格');
      return;
    }

    try {
      setLoading(true);
      const promises = tableData.map(item => 
        fetch('/api/inbound/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            product_code: item.productCode,
            location_code: item.location,
            quantity: item.quantity
          })
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every(res => res.ok);
      
      if (allSuccess) {
        message.success('批量入库成功');
        setTableData([]);
      } else {
        message.error('部分商品入库失败');
      }
    } catch (error) {
      console.error('批量入库失败:', error);
      message.error('批量入库失败');
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
    let newTableData = [...tableData];
    for (const code of codes) {
      // 查商品信息
      let productName = code;
      let unit = '件';
      let productId = null;
      try {
        const response = await axios.get(`/api/products/code/${code}`);
        if (response.status === 200) {
          const product = response.data;
          productName = product.name;
          unit = product.unit;
          productId = product._id || product.id;
        }
      } catch (error) {
        // 查不到就用默认
      }
      newTableData.push({
        key: `${code}-${Date.now()}-${Math.random()}`,
        productCode: code,
        productName,
        unit,
        quantity: 1,
        product_id: productId,
      });
    }
    setTableData(newTableData);
    setMultiInput('');
  };

  const handleTableLocationChange = async (value, key) => {
    let loc = locations.find(l => l.code === value);
    // 如果找不到，自动创建库位
    if (!loc && value) {
      try {
        const res = await axios.post('/api/locations/', { code: value, name: value }, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        loc = res.data;
        // 刷新 locations 列表
        const locRes = await axios.get('/api/locations/', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        setLocations(locRes.data);
      } catch (e) {
        // 创建失败，location_id 依然为 null
      }
    }
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
        onBlur={handleLocationBlur}
        onSearch={handleLocationInputChange}
        notFoundContent={null}
        placeholder="请选择或输入库位"
      />
    ) },
    { title: '操作', key: 'action', render: (_, record) => (
      <Button danger size="small" onClick={() => handleDelete(record.key)}>删除</Button>
    ) },
  ];

  return (
    <div>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h1>入库管理</h1>
        <Form form={form} layout="vertical">
          <Form.Item label="商品编码" name="productCode" rules={[{ required: true, message: '请输入或选择商品编码' }]}> 
            <Input.TextArea
              value={multiInput}
              onChange={handleMultiInputChange}
              placeholder="可粘贴多行商品编码，每行一个，回车或按钮批量加入"
              autoSize={{ minRows: 2, maxRows: 6 }}
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleBatchAdd(); } }}
            />
            <Button htmlType="button" onClick={handleBatchAdd} style={{ marginTop: 8 }}>确认</Button>
          </Form.Item>
          <Form.Item label="库位" name="location"> 
            <Input
              placeholder="请输入库位（可为空，实际选择在表格中完成）"
              allowClear
              value={locationInputValue}
              onChange={e => setLocationInputValue(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="数量" name="quantity"> 
            <Input type="number" min={1} placeholder="请输入数量（可为空，默认为1）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">确认入库</Button>
          </Form.Item>
        </Form>
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" block onClick={() => { console.log('按钮被点击'); handleConfirmInbound(); }}>确认入库</Button>
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

export default Inbound;
