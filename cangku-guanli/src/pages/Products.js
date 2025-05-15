import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message } from 'antd';
import axios from 'axios';

const Products = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    axios.get('/api/products/')
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/products/${id}/`);
    message.success('删除成功');
    fetchData();
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('提交到后端的数据:', values);
      if (editing) {
        await axios.put(`/api/products/${editing.id}/`, values);
        message.success('修改成功');
      } else {
        await axios.post('/api/products/', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    }
  };

  const columns = [
    { title: '产品编码', dataIndex: 'code', key: 'code' },
    { title: '产品名称', dataIndex: 'name', key: 'name' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <>
          <Button size="small" onClick={() => handleEdit(record)} style={{ marginRight: 8 }}>编辑</Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </>
      )
    }
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 24 }}>
      <h1>产品管理</h1>
      <Button type="primary" style={{ marginBottom: 16 }} onClick={handleAdd}>新增产品</Button>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
      <Modal
        open={modalVisible}
        title={editing ? '编辑产品' : '新增产品'}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ code: '', name: '', unit: '' }}>
          <Form.Item name="code" label="产品编码"> <Input /> </Form.Item>
          <Form.Item name="name" label="产品名称"> <Input /> </Form.Item>
          <Form.Item name="unit" label="单位"> <Input /> </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;