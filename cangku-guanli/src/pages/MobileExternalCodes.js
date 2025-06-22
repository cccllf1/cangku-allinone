import React, { useState, useEffect } from 'react';
import { Button, message, Input, Modal } from 'antd';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';

const MobileExternalCodes = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [expandedColor, setExpandedColor] = useState(null);
  const [selectedSku, setSelectedSku] = useState(null);
  const [externalCodes, setExternalCodes] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      console.log('开始加载产品数据...');
      const response = await api.get('/products');
      console.log('API响应:', response.data);
      
      const data = response.data?.data || response.data || {};
      const productList = data.products || [];
      console.log('解析到的产品:', productList);
      
      setProducts(productList);
      message.success(`加载了 ${productList.length} 个产品`);
    } catch (error) {
      console.error('加载产品失败:', error);
      message.error('加载产品失败');
    }
    setLoading(false);
  };

  // 获取外部条码
  const loadExternalCodes = async (skuCode) => {
    try {
      console.log('获取外部条码:', skuCode);
      const response = await api.get(`/sku/${skuCode}/external-codes`);
      console.log('外部条码响应:', response.data);
      const raw = response.data?.data ?? response.data ?? [];
      setExternalCodes(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error('获取外部条码失败:', error);
      setExternalCodes([]);
    }
  };

  // 点击SKU
  const handleSkuClick = (sku, product, colorObj) => {
    console.log('点击SKU:', sku, product);
    
    const skuData = {
      sku_code: sku.sku_code,
      sku_color: colorObj?.color || sku.sku_color || '',
      sku_size: sku.sku_size || '',
      product_name: product.product_name || '',
      product_code: product.product_code || '',
    };
    
    setSelectedSku(skuData);
    setShowModal(true);
    loadExternalCodes(sku.sku_code);
    message.success(`选中SKU: ${sku.sku_code}`);
  };

  // 关闭外部条码管理
  const closeBarcodeManager = () => {
    setShowModal(false);
    setSelectedSku(null);
    setExternalCodes([]);
    setInputCode('');
  };

  // 添加外部条码
  const addExternalCode = async () => {
    if (!inputCode.trim() || !selectedSku) return;

    const operator_id = localStorage.getItem('user_id');
    if (!operator_id) {
      message.error('无法获取用户信息，请重新登录后再试');
      return;
    }
    
    try {
      await api.post(`/sku/${selectedSku.sku_code}/external-codes`, {
        external_code: inputCode.trim(),
        operator_id
      });
      message.success('添加成功');
      setInputCode('');
      loadExternalCodes(selectedSku.sku_code);
    } catch (error) {
      console.error('添加失败:', error);
      const errorMessage = error.response?.data?.error_message || '添加失败，条码可能已存在或网络错误';
      message.error(errorMessage);
    }
  };

  // 删除外部条码
  const deleteExternalCode = async (code) => {
    const operator_id = localStorage.getItem('user_id');
    if (!operator_id) {
      message.error('无法获取用户信息，请重新登录后再试');
      return;
    }

    try {
      await api.delete(`/sku/${selectedSku.sku_code}/external-codes/${code}`, {
        data: { operator_id }
      });
      message.success('删除成功');
      loadExternalCodes(selectedSku.sku_code);
    } catch (error) {
      console.error('删除失败:', error);
      const errorMessage = error.response?.data?.error_message || '删除失败';
      message.error(errorMessage);
    }
  };

  // 切换商品展开/收起
  const toggleProduct = (code) => {
    const newExpandedProduct = expandedProduct === code ? null : code;
    setExpandedProduct(newExpandedProduct);
    // 切换商品时，总是收起颜色列表
    setExpandedColor(null);
  };

  // 切换颜色展开/收起
  const toggleColor = (key) => {
    setExpandedColor(prev => (prev === key ? null : key));
  };

  const handleSearch = async (value) => {
    const query = value.trim();
    if (!query) return;

    // 前端快速搜索SKU
    for (const product of products) {
      for (const color of toArray(product.colors)) {
        for (const sku of toArray(color.sizes)) {
          if (sku.sku_code === query) {
            message.success(`在前端找到 SKU: ${query}`);
            setExpandedProduct(product.product_code);
            setExpandedColor(`${product.product_code}-${color.color}`);
            handleSkuClick(sku, product, color);
            return;
          }
        }
      }
    }
    
    // API 搜索
    try {
      setLoading(true);
      const response = await api.get(`/products/sku-lookup/${query}`);
      const data = response.data.data;

      if (data && data.type === 'sku') {
        const skuInfo = data.result;
        message.success(`通过API找到 SKU: ${skuInfo.sku_code}`);
        await loadProducts();
        setTimeout(() => {
          setExpandedProduct(skuInfo.product_code);
          setExpandedColor(`${skuInfo.product_code}-${skuInfo.color}`);
          const product = skuInfo.product;
          const colorObj = product.colors.find(c => c.color === skuInfo.color);
          handleSkuClick(skuInfo, product, colorObj);
        }, 100);
      } else if (data && data.type === 'product') {
        const productInfo = data.result;
        message.success(`通过API找到商品: ${productInfo.product_code}`);
        await loadProducts();
        setTimeout(() => {
          setExpandedProduct(productInfo.product_code);
          setExpandedColor(null);
        }, 100);
      } else {
        message.error('未找到匹配的商品、SKU或外部条码');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error_message || '搜索失败，请检查条码是否正确';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    loadProducts();
  }, [navigate]);

  return (
    <div style={{ padding: 16 }}>
      <MobileNavBar currentPage="externalCodes" />
      
      {/* 搜索栏 */}
      <Input.Search
        placeholder="搜索商品/SKU/颜色/尺码"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        onSearch={handleSearch}
        allowClear
        style={{ marginBottom: 12 }}
      />
      
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={loadProducts} loading={loading}>
          刷新数据
        </Button>
        <span style={{ marginLeft: 16, color: '#666' }}>
          共 {products.length} 个产品
        </span>
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>加载中...</div>
      ) : (
        <div>
          {products.length > 0 ? (
            products.filter(p=>{
              const v = searchValue.trim().toLowerCase();
              if(!v) return true;
              // quick text match on product
              return (
                (p.product_name||'').toLowerCase().includes(v) ||
                (p.product_code||'').toLowerCase().includes(v)
              );
            }).map(product => (
              <div key={product.product_id || product.product_code} style={{ 
                border: '1px solid #ddd', 
                padding: 16, 
                marginBottom: 16,
                borderRadius: 8 
              }}>
                <h3 style={{cursor:'pointer'}} onClick={()=>toggleProduct(product.product_code)}>
                  {expandedProduct === product.product_code ? '▼' : '▶'} {product.product_name || '未知商品'} ({product.product_code || '无编码'})
                </h3>

                {expandedProduct === product.product_code && (
                  toArray(product.colors).length > 0 ? (
                    toArray(product.colors).map(color => (
                      <div key={color.color || Math.random()} style={{ 
                        border: '1px solid #eee', 
                        padding: 8, 
                        marginBottom: 8,
                        borderRadius: 4
                      }}>
                        <div style={{ marginBottom: 8, fontWeight: 'bold', color: 'blue', cursor:'pointer' }}
                          onClick={()=>toggleColor(`${product.product_code}-${color.color}`)}>
                          {expandedColor === `${product.product_code}-${color.color}` ? '▼' : '▶'} {color.color || '未知颜色'} ({toArray(color.sizes).length} 个SKU)
                        </div>
                        
                        { expandedColor === `${product.product_code}-${color.color}` && toArray(color.sizes).length > 0 && (
                          <div>
                            {toArray(color.sizes).map(size => (
                              <div
                                key={size.sku_code || Math.random()}
                                style={{
                                  padding: 8,
                                  border: '1px solid #ccc',
                                  borderRadius: 4,
                                  marginBottom: 4,
                                  cursor: 'pointer',
                                  backgroundColor: '#f9f9f9'
                                }}
                                onClick={() => handleSkuClick(size, product, color)}
                              >
                                <span style={{ color: 'green', fontWeight: 'bold' }}>
                                  {size.sku_size || '未知尺码'}
                                </span>
                                <span style={{ marginLeft: 8 }}>{size.sku_code || '无SKU码'}</span>
                                <span style={{ float: 'right', color: '#666' }}>
                                  库存: {size.sku_total_quantity || 0}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#999', padding: 8 }}>该产品暂无SKU数据</div>
                  )
                )}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
              暂无产品数据
            </div>
          )}
        </div>
      )}

      {/* 外部条码管理弹窗 */}
      <Modal
        title={`外部条码管理: ${selectedSku?.sku_code || ''}`}
        open={showModal}
        onCancel={closeBarcodeManager}
        footer={null}
        width="90%"
      >
        {selectedSku && (
        <div>
          {/* SKU信息 */}
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            backgroundColor: 'white', 
            borderRadius: 4,
            border: '1px solid #e8e8e8'
          }}>
            <p style={{ margin: '4px 0' }}><strong>商品:</strong> {selectedSku.product_name}</p>
            <p style={{ margin: '4px 0' }}><strong>颜色:</strong> {selectedSku.sku_color}</p>
            <p style={{ margin: '4px 0' }}><strong>尺码:</strong> {selectedSku.sku_size}</p>
          </div>

          {/* 添加条码区域 */}
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            backgroundColor: 'white', 
            borderRadius: 4,
            border: '1px solid #e8e8e8'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>添加外部条码</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder="输入外部条码"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onPressEnter={addExternalCode}
                style={{ flex: 1 }}
              />
              <Button type="primary" onClick={addExternalCode}>
                添加
              </Button>
            </div>
          </div>

          {/* 已绑定条码列表 */}
          <div style={{ 
            padding: 12, 
            backgroundColor: 'white', 
            borderRadius: 4,
            border: '1px solid #e8e8e8'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>
              已绑定条码 ({externalCodes.length})
            </h4>
            
            {externalCodes.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: 16 }}>
                暂无外部条码
              </p>
            ) : (
              <div>
                {externalCodes.map((code, index) => {
                  const codeValue = code.external_code || code;
                  return (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: 8,
                      border: '1px solid #d9d9d9',
                      borderRadius: 4,
                      marginBottom: 4,
                      backgroundColor: '#fafafa'
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                        {codeValue}
                      </span>
                      <Button 
                        size="small" 
                        danger 
                        onClick={() => deleteExternalCode(codeValue)}
                      >
                        删除
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
};

export default MobileExternalCodes; 