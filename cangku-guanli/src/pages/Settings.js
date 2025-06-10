import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Tag, message, Space, Modal, Form, Divider, List, Select, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import MobileNavBar from '../components/MobileNavBar';
import api from '../api/auth';
import theme, { getStyle, messageConfig } from '../styles/theme';

const Settings = () => {
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [addUserModal, setAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [resetPwdModal, setResetPwdModal] = useState(false);
  const [resetPwd, setResetPwd] = useState('');
  const [changePwdModal, setChangePwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // 加载设置
  useEffect(() => {
    loadSettings();
    // 获取当前用户信息
    api.get('/auth/me').then(res => {
      setCurrentUser(res.data.user);
    }).catch(() => {
      setCurrentUser(null);
    });
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // 从localStorage中获取设置，如果没有则使用默认值
      const savedColors = JSON.parse(localStorage.getItem('productColors')) || [
        '黑色', '白色', '红色', '蓝色', '绿色', '黄色', 
        '紫色', '粉色', '灰色', '棕色', '橙色', '米色'
      ];
      const savedSizes = JSON.parse(localStorage.getItem('productSizes')) || [
        'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'
      ];
      const savedCategories = JSON.parse(localStorage.getItem('productCategories')) || [
        '衣服', '裤子', '上衣', '套装', '外套', '连衣裙', '半身裙', '短裤'
      ];
      
      setColors(savedColors);
      setSizes(savedSizes);
      setCategories(savedCategories);
    } catch (error) {
      console.error('加载设置失败:', error);
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      // 保存到localStorage
      localStorage.setItem('productColors', JSON.stringify(colors));
      localStorage.setItem('productSizes', JSON.stringify(sizes));
      localStorage.setItem('productCategories', JSON.stringify(categories));
      message.success({
        content: '设置已保存',
        icon: messageConfig.success.icon
      });
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    }
  };

  // 添加颜色
  const handleAddColor = () => {
    if (!newColor.trim()) {
      message.warning('颜色名称不能为空');
      return;
    }

    if (colors.includes(newColor.trim())) {
      message.warning('该颜色已存在');
      return;
    }

    setColors([...colors, newColor.trim()]);
    setNewColor('');
  };

  // 添加尺码
  const handleAddSize = () => {
    if (!newSize.trim()) {
      message.warning('尺码不能为空');
      return;
    }

    if (sizes.includes(newSize.trim())) {
      message.warning('该尺码已存在');
      return;
    }

    setSizes([...sizes, newSize.trim()]);
    setNewSize('');
  };

  // 删除颜色
  const handleRemoveColor = (color) => {
    setColors(colors.filter(c => c !== color));
  };

  // 删除尺码
  const handleRemoveSize = (size) => {
    setSizes(sizes.filter(s => s !== size));
  };

  // 添加分类
  const handleAddCategory = () => {
    if (!newCategory.trim()) {
      message.warning('分类名称不能为空');
      return;
    }

    if (categories.includes(newCategory.trim())) {
      message.warning('该分类已存在');
      return;
    }

    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
  };

  // 删除分类
  const handleRemoveCategory = (category) => {
    setCategories(categories.filter(c => c !== category));
  };

  const fetchUsers = async () => {
    setUserLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users || []);
    } catch (e) {
      message.error('获取用户列表失败');
    } finally {
      setUserLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      message.warning('用户名和密码不能为空');
      return;
    }
    try {
      await api.post('/auth/users', newUser);
      message.success('添加成功');
      setAddUserModal(false);
      setNewUser({ username: '', password: '', role: 'user' });
      fetchUsers();
    } catch (e) {
      message.error(e.response?.data?.message || '添加失败');
    }
  };

  const handleDeleteUser = async (id) => {
    Modal.confirm({
      title: '确认删除该用户？',
      onOk: async () => {
        try {
          await api.delete(`/auth/users/${id}`);
          message.success('删除成功');
          fetchUsers();
        } catch (e) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleResetPwd = async () => {
    if (!resetPwdUser || !resetPwd) return;
    try {
      await api.post(`/auth/users/${resetPwdUser.id || resetPwdUser._id}/reset_password`, { new_password: resetPwd });
      message.success('密码已重置');
      setResetPwdModal(false);
      setResetPwd('');
      setResetPwdUser(null);
    } catch (e) {
      message.error('重置失败');
    }
  };

  const handleChangePwd = async () => {
    if (!oldPwd || !newPwd) {
      message.warning('请输入原密码和新密码');
      return;
    }
    try {
      await api.post('/auth/change_password', { oldPassword: oldPwd, newPassword: newPwd });
      message.success('密码修改成功');
      setChangePwdModal(false);
      setOldPwd('');
      setNewPwd('');
    } catch (e) {
      message.error(e.response?.data?.message || '修改失败');
    }
  };

  return (
    <div style={getStyle('mobileContainer')}>
      <MobileNavBar currentPage="settings" />
      <Card 
        title="系统设置" 
        style={{ marginBottom: theme.spacingMd }}
        className="compact-card"
        headStyle={{ 
          fontSize: '16px', 
          fontWeight: 'bold',
          padding: `${theme.spacingSm} ${theme.spacingMd}`
        }}
        bodyStyle={{ padding: theme.spacingMd }}
      >
        <Tabs
          defaultActiveKey="color-size"
          size="large"
          onChange={key => {
            if (key === 'user') {
              fetchUsers();
            }
          }}
        >
          <Tabs.TabPane tab="颜色尺码" key="color-size">
            <div style={{ marginBottom: theme.spacingLg }}>
              <h3 style={{ fontSize: '15px', marginBottom: theme.spacingMd }}>产品颜色管理</h3>
              <div style={{ marginBottom: theme.spacingSm, display: 'flex' }}>
                <Input 
                  placeholder="输入颜色名称" 
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onPressEnter={handleAddColor}
                  style={{ marginRight: theme.spacingSm }}
                />
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddColor}
                  style={getStyle('successIconBtn')}
                >
                  添加
                </Button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacingSm }}>
                {colors.map(color => (
                  <Tag 
                    key={color}
                    closable
                    onClose={() => handleRemoveColor(color)}
                    style={{ fontSize: '14px', padding: '2px 6px' }}
                  >
                    {color}
                  </Tag>
                ))}
              </div>
            </div>
            <Divider style={{ margin: `${theme.spacingMd} 0` }} />
            <div style={{ marginBottom: theme.spacingLg }}>
              <h3 style={{ fontSize: '15px', marginBottom: theme.spacingMd }}>产品尺码管理</h3>
              <div style={{ marginBottom: theme.spacingSm, display: 'flex' }}>
                <Input 
                  placeholder="输入尺码" 
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onPressEnter={handleAddSize}
                  style={{ marginRight: theme.spacingSm }}
                />
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddSize}
                  style={getStyle('successIconBtn')}
                >
                  添加
                </Button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacingSm }}>
                {sizes.map(size => (
                  <Tag 
                    key={size}
                    closable
                    onClose={() => handleRemoveSize(size)}
                    color="blue"
                    style={{ fontSize: '14px', padding: '2px 6px' }}
                  >
                    {size}
                  </Tag>
                ))}
              </div>
            </div>
            <Divider style={{ margin: `${theme.spacingMd} 0` }} />
            <div style={{ marginBottom: theme.spacingLg }}>
              <h3 style={{ fontSize: '15px', marginBottom: theme.spacingMd }}>服装分类管理</h3>
              <div style={{ marginBottom: theme.spacingSm, display: 'flex' }}>
                <Input 
                  placeholder="输入分类名称" 
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onPressEnter={handleAddCategory}
                  style={{ marginRight: theme.spacingSm }}
                />
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddCategory}
                  style={getStyle('successIconBtn')}
                >
                  添加
                </Button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacingSm }}>
                {categories.map(category => (
                  <Tag 
                    key={category}
                    closable
                    onClose={() => handleRemoveCategory(category)}
                    color="orange"
                    style={{ fontSize: '14px', padding: '2px 6px' }}
                  >
                    {category}
                  </Tag>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: theme.spacingMd }}>
              <Button 
                type="primary" 
                onClick={saveSettings}
                style={{ width: '200px', ...getStyle('successIconBtn') }}
              >
                保存设置
              </Button>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="用户管理" key="user">
            <Button type="primary" style={{ marginBottom: 12, width: '100%' }} onClick={() => setAddUserModal(true)} icon={<PlusOutlined />}>添加用户</Button>
            <List
              loading={userLoading}
              dataSource={users}
              renderItem={user => (
                <List.Item
                  actions={[
                    <a key="reset" onClick={() => { setResetPwdUser(user); setResetPwdModal(true); }}>重置密码</a>,
                    <a key="delete" style={{ color: 'red' }} onClick={() => handleDeleteUser(user.id || user._id)}>删除</a>
                  ]}
                >
                  <Space><UserOutlined />{user.username}<Tag>{user.role}</Tag></Space>
                </List.Item>
              )}
            />
            <Modal
              title="添加用户"
              open={addUserModal}
              onCancel={() => setAddUserModal(false)}
              onOk={handleAddUser}
              okText="添加"
              cancelText="取消"
            >
              <Form layout="vertical">
                <Form.Item label="用户名">
                  <Input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                </Form.Item>
                <Form.Item label="密码">
                  <Input.Password value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                </Form.Item>
                <Form.Item label="角色">
                  <Select value={newUser.role} onChange={role => setNewUser({ ...newUser, role })}>
                    <Select.Option value="user">普通用户</Select.Option>
                    <Select.Option value="admin">管理员</Select.Option>
                  </Select>
                </Form.Item>
              </Form>
            </Modal>
            <Modal
              title={`重置密码：${resetPwdUser?.username || ''}`}
              open={resetPwdModal}
              onCancel={() => setResetPwdModal(false)}
              onOk={handleResetPwd}
              okText="重置"
              cancelText="取消"
            >
              <Form layout="vertical">
                <Form.Item label="新密码">
                  <Input.Password value={resetPwd} onChange={e => setResetPwd(e.target.value)} />
                </Form.Item>
              </Form>
            </Modal>
          </Tabs.TabPane>
          <Tabs.TabPane tab="修改密码" key="password">
            <div style={{ textAlign: 'center', marginBottom: 16, color: '#888' }}>
              当前账号：{currentUser?.username || '未知'}
            </div>
            <Form layout="vertical" style={{ maxWidth: 400, margin: '0 auto' }}>
              <Form.Item label="原密码">
                <Input.Password value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
              </Form.Item>
              <Form.Item label="新密码">
                <Input.Password value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </Form.Item>
              <Form.Item label="确认新密码">
                <Input.Password value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" onClick={() => {
                  if (newPwd !== confirmPwd) {
                    message.error('两次输入的新密码不一致');
                    return;
                  }
                  handleChangePwd();
                }} style={{ width: '100%' }}>修改</Button>
              </Form.Item>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Settings; 