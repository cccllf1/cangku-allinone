import React, { useState, useEffect } from 'react';
import { 
  Input, Button, List, Card, Select, Badge, Tag, Space, 
  Modal, InputNumber, message, Empty, Spin 
} from 'antd';
import { 
  SearchOutlined, EditOutlined, SwapOutlined, 
  SaveOutlined, WarningOutlined, CheckCircleOutlined 
} from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';

const { Option } = Select;

const MobileLocationInventory = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetail, setLocationDetail] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState(0);
  const [transferVisible, setTransferVisible] = useState(false);
  const [targetLocation, setTargetLocation] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [locationOptions, setLocationOptions] = useState([]);
  const navigate = useNavigate();

  // 页面加载时获取所有库位
  useEffect(() => {
    fetchLocations();
  }, []);

  // 获取所有库位信息
  const fetchLocations = async () => {
    try {
      setLoading(true);
      
      // 获取所有库位
      const res = await api.get('/locations/');
      const locationsList = res.data;
      
      // 获取库存信息，用于计算每个库位的商品数量
      const inventoryRes = await api.get('/inventory/');
      const inventory = inventoryRes.data;
      
      // 计算每个库位的商品款数
      const locationProductCounts = {};
      inventory.forEach(item => {
        if (item.locations && Array.isArray(item.locations)) {
          item.locations.forEach(loc => {
            if (loc.quantity > 0) {
              const locCode = loc.locationCode;
              if (!locationProductCounts[locCode]) {
                locationProductCounts[locCode] = 0;
              }
              locationProductCounts[locCode]++;
            }
          });
        }
      });
      
      // 将商品数量添加到库位信息中
      const locationsWithCounts = locationsList.map(loc => ({
        ...loc,
        productCount: locationProductCounts[loc.code] || 0
      }));
      
      setLocations(locationsWithCounts);
      setFilteredLocations(locationsWithCounts);
      
      // 生成库位选项
      setLocationOptions(
        locationsWithCounts.map(loc => ({
          value: loc.code,
          label: `${loc.code} (${loc.name || '未命名库位'})`
        }))
      );
    } catch (error) {
      console.error('获取库位失败:', error);
      message.error('获取库位失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取库位库存详情
  const fetchLocationDetail = async (locationCode) => {
    try {
      setLoading(true);
      const res = await api.get(`/inventory/location/${locationCode}`);
      setLocationDetail(res.data);
      return res.data;
    } catch (error) {
      console.error('获取库位详情失败:', error);
      message.error('获取库位详情失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 搜索库位
  const handleSearch = () => {
    if (!searchValue.trim()) {
      setFilteredLocations(locations);
      return;
    }

    const filtered = locations.filter(
      loc => loc.code.toLowerCase().includes(searchValue.toLowerCase()) || 
             (loc.name && loc.name.toLowerCase().includes(searchValue.toLowerCase()))
    );

    setFilteredLocations(filtered);
    
    if (filtered.length === 0) {
      message.info('未找到匹配的库位');
    }
  };

  // 显示库位详情
  const showLocationDetail = async (location) => {
    setSelectedLocation(location);
    const detail = await fetchLocationDetail(location.code);
    if (detail) {
      setDetailVisible(true);
    }
  };

  // 开始编辑商品数量
  const startEdit = (item) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
    setEditMode(true);
  };

  // 保存编辑的数量
  const saveEditQuantity = async () => {
    if (!editingItem || !selectedLocation) return;

    try {
      setLoading(true);

      // 调用API保存数量修改
      await api.post('/inventory/adjust', {
        productId: editingItem.product_id,
        locationCode: selectedLocation.code,
        quantity: editQuantity
      });

      // 更新本地数据
      const updatedDetail = await fetchLocationDetail(selectedLocation.code);
      setLocationDetail(updatedDetail);
      
      message.success('数量已更新');
      setEditMode(false);
      setEditingItem(null);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败: ' + (error.response?.data?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 显示转移弹窗
  const showTransferModal = (item) => {
    setEditingItem(item);
    setTransferQuantity(Math.min(item.quantity, 1));
    setTargetLocation(null);
    setTransferVisible(true);
  };

  // 执行转移操作
  const handleTransfer = async () => {
    if (!editingItem || !selectedLocation || !targetLocation || transferQuantity <= 0) {
      message.warning('请完善转移信息');
      return;
    }

    if (transferQuantity > editingItem.quantity) {
      message.warning('转移数量不能大于当前数量');
      return;
    }

    try {
      setLoading(true);

      // 先从当前库位出库
      await api.post('/outbound/', {
        product_id: editingItem.product_id,
        location_id: selectedLocation.code,
        quantity: transferQuantity
      });

      // 再入库到目标库位
      await api.post('/inbound/', {
        product_id: editingItem.product_id,
        location_id: targetLocation,
        quantity: transferQuantity,
        // 如果有SKU，也需要传递
        ...(editingItem.sku_code ? {
          sku_code: editingItem.sku_code,
          sku_color: editingItem.sku_color,
          sku_size: editingItem.sku_size
        } : {})
      });

      message.success('转移成功');
      
      // 更新本地数据
      const updatedDetail = await fetchLocationDetail(selectedLocation.code);
      setLocationDetail(updatedDetail);
      
      // 关闭弹窗
      setTransferVisible(false);
    } catch (error) {
      console.error('转移失败:', error);
      message.error('转移失败: ' + (error.response?.data?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 计算每个库位的商品款数
  const getLocationProductCount = (locationCode) => {
    // 在locations数组中查找匹配的库位
    const location = locations.find(loc => loc.code === locationCode);
    // 如果找到库位且有productCount属性则返回，否则返回0
    return location && location.productCount ? location.productCount : 0;
  };

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="locationInventory" />
      
      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>搜索库位:</div>
        <Input
          placeholder="输入库位编号或名称"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          suffix={
            <Button 
              icon={<SearchOutlined />} 
              onClick={handleSearch}
            />
          }
          style={{ width: '100%' }}
        />
      </div>
      
      {/* 库位列表 */}
      <List
        loading={loading}
        dataSource={filteredLocations}
        renderItem={location => (
          <Card 
            size="small" 
            style={{ marginBottom: 8 }}
            onClick={() => showLocationDetail(location)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>库位: {location.code}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {location.name || '未命名库位'}
                </div>
              </div>
              <div>
                <Tag color="blue">
                  {getLocationProductCount(location.code) > 0 
                    ? `${getLocationProductCount(location.code)} 种商品` 
                    : '空库位'}
                </Tag>
              </div>
            </div>
          </Card>
        )}
      />
      
      {/* 库位详情弹窗 */}
      <Modal
        title={selectedLocation ? `库位: ${selectedLocation.code}` : '库位详情'}
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setEditMode(false);
          setEditingItem(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width="100%"
        style={{ top: 0 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin />
          </div>
        ) : locationDetail && locationDetail.items && locationDetail.items.length > 0 ? (
          <List
            dataSource={locationDetail.items}
            renderItem={item => (
              <Card 
                size="small" 
                style={{ marginBottom: 8 }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.productName} 
                      style={{ width: 48, height: 48, marginRight: 8, objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, background: '#eee', marginRight: 8 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>编码: {item.productCode}</div>
                    {item.sku_code && (
                      <div style={{ fontSize: 12, color: '#1890ff' }}>
                        {item.sku_color} {item.sku_size} ({item.sku_code})
                      </div>
                    )}
                  </div>

                  {editMode && editingItem && editingItem.productCode === item.productCode ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <InputNumber
                        min={0}
                        value={editQuantity}
                        onChange={value => setEditQuantity(value)}
                        style={{ width: 70 }}
                      />
                      <div style={{ marginLeft: 8 }}>
                        <Button 
                          type="primary" 
                          size="small" 
                          onClick={saveEditQuantity}
                          icon={<SaveOutlined />}
                          loading={loading}
                        >
                          保存
                        </Button>
                        <Button 
                          size="small" 
                          onClick={() => {
                            setEditMode(false);
                            setEditingItem(null);
                          }}
                          style={{ marginLeft: 4 }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <Badge 
                        count={item.quantity} 
                        overflowCount={9999}
                        style={{ backgroundColor: '#52c41a', marginBottom: 4 }}
                      />
                      <Space>
                        <Button 
                          size="small" 
                          icon={<EditOutlined />}
                          onClick={e => {
                            e.stopPropagation();
                            startEdit(item);
                          }}
                        >
                          修改
                        </Button>
                        <Button 
                          size="small" 
                          type="primary"
                          icon={<SwapOutlined />}
                          onClick={e => {
                            e.stopPropagation();
                            showTransferModal(item);
                          }}
                        >
                          转移
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              </Card>
            )}
          />
        ) : (
          <Empty 
            description={
              <span>此库位没有存放任何商品 <CheckCircleOutlined style={{ color: 'green' }} /></span>
            }
          />
        )}
      </Modal>
      
      {/* 转移商品弹窗 */}
      <Modal
        title="转移商品"
        open={transferVisible}
        onCancel={() => setTransferVisible(false)}
        onOk={handleTransfer}
        confirmLoading={loading}
      >
        {editingItem && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>商品:</div>
              <div>{editingItem.productName}</div>
              <div style={{ fontSize: 12, color: '#888' }}>编码: {editingItem.productCode}</div>
              {editingItem.sku_code && (
                <div style={{ fontSize: 12, color: '#1890ff' }}>
                  {editingItem.sku_color} {editingItem.sku_size} ({editingItem.sku_code})
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>当前库位:</div>
              <div>{selectedLocation?.code} {selectedLocation?.name || ''}</div>
              <div style={{ fontSize: 12, color: '#52c41a' }}>
                当前数量: {editingItem.quantity}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>转移数量:</div>
              <InputNumber
                min={1}
                max={editingItem.quantity}
                value={transferQuantity}
                onChange={value => setTransferQuantity(value)}
                style={{ width: '100%' }}
              />
              {transferQuantity > editingItem.quantity && (
                <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                  <WarningOutlined /> 转移数量不能超过当前数量
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>目标库位:</div>
              <Select
                style={{ width: '100%' }}
                placeholder="选择要转移到的库位"
                options={locationOptions.filter(loc => loc.value !== selectedLocation?.code)}
                value={targetLocation}
                onChange={setTargetLocation}
                showSearch
                filterOption={(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MobileLocationInventory; 