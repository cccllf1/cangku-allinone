import React, { useEffect, useState } from 'react';
import { Table, Button, Image, Modal, Select, Input, Space, message, Descriptions, Card, InputNumber, Popconfirm } from 'antd';
import axios from 'axios';
import api from '../api/auth'; // 导入认证API实例
import Navbar from '../components/Navbar';

const Inventory = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [searchType, setSearchType] = useState('code');
  const [searchValue, setSearchValue] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // 加载库存数据的函数
  const loadInventoryData = async () => {
    try {
      setLoading(true);
      
      // 先获取所有商品信息
      const productsRes = await api.get('/products/');
      const productsList = productsRes.data;
      console.log('获取商品列表成功:', productsList.length, '条记录');
      
      // 创建商品映射表，便于查找
      const productsMap = {};
      productsList.forEach(product => {
        productsMap[product.code] = product;
      });
      
      // 获取库存信息
      const response = await api.get('/inventory/');
      console.log('获取库存数据成功:', response.data.length, '条记录');
      
      // 处理库存数据，添加图片信息
      const processedData = response.data.map(item => {
        // 从商品列表中获取对应的商品信息
        const productInfo = productsMap[item.productCode];
        
        // 如果找到对应商品，添加图片信息
        if (productInfo) {
          item.image = productInfo.image_path || productInfo.image || '';
          if (item.image) {
            console.log(`成功找到商品${item.productCode}的图片:`, item.image);
          }
        }
        
        return item;
      });
      
      console.log('处理后的库存数据:', processedData);
      setData(processedData);
    } catch (error) {
      console.error('获取库存数据失败:', error);
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        // 不立即跳转，给用户查看错误信息的时间
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }
      message.error('获取库存数据失败: ' + (error.response?.data?.message || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, []);

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

  const handleSearch = () => {
    // 如果没有搜索内容，重新加载所有数据
    if (!searchValue) {
      loadInventoryData();
      return;
    }
    
    // 前端筛选
    try {
      const filtered = data.filter(item => {
        if (searchType === 'code') {
          return item.productCode && item.productCode.includes(searchValue);
        } else if (searchType === 'name') {
          return item.productName && item.productName.includes(searchValue);
        }
        return true;
      });
      setData(filtered);
      
      if (filtered.length === 0) {
        message.info('没有找到匹配的商品');
      }
    } catch (error) {
      console.error('搜索出错:', error);
      message.error('搜索出错，请重试');
    }
  };

  const showProductDetail = (record) => {
    setCurrentProduct(record);
    setDetailVisible(true);
  };

  // 开始编辑库位数量
  const startEdit = (locationCode) => {
    setEditingLocation(locationCode);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingLocation(null);
  };

  // 保存盘点结果
  const saveLocationQuantity = async (locationCode, newQuantity) => {
    if (!currentProduct || !currentProduct._id) {
      message.error('商品信息不完整，无法保存');
      return;
    }

    try {
      setSavingLocation(true);
      
      // 调用API保存新数量
      await api.post('/inventory/adjust', {
        productId: currentProduct._id,
        locationCode: locationCode,
        quantity: newQuantity
      });
      
      // 更新本地状态
      const updatedProduct = {...currentProduct};
      const locationIndex = updatedProduct.locations.findIndex(loc => loc.locationCode === locationCode);
      
      if (locationIndex >= 0) {
        updatedProduct.locations[locationIndex].quantity = newQuantity;
        // 重新计算总数量
        updatedProduct.quantity = updatedProduct.locations.reduce((sum, loc) => sum + loc.quantity, 0);
      }
      
      // 更新当前显示的产品和数据列表
      setCurrentProduct(updatedProduct);
      
      // 更新主数据列表中的数据
      const updatedData = [...data];
      const productIndex = updatedData.findIndex(p => p._id === currentProduct._id);
      if (productIndex >= 0) {
        updatedData[productIndex] = updatedProduct;
        setData(updatedData);
      }
      
      message.success('盘点数据已保存');
      setEditingLocation(null);
    } catch (error) {
      console.error('盘点数据保存失败:', error);
      message.error('盘点数据保存失败: ' + (error.response?.data?.message || error.message || '未知错误'));
    } finally {
      setSavingLocation(false);
    }
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'image',
      key: 'image',
      render: (img, record) => {
        console.log('渲染库存图片信息:', record);
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
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode', sorter: (a, b) => (a.productCode || '').localeCompare(b.productCode || '') },
    { title: '商品名称', dataIndex: 'productName', key: 'productName', sorter: (a, b) => (a.productName || '').localeCompare(b.productName || '') },
    { title: '单位', dataIndex: 'unit', key: 'unit', sorter: (a, b) => (a.unit || '').localeCompare(b.unit || '') },
    { title: '总库存', dataIndex: 'quantity', key: 'quantity', sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0) },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => <Button size="small" onClick={() => showProductDetail(record)}>详情</Button>
    }
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h1>库存管理</h1>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Select
            value={searchType}
            onChange={v => setSearchType(v)}
            style={{ width: 140 }}
            options={[
              { value: 'code', label: '按商品编码' },
              { value: 'name', label: '按商品名称' },
            ]}
          />
          <Input
            placeholder="请输入搜索内容"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            style={{ width: 300 }}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="productCode"
          pagination={{ pageSize: 10 }}
        />
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

        <Modal
          title="商品详情"
          open={detailVisible}
          onCancel={() => setDetailVisible(false)}
          footer={[
            <Button key="close" onClick={() => setDetailVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
        >
          {currentProduct && (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <Descriptions title="商品基本信息" bordered>
                  <Descriptions.Item label="商品编码" span={3}>{currentProduct.productCode}</Descriptions.Item>
                  <Descriptions.Item label="商品名称" span={3}>{currentProduct.productName}</Descriptions.Item>
                  <Descriptions.Item label="单位">{currentProduct.unit}</Descriptions.Item>
                  <Descriptions.Item label="总库存数量">{currentProduct.quantity}</Descriptions.Item>
                  {currentProduct.image && (
                    <Descriptions.Item label="商品图片" span={3}>
                      <Image 
                        src={(() => {
                          const imageUrl = currentProduct.image || currentProduct.image_path || '';
                          if (!imageUrl) return '';
                          if (imageUrl.startsWith('http')) return imageUrl;
                          const baseUrl = window.location.protocol + '//' + window.location.host;
                          return imageUrl.startsWith('/') ? baseUrl + imageUrl : baseUrl + '/' + imageUrl;
                        })()}
                        width={120} 
                        preview={true}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
                      />
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
              
              <Card title="库位库存明细" bordered>
                {currentProduct.locations && currentProduct.locations.length > 0 ? (
                  <Table
                    columns={[
                      { title: '库位编码', dataIndex: 'locationCode', key: 'locationCode' },
                      { title: '库位名称', dataIndex: 'locationName', key: 'locationName' },
                      { 
                        title: '数量', 
                        dataIndex: 'quantity', 
                        key: 'quantity',
                        render: (quantity, record) => (
                          editingLocation === record.locationCode ? (
                            <InputNumber
                              min={0}
                              defaultValue={quantity}
                              style={{ width: '100%' }}
                              autoFocus
                              id={`quantity-input-${record.locationCode}`}
                              controls={true}
                              precision={0}
                              onPressEnter={(e) => {
                                const value = document.getElementById(`quantity-input-${record.locationCode}`).value;
                                saveLocationQuantity(record.locationCode, parseInt(value) || 0);
                              }}
                              onBlur={(e) => {
                                // 失焦时不自动保存，让用户点击保存按钮确认
                              }}
                            />
                          ) : (
                            <span>{quantity}</span>
                          )
                        )
                      },
                      {
                        title: '操作',
                        key: 'operation',
                        render: (_, record) => {
                          const isEditing = editingLocation === record.locationCode;
                          return isEditing ? (
                            <Space size="small">
                              <Popconfirm
                                title="确定要保存盘点结果吗?"
                                onConfirm={() => {
                                  const value = document.getElementById(`quantity-input-${record.locationCode}`).value;
                                  saveLocationQuantity(record.locationCode, parseInt(value));
                                }}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button type="primary" size="small" loading={savingLocation}>
                                  保存
                                </Button>
                              </Popconfirm>
                              <Button onClick={cancelEdit} size="small">取消</Button>
                            </Space>
                          ) : (
                            <Button onClick={() => startEdit(record.locationCode)} size="small">
                              盘点
                            </Button>
                          );
                        },
                      }
                    ]}
                    dataSource={currentProduct.locations}
                    pagination={false}
                    rowKey={(row) => row.locationCode}
                    size="small"
                  />
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa' }}>无分库位库存明细</div>
                )}
              </Card>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default Inventory;
