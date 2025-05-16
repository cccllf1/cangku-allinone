import React, { useEffect, useState } from 'react';
import { Button, Input, message, List, Card, Space, Modal, Form, Switch, Select, Upload, Tabs, Badge, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PictureOutlined, SaveOutlined, SearchOutlined, LinkOutlined, ScanOutlined } from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import BarcodeScannerComponent from '../components/BarcodeScannerComponent';
import MobileNavBar from '../components/MobileNavBar';

const { TabPane } = Tabs;
const { Option } = Select;

const MobileProductManage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [hasSKU, setHasSKU] = useState(false);
  const [skus, setSkus] = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [skuDetailVisible, setSkuDetailVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const navigate = useNavigate();

  // 加载所有产品
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products/');
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error('获取产品失败:', error);
      message.error('获取产品失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索产品
  const handleSearch = () => {
    if (!searchValue) {
      setFilteredProducts(products);
      return;
    }
    
    const filtered = products.filter(product => 
      (product.name && product.name.toLowerCase().includes(searchValue.toLowerCase())) || 
      (product.code && product.code.toLowerCase().includes(searchValue.toLowerCase()))
    );
    
    setFilteredProducts(filtered);
    
    if (filtered.length === 0) {
      message.info('没有找到匹配的产品');
    }
  };

  // 显示产品表单
  const showProductForm = (product = null) => {
    setCurrentProduct(product);
    const hasSKUs = product && product.skus && product.skus.length > 0;
    setHasSKU(hasSKUs);
    
    if (product) {
      form.setFieldsValue({
        name: product.name,
        code: product.code,
        unit: product.unit,
        description: product.description,
        has_sku: hasSKUs,
      });
      setImageUrl(product.image_path || product.image || '');
      
      // 转换SKU为按颜色分组的结构
      if (hasSKUs && Array.isArray(product.skus)) {
        // 按颜色分组SKU
        const groupedSkus = [];
        const colorGroups = {};
        
        product.skus.forEach(sku => {
          const color = sku.color || '默认颜色';
          if (!colorGroups[color]) {
            colorGroups[color] = {
              color: color,
              image: sku.image || '',
              sizes: []
            };
            groupedSkus.push(colorGroups[color]);
          }
          
          colorGroups[color].sizes.push({
            size: sku.size || '默认尺码',
            code: sku.code
          });
        });
        
        setSkus(groupedSkus);
      } else {
        setSkus([]);
      }
    } else {
      form.resetFields();
      setImageUrl('');
      setSkus([]);
    }
    
    setFormVisible(true);
  };

  // 处理表单提交
  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      
      // 如果名称为空，则使用编码作为名称
      if (!values.name || values.name.trim() === '') {
        values.name = values.code;
      }
      
      // 准备SKU数据 - 将分组结构转换为平面结构
      let flatSkus = [];
      if (hasSKU) {
        skus.forEach(colorGroup => {
          colorGroup.sizes.forEach(sizeItem => {
            flatSkus.push({
              color: colorGroup.color,
              size: sizeItem.size,
              code: sizeItem.code,
              image: colorGroup.image
            });
          });
        });
      }
      
      const productData = {
        ...values,
        skus: hasSKU ? flatSkus : [],
        image: imageUrl
      };
      
      if (currentProduct) {
        // 更新产品
        await api.put(`/products/${currentProduct._id || currentProduct.id}`, productData);
        message.success('产品已更新');
      } else {
        // 创建产品
        await api.post('/products', productData);
        message.success('产品已创建');
      }
      
      setFormVisible(false);
      fetchProducts();
    } catch (error) {
      console.error('保存产品失败:', error);
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfirmLoading(false);
    }
  };

  // 上传图片
  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.url) {
        setImageUrl(response.data.url);
        message.success('图片上传成功');
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败');
    } finally {
      setLoading(false);
    }
  };

  // 上传颜色图片
  const handleColorImageUpload = async (file, colorIndex) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.url) {
        // 更新特定颜色的图片
        const updatedSkus = [...skus];
        updatedSkus[colorIndex].image = response.data.url;
        setSkus(updatedSkus);
        message.success('颜色图片上传成功');
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error('颜色图片上传失败:', error);
      message.error('颜色图片上传失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除产品
  const handleDelete = async (product) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除产品 "${product.name || product.code}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          await api.delete(`/products/${product._id || product.id}`);
          message.success('产品已删除');
          fetchProducts();
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 添加颜色
  const handleAddColor = () => {
    const newColor = {
      color: '新颜色',
      image: '',
      sizes: [
        {
          size: '默认尺码',
          code: currentProduct ? `${currentProduct.code}-` : 'SKU-'
        }
      ]
    };
    
    setSkus([...skus, newColor]);
  };

  // 添加尺码
  const handleAddSize = (colorIndex) => {
    const updatedSkus = [...skus];
    const colorGroup = updatedSkus[colorIndex];
    
    colorGroup.sizes.push({
      size: `尺码${colorGroup.sizes.length + 1}`,
      code: currentProduct ? `${currentProduct.code}-${colorGroup.color}-` : `SKU-${colorGroup.color}-`
    });
    
    setSkus(updatedSkus);
  };

  // 更新颜色名称
  const handleUpdateColor = (index, value) => {
    const updatedSkus = [...skus];
    updatedSkus[index].color = value;
    setSkus(updatedSkus);
  };

  // 更新尺码信息
  const handleUpdateSize = (colorIndex, sizeIndex, field, value) => {
    const updatedSkus = [...skus];
    updatedSkus[colorIndex].sizes[sizeIndex][field] = value;
    setSkus(updatedSkus);
  };

  // 移除颜色
  const handleRemoveColor = (index) => {
    const updatedSkus = [...skus];
    updatedSkus.splice(index, 1);
    setSkus(updatedSkus);
  };

  // 移除尺码
  const handleRemoveSize = (colorIndex, sizeIndex) => {
    const updatedSkus = [...skus];
    updatedSkus[colorIndex].sizes.splice(sizeIndex, 1);
    setSkus(updatedSkus);
  };

  // 进入外部条码管理
  const goToExternalCodes = (productId) => {
    navigate(`/external-codes?product_id=${productId}`);
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

  // 新增：按照新结构展示产品SKU详情
  const showSkuDetail = (product, e) => {
    // 阻止事件冒泡，避免点击事件触发按钮的点击事件
    if (e) {
      e.stopPropagation();
    }
    
    if (product.has_sku && product.skus && product.skus.length > 0) {
      setSelectedProduct(product);
      
      // 按颜色分组SKU用于展示
      const groupedSkus = [];
      const colorGroups = {};
      
      product.skus.forEach(sku => {
        const color = sku.color || '默认颜色';
        if (!colorGroups[color]) {
          colorGroups[color] = {
            color: color,
            image: sku.image || '',
            sizes: []
          };
          groupedSkus.push(colorGroups[color]);
        }
        
        colorGroups[color].sizes.push({
          size: sku.size || '默认尺码',
          code: sku.code
        });
      });
      
      setSkuDetailVisible(true);
    } else {
      message.info('此产品没有SKU款式');
    }
  };

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="products" />

      {/* 操作区 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showProductForm()}
          style={{ marginBottom: 8 }}
        >
          新增产品
        </Button>
        <Button
          icon={<LinkOutlined />}
          onClick={() => navigate('/external-codes')}
          style={{ marginBottom: 8 }}
        >
          外部条码管理
        </Button>
      </div>

      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索产品编码或名称"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          suffix={
            <Space>
              <Button 
                type="primary" 
                icon={<ScanOutlined />} 
                onClick={openScanner}
              />
              <Button 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
              />
            </Space>
          }
          style={{ width: '100%' }}
        />
      </div>

      {/* 产品列表 */}
      <List
        dataSource={filteredProducts}
        renderItem={product => (
          <Card 
            style={{ marginBottom: 8 }} 
            size="small"
            onClick={(e) => product.has_sku ? showSkuDetail(product, e) : null}
            hoverable={product.has_sku}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {product.image_path ? (
                <img 
                  src={product.image_path} 
                  alt={product.name} 
                  style={{ width: 50, height: 50, marginRight: 12, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: 50, height: 50, backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <PictureOutlined />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{product.name || product.code}</div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>编码: {product.code}</div>
                <div style={{ color: '#888', fontSize: '0.9em' }}>
                  单位: {product.unit || '件'}
                  {product.has_sku && 
                    <Badge
                      count={`${product.skus?.length || 0} SKU`}
                      style={{ backgroundColor: '#2db7f5', marginLeft: 8 }}
                    />
                  }
                </div>
              </div>
              <Space onClick={e => e.stopPropagation()}>
                <Button 
                  type="text" 
                  icon={<LinkOutlined />}
                  onClick={() => goToExternalCodes(product.id || product._id)}
                />
                <Button 
                  type="text" 
                  icon={<EditOutlined />}
                  onClick={() => showProductForm(product)}
                />
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(product)}
                />
              </Space>
            </div>
          </Card>
        )}
      />
      
      {/* 产品表单 */}
      <Modal
        title={currentProduct ? '编辑产品' : '添加产品'}
        open={formVisible}
        onCancel={() => setFormVisible(false)}
        footer={[
          <Button key="back" onClick={() => setFormVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" loading={confirmLoading} onClick={handleFormSubmit}>保存</Button>
        ]}
        width="95%"
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab="基本信息" key="basic">
            <Form
              form={form}
              layout="vertical"
            >
              <Form.Item
                name="code"
                label="产品编码"
                rules={[{ required: true, message: '请输入产品编码' }]}
              >
                <Input placeholder="请输入产品编码（必填）" />
              </Form.Item>
              
              <Form.Item
                name="name"
                label="产品名称"
                extra="选填，如不填写将使用产品编码作为名称"
              >
                <Input placeholder="请输入产品名称（选填）" />
              </Form.Item>
              
              <Form.Item
                name="unit"
                label="单位"
                initialValue="件"
              >
                <Input placeholder="件、个、箱等" />
              </Form.Item>
              
              <Form.Item
                name="description"
                label="描述"
              >
                <Input.TextArea rows={3} placeholder="产品描述（选填）" />
              </Form.Item>
              
              <Form.Item
                label="产品图片"
              >
                {imageUrl ? (
                  <div style={{ marginBottom: 10 }}>
                    <img 
                      src={imageUrl} 
                      alt="产品图片" 
                      style={{ width: '100%', maxWidth: 300, maxHeight: 300, objectFit: 'contain' }} 
                    />
                  </div>
                ) : (
                  <div style={{ width: 102, height: 102, background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                    <PictureOutlined style={{ fontSize: 28, color: '#999' }} />
                  </div>
                )}
                <Upload
                  name="file"
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleImageUpload(file);
                    return false;
                  }}
                >
                  <Button icon={<PictureOutlined />}>
                    {imageUrl ? '更换图片' : '上传图片'}
                  </Button>
                </Upload>
              </Form.Item>
              
              <Form.Item
                name="has_sku"
                valuePropName="checked"
                label="启用多尺码/颜色"
              >
                <Switch 
                  checked={hasSKU} 
                  onChange={(checked) => setHasSKU(checked)} 
                />
              </Form.Item>
            </Form>
          </TabPane>
          
          {hasSKU && (
            <TabPane tab="颜色尺码管理" key="sku">
              {skus.map((colorGroup, colorIndex) => (
                <Card 
                  key={colorIndex} 
                  size="small" 
                  style={{ marginBottom: 16 }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: 8 }}>颜色:</span>
                      <Input
                        placeholder="输入颜色名称"
                        value={colorGroup.color}
                        onChange={(e) => handleUpdateColor(colorIndex, e.target.value)}
                        style={{ width: 160 }}
                      />
                    </div>
                  }
                  extra={
                    <Button 
                      type="link" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveColor(colorIndex)}
                    />
                  }
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 16 }}>
                    {/* 颜色图片 */}
                    <div style={{ flex: '0 0 150px', marginRight: 16, textAlign: 'center' }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>颜色图片</div>
                      {colorGroup.image ? (
                        <img 
                          src={colorGroup.image} 
                          alt={colorGroup.color} 
                          style={{ width: '100%', maxHeight: 120, objectFit: 'contain', marginBottom: 8 }} 
                        />
                      ) : (
                        <div style={{ width: 120, height: 120, backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 8, margin: '0 auto' }}>
                          <PictureOutlined style={{ fontSize: 24, color: '#999' }} />
                        </div>
                      )}
                      <Upload
                        name="file"
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={(file) => {
                          handleColorImageUpload(file, colorIndex);
                          return false;
                        }}
                      >
                        <Button icon={<PictureOutlined />} size="small">
                          {colorGroup.image ? '更换图片' : '上传图片'}
                        </Button>
                      </Upload>
                    </div>
                    
                    {/* 尺码列表 */}
                    <div style={{ flex: '1 1 auto' }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>尺码列表</div>
                      
                      {colorGroup.sizes.map((sizeItem, sizeIndex) => (
                        <div key={sizeIndex} style={{ display: 'flex', marginBottom: 8, alignItems: 'center' }}>
                          <Input
                            placeholder="输入尺码"
                            value={sizeItem.size}
                            onChange={(e) => handleUpdateSize(colorIndex, sizeIndex, 'size', e.target.value)}
                            style={{ width: 120, marginRight: 8 }}
                          />
                          <Input
                            placeholder="SKU编码 (如：BASE-RED-XL)"
                            value={sizeItem.code}
                            onChange={(e) => handleUpdateSize(colorIndex, sizeIndex, 'code', e.target.value)}
                            style={{ flex: 1, marginRight: 8 }}
                          />
                          <Button 
                            type="link" 
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveSize(colorIndex, sizeIndex)}
                            disabled={colorGroup.sizes.length <= 1}
                          />
                        </div>
                      ))}
                      
                      <Button 
                        type="dashed" 
                        onClick={() => handleAddSize(colorIndex)} 
                        icon={<PlusOutlined />}
                        style={{ marginTop: 8 }}
                      >
                        添加尺码
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              
              <Button 
                type="dashed" 
                onClick={handleAddColor} 
                style={{ width: '100%', marginTop: 8 }}
                icon={<PlusOutlined />}
              >
                添加颜色
              </Button>
            </TabPane>
          )}
        </Tabs>
      </Modal>

      {/* SKU详情弹窗 */}
      <Modal
        title={selectedProduct ? `${selectedProduct.name || selectedProduct.code} 的SKU款式` : 'SKU详情'}
        open={skuDetailVisible}
        onCancel={() => setSkuDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSkuDetailVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary"
            onClick={() => {
              setSkuDetailVisible(false);
              showProductForm(selectedProduct);
            }}
          >
            编辑产品
          </Button>
        ]}
        width="100%"
        style={{ top: 0 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        {selectedProduct && selectedProduct.skus && (
          <>
            {/* 按颜色分组显示SKU */}
            {(() => {
              // 按颜色分组SKU
              const colorGroups = {};
              
              selectedProduct.skus.forEach(sku => {
                const color = sku.color || '默认颜色';
                if (!colorGroups[color]) {
                  colorGroups[color] = {
                    color,
                    image: sku.image || '',
                    sizes: []
                  };
                }
                colorGroups[color].sizes.push({
                  size: sku.size || '默认尺码',
                  code: sku.code
                });
              });
              
              return Object.values(colorGroups).map((group, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  title={<span style={{ fontWeight: 'bold' }}>{group.color}</span>}
                  style={{ marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {/* 颜色图片 */}
                    <div style={{ flex: '0 0 100px', marginRight: 16 }}>
                      {group.image ? (
                        <img 
                          src={group.image} 
                          alt={group.color} 
                          style={{ width: '100%', objectFit: 'contain' }} 
                        />
                      ) : (
                        <div style={{ width: 100, height: 100, backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <PictureOutlined style={{ fontSize: 24 }} />
                        </div>
                      )}
                    </div>
                    
                    {/* 尺码列表 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>尺码列表:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {group.sizes.map((size, idx) => (
                          <Tag key={idx} color="blue">
                            {size.size} ({size.code})
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ));
            })()}
          </>
        )}
      </Modal>

      {/* 扫码器Modal */}
      <Modal
        title="扫描条码"
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

export default MobileProductManage; 