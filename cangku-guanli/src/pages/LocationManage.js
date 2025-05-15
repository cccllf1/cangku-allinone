import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Form, Switch, InputNumber, message } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const LocationManage = () => {
  const [locations, setLocations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchLocations = async () => {
    const res = await axios.get('/api/locations/');
    setLocations(res.data);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ code: '', name: '', description: '', priority: 0, defective: false });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/locations/${id}/`);
    message.success('删除成功');
    fetchLocations();
  };

  const handleOk = async () => {
    try {
      let values = form.getFieldsValue();
      if (values.code) values.code = values.code.trim();
      form.setFieldsValue({ code: values.code });
      console.log('表单所有字段:', values);
      values = await form.validateFields();
      console.log('validateFields 返回:', values);
      if (!values.name) values.name = values.code;
      if (editing) {
        await axios.put(`/api/locations/${editing.id}/`, values);
        message.success('修改成功');
      } else {
        await axios.post('/api/locations/', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchLocations();
    } catch (e) {}
  };

  const columns = [
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    { title: '是否次品', dataIndex: 'defective', key: 'defective', render: v => v ? '是' : '否' },
    { title: '操作', key: 'action', render: (_, record) => (
      <>
        <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
        <Button size="small" danger style={{marginLeft:8}} onClick={() => handleDelete(record.id)}>删除</Button>
      </>
    ) },
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <h2>库位管理</h2>
        <Button type="primary" onClick={handleAdd} style={{marginBottom:16}}>添加库位</Button>
        <Table rowKey="id" columns={columns} dataSource={locations} />
        <Modal open={modalVisible} onOk={handleOk} onCancel={()=>setModalVisible(false)} title={editing?'编辑库位':'添加库位'} destroyOnClose={true}>
          <Form form={form} layout="vertical">
            <Form.Item name="code" label="货位编码" rules={[{required:true, whitespace:true, message:'请输入货位编码'}]}> <Input placeholder="货位编码" /> </Form.Item>
            <Form.Item name="name" label="货位名称"> <Input /> </Form.Item>
            <Form.Item name="description" label="描述"> <Input /> </Form.Item>
            <Form.Item name="priority" label="优先级"> <InputNumber min={0} /> </Form.Item>
            <Form.Item name="defective" label="是否次品" valuePropName="checked"> <Switch /> </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default LocationManage; 