import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Inbound from './pages/Inbound';
import Outbound from './pages/Outbound';
import Locations from './pages/Locations';
import UserManagement from './pages/UserManagement';
import ChangePassword from './pages/ChangePassword';
import Profile from './pages/Profile';
import LocationManage from './pages/LocationManage';
import ProductManage from './pages/ProductManage';
import TestForm from './pages/TestForm';

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound"
          element={
            <ProtectedRoute>
              <Inbound />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound"
          element={
            <ProtectedRoute>
              <Outbound />
            </ProtectedRoute>
          }
        />
        <Route
          path="/locations"
          element={
            <ProtectedRoute>
              <LocationManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/products" element={<ProductManage />} />
        <Route path="/testform" element={<TestForm />} />
        <Route path="/" element={<Navigate to="/inventory" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
