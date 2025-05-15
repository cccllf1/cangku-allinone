import axios from 'axios';

const API_URL = 'http://192.168.11.55:8000';

// 获取用户列表
export const getUsers = () => {
  return axios.get(`${API_URL}/api/auth/users`);
};

// 创建用户
export const createUser = (data) => {
  return axios.post(`${API_URL}/api/auth/users`, data);
};

// 删除用户
export const deleteUser = (userId) => {
  return axios.delete(`${API_URL}/api/auth/users/${userId}`);
};

// 重置密码
export const resetPassword = (userId) => {
  // 这里需要传递新密码，前端可以弹窗输入或用默认密码
  return axios.post(`${API_URL}/api/auth/users/${userId}/reset_password`, { new_password: '123456' });
};

// 修改密码
export const changePassword = (data) => {
  return axios.post(`${API_URL}/api/auth/change_password`, data);
};

// 获取当前用户信息
export const getMe = () => {
  return axios.get(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
};

// 修改用户名和密码
export const updateProfile = (data) => {
  return axios.post(`${API_URL}/api/auth/update_profile`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
};

// 编辑用户
export const editUser = (userId, data) => {
  return axios.put(`${API_URL}/api/auth/users/${userId}`, data);
}; 