import React, { useEffect, useState } from 'react';
import { Table, Input, Button, Space, Popconfirm, Form, Select, message, Tag, Upload, Modal, Radio, List } from 'antd';
import { EditOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, PlusOutlined, InboxOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../api/auth';
import MobileNavBar from '../components/MobileNavBar';
import * as XLSX from 'xlsx';

const { Option } = Select;

const EditableCell = ({ editing, dataIndex, title, inputType, record, index, children, ...restProps }) => {
  let inputNode = <Input />;
  if (inputType === 'select') {
    inputNode = (
      <Select style={{ width: '100%' }}>
        {(record.options || []).map(opt => (
          <Option key={opt} value={opt}>{opt}</Option>
        ))}
      </Select>
    );
  }
  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={dataIndex === 'code' ? [{ required: true, message: `请输入SKU编码` }] : []}
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

const MobileSKUManage = () => {
  const [form] = Form.useForm();
  const [skuData, setSkuData] = useState([]);
  const [editingKey, setEditingKey] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [colorOptions, setColorOptions] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState('add'); // 'add' or 'cover'
  const [importPreview, setImportPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100 });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAllSkus();
  }, []);

  const fetchAllSkus = async (page = 1, pageSize = 100) => {
    setLoading(true);
    try {
      // 获取商品、库存
      const productsRes = await api.get('/products/');
      const products = productsRes.data || [];
      const inventoryRes = await api.get('/inventory/');
      const inventoryList = inventoryRes.data || [];
      // SKU库存映射、货位映射
      const skuInventoryMap = {};
      const skuLocationsMap = {};
      inventoryList.forEach(inv => {
        if (inv.product_code && inv.product_code.includes('-')) {
          skuInventoryMap[inv.product_code] = inv.quantity || 0;
        }
        if (inv.locations && Array.isArray(inv.locations)) {
          inv.locations.forEach(loc => {
            if (loc.skus && Array.isArray(loc.skus)) {
              loc.skus.forEach(sku => {
                const code = sku.sku_code || sku.code;
                if (!skuInventoryMap[code]) skuInventoryMap[code] = 0;
                skuInventoryMap[code] += sku.quantity || 0;
                if (!skuLocationsMap[code]) skuLocationsMap[code] = new Set();
                if (loc.location_code) skuLocationsMap[code].add(loc.location_code);
              });
            }
          });
        }
      });
      // 采集所有SKU
      const allSkus = [];
      const colorSet = new Set();
      const sizeSet = new Set();
      let totalCount = 0;
      products.forEach(product => {
        if (product.skus && product.skus.length > 0) {
          product.skus.forEach(sku => {
            totalCount++;
            allSkus.push({
              key: sku.sku_code || sku.code,
              product_code: product.product_code || product.code,
              product_name: product.product_name || product.name,
              sku_code: sku.sku_code || sku.code,
              sku_color: sku.sku_color || sku.color,
              sku_size: sku.sku_size || sku.size,
              stock_quantity: skuInventoryMap[sku.sku_code || sku.code] || 0,
              locations: Array.from(skuLocationsMap[sku.sku_code || sku.code] || []),
              external_codes: sku.external_codes || [],
              product_id: product.product_id || product._id || product.id,
              sku_id: sku.sku_id || sku._id || sku.id,
            });
            if (sku.sku_color || sku.color) colorSet.add(sku.sku_color || sku.color);
            if (sku.sku_size || sku.size) sizeSet.add(sku.sku_size || sku.size);
          });
        }
      });
      setTotal(totalCount);
      // 分页
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      setSkuData(allSkus.slice(start, end));
      setColorOptions(Array.from(colorSet));
      setSizeOptions(Array.from(sizeSet));
    } catch (error) {
      message.error('获取SKU数据失败');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = (record) => record.key === editingKey;

  const edit = (record) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey('');
  };

  const save = async (key) => {
    try {
      const row = await form.validateFields();
      const newData = [...skuData];
      const index = newData.findIndex(item => key === item.key);
      if (index > -1) {
        const item = newData[index];
        await api.post(`/products/${item.product_id}/update-sku`, {
          sku_code: row.sku_code,
          sku_color: row.sku_color,
          sku_size: row.sku_size,
          product_name: row.product_name || item.product_name
        });
        newData.splice(index, 1, { ...item, ...row });
        setSkuData(newData);
        setEditingKey('');
        message.success('保存成功');
      }
    } catch (err) {
      message.error('保存失败');
    }
  };

  const handleDelete = async (key) => {
    const sku = skuData.find(item => item.key === key);
    if (!sku) return;
    try {
      const remainSkus = skuData.filter(item => item.product_id === sku.product_id && item.key !== key)
        .map(item => ({ sku_code: item.sku_code, sku_color: item.sku_color, sku_size: item.sku_size, product_name: item.product_name }));
      if (remainSkus.length === 0) {
        await api.delete(`/products/${sku.product_id}`);
        message.success('SKU和商品已全部删除');
      } else {
        await api.put(`/products/${sku.product_id}`, {
          skus: remainSkus
        });
        message.success('删除成功');
      }
      setSkuData(skuData.filter(item => item.key !== key));
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleSearch = () => {
    if (!searchValue) {
      fetchAllSkus();
      return;
    }
    const filtered = skuData.filter(item =>
      (item.product_code && item.product_code.includes(searchValue)) ||
      (item.product_name && item.product_name.includes(searchValue)) ||
      (item.sku_code && item.sku_code.includes(searchValue)) ||
      (item.sku_color && item.sku_color.includes(searchValue)) ||
      (item.sku_size && item.sku_size.includes(searchValue))
    );
    setSkuData(filtered);
  };

  // 分页、排序、筛选事件
  const handleTableChange = (pagination, filters, sorter) => {
    setPagination(pagination);
    fetchAllSkus(pagination.current, pagination.pageSize);
  };

  // 导出功能
  const handleExport = () => {
    const exportData = skuData.map(item => ({
      商品编码: item.product_code,
      商品名称: item.product_name,
      SKU编码: item.sku_code,
      颜色: item.sku_color ? item.sku_color : '',
      尺码: item.sku_size ? item.sku_size : '',
      库存: item.stock_quantity,
      货位: item.locations ? item.locations.join(',') : '',
      外部条码: item.external_codes ? item.external_codes.join(',') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU');
    XLSX.writeFile(wb, 'SKU导出.xlsx');
  };

  // 导入功能
  const handleImportFile = (file) => {
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      const fixedJson = json.map(row => ({
        ...row,
        颜色: (row['颜色'] === '默认' ? '' : row['颜色']) || (row['color'] === '默认' ? '' : row['color']) || '',
        尺码: (row['尺码'] === '默认' ? '' : row['尺码']) || (row['size'] === '默认' ? '' : row['size']) || '',
      }));
      setImportPreview(fixedJson);
      setImportLoading(false);
    };
    reader.readAsArrayBuffer(file);
    return false; // 阻止Upload自动上传
  };

  // 执行导入
  const handleImportConfirm = async () => {
    if (!importPreview.length) {
      message.warning('没有可导入的数据');
      return;
    }
    setImportLoading(true);
    let addCount = 0, coverCount = 0, skipCount = 0;
    try {
      const existSkuCodes = new Set(skuData.map(item => item.sku_code));
      for (const row of importPreview) {
        const sku_code = row['SKU编码'] || row['sku编码'] || row['skuCode'] || row['code'];
        const sku_color = row['颜色'] || row['sku_color'] || row['color'];
        const sku_size = row['尺码'] || row['sku_size'] || row['size'];
        const product_code = row['商品编码'] || row['product_code'] || row['productCode'];
        const locations = (row['货位'] || '').split(',').map(s => s.trim()).filter(Boolean);
        const external_codes = (row['外部条码'] || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!sku_code || !product_code) { skipCount++; continue; }
        const exist = existSkuCodes.has(sku_code);
        if (importMode === 'add' && exist) { skipCount++; continue; }
        let product_id = '';
        let product = skuData.find(item => item.product_code === product_code);
        if (!product) {
          const res = await api.post('/products', { product_code });
          product_id = res.data.product_id || res.data._id || res.data.id;
        } else {
          product_id = product.product_id;
        }
        await api.post(`/products/${product_id}/update-sku`, {
          sku_code,
          sku_color,
          sku_size,
          locations,
          external_codes,
        });
        if (exist) coverCount++; else addCount++;
      }
      message.success(`导入完成，新增${addCount}条，覆盖${coverCount}条，跳过${skipCount}条`);
      setImportModalVisible(false);
      fetchAllSkus();
    } catch (err) {
      message.error('导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const template = [
      { 商品编码: '', 商品名称: '', SKU编码: '', 颜色: '', 尺码: '', 库存: '' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    XLSX.writeFile(wb, 'SKU导入模板.xlsx');
  };

  const columns = [
    { title: '商品编码', dataIndex: 'product_code', width: 100, ellipsis: true, sorter: (a, b) => a.product_code.localeCompare(b.product_code), },
    { title: '商品名称', dataIndex: 'product_name', width: 120, editable: true, ellipsis: true, sorter: (a, b) => a.product_name.localeCompare(b.product_name), },
    { title: 'SKU编码', dataIndex: 'sku_code', width: 120, editable: true, ellipsis: true, sorter: (a, b) => a.sku_code.localeCompare(b.sku_code), },
    { title: '颜色', dataIndex: 'sku_color', width: 80, editable: true, filters: colorOptions.map(c => ({ text: c, value: c })), onFilter: (value, record) => record.sku_color === value, sorter: (a, b) => a.sku_color.localeCompare(b.sku_color), render: (text) => text ? <Tag color="blue">{text}</Tag> : '', },
    { title: '尺码', dataIndex: 'sku_size', width: 80, editable: true, filters: sizeOptions.map(s => ({ text: s, value: s })), onFilter: (value, record) => record.sku_size === value, sorter: (a, b) => a.sku_size.localeCompare(b.sku_size), render: (text) => text ? <Tag color="green">{text}</Tag> : '', },
    { title: '库存', dataIndex: 'stock_quantity', width: 60, sorter: (a, b) => a.stock_quantity - b.stock_quantity, render: (text) => <span>{text}</span>, },
    { title: '货位', dataIndex: 'locations', width: 120, render: (locs) => locs ? locs.join(', ') : '', },
    { title: '外部条码', dataIndex: 'external_codes', width: 180, render: (codes) => codes ? codes.join(', ') : '', },
    {
      title: '操作',
      dataIndex: 'operation',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Button type="primary" icon={<SaveOutlined />} size="small" onClick={() => save(record.key)} style={{ marginRight: 8 }}>保存</Button>
            <Button size="small" onClick={cancel}>取消</Button>
          </span>
        ) : (
          <Space>
            <Button icon={<EditOutlined />} size="small" onClick={() => edit(record)} disabled={editingKey !== ''}>编辑</Button>
            <Popconfirm title="确定删除此SKU吗？" onConfirm={() => handleDelete(record.key)}>
              <Button icon={<DeleteOutlined />} size="small" danger disabled={editingKey !== ''}>删除</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const mergedColumns = columns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: record => ({
        record,
        inputType: col.dataIndex === 'color' ? 'select' : (col.dataIndex === 'size' ? 'select' : 'text'),
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
        options: col.dataIndex === 'color' ? colorOptions : (col.dataIndex === 'size' ? sizeOptions : undefined),
      }),
    };
  });

  return (
    <div className="page-container" style={{ padding: 8 }}>
      <MobileNavBar currentPage="skuManager" />
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索商品编码/名称/SKU/颜色/尺码/货位/外部条码"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
        <Button icon={<PlusOutlined />} onClick={() => fetchAllSkus(1, pagination.pageSize)}>重置</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
        <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>导入</Button>
      </div>
      <Form form={form} component={false}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            loading={loading}
            dataSource={skuData}
            columns={columns}
            components={{ body: { cell: EditableCell } }}
            pagination={{ ...pagination, total, showSizeChanger: true, pageSizeOptions: ['50','100','200','500'] }}
            onChange={handleTableChange}
            rowClassName="editable-row"
            size="small"
            scroll={{ x: 1200 }}
          />
        </div>
      </Form>
      <Modal
        title="批量导入SKU"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={handleImportConfirm}
        confirmLoading={importLoading}
        okText="确认导入"
        width={360}
      >
        <div style={{ marginBottom: 8 }}>
          <Radio.Group value={importMode} onChange={e => setImportMode(e.target.value)}>
            <Radio value="add">只新增</Radio>
            <Radio value="cover">允许覆盖</Radio>
          </Radio.Group>
          <Button type="link" size="small" onClick={handleDownloadTemplate} style={{ float: 'right' }}>下载模板</Button>
        </div>
        <Upload.Dragger
          accept=".xlsx,.xls,.csv"
          beforeUpload={handleImportFile}
          showUploadList={false}
          disabled={importLoading}
          style={{ marginBottom: 8 }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>点击或拖拽文件到此处上传</p>
        </Upload.Dragger>
        {importPreview.length > 0 && (
          <div style={{ margin: '12px 0' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>预览：</div>
            <List
              size="small"
              dataSource={importPreview}
              renderItem={row => (
                <List.Item>
                  {`${row['商品编码'] || ''} / ${row['SKU编码'] || ''} / ${row['颜色'] || ''} / ${row['尺码'] || ''}`}
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MobileSKUManage; 