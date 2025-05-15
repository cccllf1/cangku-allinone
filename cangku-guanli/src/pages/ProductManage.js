import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Form, message } from 'antd';
import axios from 'axios';
import Navbar from '../components/Navbar';

const ProductManage = () => {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const fetchProducts = async () => {
    const res = await axios.get('/api/products/');
    setProducts(res.data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/products/${id}/`);
    message.success('删除成功');
    fetchProducts();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await axios.put(`/api/products/${editing.id}/`, values);
        message.success('修改成功');
      } else {
        await axios.post('/api/products/', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchProducts();
    } catch (e) {}
  };

  const filtered = products.filter(p => p.code.includes(search) || p.name.includes(search));

  const columns = [
    { title: '商品编码', dataIndex: 'code', key: 'code' },
    { title: '商品名称', dataIndex: 'name', key: 'name' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '图片', dataIndex: 'image_path', key: 'image_path', render: v => v ? <img src={v} alt="" style={{width:40}} /> : '-' },
    { title: '编辑', key: 'edit', render: (_, record) => <Button size="small" onClick={() => handleEdit(record)}>编辑</Button> },
    { title: '删除', key: 'delete', render: (_, record) => <Button size="small" danger onClick={() => handleDelete(record.id)}>删除</Button> },
  ];

  return (
    <div>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h2>商品管理</h2>
        <div style={{marginBottom:16}}>
          <Input.Search
            placeholder="请输入搜索内容"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:300, marginRight:16}}
          />
          <Button type="primary" onClick={handleAdd}>新增产品</Button>
        </div>
        <Table rowKey="id" columns={columns} dataSource={filtered} />
        <Modal open={modalVisible} onOk={handleOk} onCancel={()=>setModalVisible(false)} title={editing?'编辑商品':'新增产品'}>
          <Form form={form} layout="vertical">
            <Form.Item name="code" label="商品编码" rules={[{required:true}]}> <Input /> </Form.Item>
            <Form.Item name="name" label="商品名称"> <Input /> </Form.Item>
            <Form.Item name="unit" label="单位" rules={[{required:true}]}> <Input /> </Form.Item>
            <Form.Item name="image_path" label="图片URL"> <Input /> </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default ProductManage; 