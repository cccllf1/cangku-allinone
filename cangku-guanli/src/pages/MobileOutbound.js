import React, { useEffect, useState, useCallback } from 'react';
import { Button, Input, message, List, Select, Typography } from 'antd';
const { Text } = Typography;
import api from '../api/auth';
import { getCurrentUser } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import MobileNavBar from '../components/MobileNavBar';
import InboundItemCard from '../components/InboundItemCard';
import { getCache, setCache } from '../utils/cacheUtils';

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
    try {
      setLoading(true);
      
      // 查询商品信息 - 统一的查询逻辑
      let productData = null;
      try {
        // 1) 若含 '-' 当作 SKU 直接查 /products/code
        if (code.includes('-')) {
          const skuRes = await api.get(`/api/products/code/${code}`);
          productData = skuRes?.data?.data;
        } else {
          // 2) 先查商品码
          const prodRes = await api.get(`/api/products/code/${code}`);
          productData = prodRes?.data?.data;
        }
      } catch (err) {
        if (err.response && err.response.status === 404 && !code.includes('-')) {
          // 3) 商品码404时查外部条码
          try {
            const extRes = await api.get(`/api/products/external-code/${code}`);
            productData = extRes?.data?.data;
          } catch (err2) {
            // 外部条码也404
          }
        }
      }
      
      if (!productData) { 
        message.warning('未找到商品'); 
        return; 
      }
      
      const product = productData;

      // 调用聚合库存接口获取颜色→尺码→库位结构
      let colorsArray = [];
      try {
        const invRes = await api.get('products', { params: { search: product.product_code, page_size: 1 } });
        colorsArray = invRes.data.data?.products?.[0]?.colors || [];
      } catch {}

      if (colorsArray.length === 0 && product.skus) {
        // fallback 同入库逻辑
        const map = {};
        product.skus.forEach(sku => {
          const col = sku.sku_color || '默认颜色';
          if (!map[col]) map[col] = { color: col, image_path: sku.image_path || '', sizes: [] };
          map[col].sizes.push({ sku_size: sku.sku_size, sku_code: sku.sku_code, sku_total_quantity: 0, locations: [] });
        });
        colorsArray = Object.values(map);
      }

      colorsArray = colorsArray.filter(col => (col.sizes||[]).some(sz => (sz.locations||[]).some(l=>l.stock_quantity>0)));

      const colorOptions = colorsArray.map(c => ({ value: c.color, label: c.color, image_path: c.image_path }));
      const sizeOptions = {};
      colorsArray.forEach(c => {
        const validSizes = (c.sizes||[]).filter(sz => (sz.locations||[]).some(l=>l.stock_quantity>0));
        sizeOptions[c.color] = validSizes.map(sz => ({
          value: sz.sku_code,
          label: `${sz.sku_size} (${sz.sku_code})`,
          size: sz.sku_size,
          locations: sz.locations || []
        }));
      });

      // === 自动选中颜色和尺码逻辑（和入库保持一致） ===
      let autoColor='', autoSkuCode='', autoSize='', autoLoc='';
      
      // 1. 如果API返回了matched_sku（SKU编码查询 或 SKU级外部条码查询）
      if (product.matched_sku) {
        autoColor = product.matched_sku.sku_color;
        autoSkuCode = product.matched_sku.sku_code;
        autoSize = product.matched_sku.sku_size;
        // 查找对应的库位信息
        const colorObj = colorsArray.find(c => c.color === autoColor);
        const sizeObj = colorObj?.sizes?.find(s => s.sku_code === autoSkuCode);
        const availableLocs = sizeObj?.locations?.filter(l => l.stock_quantity > 0) || [];
        autoLoc = availableLocs[0]?.location_code || '';
      }
      // 2. 如果原始扫描是完整SKU格式（包含'-'）
      else if (code.includes('-')) {
        const parts = code.split('-');
        if (parts.length >= 3) {
          const targetColor = parts[1];
          const targetSkuCode = code;
          const targetSize = parts.slice(2).join('-');
          
          // 查找对应的库位信息
          const colorObj = colorsArray.find(c => c.color === targetColor);
          const sizeObj = colorObj?.sizes?.find(s => s.sku_code === targetSkuCode);
          const availableLocs = sizeObj?.locations?.filter(l => l.stock_quantity > 0) || [];
          
          if (availableLocs.length > 0) {
            autoColor = targetColor;
            autoSkuCode = targetSkuCode;
            autoSize = targetSize;
            autoLoc = availableLocs[0].location_code;
          }
        }
      }
      
      // 3. 如果没有匹配的SKU，默认选第一有库存的 color/size/location
      if (!autoSkuCode) {
        const firstColor = colorsArray.find(c=> (c.sizes||[]).some(sz=> (sz.locations||[]).some(l=>l.stock_quantity>0)) ) || colorsArray[0];
        if (firstColor) {
          autoColor = firstColor.color;
          const firstSize = (firstColor.sizes||[]).find(sz=> (sz.locations||[]).some(l=>l.stock_quantity>0)) || firstColor.sizes?.[0];
          if (firstSize) {
            autoSkuCode = firstSize.sku_code;
            autoSize = firstSize.sku_size;
            autoLoc = firstSize.locations?.[0]?.location_code || '';
          }
        }
      }

      setTableData(prev => [...prev, {
        key: Date.now().toString(),
        product_id: product.product_id,
        product_code: product.product_code,
        product_name: product.product_name,
        sku_code: autoSkuCode,
        sku_color: autoColor,
        sku_size: autoSize,
        stock_quantity: 1,
        location_code: autoLoc,
        image_path: firstColor?.image_path || product.image_path || '',
        colorOptions,
        sizeOptions,
        colors: colorsArray
      }]);
      setInputCode('');
    } catch (err) {
      message.error('查询失败');
    } finally { setLoading(false); }
  }, [inputCode]);

  // 表格项处理
  const handleColorChange = (key, color) => {
    setTableData(prev => prev.map(item => {
      if (item.key !== key) return item;
      const colorObj = (item.colors||[]).find(c=>c.color===color);
      const validSizes = (colorObj?.sizes||[]).filter(sz=> (sz.locations||[]).some(l=>l.stock_quantity>0));
      const sizesArr = validSizes.map(sz=>({
        value: sz.sku_code,
        label: `${sz.sku_size} (${sz.sku_code})`,
        size: sz.sku_size,
        locations: sz.locations||[]
      }));
      const newSizeOptions = { ...item.sizeOptions, [color]: sizesArr };
      return {
        ...item,
        sku_color: color,
        sku_code: '',
        sku_size: '',
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
        sku_code: skuCode,
        sku_size: selSizeObj?.sku_size || '',
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
        await api.post('/outbound/', payload);
      }
      message.success('出库成功');
      setTableData([]);
    } catch(err) {
      message.error('出库失败: '+(err.response?.data?.message||err.message));
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