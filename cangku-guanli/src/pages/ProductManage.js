import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Form, message, Upload, Image, Space, Tooltip } from 'antd';
import { UploadOutlined, PlusOutlined, LinkOutlined } from '@ant-design/icons';
import api from '../api/auth'; // 导入带认证功能的API实例
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  // 构建完整的图片URL
  const getFullImageUrl = (path) => {
    if (!path) return '';
    
    console.log('处理图片路径:', path);
    
    // 如果已经是完整URL，直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      console.log('图片路径已是完整URL');
      return path;
    }
    
    // 确保路径以/开头
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    
    // 使用当前域名构建完整URL
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const fullUrl = baseUrl + cleanPath;
    
    console.log('生成完整URL:', fullUrl);
    return fullUrl;
  };

  const fetchProducts = async () => {
    try {
      // 使用api模块发送GET请求
      const res = await api.get('/products');
      console.log('获取商品成功:', res.data);
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
          url: record.image_path
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
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过2MB!');
      return false;
    }
    return true;
  };

  // 处理文件上传
  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    try {
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
      
      // 简化图片加载测试，直接返回成功
      message.success('图片上传成功');
      onSuccess(response, file);
      
    } catch (error) {
      console.error('图片上传失败:', error);
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
      
      // 确保字段名称与后端一致
      const productData = {
        code: values.code,
        name: values.name || values.code, // 如果name为空，使用code
        unit: values.unit,
        image: uploadedImageUrl // 使用上传后的图片URL
      };
      
      console.log('发送到后端的数据:', productData);
      
      if (editing) {
        // 使用api模块发送PUT请求
        await api.put(`/products/${editing.id}`, productData);
        message.success('修改成功');
      } else {
        // 使用api模块发送POST请求
        await api.post('/products', productData);
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
    console.log('预览图片:', url);
    
    if (!url) {
      message.error('无法预览图片：URL为空');
      return;
    }
    
    // 设置预览图片URL
    setPreviewImage(url);
    setPreviewVisible(true);
    
    // 测试图片是否可加载
    const img = new Image();
    img.onload = () => console.log('图片加载成功:', url);
    img.onerror = () => {
      console.error('图片加载失败:', url);
      message.warning('图片可能无法正确加载');
    };
    img.src = url;
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
        
        console.log(`渲染商品${record.code}的图片:`, url);
        const fullUrl = getFullImageUrl(url);
        console.log(`完整URL:`, fullUrl);
        
        return (
          <Image 
            src={fullUrl}
            alt={record.name || record.code}
            style={{width:40, cursor: 'pointer'}}
            preview={{
              src: fullUrl,
              mask: '点击预览'
            }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
          />
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (text, record) => (
        <Space>
          <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button 
            size="small" 
            type="primary"
            onClick={() => navigate(`/external-codes?product_id=${record.id}`)}
            icon={<LinkOutlined />}
          >
            外部条码
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 24 }}>
        <h2>商品管理</h2>
        <div style={{marginBottom:16}}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增商品
            </Button>
            <Button 
              onClick={() => navigate('/external-codes')}
              icon={<LinkOutlined />}
            >
              外部条码管理
            </Button>
          </Space>
          <Input.Search
            placeholder="搜索商品"
            style={{width:300, marginLeft:16}}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* 渲染表格 */}
        <Table columns={columns} dataSource={filtered} rowKey="id" />
      
        {/* 编辑/新增商品的Modal */}
        <Modal 
          open={modalVisible} 
          onOk={handleOk} 
          onCancel={()=>setModalVisible(false)} 
          title={editing?'编辑商品':'新增商品'}
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
                onPreview={() => {
                  if (uploadedImageUrl) {
                    const url = getFullImageUrl(uploadedImageUrl);
                    setPreviewImage(url);
                    setPreviewVisible(true);
                  }
                }}
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
                  <img 
                    src={getFullImageUrl(uploadedImageUrl)}
                    alt="已上传图片"
                    style={{ width: 200, cursor: 'pointer' }}
                    onClick={() => {
                      setPreviewImage(getFullImageUrl(uploadedImageUrl));
                      setPreviewVisible(true);
                    }}
                  />
                </div>
              )}
            </Form.Item>
          </Form>
        </Modal>
        
        {/* 图片预览Modal */}
        <Modal
          open={previewVisible}
          footer={null}
          onCancel={() => setPreviewVisible(false)}
          width={600}
        >
          <Image 
            src={previewImage} 
            style={{ width: '100%' }} 
            preview={{ 
              src: previewImage,
              mask: false,
              toolbarRender: () => null
            }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
          />
        </Modal>
      </div>
    </div>
  );
};

export default ProductManage;