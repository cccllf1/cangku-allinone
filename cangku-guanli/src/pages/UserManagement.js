import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { getUsers, createUser, deleteUser, resetPassword, editUser } from '../api/user';
import Navbar from '../components/Navbar';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (values) => {
    try {
      await createUser(values);
      message.success('添加用户成功');
      setModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('添加用户失败');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(userId);
      message.success('删除用户成功');
      fetchUsers();
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      await resetPassword(userId);
      message.success('重置密码成功');
    } catch (error) {
      message.error('重置密码失败');
    }
  };

  const handleEditUser = (record) => {
    setEditingUser(record);
    editForm.setFieldsValue({ username: record.username, role: record.role });
    setEditModalVisible(true);
  };

  const handleEditUserOk = async () => {
    try {
      const values = await editForm.validateFields();
      await editUser(editingUser.id, values);
      message.success('编辑用户成功');
      setEditModalVisible(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      message.error('编辑用户失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="text" onClick={() => handleEditUser(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此用户吗？"
            onConfirm={() => handleDeleteUser(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要重置此用户的密码吗？"
            onConfirm={() => handleResetPassword(record.id)}
          >
            <Button type="text" icon={<KeyOutlined />}>
              重置密码
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            添加用户
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
        />

        <Modal
          title="添加用户"
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form
            form={form}
            onFinish={handleAddUser}
            layout="vertical"
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="编辑用户"
          open={editModalVisible}
          onCancel={() => { setEditModalVisible(false); setEditingUser(null); }}
          onOk={handleEditUserOk}
        >
          <Form form={editForm} layout="vertical">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}> 
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default UserManagement; 