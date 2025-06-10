import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Table, Form, Input, Space, Select, 
  Typography, Popconfirm, message, Modal, Tag 
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * 产品SKU管理组件
 * @param {Object} props
 * @param {Object} props.product - 产品信息
 * @param {Function} props.onSave - 保存回调
 */
const ProductSKUManager = ({ product, onSave }) => {
  const [form] = Form.useForm();
  const [skus, setSkus] = useState([]);
  const [editingKey, setEditingKey] = useState('');
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  useEffect(() => {
    if (product && product.skus) {
      setSkus(product.skus);
      
      // 从现有SKU中提取颜色和尺码选项
      const uniqueColors = Array.from(new Set(product.skus.map(sku => sku.color).filter(Boolean)));
      const uniqueSizes = Array.from(new Set(product.skus.map(sku => sku.size).filter(Boolean)));
      
      setColors(uniqueColors);
      setSizes(uniqueSizes);
    }
  }, [product]);

  const isEditing = (record) => record.key === editingKey;

  const edit = (record) => {
    form.setFieldsValue({
      color: record.color,
      size: record.size,
      code: record.code,
      ...record,
    });
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey('');
  };

  const save = async (key) => {
    try {
      const row = await form.validateFields();
      
      // 生成SKU编码（如果为空或已更改）
      if (!row.code && product && product.code) {
        row.code = generateSkuCode(product.code, row.color, row.size);
      }
      
      const newData = [...skus];
      const index = newData.findIndex((item) => key === item.key);

      if (index > -1) {
        const item = newData[index];
        newData.splice(index, 1, { ...item, ...row });
        setSkus(newData);
      } else {
        newData.push(row);
        setSkus(newData);
      }
      
      setEditingKey('');
      
      // 回调保存
      if (onSave) {
        onSave({
          ...product,
          has_sku: true,
          skus: newData
        });
      }
    } catch (errInfo) {
      console.log('验证失败:', errInfo);
    }
  };

  // 添加新的SKU
  const handleAddSku = () => {
    const newKey = Date.now().toString();
    
    // 自动添加新颜色/尺码到选项
    const handleColorChange = (value) => {
      if (value && !colors.includes(value)) {
        setColors([...colors, value]);
      }
    };
    
    const handleSizeChange = (value) => {
      if (value && !sizes.includes(value)) {
        setSizes([...sizes, value]);
      }
    };
    
    const newSku = {
      key: newKey,
      color: '',
      size: '',
      code: ''
    };
    
    setSkus([...skus, newSku]);
    edit(newSku);
  };

  // 批量添加SKU
  const handleBatchAddSku = () => {
    if (!colors.length || !sizes.length) {
      message.warning('请先添加至少一种颜色和一种尺码');
      return;
    }
    
    // 询问用户是否要批量生成所有颜色和尺码的组合
    Modal.confirm({
      title: '批量添加SKU',
      content: `确定要为 ${colors.length} 种颜色和 ${sizes.length} 种尺码批量生成 ${colors.length * sizes.length} 个SKU吗？`,
      onOk: () => {
        const newSkus = [];
        let existingCount = 0;
        
        // 生成所有颜色和尺码的组合
        colors.forEach(color => {
          sizes.forEach(size => {
            // 检查该组合是否已存在
            const exists = skus.some(sku => 
              sku.color === color && sku.size === size
            );
            
            if (!exists) {
              const skuCode = generateSkuCode(product.code, color, size);
              newSkus.push({
                key: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                color,
                size,
                code: skuCode
              });
            } else {
              existingCount++;
            }
          });
        });
        
        // 如果有些组合已存在，提示用户
        if (existingCount > 0) {
          message.info(`已跳过 ${existingCount} 个已存在的组合`);
        }
        
        // 添加新生成的SKU
        if (newSkus.length > 0) {
          const updatedSkus = [...skus, ...newSkus];
          setSkus(updatedSkus);
          
          // 回调保存
          if (onSave) {
            onSave({
              ...product,
              has_sku: true,
              skus: updatedSkus
            });
          }
          
          message.success(`成功生成 ${newSkus.length} 个新SKU`);
        } else {
          message.info('没有新的SKU需要生成');
        }
      }
    });
  };

  // 添加颜色
  const handleAddColor = () => {
    Modal.prompt({
      title: '添加新颜色',
      content: (
        <Input placeholder="请输入颜色名称" />
      ),
      onOk: (value) => {
        if (value && !colors.includes(value)) {
          setColors([...colors, value]);
          message.success(`成功添加颜色: ${value}`);
        } else if (colors.includes(value)) {
          message.warning('该颜色已存在');
        }
      }
    });
  };

  // 添加尺码
  const handleAddSize = () => {
    Modal.prompt({
      title: '添加新尺码',
      content: (
        <Input placeholder="请输入尺码" />
      ),
      onOk: (value) => {
        if (value && !sizes.includes(value)) {
          setSizes([...sizes, value]);
          message.success(`成功添加尺码: ${value}`);
        } else if (sizes.includes(value)) {
          message.warning('该尺码已存在');
        }
      }
    });
  };

  // 删除SKU
  const handleDeleteSku = (key) => {
    const newData = skus.filter(item => item.key !== key);
    setSkus(newData);
    
    // 回调保存
    if (onSave) {
      onSave({
        ...product,
        has_sku: newData.length > 0,
        skus: newData
      });
    }
  };

  // 生成SKU编码
  const generateSkuCode = (productCode, color, size) => {
    if (!productCode) return '';
    
    // 使用"商品编码-颜色-尺码"格式
    return `${productCode}-${color}-${size}`;
  };

  // 当颜色或尺码改变时，自动更新SKU编码
  const handleFieldChange = (value, field, record) => {
    const newData = [...skus];
    const index = newData.findIndex(item => item.key === record.key);
    
    if (index > -1) {
      const item = newData[index];
      
      // 更新字段值
      const updatedItem = { ...item, [field]: value };
      
      // 自动更新SKU编码
      if (field === 'color' || field === 'size') {
        if (product && product.code && updatedItem.color && updatedItem.size) {
          updatedItem.code = generateSkuCode(product.code, updatedItem.color, updatedItem.size);
        }
      }
      
      newData.splice(index, 1, updatedItem);
      setSkus(newData);
      
      // 更新表单中显示的值
      if (editingKey === record.key) {
        form.setFieldsValue(updatedItem);
      }
    }
  };

  const columns = [
    {
      title: '颜色',
      dataIndex: 'color',
      width: '20%',
      editable: true,
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="color"
            rules={[{ required: true, message: '请输入颜色' }]}
          >
            <Select 
              placeholder="选择或输入颜色"
              allowClear
              showSearch
              onChange={(value) => handleFieldChange(value, 'color', record)}
            >
              {colors.map(color => (
                <Option key={color} value={color}>{color}</Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          <span>{record.color}</span>
        );
      }
    },
    {
      title: '尺码',
      dataIndex: 'size',
      width: '20%',
      editable: true,
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="size"
            rules={[{ required: true, message: '请输入尺码' }]}
          >
            <Select 
              placeholder="选择或输入尺码"
              allowClear
              showSearch
              onChange={(value) => handleFieldChange(value, 'size', record)}
            >
              {sizes.map(size => (
                <Option key={size} value={size}>{size}</Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          <span>{record.size}</span>
        );
      }
    },
    {
      title: 'SKU编码',
      dataIndex: 'code',
      width: '40%',
      editable: true,
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="code"
            rules={[{ required: true, message: '请输入SKU编码' }]}
          >
            <Input 
              placeholder={`默认格式: ${product?.code || '商品编码'}-颜色-尺码`}
              disabled={true}
            />
          </Form.Item>
        ) : (
          <span>{record.code}</span>
        );
      }
    },
    {
      title: '操作',
      dataIndex: 'operation',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Space>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={() => save(record.key)}
            >
              保存
            </Button>
            <Button onClick={cancel}>取消</Button>
          </Space>
        ) : (
          <Space>
            <Button 
              type="primary" 
              disabled={editingKey !== ''} 
              icon={<EditOutlined />}
              onClick={() => edit(record)}
            >
              编辑
            </Button>
            <Popconfirm 
              title="确定删除此SKU?" 
              onConfirm={() => handleDeleteSku(record.key)}
            >
              <Button 
                type="primary" 
                danger 
                icon={<DeleteOutlined />}
                disabled={editingKey !== ''}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="SKU管理" style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddSku}
          >
            添加SKU
          </Button>
          <Button
            onClick={handleBatchAddSku}
          >
            批量生成
          </Button>
          <Button onClick={handleAddColor}>添加颜色</Button>
          <Button onClick={handleAddSize}>添加尺码</Button>
        </Space>
        
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">已有 {colors.length} 种颜色和 {sizes.length} 种尺码</Text>
          {colors.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text strong>颜色: </Text>
              {colors.map(color => (
                <Tag key={color} color="blue">{color}</Tag>
              ))}
            </div>
          )}
          {sizes.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text strong>尺码: </Text>
              {sizes.map(size => (
                <Tag key={size} color="green">{size}</Tag>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Form form={form} component={false}>
        <Table
          bordered
          dataSource={skus}
          columns={columns}
          rowClassName="editable-row"
          pagination={false}
        />
      </Form>
    </Card>
  );
};

export default ProductSKUManager; 