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
      const res = await api.get('/locations/');
      setLocations(res.data || []);
    } catch (e) {
      message.error('获取货位失败');
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
    setCurrentLocation(location);
    form.setFieldsValue({ code: location.code, name: location.name, description: location.description });
    setEditModalVisible(true);
  };

  const handleDelete = async (location) => {
    try {
      await api.delete(`/locations/${location.id || location._id}`);
      message.success('删除成功');
      fetchLocations();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleAddOk = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/locations/', values);
      message.success('添加成功');
      setAddModalVisible(false);
      fetchLocations();
    } catch (e) {
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await form.validateFields();
      await api.put(`/locations/${currentLocation.id || currentLocation._id}`, values);
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
      (loc.code && loc.code.toLowerCase().includes(searchValue.toLowerCase())) ||
      (loc.name && loc.name.toLowerCase().includes(searchValue.toLowerCase())) ||
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
              actions={[
                <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(item)} key="edit" style={{ fontWeight: 'bold', fontSize: 14 }}>编辑</Button>,
                <Popconfirm title="确定删除该货位吗？" onConfirm={() => handleDelete(item)} okText="删除" cancelText="取消">
                  <Button icon={<DeleteOutlined />} size="small" danger key="delete" style={{ fontWeight: 'bold', fontSize: 14 }}>删除</Button>
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={<span>{item.name || item.code} <span style={{color:'#888',fontSize:12}}>{item.category1Label||'一级'}:{item.category1||'-'} / {item.category2Label||'二级'}:{item.category2||'-'}</span></span>}
                description={<span>编码: {item.code} {item.description ? `｜备注: ${item.description}` : ''}</span>}
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
          <Form.Item name="code" label="货位编码" rules={[{ required: true, message: '请输入货位编码' }]}>
            <Input placeholder="请输入货位编码" />
          </Form.Item>
          <Form.Item name="name" label="货位名称">
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
          <Form.Item name="code" label="货位编码" rules={[{ required: true, message: '请输入货位编码' }]}>
            <Input placeholder="请输入货位编码" />
          </Form.Item>
          <Form.Item name="name" label="货位名称">
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