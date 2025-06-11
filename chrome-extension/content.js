// PDA扫码助手内容脚本
console.log('PDA扫码助手内容脚本已加载');

// 标记扩展是否已激活
let isExtensionReady = false;
let lastBarcodeData = null;

// 初始化扩展
function initializeExtension() {
  console.log('🚀 初始化PDA扫码助手...');
  isExtensionReady = true;
  
  // 通知后台脚本content script已准备就绪
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {
    // 如果发送失败也不影响功能
  });
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  // 如果页面已经加载完成，立即初始化
  initializeExtension();
}

// 确保在页面完全加载后再次初始化
window.addEventListener('load', () => {
  if (!isExtensionReady) {
    initializeExtension();
  }
});

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 收到消息:', message.type);
  
  if (message.type === 'PDA_SCAN_RESULT') {
    // 检查扩展是否启用
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.enabled) {
        console.log('📱 扩展已启用，处理扫码数据:', message.barcode);
        lastBarcodeData = message.barcode;
        
        // 立即尝试插入
        const success = insertBarcodeAtCursor(message.barcode, message.appendType);
        sendResponse({ success: success });
        
        // 如果第一次失败，等待一下再试
        if (!success) {
          setTimeout(() => {
            insertBarcodeAtCursor(message.barcode, message.appendType);
          }, 500);
        }
      } else {
        console.log('🚫 扩展已禁用，忽略扫码数据');
        sendResponse({ success: false, reason: 'extension_disabled' });
      }
    });
  } else if (message.type === 'PING') {
    sendResponse({ ready: isExtensionReady });
  }
  
  return true; // 保持消息通道开放
});

// 在光标位置插入扫码数据
window.insertBarcodeAtCursor = function insertBarcodeAtCursor(barcode, appendType = 'none') {
  console.log('🎯 尝试插入扫码数据:', barcode, '附加内容:', appendType);
  
  const activeElement = document.activeElement;
  
  // 检查当前焦点元素是否是可输入的
  if (isInputElement(activeElement)) {
    console.log('✅ 在当前焦点元素插入:', activeElement.tagName);
    insertIntoInputElement(activeElement, barcode, appendType);
    return true;
  } else {
    // 如果没有焦点的输入框，尝试找到页面中的第一个可见输入框
    const inputElement = findFirstVisibleInput();
    if (inputElement) {
      console.log('🔍 找到输入框，自动聚焦:', inputElement.tagName);
      inputElement.focus();
      // 等待聚焦完成
      setTimeout(() => {
        insertIntoInputElement(inputElement, barcode, appendType);
      }, 100);
      return true;
    } else {
      console.log('❌ 未找到可用的输入框');
      // 如果找不到输入框，显示通知
      showNotification(barcode);
      return false;
    }
  }
}

// 检查元素是否是可输入的
function isInputElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  const type = element.type ? element.type.toLowerCase() : '';
  
  // 检查是否是文本输入框
  if (tagName === 'input' && (
    type === 'text' || 
    type === 'search' || 
    type === 'url' || 
    type === 'tel' || 
    type === 'email' || 
    type === 'password' || 
    type === 'number' ||
    type === '' // 默认类型
  )) {
    return true;
  }
  
  // 检查是否是文本区域
  if (tagName === 'textarea') {
    return true;
  }
  
  // 检查是否是可编辑的div
  if (element.contentEditable === 'true') {
    return true;
  }
  
  return false;
}

