import React, { useEffect, useState } from 'react';
import { Card, Row, Col } from 'antd';
import Navbar from '../components/Navbar';

const Home = () => {
  // 假数据，可后续用接口替换
  const [stats, setStats] = useState({
    totalInventory: 1234,
    todayInbound: 56,
    todayOutbound: 42,
    productCount: 88,
    locationCount: 12,
  });

  // 可用 useEffect 拉取真实统计数据

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <h1 style={{ marginBottom: 32 }}>欢迎使用仓库管理系统</h1>
        <Row gutter={24} style={{ marginBottom: 32 }}>
          <Col span={6}><Card title="总库存" bordered={false} style={{ fontSize: 22 }}>{stats.totalInventory}</Card></Col>
          <Col span={6}><Card title="今日入库" bordered={false} style={{ fontSize: 22 }}>{stats.todayInbound}</Card></Col>
          <Col span={6}><Card title="今日出库" bordered={false} style={{ fontSize: 22 }}>{stats.todayOutbound}</Card></Col>
          <Col span={3}><Card title="产品数" bordered={false} style={{ fontSize: 22 }}>{stats.productCount}</Card></Col>
          <Col span={3}><Card title="库位数" bordered={false} style={{ fontSize: 22 }}>{stats.locationCount}</Card></Col>
        </Row>
        {/* 后续可加图表、快捷入口等 */}
      </div>
    </div>
  );
};

export default Home;
