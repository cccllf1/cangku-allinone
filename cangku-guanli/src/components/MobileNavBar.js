import React, { useState } from 'react';
import { Button, Space, Dropdown, message, Tooltip } from 'antd';
import { SettingOutlined, LogoutOutlined, AppstoreOutlined, InboxOutlined, BarcodeOutlined, TagsOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import theme, { getStyle, messageConfig } from '../styles/theme';

const MobileNavBar = ({ currentPage }) => {
  const navigate = useNavigate();
  
  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('is_admin');
    message.success({
      content: '退出成功',
      icon: messageConfig.success.icon
    });
    navigate('/login');
  };

  // 设置下拉菜单项
  const settingsItems = [
    {
      key: 'products',
      label: '产品管理',
      icon: <AppstoreOutlined />
    },
    {
      key: 'skuManager',
      label: 'SKU管理',
      icon: <TagsOutlined />
    },
    {
      key: 'externalCodes',
      label: '外部条码',
      icon: <BarcodeOutlined />
    },
    {
      key: 'locationInventory',
      label: '货位盘点',
      icon: <InboxOutlined />
    },
    {
      key: 'locationManagement',
      label: '货位管理',
      icon: <DatabaseOutlined />
    },
    {
      key: 'settings',
      label: '系统设置',
      icon: <SettingOutlined />
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />
    }
  ];

  const handleMenuClick = ({ key }) => {
    switch (key) {
      case 'products':
        navigate('/mobile-product-manage');
        break;
      case 'skuManager':
        navigate('/mobile-sku-manage');
        break;
      case 'externalCodes':
        navigate('/mobile-external-codes');
        break;
      case 'locationInventory':
        navigate('/mobile-location-inventory');
        break;
      case 'locationManagement':
        navigate('/mobile-location-manage');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '4px 2px', 
      marginBottom: '4px',
      backgroundColor: theme.backgroundWhite,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderRadius: theme.borderRadius,
      height: theme.compactNavHeight
    }}>
      <h2 style={{ 
        margin: 0, 
        fontSize: '15px', 
        fontWeight: 'bold' 
      }}>
        {currentPage === 'inventory' && '库存管理'}
        {currentPage === 'inbound' && '入库管理'}
        {currentPage === 'outbound' && '出库管理'}
        {currentPage === 'products' && '产品管理'}
        {currentPage === 'skuManager' && 'SKU管理'}
        {currentPage === 'externalCodes' && '外部条码管理'}
        {currentPage === 'locationInventory' && '货位盘点'}
        {currentPage === 'locationManagement' && '货位管理'}
        {currentPage === 'settings' && '系统设置'}
      </h2>
      <Space size={8} style={{ margin: 0 }}>
        <Button 
          type={currentPage === 'inventory' ? 'primary' : 'default'} 
          onClick={() => navigate('/mobile-inventory')}
          size="large"
          style={{ width: 50, height: 30, fontSize: 12, margin: '0 1px' }}
        >
          库存
        </Button>
        <Button 
          type={currentPage === 'locationInventory' ? 'primary' : 'default'} 
          onClick={() => navigate('/mobile-location-inventory')}
          size="large"
          style={{ width: 50, height: 30, fontSize: 12, margin: '0 1px' }}
        >
          货位
        </Button>
        <Button 
          type={currentPage === 'inbound' ? 'primary' : 'default'} 
          onClick={() => navigate('/mobile-inbound')}
          size="large"
          style={{ width: 50, height: 30, fontSize: 12, margin: '0 1px' }}
        >
          入库
        </Button>
        <Button 
          type={currentPage === 'outbound' ? 'primary' : 'default'} 
          onClick={() => navigate('/mobile-outbound')}
          size="large"
          style={{ width: 50, height: 30, fontSize: 12, margin: '0 1px' }}
        >
          出库
        </Button>
        <Dropdown menu={{ items: settingsItems, onClick: handleMenuClick }} placement="bottomRight">
          <Button 
            icon={<SettingOutlined style={{ fontSize: '14px' }} />} 
            size="large"
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 1px' }} 
          />
        </Dropdown>
      </Space>
    </div>
  );
};

export default MobileNavBar; 