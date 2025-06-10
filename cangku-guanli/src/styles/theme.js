// 应用主题配置
export const theme = {
  // 主色调
  primaryColor: '#1677ff',  // 蓝色
  successColor: '#52c41a',  // 绿色
  warningColor: '#faad14',  // 黄色
  errorColor: '#ff4d4f',    // 红色
  
  // 文本颜色
  textPrimary: '#000000d9',  // 主要文本
  textSecondary: '#00000073', // 次要文本
  textDisabled: '#00000040',  // 禁用文本
  
  // 背景颜色
  backgroundBase: '#f0f2f5',  // 基础背景
  backgroundLight: '#fafafa',  // 浅色背景
  backgroundWhite: '#ffffff',  // 白色背景
  
  // 边框颜色
  borderColor: '#d9d9d9',  // 边框颜色
  
  // 字体
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  
  // 圆角
  borderRadius: '4px',
  
  // 阴影
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  
  // 尺寸
  spacingXs: '4px',
  spacingSm: '6px',
  spacingMd: '10px',
  spacingLg: '14px',
  spacingXl: '20px',
  
  // 移动端专用
  mobilePadding: '6px',
  mobileCardSpacing: '4px',
  compactNavHeight: '42px',
  
  // 图标
  successIcon: '✓',
  errorIcon: '✕',
  warningIcon: '!'
};

// 生成样式工具函数
export const getStyle = (type) => {
  switch (type) {
    case 'card':
      return {
        borderRadius: theme.borderRadius,
        boxShadow: theme.boxShadow,
        backgroundColor: theme.backgroundWhite,
        padding: theme.spacingMd
      };
    case 'compactCard':
      return {
        borderRadius: theme.borderRadius,
        boxShadow: 'none',
        backgroundColor: theme.backgroundWhite,
        padding: theme.spacingSm,
        marginBottom: theme.mobileCardSpacing,
        border: `1px solid ${theme.borderColor}`
      };
    case 'button':
      return {
        borderRadius: theme.borderRadius,
        fontFamily: theme.fontFamily,
        fontSize: '14px',
        padding: `${theme.spacingXs} ${theme.spacingSm}`
      };
    case 'compactLayout':
      return {
        padding: '0px',
        margin: 0
      };
    case 'mobileContainer':
      return {
        padding: theme.mobilePadding,
        backgroundColor: theme.backgroundBase
      };
    case 'successMessage':
      return {
        content: `${theme.successIcon} `,
        color: theme.successColor,
        marginRight: '8px'
      };
    case 'successIconBtn':
      return {
        backgroundColor: theme.successColor,
        borderColor: theme.successColor
      };
    case 'searchBox':
      return {
        marginBottom: theme.spacingMd,
        display: 'flex',
        alignItems: 'center'
      };
    case 'listContainer':
      return {
        marginTop: theme.spacingSm,
        marginBottom: theme.spacingLg
      };
    case 'modal':
      return {
        top: 0,
        padding: 0,
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'auto'
      };
    case 'verticalButtons':
      return {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        width: '70px',
        gap: '2px'
      };
    case 'compactButton':
      return {
        width: '100%',
        textAlign: 'left',
        padding: '0 8px',
        height: '24px',
        fontSize: '12px'
      };
    default:
      return {};
  }
};

// 消息提示样式配置
export const messageConfig = {
  success: {
    icon: <span style={{ color: theme.successColor, marginRight: '8px' }}>{theme.successIcon}</span>,
    duration: 2
  },
  error: {
    icon: <span style={{ color: theme.errorColor, marginRight: '8px' }}>{theme.errorIcon}</span>,
    duration: 3
  },
  warning: {
    icon: <span style={{ color: theme.warningColor, marginRight: '8px' }}>{theme.warningIcon}</span>,
    duration: 3
  }
};

// 常用样式组合
export const combinedStyles = {
  successBtn: {
    ...getStyle('button'),
    ...getStyle('successIconBtn')
  },
  compactContainer: {
    ...getStyle('compactLayout'),
    ...getStyle('mobileContainer')
  },
  verticalCompactButtons: {
    ...getStyle('verticalButtons')
  }
};

export default theme; 