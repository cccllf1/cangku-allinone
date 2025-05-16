import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Form, Switch, InputNumber, message } from 'antd';
import api from '../api/auth'; // 导入带认证功能的API实例
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const LocationManage = () => {
  const [locations, setLocations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchLocations = async () => {
    try {
      // 使用api模块发送GET请求
      const res = await api.get('/locations');
      console.log('获取库位成功:', res.data);
      setLocations(res.data);
    } catch (error) {
      console.error('获取库位失败:', error);
      message.error('获取库位失败, 可能需要重新登录');
    }
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
    try {
      // 使用api模块发送DELETE请求
      await api.delete(`/locations/${id}`);
      message.success('删除成功');
      fetchLocations();
    } catch (error) {
      console.error('删除库位失败:', error);
      message.error('删除库位失败');
    }
  };

  const handleOk = async () => {
    try {
      console.log('提交表单数据:', form.getFieldsValue());
      // 确保在调用validateFields之前不要对表单值进行修改
      // 先进行表单验证
      const values = await form.validateFields();
      console.log('验证通过，表单数据:', values);
      
      // 修剪库位编码和处理表单数据
      values.code = values.code ? values.code.trim() : '';
      if (!values.name || values.name.trim() === '') {
        values.name = values.code;
      }
      
      if (editing) {
        // 使用api模块发送PUT请求
        await api.put(`/locations/${editing.id}`, values);
        message.success('修改成功');
      } else {
        // 使用api模块发送POST请求
        await api.post('/locations', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchLocations();
    } catch (e) {
      console.error('保存库位失败:', e);
      if (e.errorFields) {
        // 显示表单验证错误
        message.error('表单验证失败: ' + e.errorFields[0]?.errors[0] || '请检查输入');
      } else {
        message.error('保存失败: ' + (e.response?.data?.message || e.message || '未知错误'));
      }
    }
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
            <Form.Item 
              name="code" 
              label="货位编码" 
              rules={[
                { 
                  required: true, 
                  message: '请输入货位编码',
                  validator: (_, value) => {
                    if (value && value.trim()) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('请输入货位编码'));
                  }
                }
              ]}
            > 
              <Input placeholder="货位编码" /> 
            </Form.Item>
            <Form.Item name="name" label="货位名称"> 
              <Input placeholder="留空将使用编码作为名称" /> 
            </Form.Item>
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