import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { getMe, updateProfile } from '../api/user';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const Profile = () => {
  const [form] = Form.useForm();
  const [currentUsername, setCurrentUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 获取当前用户信息
    const fetchMe = async () => {
      try {
        const res = await getMe();
        setCurrentUsername(res.data.username);
        form.setFieldsValue({ modify_username: res.data.username });
      } catch (e) {
        message.error('获取用户信息失败');
      }
    };
    fetchMe();
  }, [form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await updateProfile({
        new_username: values.modify_username,
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('修改成功，请重新登录');
      // 可选：清除token并跳转到登录页
      localStorage.removeItem('token');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (e) {
      message.error(e.response?.data?.detail || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <Card title="个人信息">
          <Form
            form={form}
            onFinish={handleSubmit}
            layout="vertical"
          >
            <Form.Item label="当前用户">
              <Input value={currentUsername} disabled />
            </Form.Item>
            <Form.Item
              name="modify_username"
              label="修改用户"
              rules={[{ required: true, message: '请输入新用户名' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="old_password"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度不能小于6位' }
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认新密码"
              dependencies={['new_password']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                保存
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Profile; 