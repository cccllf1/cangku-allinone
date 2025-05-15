import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, Menu, Button } from 'antd';
import { SettingOutlined, LogoutOutlined, HomeOutlined, AppstoreOutlined, TeamOutlined, LoginOutlined, DatabaseOutlined } from '@ant-design/icons';

function Navbar() {
  const isLoggedIn = !!localStorage.getItem('token');
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  console.log('Navbar: is_admin in localStorage =', localStorage.getItem('is_admin'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    navigate('/login');
  };

  const settingsMenu = (
    <Menu>
      <Menu.Item key="home" icon={<HomeOutlined />} onClick={() => navigate('/')}>主页</Menu.Item>
      <Menu.Item key="products" icon={<AppstoreOutlined />} onClick={() => navigate('/products')}>产品</Menu.Item>
      <Menu.Item key="locations" icon={<DatabaseOutlined />} onClick={() => navigate('/locations')}>库位</Menu.Item>
      <Menu.Item key="profile" icon={<SettingOutlined />} onClick={() => navigate('/profile')}>个人设置</Menu.Item>
      {isAdmin && (
        <Menu.Item key="users" icon={<TeamOutlined />} onClick={() => navigate('/users')}>用户管理</Menu.Item>
      )}
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: 'red' }}>退出</Menu.Item>
    </Menu>
  );

  return (
    <div style={{ background: '#eee', padding: 0 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 16, alignItems: 'center', height: 72 }}>
        <Dropdown overlay={settingsMenu} placement="bottom">
          <Button icon={<SettingOutlined />}>设置</Button>
        </Dropdown>
        <Button
          type={location.pathname === '/inventory' ? 'primary' : 'default'}
          style={{ marginRight: 8 }}
          onClick={() => navigate('/inventory')}
        >
          库存
        </Button>
        <Button
          type={location.pathname === '/inbound' ? 'primary' : 'default'}
          style={{ marginRight: 8 }}
          onClick={() => navigate('/inbound')}
        >
          入库
        </Button>
        <Button
          type={location.pathname === '/outbound' ? 'primary' : 'default'}
          style={{ marginRight: 8 }}
          onClick={() => navigate('/outbound')}
        >
          出库
        </Button>
        <div style={{ flex: 1 }} />
        {/* 彻底移除退出按钮，不再渲染 */}
      </div>
    </div>
  );
}

export default Navbar;
