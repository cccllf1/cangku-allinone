import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Button, Input, Form, Spin } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { login } from '../api/auth';

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
    
    try {
      const data = await login(values.user_name, values.password);
      console.log('Login response:', data);
      
      if (data && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('is_admin', data.is_admin);
        localStorage.setItem('user_name', values.user_name);
        
        console.log('Stored user data:', {
          token: data.token,
          is_admin: data.is_admin,
          user_name: values.user_name
        });
        
        message.success('登录成功');
        navigate('/mobile-inventory');
      } else {
        console.error('Invalid login response:', data);
        throw new Error('登录失败：服务器响应格式错误');
      }
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      
      const errorMessage = error.response?.data?.error_message 
        || error.message 
        || '登录失败，请检查网络连接';
      
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 默认设置用户名为wms
  useEffect(() => {
    form.setFieldsValue({ user_name: 'wms' });
  }, [form]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#f0f2f5',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: isMobile ? '24px' : '40px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        width: isMobile ? '90%' : '400px',
        maxWidth: '400px',
        position: 'relative'
      }}>
        <Spin spinning={loading} tip="登录中...">
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: '24px',
            fontSize: isMobile ? '24px' : '28px',
            color: '#1890ff'
          }}>
            仓库管理系统
          </h2>
          
          {error && (
            <div style={{
              color: '#ff4d4f',
              textAlign: 'center',
              marginBottom: '16px',
              padding: '8px',
              background: '#fff1f0',
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}
          
          <Form
            form={form}
            onFinish={handleLogin}
            initialValues={{ user_name: 'wms' }}
            size={isMobile ? 'large' : 'middle'}
          >
            <Form.Item
              name="user_name"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 2, message: '用户名至少2个字符' }
              ]}
            >
              <Input 
                prefix={<UserOutlined style={{ color: '#1890ff' }} />} 
                placeholder="用户名" 
                style={{ height: isMobile ? '44px' : '40px' }}
                autoComplete="username"
              />
            </Form.Item>
            
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined style={{ color: '#1890ff' }} />} 
                placeholder="密码"
                style={{ height: isMobile ? '44px' : '40px' }}
                autoComplete="current-password"
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
        </Spin>
      </div>
      
      <div style={{ 
        marginTop: '24px', 
        color: '#666',
        fontSize: '14px' 
      }}>
        版本 1.0.0 | 技术支持
      </div>
    </div>
  );
};

export default Login;
