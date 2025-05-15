import React, { useEffect, useState } from 'react';
import { Table, Button, Image, Modal, Select, Input, Space } from 'antd';
import axios from 'axios';
import Navbar from '../components/Navbar';

const Inventory = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [searchType, setSearchType] = useState('code');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    setLoading(true);
    axios.get('/api/inventory/')
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handlePreview = (imgUrl) => {
    setPreviewImage(imgUrl);
    setPreviewVisible(true);
  };

  const handleSearch = () => {
    // 简单前端筛选（如需后端筛选可改造）
    if (!searchValue) {
      setLoading(true);
      axios.get('/api/inventory/')
        .then(res => setData(res.data))
        .finally(() => setLoading(false));
      return;
    }
    const filtered = data.filter(item => {
      if (searchType === 'code') {
        return item.code && item.code.includes(searchValue);
      } else if (searchType === 'name') {
        return item.name && item.name.includes(searchValue);
      }
      return true;
    });
    setData(filtered);
  };

  const expandedRowRender = (record) => {
    if (!record.locations || record.locations.length === 0) {
      return <div style={{ color: '#aaa' }}>无分库位库存明细</div>;
    }
    return (
      <Table
        columns={[
          { title: '库位编码', dataIndex: 'locationCode', key: 'locationCode' },
          { title: '库位名称', dataIndex: 'locationName', key: 'locationName' },
          { title: '数量', dataIndex: 'quantity', key: 'quantity' }
        ]}
        dataSource={record.locations}
        pagination={false}
        rowKey={(row) => row.locationCode}
        size="small"
      />
    );
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'image',
      key: 'image',
      render: (img, record) => img ? (
        <Image
          width={48}
          src={img}
          style={{ cursor: 'pointer' }}
          onClick={() => handlePreview(img)}
        />
      ) : <span style={{ color: '#aaa' }}>无图</span>
    },
    { title: '商品编码', dataIndex: 'code', key: 'code', sorter: (a, b) => a.code.localeCompare(b.code) },
    { title: '商品名称', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: '单位', dataIndex: 'unit', key: 'unit', sorter: (a, b) => a.unit.localeCompare(b.unit) },
    { title: '总库存', dataIndex: 'total', key: 'total', sorter: (a, b) => a.total - b.total },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => <Button size="small">详情</Button>
    }
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h1>库存管理</h1>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Select
            value={searchType}
            onChange={v => setSearchType(v)}
            style={{ width: 140 }}
            options={[
              { value: 'code', label: '按商品编码' },
              { value: 'name', label: '按商品名称' },
            ]}
          />
          <Input
            placeholder="请输入搜索内容"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            style={{ width: 300 }}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="code"
          pagination={{ pageSize: 10 }}
          expandable={{ expandedRowRender }}
        />
        <Modal
          open={previewVisible}
          footer={null}
          onCancel={() => setPreviewVisible(false)}
          width={600}
        >
          <Image src={previewImage} style={{ width: '100%' }} />
        </Modal>
      </div>
    </div>
  );
};

export default Inventory;
