import React from 'react';
import { Modal } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

/**
 * 弹出操作结果弹窗（入库/出库/盘点）
 * @param {Object} options
 * @param {boolean} options.success - 是否成功
 * @param {string} options.operation - 操作名称，如"入库"、"出库"、"盘点"
 * @param {string} [options.sku_code] - SKU编码
 * @param {number} [options.operation_quantity] - 本次操作数量
 * @param {number} [options.sku_location_quantity] - SKU当前库位库存
 * @param {number} [options.sku_total_quantity] - SKU所有库位总库存
 * @param {string} [options.error_message] - 失败时的错误信息
 */
export function showResultModal({
  success = true,
  operation = '',
  sku_code = '',
  operation_quantity = undefined,
  sku_location_quantity = undefined,
  sku_total_quantity = undefined,
  error_message = '',
}) {
  // 1. Modal 标题固定为 "XX结果"
  const title = `${operation}结果`;

  // 2. 第一行：操作成功 / 失败（带图标，放在内容而非标题里）
  const resultLine = success ? (
    <p key="result" style={{ color: '#52c41a' }}>
      <CheckCircleOutlined style={{ marginRight: 4 }} />
      {operation}成功
    </p>
  ) : (
    <p key="result" style={{ color: '#ff4d4f' }}>
      <CloseCircleOutlined style={{ marginRight: 4 }} />
      {operation}失败
    </p>
  );

  // 3. 其他行动态拼装
  const lines = [resultLine];

  if (sku_code) {
    lines.push(<p key="sku">SKU编码：{sku_code}</p>);
  }

  if (typeof operation_quantity === 'number') {
    lines.push(<p key="op_qty">本次{operation}数量：{operation_quantity}</p>);
  }

  if (typeof sku_location_quantity === 'number') {
    lines.push(<p key="loc_qty">SKU当前库位库存：{sku_location_quantity}</p>);
  }

  if (typeof sku_total_quantity === 'number') {
    lines.push(<p key="total_qty">SKU所有库位总库存：{sku_total_quantity}</p>);
  }

  // 如果失败且有错误信息，追加
  if (!success && error_message) {
    lines.push(
      <p key="err" style={{ color: '#ff4d4f' }}>{error_message}</p>
    );
  }

  return Modal.info({
    maskClosable: false,
    okText: '确认',
    title,
    content: <div style={{ fontSize: 16 }}>{lines}</div>,
  });
}

export default showResultModal; 