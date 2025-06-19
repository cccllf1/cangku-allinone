import React, { useState, useEffect } from 'react';
import { Card, Select, InputNumber, Button, Badge } from 'antd';
import { DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { getFullImageUrl } from '../utils/imageUtils';

/**
 * 入库管理 - 单条商品卡片
 * 结构：左侧图片，右侧表单（颜色 / 尺码 / 货位 / 数量）
 * 所有交互通过 props 向父组件回传，父组件负责真正更新 tableData。
 */
const InboundItemCard = ({
  item,
  locationOptions = [],
  onColorChange,
  onSkuChange,
  onLocationChange,
  onQuantityChange,
  onQuantityConfirm,
  onDelete,
  allowCustomLocation = true
}) => {
  // 根据是否已选颜色来选择尺码列表
  const sizeOpts = item.sku_color
    ? (item.sizeOptions?.[item.sku_color] || [])
    : Object.values(item.sizeOptions || {}).flat();

  // 本地数量缓冲，让用户确认后提交
  const [qty, setQty] = useState(item.stock_quantity || 1);

  useEffect(()=>{ setQty(item.stock_quantity || 1); }, [item.stock_quantity]);

  return (
    <Card
      size="small"
      bodyStyle={{ padding: 6 }}
      style={{ marginBottom: 6, border: '1px solid #eee', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {/* 图片区 */}
        <div style={{ width: 80, height: 80, position: 'relative', flex: '0 0 80px' }}>
          {item.image_path ? (
            <img
              src={getFullImageUrl(item.image_path)}
              alt={item.product_name || item.product_code}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 6,
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 12
              }}
            >
              无图
            </div>
          )}
          {/* 件数角标 */}
          <Badge
            count={item.stock_quantity}
            style={{ position: 'absolute', top: -4, left: -4, background: '#fff', color: '#666' }}
          />
        </div>

        {/* 表单区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* 商品编码 + 删除 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.display_code || item.product_code}
            </span>
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(item.key)} />
          </div>

          {/* 颜色 */}
          <Select
            placeholder="选择颜色"
            size="small"
            value={item.sku_color}
            onChange={(val) => onColorChange(item.key, val)}
            options={item.colorOptions}
          />

          {/* 尺码 */}
          <Select
            placeholder="选择尺码"
            size="small"
            value={item.sku_code}
            onChange={(val) => onSkuChange(item.key, val)}
            options={sizeOpts}
          />

          {/* 货位 + 数量 */}
          <div style={{ display: 'flex', gap: 4 }}>
            <Select
              {...(allowCustomLocation ? { mode: 'tags', showSearch: true } : { showSearch: false })}
              placeholder="选择货位"
              size="small"
              style={{ flex: 1 }}
              value={item.location_code}
              onChange={(val) => allowCustomLocation ? onLocationChange(item.key, val[val.length-1]) : onLocationChange(item.key, val)}
              options={allowCustomLocation ? (item.locationOptions && item.locationOptions.length>0 ? item.locationOptions : locationOptions) : (item.locationOptions || [])}
              disabled={!allowCustomLocation && (!item.locationOptions || item.locationOptions.length===0)}
              allowClear={false}
            />
            <InputNumber
              min={1}
              value={qty}
              onChange={(val) => setQty(val)}
              size="small"
              style={{ width: 70 }}
            />
            {onQuantityConfirm && (
              <Button
                icon={<CheckOutlined />}
                size="small"
                type="primary"
                onClick={() => onQuantityConfirm(item.key, qty)}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InboundItemCard; 