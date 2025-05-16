import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Form, message, Upload, Image } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../api/auth'; // 导入带认证功能的API实例
import Navbar from '../components/Navbar';

// 从window.location中获取API基础URL
const BASE_URL = window.location.protocol + '//' + window.location.host;

const ProductManage = () => {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');
  const [fileList, setFileList] = useState([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 构建完整的图片URL
  const getFullImageUrl = (path) => {
    if (!path) return '';
    
    console.log('原始图片路径:', path);
    
    // 如果已经是完整URL，直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      console.log('使用完整URL:', path);
      return path;
    }
    
    // 确保路径以/开头
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const fullUrl = BASE_URL + cleanPath;
    
    console.log('BASE_URL:', BASE_URL);
    console.log('构建的完整URL:', fullUrl);
    
    return fullUrl;
  };

  const fetchProducts = async () => {
    try {
      // 使用api模块发送GET请求
      const res = await api.get('/products');
      console.log('获取商品成功:', res.data);
      // 遍历检查每个商品的图片路径
      res.data.forEach(product => {
        console.log(`商品 ${product.code} 的图片路径:`, product.image_path);
      });
      setProducts(res.data);
    } catch (error) {
      console.error('获取商品失败:', error);
      message.error('获取商品失败, 可能需要重新登录');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setFileList([]);
    setUploadedImageUrl('');
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    console.log('编辑商品记录:', record);
    setEditing(record);
    // 确保表单字段正确设置
    const formValues = {
      code: record.code,
      name: record.name,
      unit: record.unit,
      image_path: record.image_path
    };
    console.log('设置表单初始值:', formValues);
    form.setFieldsValue(formValues);
    
    // 如果有图片，设置fileList
    if (record.image_path) {
      setFileList([
        {
          uid: '-1',
          name: 'image.png',
          status: 'done',
          url: getFullImageUrl(record.image_path)
        }
      ]);
      setUploadedImageUrl(record.image_path);
    } else {
      setFileList([]);
      setUploadedImageUrl('');
    }
    
    setModalVisible(true);
  };

  // 处理图片上传前的检查
  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过5MB!');
      return false;
    }
    return true;
  };

  // 处理文件上传
  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
      console.log('准备上传文件:', file.name, file.type, file.size);
      
      // 创建FormData对象
      const formData = new FormData();
      formData.append('image', file);
      
      // 发送上传请求
      const response = await api.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      console.log('图片上传成功:', response.data);
      const imageUrl = response.data.url;
      setUploadedImageUrl(imageUrl);
      console.log('设置上传图片URL:', imageUrl);
      
      onSuccess(response, file);
      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      console.error('错误详情:', error.response?.data || error.message);
      onError(error);
      message.error('图片上传失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    try {
      console.log('删除商品ID:', id);
      // 使用api模块发送DELETE请求
      await api.delete(`/products/${id}`);
      message.success('删除成功');
      fetchProducts();
    } catch (error) {
      console.error('删除商品失败:', error);
      // 显示后端返回的具体错误信息
      if (error.response && error.response.data && error.response.data.message) {
        message.error(error.response.data.message);
      } else {
        message.error('删除商品失败: ' + (error.message || '未知错误'));
      }
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('商品表单数据:', values);
      
      // 如果单位为空，设置默认值为"件"
      if (!values.unit || values.unit.trim() === '') {
        values.unit = '件';
      }
      
      // 输出上传图片的URL日志
      console.log('上传图片URL:', uploadedImageUrl);
      
      // 确保字段名称与后端一致
      const productData = {
        code: values.code,
        name: values.name || values.code, // 如果name为空，使用code
        unit: values.unit,
        image: uploadedImageUrl // 使用上传后的图片URL
      };
      
      console.log('发送到后端的数据:', productData);
      
      if (editing) {
        // 编辑模式：如果没有上传新图片，保留原图片
        if (!uploadedImageUrl && editing.image_path) {
          productData.image = editing.image_path;
          console.log('保留原图片路径:', editing.image_path);
        }
        
        // 使用api模块发送PUT请求
        const response = await api.put(`/products/${editing.id}`, productData);
        console.log('修改商品响应:', response.data);
        message.success('修改成功');
      } else {
        // 使用api模块发送POST请求
        const response = await api.post('/products', productData);
        console.log('添加商品响应:', response.data);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchProducts();
    } catch (e) {
      console.error('保存商品失败:', e);
      message.error('保存失败: ' + (e.response?.data?.message || e.message || '未知错误'));
    }
  };

  const handlePreview = (url) => {
    setPreviewImage(url);
    setPreviewVisible(true);
  };

  // 过滤商品，支持搜索功能
  let filtered = [];
  try {
    if (products && products.length > 0) {
      filtered = products.filter(p => 
        (p.code && p.code.includes(search)) || 
        (p.name && p.name.includes(search))
      );
    }
  } catch (e) {
    console.error('过滤商品出错:', e);
  }

  // 调试：显示所有商品的图片信息
  useEffect(() => {
    if (products && products.length > 0) {
      console.log('所有商品的图片信息:');
      products.forEach(p => {
        console.log(`商品 ${p.code} 图片路径:`, p.image_path, '处理后URL:', p.image_path ? getFullImageUrl(p.image_path) : '无图片');
      });
    }
  }, [products]);

  const columns = [
    { title: '商品编码', dataIndex: 'code', key: 'code', width: '15%' },
    { title: '商品名称', dataIndex: 'name', key: 'name', width: '25%' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: '10%' },
    { 
      title: '图片', 
      dataIndex: 'image_path', 
      key: 'image_path', 
      width: '20%',
      render: (url, record) => {
        if (!url) return '-';
        const fullUrl = getFullImageUrl(url);
        console.log(`渲染商品 ${record.code} 的图片, 源路径:`, url, '完整URL:', fullUrl);
        return (
          <Image 
            src={fullUrl} 
            alt={record.name || record.code} 
            style={{width:40, cursor: 'pointer'}}
            preview={false}
            onClick={() => handlePreview(fullUrl)}
            onError={(e) => {
              console.error(`图片加载失败: ${fullUrl}`, e);
              message.error(`图片 ${fullUrl} 加载失败`);
            }}
          />
        );
      }
    },
    { title: '编辑', key: 'edit', width: '15%', render: (_, record) => <Button size="small" onClick={() => handleEdit(record)}>编辑</Button> },
    { title: '删除', key: 'delete', width: '15%', render: (_, record) => <Button size="small" danger onClick={() => handleDelete(record.id)}>删除</Button> },
  ];

  return (
    <div>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h2>商品管理</h2>
        <div style={{marginBottom:16}}>
          <Input.Search
            placeholder="请输入搜索内容"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:300, marginRight:16}}
          />
          <Button type="primary" onClick={handleAdd}>新增产品</Button>
        </div>
        <Table rowKey="id" columns={columns} dataSource={filtered} />
        <Modal 
          open={modalVisible} 
          onOk={handleOk} 
          onCancel={()=>setModalVisible(false)} 
          title={editing?'编辑商品':'新增产品'}
          width={600}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="code" label="商品编码" rules={[{required:true, message: '请输入商品编码'}]}> 
              <Input placeholder="请输入商品编码" /> 
            </Form.Item>
            <Form.Item name="name" label="商品名称"> 
              <Input placeholder="请输入商品名称" /> 
            </Form.Item>
            <Form.Item name="unit" label="单位"> 
              <Input placeholder="默认为：件" /> 
            </Form.Item>
            
            <Form.Item label="商品图片">
              {/* 使用自定义上传组件 */}
              <Upload
                listType="picture-card"
                fileList={fileList}
                customRequest={handleUpload}
                beforeUpload={beforeUpload}
                onPreview={() => handlePreview(uploadedImageUrl ? getFullImageUrl(uploadedImageUrl) : '')}
                onChange={({ fileList }) => setFileList(fileList)}
                maxCount={1}
              >
                {fileList.length >= 1 ? null : (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传图片</div>
                  </div>
                )}
              </Upload>
              {uploadedImageUrl && (
                <div>
                  <p>已上传图片预览：</p>
                  <Image 
                    src={getFullImageUrl(uploadedImageUrl)}
                    style={{ width: 200 }}
                    preview={false}
                    onClick={() => handlePreview(getFullImageUrl(uploadedImageUrl))}
                  />
                </div>
              )}
            </Form.Item>
          </Form>
        </Modal>
        
        {/* 图片预览Modal */}
        <Modal
          open={previewVisible}
          title="图片预览"
          footer={null}
          onCancel={() => setPreviewVisible(false)}
        >
          <img alt="预览" style={{ width: '100%' }} src={previewImage} />
        </Modal>
      </div>
    </div>
  );
};

export default ProductManage; 