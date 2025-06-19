import React from 'react';
import { Card, Select, InputNumber, Button, Badge } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { getFullImageUrl } from '../utils/imageUtils';

/**
 * 出库管理 - 单条商品卡片
 * props:
 * - item: outbound list object { key, productName, skuColor, skuSize, image/skuImage, quantity, maxQuantity, location, availableLocations }
 * - onLocationChange, onQuantityChange, onDelete
 */
const OutboundItemCard = ({ item, onLocationChange, onQuantityChange, onDelete }) => {
  const img = item.skuImage || item.image;
  return (
    <Card size="small" bodyStyle={{ padding: 6 }} style={{ marginBottom: 6, border: '1px solid #eee', borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {/* 图片 */}
        <div style={{ width: 80, height: 80, position: 'relative', flex: '0 0 80px' }}>
          {img ? (
            <img src={getFullImageUrl(img)} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: 6, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>无图</div>
          )}
          <Badge count={item.quantity} style={{ position: 'absolute', top: -4, left: -4, background: '#fff', color: '#666' }} />
        </div>

        {/* 信息区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* 标题行 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.productName} {item.skuColor && item.skuSize ? `(${item.skuColor}-${item.skuSize})` : ''}
            </span>
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(item.key)} />
          </div>

          {/* 货位 + 数量 */}
          <div style={{ display: 'flex', gap: 4 }}>
            <Select
              placeholder="选择货位"
              size="small"
              style={{ flex: 1 }}
              value={item.location}
              onChange={(val) => onLocationChange(item.key, val)}
              options={(item.availableLocations || []).map(loc => ({ value: loc.value, label: loc.label }))}
            />
            <InputNumber
              min={1}
              max={item.maxQuantity}
              size="small"
              value={item.quantity}
              onChange={(val) => onQuantityChange(item.key, val)}
              style={{ width: 70 }}
            />
          </div>
          {/* 最大提示 */}
          <span style={{ fontSize: 12, color: '#888' }}>可用: {item.maxQuantity}</span>
        </div>
      </div>
    </Card>
  );
};

export default OutboundItemCard; 