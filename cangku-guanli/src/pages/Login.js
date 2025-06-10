import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Button, Input, Form } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { login } from '../api/auth';

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
  useEffect(() => {
    const checkDevice = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
        window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await login(values.username, values.password);
      console.log('Login response:', response);
      localStorage.setItem('token', response.token);
      localStorage.setItem('is_admin', response.is_admin);
      localStorage.setItem('username', values.username);
      message.success('登录成功');
      navigate('/inventory');
    } catch (error) {
      message.error(error.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 默认设置用户名为wms
  useEffect(() => {
    form.setFieldsValue({ username: 'wms' });
  }, [form]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#f0f2f5'
    }}>
      <div style={{
        padding: isMobile ? '24px' : '40px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        width: isMobile ? '90%' : '400px',
        maxWidth: '400px'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '24px',
          fontSize: isMobile ? '24px' : '28px' 
        }}>
          仓库管理系统
        </h2>
        
        <Form
          form={form}
          onFinish={handleLogin}
          initialValues={{ username: 'wms' }}
          size={isMobile ? 'large' : 'middle'}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
              style={{ height: isMobile ? '44px' : '40px' }}
            />
          </Form.Item>
          
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="密码"
              style={{ height: isMobile ? '44px' : '40px' }}
            />
          </Form.Item>
          
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<LoginOutlined />}
              style={{ 
                width: '100%',
                height: isMobile ? '48px' : '40px',
                fontSize: isMobile ? '18px' : '16px'
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default Login;
