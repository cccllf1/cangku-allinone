import React, { useState } from 'react';
import { Button, Space, Dropdown, message } from 'antd';
import { SettingOutlined, LogoutOutlined, AppstoreOutlined, InboxOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const MobileNavBar = ({ currentPage }) => {
  const navigate = useNavigate();
  
  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    message.success('退出成功');
    navigate('/login');
  };

  // 设置下拉菜单项
  const settingsItems = [
    {
      key: 'products',
      label: '产品管理',
      icon: <AppstoreOutlined />,
      onClick: () => navigate('/products')
    },
    {
      key: 'externalCodes',
      label: '外部条码',
      icon: <BarcodeOutlined />,
      onClick: () => navigate('/external-codes')
    },
    {
      key: 'locationInventory',
      label: '货位盘点',
      icon: <InboxOutlined />,
      onClick: () => navigate('/location-inventory')
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout
    }
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ margin: 0 }}>
        {currentPage === 'inventory' && '库存管理'}
        {currentPage === 'inbound' && '入库管理'}
        {currentPage === 'outbound' && '出库管理'}
        {currentPage === 'products' && '产品管理'}
        {currentPage === 'externalCodes' && '外部条码管理'}
        {currentPage === 'locationInventory' && '货位盘点'}
      </h2>
      <Space>
        <Button 
          type={currentPage === 'inventory' ? 'primary' : 'default'} 
          onClick={() => navigate('/inventory')}
        >
          库存
        </Button>
        <Button 
          type={currentPage === 'inbound' ? 'primary' : 'default'} 
          onClick={() => navigate('/inbound')}
        >
          入库
        </Button>
        <Button 
          type={currentPage === 'outbound' ? 'primary' : 'default'} 
          onClick={() => navigate('/outbound')}
        >
          出库
        </Button>
        <Dropdown menu={{ items: settingsItems }} placement="bottomRight">
          <Button icon={<SettingOutlined />} />
        </Dropdown>
      </Space>
    </div>
  );
};

export default MobileNavBar; 