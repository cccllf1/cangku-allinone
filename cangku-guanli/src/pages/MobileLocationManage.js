import React, { useEffect, useState } from 'react';
import { List, Button, Modal, Input, Space, message, Popconfirm, Form, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api/auth';
import MobileNavBar from '../components/MobileNavBar';

const MobileLocationManage = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [form] = Form.useForm();
  const [searchValue, setSearchValue] = useState('');

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/locations');
      if (response.data && response.data.success) {
        const data = (response.data.data || []).map(loc => ({
          ...loc,
          location_id: loc.location_id
        }));
        setLocations(data);
      } else {
        throw new Error(response.data.error_message || '获取货位失败');
      }
    } catch (error) {
      console.error('获取货位失败:', error);
      message.error('获取货位失败: ' + (error.response?.data?.error_message || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setAddModalVisible(true);
  };

  const handleEdit = (location) => {
    if (!location.location_id) {
      message.error('该货位缺少 location_id，无法编辑');
      return;
    }
    setCurrentLocation(location);
    form.setFieldsValue({ location_code: location.location_code, location_name: location.location_name, description: location.description });
    setEditModalVisible(true);
  };

  const handleDelete = async (location) => {
    if (!location.location_id) {
      message.error('该货位缺少 location_id，无法删除');
      return;
    }
    try {
      const response = await api.delete(`/locations/${location.location_id}`);
      if (response.data && response.data.success) {
        message.success('删除成功');
        fetchLocations();
      } else {
        throw new Error(response.data.error_message || '删除失败');
      }
    } catch (error) {
      console.error('删除货位失败:', error);
      message.error('删除失败: ' + (error.response?.data?.error_message || error.message));
    }
  };

  const handleAddOk = async () => {
    try {
      const values = await form.validateFields();
      const response = await api.post('/locations', {
        location_code: values.location_code,
        location_name: values.location_name,
        description: values.description
      });
      if (response.data && response.data.success) {
        message.success('添加成功');
        setAddModalVisible(false);
        fetchLocations();
      } else {
        throw new Error(response.data.error_message || '添加失败');
      }
    } catch (error) {
      console.error('添加货位失败:', error);
      message.error('添加失败: ' + (error.response?.data?.error_message || error.message));
    }
  };

  const handleEditOk = async () => {
    if (!currentLocation || !currentLocation.location_id) {
      message.error('该货位缺少 location_id，无法保存修改');
      return;
    }
    try {
      const values = await form.validateFields();
      await api.put(`/locations/${currentLocation.location_id}`, {
        location_code: values.location_code,
        location_name: values.location_name,
        description: values.description,
        category1Label: values.category1Label,
        category1: values.category1,
        category2Label: values.category2Label,
        category2: values.category2
      });
      message.success('修改成功');
      setEditModalVisible(false);
      fetchLocations();
    } catch (e) {
      message.error('修改失败');
    }
  };

  const handleSearch = () => {
    setSearchValue(searchValue.trim());
    // 过滤逻辑已自动响应 searchValue 变化
  };

  const filteredLocations = locations.filter(
    loc =>
      (loc.location_code && loc.location_code.toLowerCase().includes(searchValue.toLowerCase())) ||
      (loc.location_name && loc.location_name.toLowerCase().includes(searchValue.toLowerCase())) ||
      (loc.description && loc.description.toLowerCase().includes(searchValue.toLowerCase()))
  );

  return (
    <div className="page-container" style={{ padding: 16 }}>
      <MobileNavBar currentPage="locationManagement" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input
          placeholder="搜索货位编码、名称或备注"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
        />
        <Button type="primary" onClick={handleSearch}>搜索</Button>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ fontWeight: 'bold', fontSize: 16, borderRadius: 6, marginBottom: 12 }}>
        新增货位
      </Button>
      <List
        loading={loading}
        dataSource={filteredLocations}
        renderItem={item => (
          <Card size="small" style={{ marginBottom: 8, boxShadow: '0 1px 4px #f0f1f2', borderRadius: 8, border: 'none' }}>
            <List.Item
              key={item.location_id}
              actions={[
                <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(item)} key="edit" style={{ fontWeight: 'bold', fontSize: 14 }}>编辑</Button>,
                <Popconfirm title="确定删除该货位吗？" onConfirm={() => handleDelete(item)} okText="删除" cancelText="取消">
                  <Button icon={<DeleteOutlined />} size="small" danger key="delete" style={{ fontWeight: 'bold', fontSize: 14 }}>删除</Button>
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={<span>{item.location_name || item.location_code} <span style={{color:'#888',fontSize:12}}>{item.category1Label||'一级'}:{item.category1||'-'} / {item.category2Label||'二级'}:{item.category2||'-'}</span></span>}
                description={<span>编码: {item.location_code} {item.description ? `｜备注: ${item.description}` : ''}</span>}
              />
            </List.Item>
          </Card>
        )}
        locale={{ emptyText: '暂无货位' }}
      />
      <Modal
        title="新增货位"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddOk}
        okText="添加"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="location_code" label="货位编码" rules={[{ required: true, message: '请输入货位编码' }]}>
            <Input placeholder="请输入货位编码" />
          </Form.Item>
          <Form.Item name="location_name" label="货位名称">
            <Input placeholder="请输入货位名称（可选）" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="备注（可选）" />
          </Form.Item>
          <Form.Item name="category1Label" label="一级分类名称" initialValue="仓库">
            <Input placeholder="如：仓库/区域/楼层等" />
          </Form.Item>
          <Form.Item name="category1" label="一级分类">
            <Input placeholder="如：A仓/B区/1楼等" />
          </Form.Item>
          <Form.Item name="category2Label" label="二级分类名称" initialValue="货架">
            <Input placeholder="如：货架/排/区等" />
          </Form.Item>
          <Form.Item name="category2" label="二级分类">
            <Input placeholder="如：1号货架/2排/东区等" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="编辑货位"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditOk}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="location_code" label="货位编码" rules={[{ required: true, message: '请输入货位编码' }]}>
            <Input placeholder="请输入货位编码" />
          </Form.Item>
          <Form.Item name="location_name" label="货位名称">
            <Input placeholder="请输入货位名称（可选）" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input placeholder="备注（可选）" />
          </Form.Item>
          <Form.Item name="category1Label" label="一级分类名称" initialValue="仓库">
            <Input placeholder="如：仓库/区域/楼层等" />
          </Form.Item>
          <Form.Item name="category1" label="一级分类">
            <Input placeholder="如：A仓/B区/1楼等" />
          </Form.Item>
          <Form.Item name="category2Label" label="二级分类名称" initialValue="货架">
            <Input placeholder="如：货架/排/区等" />
          </Form.Item>
          <Form.Item name="category2" label="二级分类">
            <Input placeholder="如：1号货架/2排/东区等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MobileLocationManage; 