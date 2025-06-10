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

  useEffect(() => {
    fetchAllSkus();
  }, []);

  const fetchAllSkus = async () => {
    setLoading(true);
    try {
      const productsRes = await api.get('/products/');
      const products = productsRes.data || [];
      const inventoryRes = await api.get('/inventory/');
      const inventoryList = inventoryRes.data || [];
      // 构建SKU库存映射
      const skuInventoryMap = {};
      inventoryList.forEach(inv => {
        // 1. SKU独立行
        if (inv.productCode && inv.productCode.includes('-')) {
          skuInventoryMap[inv.productCode] = inv.quantity || 0;
        }
        // 2. 主商品下的SKU
        if (inv.locations && Array.isArray(inv.locations)) {
          inv.locations.forEach(loc => {
            if (loc.skus && Array.isArray(loc.skus)) {
              loc.skus.forEach(sku => {
                if (!skuInventoryMap[sku.code]) skuInventoryMap[sku.code] = 0;
                skuInventoryMap[sku.code] += sku.quantity || 0;
              });
            }
          });
        }
      });
      const allSkus = [];
      const colorSet = new Set();
      const sizeSet = new Set();
      products.forEach(product => {
        if (product.skus && product.skus.length > 0) {
          product.skus.forEach(sku => {
            allSkus.push({
              key: sku.code,
              productCode: product.code,
              productName: product.name,
              code: sku.code,
              color: sku.color,
              size: sku.size,
              quantity: skuInventoryMap[sku.code] || 0, // 用实时库存
              productId: product._id || product.id,
              skuId: sku._id || sku.id,
            });
            if (sku.color) colorSet.add(sku.color);
            if (sku.size) sizeSet.add(sku.size);
          });
        }
      });
      setSkuData(allSkus);
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
        // 调试输出productId和row
        console.log('保存SKU productId:', item.productId, row);
        // 调用API保存SKU和商品名称
        await api.post(`/products/${item.productId}/update-sku`, {
          code: row.code,
          color: row.color,
          size: row.size,
          name: row.productName || item.productName // 新增：支持商品名称修改
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
      // 找到该商品的所有SKU，去掉要删除的那一个
      const remainSkus = skuData.filter(item => item.productId === sku.productId && item.key !== key)
        .map(item => ({ code: item.code, color: item.color, size: item.size, name: item.productName }));
      if (remainSkus.length === 0) {
        // 没有SKU了，自动删除商品
        await api.delete(`/products/${sku.productId}`);
        message.success('SKU和商品已全部删除');
      } else {
        // 用PUT更新商品的skus字段
        await api.put(`/products/${sku.productId}`, {
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
      (item.productCode && item.productCode.includes(searchValue)) ||
      (item.productName && item.productName.includes(searchValue)) ||
      (item.code && item.code.includes(searchValue)) ||
      (item.color && item.color.includes(searchValue)) ||
      (item.size && item.size.includes(searchValue))
    );
    setSkuData(filtered);
  };

  // 导出功能
  const handleExport = () => {
    const exportData = skuData.map(item => ({
      商品编码: item.productCode,
      商品名称: item.productName,
      SKU编码: item.code,
      颜色: item.color ? item.color : '',
      尺码: item.size ? item.size : '',
      库存: item.quantity
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
      // 获取现有SKU编码集合
      const existSkuCodes = new Set(skuData.map(item => item.code));
      for (const row of importPreview) {
        const code = row['SKU编码'] || row['sku编码'] || row['skuCode'] || row['code'];
        const color = row['颜色'] || row['color'];
        const size = row['尺码'] || row['size'];
        const productCode = row['商品编码'] || row['productCode'];
        if (!code || !productCode) { skipCount++; continue; }
        const exist = existSkuCodes.has(code);
        if (importMode === 'add' && exist) { skipCount++; continue; }
        // 查找商品ID
        let productId = '';
        let product = skuData.find(item => item.productCode === productCode);
        if (!product) {
          // 自动新建商品，只传商品编码
          const res = await api.post('/products', { code: productCode });
          productId = res.data._id || res.data.id;
        } else {
          productId = product.productId;
        }
        // 新增或覆盖
        await api.post(`/products/${productId}/update-sku`, {
          code,
          color,
          size,
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
    {
      title: '商品编码',
      dataIndex: 'productCode',
      width: 100,
      ellipsis: true,
    },
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 120,
      editable: true,
      ellipsis: true,
    },
    {
      title: 'SKU编码',
      dataIndex: 'code',
      width: 120,
      editable: true,
      ellipsis: true,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 80,
      editable: true,
      render: (text) => text ? <Tag color="blue">{text}</Tag> : '',
    },
    {
      title: '尺码',
      dataIndex: 'size',
      width: 80,
      editable: true,
      render: (text) => text ? <Tag color="green">{text}</Tag> : '',
    },
    {
      title: '库存',
      dataIndex: 'quantity',
      width: 60,
      render: (text) => <span>{text}</span>,
    },
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
          placeholder="搜索商品编码/名称/SKU/颜色/尺码"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onPressEnter={handleSearch}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
        <Button icon={<PlusOutlined />} onClick={fetchAllSkus}>重置</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
        <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>导入</Button>
      </div>
      <Form form={form} component={false}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            loading={loading}
            dataSource={skuData}
            columns={mergedColumns}
            components={{ body: { cell: EditableCell } }}
            pagination={false}
            rowClassName="editable-row"
            size="small"
            scroll={{ x: 700 }}
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