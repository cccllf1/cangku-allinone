import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import api from '../api/auth'; // 导入带认证功能的API实例
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
        const locationsRes = await api.get('/locations/');
        const allLocations = locationsRes.data;
        setLocations(allLocations);

        // 获取库存明细
        const inventoryRes = await api.get('/inventory/');
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
        message.error('获取数据失败: ' + (error.response?.data?.message || error.message || '未知错误'));
      }
    };

    fetchData();
  }, []);

  const handleDelete = (key) => {
    setTableData(tableData.filter(item => item.key !== key));
  };

  const handleQuantityChange = (value, key) => {
    // 确保数量始终是合法的正整数
    const safeValue = (!value || isNaN(value) || value < 1) ? 1 : parseInt(value);
    
    setTableData(tableData.map(item => 
      item.key === key ? { ...item, quantity: safeValue } : item
    ));
  };

  const handleConfirmOutbound = async () => {
    if (tableData.length === 0) {
      message.warning('请先添加商品');
      return;
    }
    
    // 检查是否有token
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('您尚未登录或登录已过期，请先登录');
      setTimeout(() => window.location.href = '/login', 2000);
      return;
    }
    
    // 检查所有必要的字段
    const missingFields = tableData.filter(item => !item.product_id || !item.location_id);
    if (missingFields.length > 0) {
      message.error('部分商品缺少必要信息，请检查商品和库位');
      console.error('缺少必要信息的商品:', missingFields);
      return;
    }
    
    try {
      setLoading(true);
      console.log('准备出库，商品数量:', tableData.length);
      
      for (const item of tableData) {
        console.log('处理出库商品:', item.productCode, '库位:', item.location, '数量:', item.quantity, 'product_id:', item.product_id, 'location_id:', item.location_id);
        
        // 移除Number()转换，保持ID的原始格式
        await api.post('/outbound/', {
          product_id: item.product_id,
          location_id: item.location_id,
          quantity: item.quantity,
        });
      }
      
      message.success('出库成功');
      setTableData([]);
    } catch (e) {
      console.error('出库失败:', e);
      console.error('错误详情:', e.response?.data);
      if (e.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }
      message.error('出库失败: ' + (e.response?.data?.message || e.message || '未知错误'));
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

    // 检查是否有token
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('您尚未登录或登录已过期，请先登录');
      setTimeout(() => window.location.href = '/login', 2000);
      return;
    }

    // 获取库存明细
    let inventoryList = [];
    try {
      const inventoryRes = await api.get('/inventory/');
      inventoryList = inventoryRes.data;
      console.log('获取库存明细成功:', inventoryList.length, '条记录');
    } catch (e) {
      if (e.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }
      message.error('获取库存明细失败: ' + (e.response?.data?.message || e.message || '未知错误'));
      return;
    }

    // 获取所有商品
    let productList = [];
    try {
      const productsRes = await api.get('/products/');
      productList = productsRes.data;
      console.log('获取商品列表成功:', productList.length, '条记录');
    } catch (e) {
      message.error('获取商品列表失败');
      return;
    }

    for (const [code, count] of Object.entries(codeCount)) {
      // 找到该商品
      const product = productList.find(p => p.code === code);
      if (!product) {
        message.warning(`未找到商品: ${code}`);
        continue;
      }

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
          // 查找库位对象
          const location = locations.find(l => l.code === loc.locationCode);
          if (!location) {
            console.warn(`找不到库位: ${loc.locationCode}`);
            continue;
          }
          
          newTableData.push({
            key: `${code}-${loc.locationCode}-${Date.now()}`,
            productCode: code,
            productName: product.name || code,
            unit: product.unit || '件',
            quantity: useQty,
            location: loc.locationCode,
            product_id: product.id || product._id,
            location_id: location.id || location._id,
            image: product.image_path || product.image || '',
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
    console.log('选择库位:', value, '找到库位对象:', loc);
    
    if (!loc && value) {
      // 如果找不到库位但用户输入了值，显示警告
      message.warning(`库位 ${value} 不存在，请选择有效库位`);
      return;
    }
    
    setTableData(tableData.map(item => {
      if (item.key === key) {
        return {
          ...item,
          location: value,
          location_id: loc ? (loc.id || loc._id) : null,
        };
      }
      return item;
    }));
  };

  const handlePreview = (imgUrl) => {
    console.log('预览图片:', imgUrl);
    
    if (!imgUrl) {
      message.error('无法预览图片：URL为空');
      return;
    }
    
    // 设置预览图片URL
    setPreviewImage(imgUrl);
    setPreviewVisible(true);
    
    // 测试图片是否可加载
    const img = new Image();
    img.onload = () => console.log('图片加载成功:', imgUrl);
    img.onerror = () => {
      console.error('图片加载失败:', imgUrl);
      message.warning('图片可能无法正确加载');
    };
    img.src = imgUrl;
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'image',
      key: 'image',
      render: (img, record) => {
        console.log('渲染图片信息:', record);
        // 从record中获取所有可能的图片相关字段
        const imageUrl = img || record.image_path || record.imagePath || record.image_url || '';
        
        // 将URL转换为完整路径
        let fullImageUrl = imageUrl;
        if (imageUrl && !imageUrl.startsWith('http')) {
          const baseUrl = window.location.protocol + '//' + window.location.host;
          fullImageUrl = imageUrl.startsWith('/') ? 
            baseUrl + imageUrl : 
            baseUrl + '/' + imageUrl;
        }
        
        console.log('处理后的图片URL:', fullImageUrl);
        
        return imageUrl ? (
          <Image
            width={48}
            src={fullImageUrl}
            style={{ cursor: 'pointer' }}
            preview={{
              src: fullImageUrl,
              mask: '点击预览'
            }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
          />
        ) : <span style={{ color: '#aaa' }}>无图</span>
      }
    },
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (text, record) => (
      <Input
        type="number"
        min={1}
        defaultValue={1}
        value={record.quantity || 1}
        style={{ width: 60 }}
        onChange={e => {
          // 直接将输入值转为数字，无效则设为1
          let val = parseInt(e.target.value);
          if (isNaN(val) || val < 1) {
            val = 1;
          }
          handleQuantityChange(val, record.key);
        }}
        // 防止浏览器原生验证
        onInvalid={(e) => e.preventDefault()}
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
            <Button htmlType="button" onClick={handleBatchAdd} style={{ marginTop: 8 }}>批量添加</Button>
          </Form.Item>
          
          {/* 添加手动输入区域 */}
          <div style={{ display: 'flex', marginBottom: 16, alignItems: 'flex-start', gap: 8 }}>
            <Input 
              placeholder="输入商品编码" 
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              style={{ width: 200 }}
              onPressEnter={async () => {
                if (!inputCode) return;
                try {
                  // 查找商品
                  const response = await api.get(`/products/code/${inputCode}`);
                  const product = response.data;
                  if (!product) {
                    message.warning('未找到该商品');
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
                  
                  // 查找库位对象
                  const loc = productInventory.locations[0];
                  const location = locations.find(l => l.code === loc.locationCode);
                  
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
                  
                  setInputCode('');
                } catch (error) {
                  console.error('添加商品失败:', error);
                  message.error('添加失败: ' + (error.response?.data?.message || error.message));
                }
              }}
            />
            <Button type="primary" onClick={async () => {
              if (!inputCode) return;
              try {
                // 查找商品
                const response = await api.get(`/products/code/${inputCode}`);
                const product = response.data;
                if (!product) {
                  message.warning('未找到该商品');
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
                
                // 查找库位对象
                const loc = productInventory.locations[0];
                const location = locations.find(l => l.code === loc.locationCode);
                
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
                
                setInputCode('');
              } catch (error) {
                console.error('添加商品失败:', error);
                message.error('添加失败: ' + (error.response?.data?.message || error.message));
              }
            }}>添加</Button>
          </div>
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
        <Image 
          src={previewImage} 
          style={{ width: '100%' }} 
          preview={{ 
            src: previewImage,
            mask: false,
            toolbarRender: () => null
          }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        />
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