// 在输入元素中插入文本
function insertIntoInputElement(element, text, appendType = 'none') {
  const tagName = element.tagName.toLowerCase();
  
  // 根据附加类型添加后缀
  let finalText = text;
  switch (appendType) {
    case 'enter':
      finalText = text + '\n';
      break;
    case 'tab':
      finalText = text + '\t';
      break;
    case 'newline':
      finalText = text + '\r\n';
      break;
    case 'none':
    default:
      finalText = text;
      break;
  }
  
  if (tagName === 'input' || tagName === 'textarea') {
    // 对于input和textarea元素
    const startPos = element.selectionStart;
    const endPos = element.selectionEnd;
    const currentValue = element.value;
    
    // 在光标位置插入文本
    const newValue = currentValue.substring(0, startPos) + finalText + currentValue.substring(endPos);
    element.value = newValue;
    
    // 设置新的光标位置
    const newCursorPos = startPos + finalText.length;
    element.setSelectionRange(newCursorPos, newCursorPos);
    
    // 触发input事件，确保页面响应输入
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // 如果是回车，还要触发提交相关事件
    if (appendType === 'enter' || appendType === 'newline') {
      setTimeout(() => {
        element.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Enter', 
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true 
        }));
        element.dispatchEvent(new KeyboardEvent('keypress', { 
          key: 'Enter', 
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true 
        }));
        element.dispatchEvent(new KeyboardEvent('keyup', { 
          key: 'Enter', 
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true 
        }));
      }, 100);
    }
    
  } else if (element.contentEditable === 'true') {
    // 对于可编辑的div元素
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // 删除选中的内容
    range.deleteContents();
    
    // 插入新文本
    const textNode = document.createTextNode(finalText);
    range.insertNode(textNode);
    
    // 将光标移动到插入文本的末尾
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // 触发input事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // 显示成功提示
  showSuccessAnimation(element);
  console.log(`✅ 已插入: "${finalText}" (附加类型: ${appendType})`);
}

// 查找页面中第一个可见的输入框
function findFirstVisibleInput() {
  const selectors = [
    'input[type="text"]',
    'input[type="search"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[type="email"]',
    'input[type="number"]',
    'input:not([type])',
    'textarea',
    '[contenteditable="true"]'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isElementVisible(element) && !element.disabled && !element.readOnly) {
        return element;
      }
    }
  }
  
  return null;
}

// 检查元素是否可见
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    element.offsetParent !== null
  );
}

// 显示通知
function showNotification(barcode) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #4299e1, #3182ce);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 600;
    max-width: 300px;
    word-break: break-all;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="margin-bottom: 8px;">📱 PDA扫码结果</div>
    <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 5px; font-family: monospace;">
      ${barcode}
    </div>
    <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
      未找到输入框，数据已复制到剪贴板
    </div>
  `;
  
  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // 复制到剪贴板
  navigator.clipboard.writeText(barcode).catch(() => {
    console.log('复制到剪贴板失败');
  });
  
  // 3秒后自动消失
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// 显示成功动画
function showSuccessAnimation(element) {
  const originalBorder = element.style.border;
  element.style.border = '2px solid #48bb78';
  element.style.boxShadow = '0 0 10px rgba(72, 187, 120, 0.5)';
  
  setTimeout(() => {
    element.style.border = originalBorder;
    element.style.boxShadow = '';
  }, 1000);
}

// 页面点击时，如果有未处理的扫码数据，尝试重新插入
document.addEventListener('click', (event) => {
  if (lastBarcodeData && isInputElement(event.target)) {
    // 检查扩展是否启用
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.enabled) {
        console.log('🖱️ 检测到点击输入框，插入最新扫码数据');
        setTimeout(() => {
          // 获取当前设置的附加类型，如果没有则默认为none
          chrome.storage.sync.get(['appendType'], function(result) {
            const appendType = result.appendType || 'none';
            insertIntoInputElement(event.target, lastBarcodeData, appendType);
            lastBarcodeData = null; // 清除已使用的数据
          });
        }, 100);
      } else {
        console.log('🚫 扩展已禁用，不插入数据');
        lastBarcodeData = null; // 清除数据
      }
    });
  }
});

// 监听输入框获得焦点
document.addEventListener('focusin', (event) => {
  if (lastBarcodeData && isInputElement(event.target)) {
    // 检查扩展是否启用
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.enabled) {
        console.log('🎯 检测到输入框获得焦点，插入最新扫码数据');
        setTimeout(() => {
          // 获取当前设置的附加类型，如果没有则默认为none
          chrome.storage.sync.get(['appendType'], function(result) {
            const appendType = result.appendType || 'none';
            insertIntoInputElement(event.target, lastBarcodeData, appendType);
            lastBarcodeData = null; // 清除已使用的数据
          });
        }, 100);
      } else {
        console.log('🚫 扩展已禁用，不插入数据');
        lastBarcodeData = null; // 清除数据
      }
    });
  }
}); 