import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import Navbar from '../components/Navbar';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formVals, setFormVals] = useState({ code: '', name: '', unit: '' });

  // 获取商品列表
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      message.error('获取商品列表失败');
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 处理表单输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormVals(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 打开新增/编辑弹窗
  const handleAdd = () => {
    setEditingProduct(null);
    setFormVals({ code: '', name: '', unit: '' });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingProduct(record);
    setFormVals({
      code: record.code,
      name: record.name,
      unit: record.unit
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleOk = async () => {
    try {
      console.log('Submitting form values:', formVals); // 调试日志
      
      if (editingProduct) {
        await axios.put(`/api/products/${editingProduct._id}`, formVals);
        message.success('商品更新成功');
      } else {
        await axios.post('/api/products', formVals);
        message.success('商品添加成功');
      }
      
      setModalVisible(false);
      fetchProducts();
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 删除商品
  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/products/${id}`);
      message.success('商品删除成功');
      fetchProducts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '商品编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个商品吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="primary" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Navbar />
      <div style={{ marginBottom: '16px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          新增商品
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="_id"
        loading={loading}
      />

      <Modal
        title={editingProduct ? '编辑商品' : '新增商品'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>商品编码</label>
          <Input
            name="code"
            value={formVals.code}
            onChange={e => {
              console.log('onChange触发', e.target.name, e.target.value);
              const { name, value } = e.target;
              setFormVals(prev => ({ ...prev, [name]: value }));
            }}
            placeholder="请输入商品编码"
          />
          <label>商品名称</label>
          <Input
            name="name"
            value={formVals.name}
            onChange={e => {
              console.log('onChange触发', e.target.name, e.target.value);
              const { name, value } = e.target;
              setFormVals(prev => ({ ...prev, [name]: value }));
            }}
            placeholder="请输入商品名称"
          />
          <label>单位</label>
          <Input
            name="unit"
            value={formVals.unit}
            onChange={e => {
              console.log('onChange触发', e.target.name, e.target.value);
              const { name, value } = e.target;
              setFormVals(prev => ({ ...prev, [name]: value }));
            }}
            placeholder="请输入单位"
          />
        </div>
      </Modal>
    </div>
  );
};

export default Products; 