import axios from 'axios';

// 使用相对路径，自动适应不同环境
const API_URL = '/api';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 移除 withCredentials，因为使用相对路径不需要
  withCredentials: false,
});

// 请求拦截器：添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => {
    // 检查响应格式
    const data = response.data;
    if (data && data.success === false) {
      return Promise.reject(new Error(data.error_message || '操作失败'));
    }
    return response;
  },
  (error) => {
    console.error('Response error:', error);
    
    // 处理特定错误
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('token');
          localStorage.removeItem('is_admin');
          localStorage.removeItem('user_name');
          window.location.href = '/login';
          break;
        case 403:
          console.error('没有权限');
          break;
        case 500:
          console.error('服务器错误');
          break;
        default:
          console.error('未知错误');
      }
    } else if (error.request) {
      console.error('网络请求失败');
    }
    
    return Promise.reject(error);
  }
);

// 登录接口
export const login = async (user_name, password) => {
  try {
    const response = await api.post('/auth/login', { 
      user_name, 
      password 
    });
    
    if (response.data && response.data.success) {
      // 返回正确的数据结构，包含token等字段
      return {
        token: response.data.data.token,
        user: response.data.data.user,
        is_admin: response.data.data.is_admin
      };
    } else {
      throw new Error(response.data.error_message || '登录失败');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// 注册接口
export const register = async (user_name, password) => {
  try {
    const response = await api.post('/auth/register', { 
      user_name, 
      password 
    });
    
    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error_message || '注册失败');
    }
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
};

// 获取当前用户信息
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    
    if (response.data && response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error_message || '获取用户信息失败');
    }
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
};

// 检查用户是否已经登录
export const checkAuthStatus = () => {
  const token = localStorage.getItem('token');
  return !!token;
};

export default api; 