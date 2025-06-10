import React from 'react';
import { message } from 'antd';

// 成功消息，带有绿色对勾
export const successMessage = (content) => {
  message.success({
    content: content,
    icon: <span style={{ color: '#52c41a', marginRight: '8px' }}>✓</span>
  });
};

// 错误消息，带有红色感叹号
export const errorMessage = (content) => {
  message.error({
    content: content,
    icon: <span style={{ color: '#ff4d4f', marginRight: '8px' }}>!</span>
  });
};

// 警告消息，带有黄色感叹号
export const warningMessage = (content) => {
  message.warning({
    content: content,
    icon: <span style={{ color: '#faad14', marginRight: '8px' }}>!</span>
  });
};

// 信息消息，带有蓝色信息图标
export const infoMessage = (content) => {
  message.info({
    content: content,
    icon: <span style={{ color: '#1890ff', marginRight: '8px' }}>i</span>
  });
};

export default {
  success: successMessage,
  error: errorMessage,
  warning: warningMessage,
  info: infoMessage
}; 