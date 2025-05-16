import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { getMe, updateProfile, updatePassword } from '../api/user';
import { getCurrentUser } from '../api/auth';
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
        // 尝试使用auth.js中的getCurrentUser获取用户信息
        const userData = await getCurrentUser();
        console.log('获取到的用户信息:', userData);
        
        // 设置用户名
        const username = userData.user?.username || '';
        setCurrentUsername(username);
        form.setFieldsValue({ modify_username: username });
      } catch (e) {
        console.error('获取用户信息失败:', e);
        
        // 如果使用getCurrentUser失败，尝试使用之前的getMe
        try {
          const res = await getMe();
          console.log('备用方法获取的用户信息:', res.data);
          const username = res.data.user?.username || '';
          setCurrentUsername(username);
          form.setFieldsValue({ modify_username: username });
        } catch (fallbackError) {
          console.error('备用方法获取用户信息也失败:', fallbackError);
          message.error('获取用户信息失败，请重新登录');
          
          // 登录可能已过期，重定向到登录页
          localStorage.removeItem('token');
          localStorage.removeItem('is_admin');
          setTimeout(() => {
            navigate('/login');
          }, 1500);
        }
      }
    };
    fetchMe();
  }, [form, navigate]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // 判断是否修改了用户名
      const usernameChanged = values.modify_username !== currentUsername;
      
      // 判断是否提供了密码信息
      const passwordProvided = values.old_password && values.new_password;
      
      // 如果修改了用户名，调用更新用户名API
      if (usernameChanged) {
        await updateProfile({
          new_username: values.modify_username
        });
        console.log('用户名更新成功');
      }
      
      // 如果提供了密码信息，调用更新密码API
      if (passwordProvided) {
        await updatePassword({
          old_password: values.old_password,
          new_password: values.new_password
        });
        console.log('密码更新成功');
      }
      
      if (usernameChanged || passwordProvided) {
        message.success('修改成功，请重新登录');
        // 清除token并跳转到登录页
        localStorage.removeItem('token');
        localStorage.removeItem('is_admin');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        message.info('没有进行任何修改');
      }
    } catch (e) {
      console.error('修改失败:', e);
      message.error('修改失败: ' + (e.response?.data?.message || e.message || '未知错误'));
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
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    // 只有当输入了新密码时，当前密码才是必填的
                    if (getFieldValue('new_password') && !value) {
                      return Promise.reject(new Error('请输入当前密码'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="新密码"
              dependencies={['old_password']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    // 如果输入了当前密码，新密码就是必填的
                    if (getFieldValue('old_password') && !value) {
                      return Promise.reject(new Error('请输入新密码'));
                    }
                    // 如果输入了新密码，检查长度
                    if (value && value.length < 6) {
                      return Promise.reject(new Error('密码长度不能小于6位'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认新密码"
              dependencies={['new_password']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!getFieldValue('new_password')) {
                      return Promise.resolve();
                    }
                    if (!value) {
                      return Promise.reject(new Error('请确认新密码'));
                    }
                    if (getFieldValue('new_password') !== value) {
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    }
                    return Promise.resolve();
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