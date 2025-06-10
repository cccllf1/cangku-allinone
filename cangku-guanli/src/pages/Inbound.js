import React, { useEffect, useState, useRef } from 'react';
import { Table, Input, Button, Select, message, Popconfirm, Form, Modal, Image } from 'antd';
import api from '../api/auth';
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
  const [inventory, setInventory] = useState({});

  useEffect(() => {
    // 获取产品列表和库位列表
    api.get('/products').then(res => setProducts(res.data));
    api.get('/locations').then(res => setLocations(res.data));
  }, []);

  useEffect(() => {
    if (locations.length > 0 && selectedLocation === null) {
      setSelectedLocation(locations[0].id);
    }
  }, [locations, selectedLocation]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // 使用api实例
        const response = await api.get('/locations');
        if (response.status === 200) {
          const data = response.data;
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
    api.get('/inventory').then(res => {
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

  // 获取库存信息，用于计算在库数量
  useEffect(() => {
    api.get('/inventory').then(res => {
      // 处理库存数据 - 注意检查response格式
      const inventoryData = {};
      if (Array.isArray(res.data)) {
        res.data.forEach(item => {
          inventoryData[item.product_id] = item.quantity;
        });
      }
      setInventory(inventoryData);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

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
    // 允许临时存储空字符串，但在提交时仍需为有效值
    const inputValue = value === '' ? '' : (!value || isNaN(value) || value < 1) ? 1 : parseInt(value);
    
    setTableData(tableData.map(item => 
      item.key === key ? { ...item, quantity: inputValue } : item
    ));
  };

  const handleConfirmInbound = async () => {
    try {
      setLoading(true);
      // 对每个商品进行处理，确保都有库位和有效数量
      const updatedTableData = [...tableData].map(item => {
        // 确保数量是有效值
        const validQuantity = item.quantity === '' || isNaN(parseInt(item.quantity)) ? 1 : parseInt(item.quantity);
        
        // 确保有库位
        const location = !item.location ? 'DEFAULT' : item.location;
        
        return {
          ...item,
          quantity: validQuantity,
          location: location
        };
      });
      
      setTableData(updatedTableData);

      // 如果有商品没有库位ID，可能是因为库位是新输入的，需要先创建
      let needDefaultLocation = false;
      for (const item of updatedTableData) {
        if (!item.location_id && item.location) {
          needDefaultLocation = true;
        }
      }

      // 创建默认库位
      if (needDefaultLocation) {
        try {
          const defaultLocationRes = await api.post('/locations', 
            { code: "DEFAULT", name: "默认库位" }
          );
          
          console.log('创建默认库位成功:', defaultLocationRes.data);
          
          // 刷新库位列表
          const locationsRes = await api.get('/locations');
          setLocations(locationsRes.data);
          
          // 更新表格中的库位ID
          const updatedTableData = [];
          for (const item of updatedTableData) {
            if (!item.location_id && item.location) {
              // 找对应的库位
              const loc = locationsRes.data.find(l => l.code === item.location);
              if (loc) {
                updatedTableData.push({ ...item, location_id: loc.id });
                continue;
              }
              
              // 如果还是找不到，可能需要为这个特定的库位创建一个新条目
              try {
                const newLocRes = await api.post('/locations', 
                  { code: item.location, name: item.location }
                );
                updatedTableData.push({ ...item, location_id: newLocRes.data.id });
              } catch (error) {
                console.error('创建特定库位失败:', error);
                // 失败时使用默认库位
                const defaultLoc = locationsRes.data.find(l => l.code === "DEFAULT");
                if (defaultLoc) {
                  updatedTableData.push({ ...item, location: "DEFAULT", location_id: defaultLoc.id });
                } else {
                  updatedTableData.push(item);
                }
              }
            } else {
              updatedTableData.push(item);
            }
          }
          setTableData(updatedTableData);
        } catch (error) {
          console.error('创建默认库位失败:', error);
          message.error('创建默认库位失败，请手动选择库位');
          setLoading(false);
          return;
        }
      }

      // 批量入库
      const promises = updatedTableData.map(item => {
        return new Promise((resolve) => {
          api.post('/inbound', {
            product_id: Number(item.product_id),
            location_id: Number(item.location_id),
            quantity: item.quantity
          })
            .then(() => resolve({ ok: true }))
            .catch((error) => {
              console.error('入库失败:', error);
              resolve({ ok: false, error });
            });
        });
      });
      
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
        // 使用api实例
        const response = await api.get(`/products/code/${code}`);
        
        if (response.status === 200) {
          const product = response.data;
          form.setFieldsValue({
            productName: product.name,
            unit: product.unit || '件'
          });
        } else if (response.status === 404) {
          // 使用api实例创建商品
          const createResponse = await api.post('/products', {
            code: code,
            name: code,
            unit: '件'
          });
          
          if (createResponse.status === 201) {
            const newProduct = createResponse.data;
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
        // 如果是404错误，尝试创建新商品
        if (error.response?.status === 404) {
          try {
            const createResponse = await api.post('/products', {
              code: code,
              name: code,
              unit: '件'
            });
            
            const newProduct = createResponse.data;
            form.setFieldsValue({
              productName: newProduct.name,
              unit: newProduct.unit
            });
            message.success('自动创建新商品成功');
          } catch (createError) {
            console.error('创建商品失败:', createError);
            message.error('自动创建新商品失败');
          }
        } else {
          message.error('获取商品失败');
        }
      }
    }
  };

  const handleAddToTable = async () => {
    try {
      const values = await form.validateFields();
      
      // 如果单位为空，设置默认值为"件"
      if (!values.unit || values.unit.trim() === '') {
        values.unit = '件';
      }
      
      // 检查表格中是否已存在相同商品编码的商品
      const existingItemIndex = tableData.findIndex(item => item.productCode === values.productCode);
      
      if (existingItemIndex >= 0) {
        // 如果已存在，只更新数量
        const newTableData = [...tableData];
        console.log(`商品编码[${values.productCode}]已存在，累加数量 +1`);
        newTableData[existingItemIndex] = {
          ...newTableData[existingItemIndex],
          quantity: (newTableData[existingItemIndex].quantity || 0) + 1
        };
        setTableData(newTableData);
      } else {
        // 如果不存在，添加新行
        const newItem = {
          key: `${values.productCode}-${Date.now()}`,
          productCode: values.productCode,
          productName: values.productName,
          location: values.location,
          quantity: 1, // 默认数量为1
          unit: values.unit
        };
        setTableData([...tableData, newItem]);
      }
      
      // 重置表单，保留location字段的值
      const location = form.getFieldValue('location');
      form.resetFields(['productCode', 'productName', 'unit']);
      if (location) {
        form.setFieldsValue({ location });
      }
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
      
      // 对每个商品进行处理，确保都有库位和有效数量
      const updatedTableData = [...tableData].map(item => {
        // 确保数量是有效值
        const validQuantity = item.quantity === '' || isNaN(parseInt(item.quantity)) ? 1 : parseInt(item.quantity);
        
        // 确保有库位
        const location = !item.location ? 'DEFAULT' : item.location;
        
        return {
          ...item,
          quantity: validQuantity,
          location: location
        };
      });
      
      setTableData(updatedTableData);

      // 确保有默认库位
      try {
        // 查找或创建默认库位
        let defaultLocation;
        try {
          const response = await api.get('/locations/code/DEFAULT');
          defaultLocation = response.data;
        } catch (error) {
          if (error.response?.status === 404) {
            // 创建默认库位
            const res = await api.post('/locations', { 
              code: 'DEFAULT', 
              name: '默认库位' 
            });
            defaultLocation = res.data;
            message.success('自动创建默认库位成功');
          } else {
            throw error;
          }
        }
        
        // 处理每个商品的库位
        for (let i = 0; i < updatedTableData.length; i++) {
          let item = updatedTableData[i];
          if (!item.location_id && item.location) {
            // 尝试查找对应库位
            try {
              const res = await api.get(`/locations/code/${item.location}`);
              updatedTableData[i] = {
                ...item,
                location_id: res.data.id
              };
            } catch (error) {
              if (error.response?.status === 404) {
                // 创建新库位
                try {
                  const newLocRes = await api.post('/locations', {
                    code: item.location,
                    name: item.location
                  });
                  updatedTableData[i] = {
                    ...item,
                    location_id: newLocRes.data.id
                  };
                  message.success(`自动创建库位 "${item.location}" 成功`);
                } catch (createError) {
                  console.error('创建库位失败:', createError);
                  // 使用默认库位
                  updatedTableData[i] = {
                    ...item,
                    location: 'DEFAULT',
                    location_id: defaultLocation.id
                  };
                  message.warning(`无法创建库位 "${item.location}", 使用默认库位`);
                }
              } else {
                console.error('获取库位失败:', error);
                // 使用默认库位
                updatedTableData[i] = {
                  ...item,
                  location: 'DEFAULT',
                  location_id: defaultLocation.id
                };
              }
            }
          }
        }
      
        // 更新表格数据
        setTableData(updatedTableData);
      
        // 执行入库操作
        const promises = updatedTableData.map(item => 
          new Promise((resolve) => {
            api.post('/inbound', {
              product_code: item.productCode,
              product_id: item.product_id,
              location_code: item.location,
              location_id: item.location_id,
              quantity: item.quantity
            })
            .then(() => resolve({ ok: true }))
            .catch((error) => {
              console.error('入库失败:', error);
              resolve({ ok: false, error });
            });
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
        console.error('处理库位失败:', error);
        message.error('处理库位失败: ' + (error.response?.data?.message || error.message));
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
    
    // 计算每个商品码出现的次数
    const codeCount = {};
    codes.forEach(code => {
      codeCount[code] = (codeCount[code] || 0) + 1;
    });
    
    let newTableData = [...tableData];
    
    for (const [code, count] of Object.entries(codeCount)) {
      // 先检查表格中是否已存在该商品
      const existingItemIndex = newTableData.findIndex(item => item.productCode === code);
      
      if (existingItemIndex >= 0) {
        // 如果已存在，只更新数量
        console.log(`商品编码[${code}]已存在，累加数量 +${count}`);
        newTableData[existingItemIndex] = {
          ...newTableData[existingItemIndex],
          quantity: (newTableData[existingItemIndex].quantity || 0) + count
        };
        continue;
      }
      
      // 如果不存在，查商品信息并创建新行
      let productName = code;
      let unit = '件'; // 默认单位为"件"
      let productId = null;
      let imageUrl = '';
      try {
        // 使用api实例发送GET请求
        const response = await api.get(`/products/code/${code}`);
        if (response.status === 200) {
          const product = response.data;
          productName = product.name;
          // 如果获取到的单位为空，也使用默认值"件"
          unit = product.unit && product.unit.trim() !== '' ? product.unit : '件';
          productId = product._id || product.id;
          imageUrl = product.image_path || product.image || '';
        }
      } catch (error) {
        console.log(`商品编码[${code}]不存在，自动创建...`);
        // 如果是404错误，表示商品不存在，自动创建
        if (error.response?.status === 404) {
          try {
            const createResponse = await api.post('/products', {
              code: code,
              name: code,
              unit: '件'
            });
            
            const newProduct = createResponse.data;
            productName = newProduct.name;
            unit = newProduct.unit;
            productId = newProduct.id || newProduct._id;
            imageUrl = newProduct.image_path || newProduct.image || '';
            message.success(`自动创建商品 "${code}" 成功`);
          } catch (createError) {
            console.error('创建商品失败:', createError);
            message.error(`自动创建商品 "${code}" 失败: ${createError.response?.data?.message || createError.message}`);
            // 仍然添加到表格，使用默认值
          }
        } else {
          message.error(`获取商品 "${code}" 失败: ${error.response?.data?.message || error.message}`);
        }
      }
      
      // 添加新行，数量为该商品码的出现次数
      newTableData.push({
        key: `${code}-${Date.now()}-${Math.random()}`,
        productCode: code,
        productName,
        unit,
        quantity: count, // 使用计数作为数量
        product_id: productId,
        image: imageUrl,
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
        // 使用api实例发送POST请求创建库位
        const res = await api.post('/locations', { code: value, name: value });
        loc = res.data;
        // 刷新 locations 列表，也使用api实例
        const locRes = await api.get('/locations');
        setLocations(locRes.data);
      } catch (e) {
        console.error('创建库位失败:', e);
        message.error('创建库位失败:' + (e.response?.data?.message || e.message));
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

  const getFullImageUrl = (imagePath) => {
    if (imagePath && !imagePath.startsWith('http')) {
      const baseUrl = window.location.protocol + '//' + window.location.host;
      let fullImageUrl = imagePath.startsWith('/') ? 
        baseUrl + imagePath : 
        baseUrl + '/' + imagePath;
      return fullImageUrl;
    }
    return imagePath;
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'image',
      key: 'image',
      render: (img, record) => {
        console.log('渲染入库图片信息:', record);
        // 从record中获取所有可能的图片相关字段
        const imageUrl = getFullImageUrl(img || record.image_path || record.imagePath || record.image_url || '');
        
        console.log('处理后的图片URL:', imageUrl);
        
        return imageUrl ? (
          <Image
            width={150}
            src={imageUrl}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            preview={{ src: imageUrl, mask: '点击放大' }}
          />
        ) : <div style={{ color: '#aaa', marginTop: 8 }}>无图片</div>
      }
    },
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (text, record) => (
      <Input
        type="number"
        min={1}
        style={{ width: 60 }}
        value={record.quantity}
        onChange={e => {
          // 直接传递输入值给handleQuantityChange，可以包括空字符串
          handleQuantityChange(e.target.value, record.key);
        }}
        onBlur={e => {
          // 失去焦点时，如果为空或非法值，设为1
          const val = e.target.value;
          if (val === '' || isNaN(parseInt(val)) || parseInt(val) < 1) {
            handleQuantityChange(1, record.key);
          }
        }}
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
        </Form>
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" block onClick={() => { console.log('按钮被点击'); handleBatchConfirm(); }}>确认入库</Button>
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

export default Inbound;
