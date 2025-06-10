import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { message } from 'antd';
import Login from './pages/Login';
// 只保留移动端页面
import MobileInventory from './pages/MobileInventory';
import MobileInbound from './pages/MobileInbound';
import MobileOutbound from './pages/MobileOutbound';
import MobileProductManage from './pages/MobileProductManage';
import MobileExternalCodes from './pages/MobileExternalCodes';
import MobileLocationInventory from './pages/MobileLocationInventory';
import Settings from './pages/Settings';
import MobileSKUManage from './pages/MobileSKUManage';
import MobileLocationManage from './pages/MobileLocationManage';
import './mobile.css';
import { messageConfig } from './styles/theme';
import withAuth from './components/withAuth';

// 将message组件挂载到window对象，使其全局可用
window.antd = { message };

// 配置message全局默认值
message.config({
  top: 50,
  duration: 2,
  maxCount: 3
});

// 只包装移动端页面
const AuthMobileInventory = withAuth(MobileInventory);
const AuthMobileInbound = withAuth(MobileInbound);
const AuthMobileOutbound = withAuth(MobileOutbound);
const AuthMobileProductManage = withAuth(MobileProductManage);
const AuthMobileExternalCodes = withAuth(MobileExternalCodes);
const AuthMobileLocationInventory = withAuth(MobileLocationInventory);
const AuthSettings = withAuth(Settings);
const AuthMobileSKUManage = withAuth(MobileSKUManage);
const AuthMobileLocationManage = withAuth(MobileLocationManage);

function App() {
  // 检测设备类型
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    window.innerWidth < 768;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/mobile-inventory" element={<AuthMobileInventory />} />
        <Route path="/mobile-inbound" element={<AuthMobileInbound />} />
        <Route path="/mobile-outbound" element={<AuthMobileOutbound />} />
        <Route path="/mobile-product-manage" element={<AuthMobileProductManage />} />
        <Route path="/mobile-external-codes" element={<AuthMobileExternalCodes />} />
        <Route path="/mobile-location-inventory" element={<AuthMobileLocationInventory />} />
        <Route path="/settings" element={<AuthSettings />} />
        <Route path="/mobile-sku-manage" element={<AuthMobileSKUManage />} />
        <Route path="/mobile-location-manage" element={<AuthMobileLocationManage />} />
        {/* 电脑版入口重定向到移动端首页 */}
        <Route path="/" element={<Navigate to="/mobile-inventory" replace />} />
        <Route path="/inventory" element={<Navigate to="/mobile-inventory" replace />} />
        <Route path="/products" element={<Navigate to="/mobile-product-manage" replace />} />
        <Route path="/external-codes" element={<Navigate to="/mobile-external-codes" replace />} />
        <Route path="/location-inventory" element={<Navigate to="/mobile-location-inventory" replace />} />
        <Route path="/locations" element={<Navigate to="/mobile-location-inventory" replace />} />
        {/* 其它未匹配路径也可重定向到移动端首页 */}
        <Route path="*" element={<Navigate to="/mobile-inventory" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
