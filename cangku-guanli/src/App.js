import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { message } from 'antd';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import Inbound from './pages/Inbound';
import Outbound from './pages/Outbound';
import Locations from './pages/Locations';
import UserManagement from './pages/UserManagement';
import ChangePassword from './pages/ChangePassword';
import Profile from './pages/Profile';
import LocationManage from './pages/LocationManage';
import ProductManage from './pages/ProductManage';
import ExternalCodes from './pages/ExternalCodes';
import TestForm from './pages/TestForm';
import Home from './pages/Home';
import withAuth from './components/withAuth';
// 引入移动端页面
import MobileInventory from './pages/MobileInventory';
import MobileInbound from './pages/MobileInbound';
import MobileOutbound from './pages/MobileOutbound';
import MobileProductManage from './pages/MobileProductManage';
import MobileExternalCodes from './pages/MobileExternalCodes';
import MobileLocationInventory from './pages/MobileLocationInventory';

// 将message组件挂载到window对象，使其全局可用
window.antd = { message };

// 使用withAuth高阶组件包装所有需要认证的页面
const AuthInventory = withAuth(Inventory);
const AuthInbound = withAuth(Inbound);
const AuthOutbound = withAuth(Outbound);
const AuthLocations = withAuth(LocationManage);
const AuthUserManagement = withAuth(UserManagement);
const AuthChangePassword = withAuth(ChangePassword);
const AuthProfile = withAuth(Profile);
const AuthProductManage = withAuth(ProductManage);
const AuthExternalCodes = withAuth(ExternalCodes);
const AuthHome = withAuth(Home);
// 包装移动端页面
const AuthMobileInventory = withAuth(MobileInventory);
const AuthMobileInbound = withAuth(MobileInbound);
const AuthMobileOutbound = withAuth(MobileOutbound);
const AuthMobileProductManage = withAuth(MobileProductManage);
const AuthMobileExternalCodes = withAuth(MobileExternalCodes);
const AuthMobileLocationInventory = withAuth(MobileLocationInventory);

function App() {
  // 检测设备类型
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    window.innerWidth < 768;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* 根据设备类型选择桌面版或移动版 */}
        <Route path="/inventory" element={isMobile ? <AuthMobileInventory /> : <AuthInventory />} />
        <Route path="/inbound" element={isMobile ? <AuthMobileInbound /> : <AuthInbound />} />
        <Route path="/outbound" element={isMobile ? <AuthMobileOutbound /> : <AuthOutbound />} />
        <Route path="/products" element={isMobile ? <AuthMobileProductManage /> : <AuthProductManage />} />
        <Route path="/external-codes" element={isMobile ? <AuthMobileExternalCodes /> : <AuthExternalCodes />} />
        <Route path="/location-inventory" element={isMobile ? <AuthMobileLocationInventory /> : <AuthInventory />} />
        
        {/* 其他路由 */}
        <Route path="/locations" element={<AuthLocations />} />
        <Route path="/users" element={<AuthUserManagement />} />
        <Route path="/change-password" element={<AuthChangePassword />} />
        <Route path="/profile" element={<AuthProfile />} />
        <Route path="/testform" element={<TestForm />} />
        <Route path="/" element={<Navigate to="/inventory" replace />} />
        <Route path="/home" element={<AuthHome />} /> 
      </Routes>
    </Router>
  );
}

export default App;
