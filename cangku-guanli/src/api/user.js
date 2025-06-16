import axios from 'axios';
import api from './auth'; // 导入带认证的API实例

// 修改为统一使用相对路径
const API_URL = '/api';

// 获取用户列表
export const getUsers = () => {
  return api.get('/auth/users');
};

// 创建用户
export const createUser = (data) => {
  return api.post('/auth/users', data);
};

// 删除用户
export const deleteUser = (userId) => {
  return api.delete(`/auth/users/${userId}`);
};

// 重置密码
export const resetPassword = (userId) => {
  // 这里需要传递新密码，前端可以弹窗输入或用默认密码
  return api.post(`/auth/users/${userId}/reset_password`, { new_password: '123456' });
};

// 修改密码
export const changePassword = (data) => {
  return api.post('/auth/change_password', data);
};

// 获取当前用户信息
export const getMe = () => {
  return api.get('/auth/me');
};

// 修改用户名和密码
export const updateProfile = (data) => {
  return api.post('/auth/update_profile', { 
    username: data.new_username,
    is_admin: data.is_admin
  });
};

// 修改密码
export const updatePassword = (data) => {
  return api.post('/auth/change_password', { 
    old_password: data.old_password, 
    new_password: data.new_password 
  });
};

// 编辑用户
export const editUser = (userId, data) => {
  return api.put(`/auth/users/${userId}`, {
    username: data.username,
    is_admin: data.is_admin,
    is_active: data.is_active
  });
}; 