import React, { useEffect, useState, useCallback } from 'react';
import { Button, Input, message, List, Select, Typography } from 'antd';
const { Text } = Typography;
import api from '../api/auth';
import { getCurrentUser } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';
import InboundItemCard from '../components/InboundItemCard';
import { getCache, setCache } from '../utils/cacheUtils';
import { showResultModal } from '../components/ResultModal';

const MobileOutbound = () => {
  const [locationOptions, setLocationOptions] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();

  // 计算提交可用性
  const canSubmit = tableData.length > 0 && tableData.every(it => it.sku_code && it.location_code && it.stock_quantity > 0);

  // 获取库位
  const fetchLocations = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCache('locations');
      if (cached) {
        setLocationOptions(cached);
        return;
      }
    }
    try {
      setLoadingLocations(true);
      const res = await api.get('/locations/');
      const opts = [
        { value: '无货位', label: '无货位' },
        ...(res.data.data || []).map(l => ({ value: l.location_code, label: l.location_code }))
      ];
      setLocationOptions(opts);
      setCache('locations', opts);
    } catch (err) {
      message.error('获取库位失败');
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => { 
    fetchLocations(); 
    fetchCurrentUser();
  }, []);
  
  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      navigate('/login');
    }
  };

  // 扫码或输入确认
  const handleScan = useCallback(async () => {
    const code = inputCode.trim();
    if (!code) return;
    
    setLoading(true);
    try {
      let productData = null;
      try {
        if (code.includes('-')) {
          const skuRes = await api.get(`/products/code/${code}`);
          productData = skuRes?.data?.data;
        } else {
          const prodRes = await api.get(`/products/code/${code}`);
          productData = prodRes?.data?.data;
        }
      } catch (err) {
        if (err.response && err.response.status === 404 && !code.includes('-')) {
          try {
            const extRes = await api.get(`/products/external-code/${code}`);
            if (extRes?.data?.success && extRes.data.data) {
              productData = extRes.data.data;
            }
          } catch (err2) {
            // 外部条码也查找失败
          }
        }
      }

      if (productData) {
        await processScannedData(productData);
      } else {
        message.warning('未找到商品或SKU');
      }

    } catch (err) {
      console.error("处理扫描失败", err);
      message.error('查询或处理失败');
    } finally { 
      setLoading(false); 
      setInputCode('');
    }
  }, [inputCode, tableData]);

  // 新增: 处理扫描到的数据
  const processScannedData = async (productData) => {
    let targetSkuCode;
    let productDetails;

    // 1. 确定目标SKU和商品详情
    if (productData.matched_sku) { // 外部条码或SKU编码直接定位
      targetSkuCode = productData.matched_sku.sku_code;
      // 当通过外部码查找时, productData里没有colors数组, 需要重新获取商品完整信息
      const fullProductRes = await api.get(`/products/code/${productData.product_code}`);
      productDetails = fullProductRes?.data?.data;

    } else { // 商品编码
      productDetails = productData;
      // 如果是商品, 默认选择第一个有库存的SKU
      for (const color of productDetails.colors || []) {
        const firstSku = (color.sizes || []).find(s => s.sku_total_quantity > 0);
        if (firstSku) {
          targetSkuCode = firstSku.sku_code;
          break;
        }
      }
    }
    
    if (!productDetails || !targetSkuCode) {
      message.warning('该商品无可用库存或未找到SKU');
      return;
    }

    // 2. 检查SKU是否已在出库列表
    const existingItem = tableData.find(item => item.sku_code === targetSkuCode);
    if (existingItem) {
      handleQuantityConfirm(existingItem.key, existingItem.stock_quantity + 1);
      return;
    }

    // 3. 构建新的出库条目
    let skuInfo, colorInfo, locationInfo;
    for (const color of productDetails.colors) {
        const foundSize = color.sizes.find(s => s.sku_code === targetSkuCode);
        if (foundSize) {
            skuInfo = foundSize;
            colorInfo = color;
            // 找到第一个有库存的库位
            locationInfo = (skuInfo.locations || []).find(l => l.stock_quantity > 0);
            break;
        }
    }

    if (!skuInfo) {
      message.error("无法在商品信息中定位到SKU，请检查数据");
      return;
    }
    
    // 4. 添加到表格
    setTableData(prev => [...prev, {
      key: Date.now().toString(),
      product_id: productDetails.product_id,
      product_code: productDetails.product_code,
      display_code: skuInfo.sku_code,
      product_name: productDetails.product_name,
      sku_code: skuInfo.sku_code,
      sku_total_quantity: skuInfo.sku_total_quantity,
      sku_color: colorInfo.color,
      sku_size: skuInfo.sku_size,
      stock_quantity: 1,
      location_code: locationInfo?.location_code || '',
      image_path: colorInfo?.image_path || productDetails.image_path || '',
      // 为下拉选择准备数据
      colorOptions: productDetails.colors.map(c => ({ value: c.color, label: c.color })),
      sizeOptions: productDetails.colors.reduce((acc, c) => {
        acc[c.color] = (c.sizes || []).filter(s => s.sku_total_quantity > 0).map(s => ({
          value: s.sku_code,
          label: `${s.sku_size} (${s.sku_total_quantity}件)`,
          locations: s.locations,
        }));
        return acc;
      }, {}),
      locationOptions: (skuInfo.locations || []).filter(l => l.stock_quantity > 0).map(l => ({
        value: l.location_code,
        label: `${l.location_code} (库存: ${l.stock_quantity})`,
        qty: l.stock_quantity,
      })),
      colors: productDetails.colors, // 保存完整结构用于后续操作
    }]);
    message.success("添加成功");
  };

  // 表格项处理
  const handleColorChange = (key, color) => {
    setTableData(prev => prev.map(item => {
      if (item.key !== key) return item;
      const colorObj = (item.colors||[]).find(c=>c.color===color);
      const validSizes = (colorObj?.sizes||[]).filter(sz=> (sz.locations||[]).some(l=>l.stock_quantity>0));
      const sizesArr = validSizes.map(sz=>({
        value: sz.sku_code,
        label: `${sz.sku_size} (${sz.sku_total_quantity}件)`,
        size: sz.sku_size,
        locations: sz.locations||[]
      }));
      const newSizeOptions = { ...item.sizeOptions, [color]: sizesArr };
      return {
        ...item,
        display_code: item.product_code,
        product_name: item.product_name,
        sku_color: color,
        image_path: colorObj?.image_path || item.image_path,
        sku_code: '',
        sku_size: '',
        sku_total_quantity: null,
        sizeOptions: newSizeOptions,
        location_code: '',
        locationOptions: []
      };
    }));
  };
  const handleSkuChange = (key, skuCode) => {
    setTableData(prev => prev.map(item => {
      if (item.key !== key) return item;
      // find selected size object
      let selSizeObj=null;
      const colorArr = (item.colors||[]).find(c=>c.color===item.sku_color);
      if(colorArr){ selSizeObj = (colorArr.sizes||[]).find(sz=>sz.sku_code===skuCode); }
      const locOptsRaw = (selSizeObj?.locations||[]).filter(l=>l.stock_quantity>0);
      const locOpts = locOptsRaw.map(loc=>({ value: loc.location_code, label: `${loc.location_code} (${loc.stock_quantity}件)`, qty: loc.stock_quantity }));
      return {
        ...item,
        display_code: skuCode,
        sku_code: skuCode,
        sku_size: selSizeObj?.sku_size || '',
        sku_total_quantity: selSizeObj?.sku_total_quantity || 0,
        locationOptions: locOpts,
        location_code: locOpts[0]?.value || ''
      };
    }));
  };
  const handleLocationChange = (key, loc) => { setTableData(prev=>prev.map(i=>i.key===key?{...i, location_code:loc}:i)); };
  const handleQuantityChangeSimple = (key, qty) => {
    setTableData(prev=>prev.map(i=>i.key===key?{...i, stock_quantity:qty}:i));
  };
  const handleQuantityConfirm = (key, qty) => {
    setTableData(prev => {
      const list = [...prev];
      const idx = list.findIndex(i=>i.key===key);
      if (idx===-1) return prev;
      const item = list[idx];
      if (!item.locationOptions) { list[idx] = { ...item, stock_quantity: qty }; return list; }
      const currentLocObj = item.locationOptions.find(l=>l.value===item.location_code);
      const maxQty = currentLocObj?.qty || item.maxQuantity || 0;
      if (qty <= maxQty) { list[idx] = { ...item, stock_quantity: qty }; return list; }

      // 超出库存，按其它库位拆分
      let remaining = qty - maxQty;
      list[idx] = { ...item, stock_quantity: maxQty };

      const otherLocs = item.locationOptions.filter(l=>l.value!==item.location_code);
      for (const loc of otherLocs) {
        if (remaining<=0) break;
        const take = Math.min(remaining, loc.qty);
        if (take<=0) continue;
        remaining -= take;
        list.push({
          ...item,
          key: `${item.key}-${loc.value}-${Date.now()}`,
          location_code: loc.value,
          stock_quantity: take,
          maxQuantity: loc.qty,
          locationOptions: item.locationOptions
        });
      }
      if (remaining>0) {
        message.warning(`库存不足，仍有 ${remaining} 件超出可用库存`);
      }
      return list;
    });
  };
  const handleDelete = (key) => { setTableData(prev=>prev.filter(i=>i.key!==key)); };

  // 提交出库
  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      for (const item of tableData) {
        const payload = {
          sku_code: item.sku_code,
          location_code: item.location_code,
          outbound_quantity: Number(item.stock_quantity),
          operator_id: currentUser?.user_id,
          notes: '移动端出库操作'
        };
        const resp = await api.post('/outbound/', payload);

        const inventoryObj = resp.data?.inventory || resp.data?.data;
        if (inventoryObj) {
          const { sku_location_quantity, sku_total_quantity, outbound_quantity, sku_code } = inventoryObj;
          showResultModal({
            success: true,
            operation: '出库',
            sku_code: sku_code || item.sku_code,
            operation_quantity: outbound_quantity || Number(item.stock_quantity),
            sku_location_quantity,
            sku_total_quantity,
          });
        } else {
          showResultModal({
            success: true,
            operation: '出库',
            sku_code: item.sku_code,
            operation_quantity: Number(item.stock_quantity),
          });
        }
      }

      setTableData([]);
    } catch(err) {
      showResultModal({
        success: false,
        operation: '出库',
        sku_code: tableData.length === 1 ? tableData[0]?.sku_code : '',
        error_message: err.response?.data?.error_message || err.response?.data?.message || err.message,
      });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 8 }}>
      <MobileNavBar currentPage="outbound" />
      {/* 扫码条码 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <Input
            placeholder="商品条码或手动输入"
            value={inputCode}
            onChange={e=>setInputCode(e.target.value)}
            onPressEnter={handleScan}
            style={{ flex:1 }}
          />
          <Button type="primary" onClick={handleScan} loading={loading} style={{ minWidth:80 }}>确认</Button>
        </div>
      </div>
      {/* 列表头 & 操作区 */}
      <div style={{ padding:2,borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8 }}>
        <Text strong style={{ fontSize:16 }}>出库商品({tableData.length})</Text>
        <div style={{ display:'flex',alignItems:'center',gap:8,flex:1,justifyContent:'flex-end' }}>
          <Button type="primary" size="middle" disabled={!canSubmit} style={{ borderRadius:4,fontWeight:'normal',opacity:canSubmit?1:0.4 }} onClick={handleSubmit}>确认出库</Button>
        </div>
      </div>
      {/* 商品列表 */}
      <div style={{ flex:1,overflow:'auto',padding:12 }}>
        <List
          dataSource={tableData}
          renderItem={item => (
            <InboundItemCard
              key={item.key}
              item={item}
              locationOptions={locationOptions}
              onColorChange={handleColorChange}
              onSkuChange={handleSkuChange}
              onLocationChange={handleLocationChange}
              onQuantityChange={handleQuantityChangeSimple}
              onQuantityConfirm={handleQuantityConfirm}
              onDelete={handleDelete}
              allowCustomLocation={false}
            />
          )}
        />
      </div>
    </div>
  );
};

export default MobileOutbound; 