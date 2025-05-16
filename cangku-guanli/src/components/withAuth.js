import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import api from '../api/auth';

// 高阶组件，用于页面级认证检查
const withAuth = (WrappedComponent) => {
  // 返回一个新组件
  return (props) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
      const verifyAuth = async () => {
        // 检查是否有token
        const token = localStorage.getItem('token');
        const hasToken = !!token;
        
        if (!hasToken) {
          message.error('请先登录');
          setAuthenticated(false);
          setLoading(false);
          return;
        }

        try {
          // 验证token是否有效
          const response = await api.get('/auth/me');
          console.log('认证检查成功:', response.data);
          setAuthenticated(true);
        } catch (error) {
          console.error('认证检查失败:', error);
          if (error.response?.status === 401) {
            message.error('登录已过期，请重新登录');
            // 清除登录信息
            localStorage.removeItem('token');
            localStorage.removeItem('is_admin');
          } else {
            // 其他错误不影响认证状态
            setAuthenticated(true);
          }
        } finally {
          setLoading(false);
        }
      };

      verifyAuth();
    }, []);

    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      );
    }

    if (!authenticated) {
      return <Navigate to="/login" replace />;
    }

    // 认证通过，渲染原始组件
    return <WrappedComponent {...props} />;
  };
};

export default withAuth; 