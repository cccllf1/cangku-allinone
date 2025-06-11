// PDA扫码助手后台脚本 - WebSocket版本
console.log('PDA扫码助手后台脚本已启动');

// 默认配置
let PDA_API_URL = 'http://192.168.11.252:8611/api/scan-results';
let PDA_WS_URL = 'ws://192.168.11.252:8611/ws/scan-results'; // WebSocket地址
let CONNECTION_MODE = 'websocket'; // 连接模式: 'websocket' 或 'polling'
let POLL_INTERVAL = 10000; // 10秒轮询间隔（默认平衡模式）
let APPEND_TYPE = 'none'; // 附加内容类型
const RECONNECT_INTERVAL = 5000; // 5秒重连间隔

let websocket = null;
let isEnabled = true;
let lastResultCount = 0;
let reconnectTimer = null;
let lastProcessedBarcode = null; // 记录最后处理的条码

// 建立WebSocket连接
function connectWebSocket() {
  if (!isEnabled) return;
  
  try {
    console.log('正在连接WebSocket...');
    websocket = new WebSocket(PDA_WS_URL);
    
    websocket.onopen = function(event) {
      console.log('✅ WebSocket连接已建立');
      clearTimeout(reconnectTimer);
      
      // 连接成功后获取一次当前状态
      fetchCurrentResults();
    };
    
    websocket.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('📱 收到WebSocket消息:', data);
        
        if (data.type === 'NEW_SCAN_RESULT' && data.barcode) {
          // 收到新的扫码结果
          sendToActiveTab(data.barcode);
          lastResultCount++;
        } else if (data.type === 'SCAN_RESULTS_CLEARED') {
          // 扫码记录被清空
          lastResultCount = 0;
          console.log('📋 扫码记录已清空');
        } else if (data.barcode) {
          // 兼容简单的barcode消息格式
          sendToActiveTab(data.barcode);
          lastResultCount++;
        }
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
      }
    };
    
    websocket.onerror = function(error) {
      console.error('❌ WebSocket连接错误:', error);
    };
    
    websocket.onclose = function(event) {
      console.log('🔌 WebSocket连接已关闭，代码:', event.code);
      websocket = null;
      
      // 如果插件仍然启用，则尝试重连
      if (isEnabled) {
        console.log(`⏱️ ${RECONNECT_INTERVAL/1000}秒后尝试重连...`);
        reconnectTimer = setTimeout(connectWebSocket, RECONNECT_INTERVAL);
      }
    };
    
  } catch (error) {
    console.error('创建WebSocket连接失败:', error);
    // 如果WebSocket不可用，回退到轮询模式
    console.log('🔄 回退到轮询模式...');
    startPolling();
  }
}

// 断开WebSocket连接
function disconnectWebSocket() {
  if (websocket) {
    console.log('断开WebSocket连接...');
    websocket.close();
    websocket = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// 获取当前扫码结果（用于初始化）
async function fetchCurrentResults() {
  try {
    const response = await fetch(PDA_API_URL);
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      lastResultCount = data.results.length;
      // 记录最新的条码，避免重复处理
      lastProcessedBarcode = data.results[0].barcode;
      console.log(`📊 初始化完成，当前有 ${lastResultCount} 条记录，最新条码: ${lastProcessedBarcode}`);
    } else {
      lastResultCount = 0;
      lastProcessedBarcode = null;
      console.log('📊 初始化完成，暂无数据');
    }
  } catch (error) {
    console.log('获取当前扫码结果失败:', error);
    lastResultCount = 0;
    lastProcessedBarcode = null;
  }
}

// 发送扫码数据到当前活动的标签页
async function sendToActiveTab(barcode) {
  // 如果扩展被禁用，不发送数据
  if (!isEnabled) {
    console.log('🚫 扩展已禁用，不发送扫码数据');
    return;
  }
  
  try {
    // 获取当前活动的标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (activeTab) {
      // 先ping一下content script确保它已准备好
      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'PING' });
        if (!response?.ready) {
          console.log('⚠️ Content script未准备好，等待...');
          // 等待一下再重试
          setTimeout(() => sendToActiveTab(barcode), 1000);
          return;
        }
      } catch (error) {
        console.log('⚠️ Content script不存在，注入并重试...');
        // 尝试注入content script
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
        // 等待注入完成再重试
        setTimeout(() => sendToActiveTab(barcode), 500);
        return;
      }
      
      // 发送消息到内容脚本
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'PDA_SCAN_RESULT',
        barcode: barcode,
        appendType: APPEND_TYPE,
        timestamp: new Date().toISOString(),
        source: websocket ? 'websocket' : 'polling'
      });
      
      console.log('📤 扫码数据已发送到标签页:', activeTab.title, '成功:', response?.success);
    }
  } catch (error) {
    console.log('发送到标签页失败:', error.message);
  }
}

// 轮询模式（WebSocket不可用时的备用方案）
let pollTimer = null;

async function pollPDAResults() {
  if (!isEnabled) return;
  
  try {
    const response = await fetch(PDA_API_URL);
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      // 检查是否有新数据：数量增加或最新条码变化
      const currentLatestBarcode = data.results[0].barcode;
      const currentCount = data.results.length;
      
      if (currentCount > lastResultCount || 
          (currentLatestBarcode !== lastProcessedBarcode)) {
        
        console.log('📱 检测到新的扫码数据:', data.results[0]);
        
        // 发送最新的条码
        sendToActiveTab(currentLatestBarcode);
        
        // 更新状态
        lastResultCount = currentCount;
        lastProcessedBarcode = currentLatestBarcode;
        
        console.log(`🎯 已发送新扫码到浏览器: ${currentLatestBarcode}`);
      }
    } else if (data.success && data.results && data.results.length === 0) {
      // 如果服务器数据被清空，重置状态
      if (lastResultCount > 0) {
        console.log('📋 服务器数据已清空');
        lastResultCount = 0;
        lastProcessedBarcode = null;
      }
    }
  } catch (error) {
    console.log('轮询PDA API失败:', error);
  }
}

function startPolling() {
  if (POLL_INTERVAL > 0) {
    console.log(`🔄 启动轮询模式，间隔 ${POLL_INTERVAL/1000} 秒...`);
    pollTimer = setInterval(pollPDAResults, POLL_INTERVAL);
    // 立即执行一次
    pollPDAResults();
  } else {
    console.log('📋 仅手动模式，不启动自动轮询');
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('⏹️ 已停止轮询');
  }
}

// 启动连接
function startConnection() {
  console.log('🚀 启动PDA扫码助手...');
  if (CONNECTION_MODE === 'websocket') {
    console.log('📡 使用WebSocket模式...');
    connectWebSocket();
  } else {
    console.log('🔄 使用轮询模式...');
    startPolling();
  }
}

// 停止连接
function stopConnection() {
  console.log('⏹️ 停止PDA扫码助手...');
  disconnectWebSocket();
  stopPolling();
}

// 加载设置
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUrl', 'pollInterval', 'appendType', 'connectionMode'], function(result) {
      if (result.apiUrl) {
        const baseUrl = result.apiUrl.replace(/\/+$/, ''); // 移除末尾斜杠
        PDA_API_URL = baseUrl + '/api/scan-results';
        PDA_WS_URL = baseUrl.replace(/^http/, 'ws') + '/ws/scan-results';
      }
      if (result.pollInterval !== undefined) {
        POLL_INTERVAL = parseFloat(result.pollInterval) * 1000; // 转换为毫秒
      }
      if (result.appendType) {
        APPEND_TYPE = result.appendType;
      }
      if (result.connectionMode) {
        CONNECTION_MODE = result.connectionMode;
      }
      console.log(`📊 配置已加载: 连接模式=${CONNECTION_MODE}, API=${PDA_API_URL}, WS=${PDA_WS_URL}, 轮询间隔=${POLL_INTERVAL/1000}秒, 附加内容=${APPEND_TYPE}`);
      resolve();
    });
  });
}

// 重新启动连接（用于设置更新后）
function restartConnection() {
  console.log('🔄 重新启动连接...');
  stopConnection();
  setTimeout(() => {
    if (isEnabled) {
      startConnection();
    }
  }, 1000);
}

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    const connectionStatus = websocket && websocket.readyState === WebSocket.OPEN ? 'websocket' : 
                           pollTimer ? 'polling' : 'disconnected';
    
    sendResponse({ 
      enabled: isEnabled,
      lastResultCount: lastResultCount,
      connectionType: connectionStatus
    });
  } else if (message.type === 'TOGGLE_ENABLED') {
    isEnabled = !isEnabled;
    console.log('PDA扫码助手', isEnabled ? '已启用' : '已禁用');
    
    if (isEnabled) {
      startConnection();
    } else {
      stopConnection();
    }
    
    sendResponse({ enabled: isEnabled });
  } else if (message.type === 'UPDATE_SETTINGS') {
    // 更新设置并重新连接
    loadSettings().then(() => {
      restartConnection();
    });
    sendResponse({ success: true });
  }
});

// 扩展安装或启动时开始连接
chrome.runtime.onStartup.addListener(() => {
  loadSettings().then(startConnection);
});
chrome.runtime.onInstalled.addListener(() => {
  loadSettings().then(startConnection);
});

// 立即开始连接
loadSettings().then(startConnection);

// 监听浏览器窗口激活事件，确保重连
chrome.windows.onFocusChanged.addListener(function(windowId) {
  if (windowId !== chrome.windows.WINDOW_ID_NONE && isEnabled) {
    // 浏览器窗口被激活，检查连接状态
    setTimeout(() => {
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.log('🔄 浏览器窗口激活，检查并重连WebSocket...');
        if (CONNECTION_MODE === 'websocket') {
          connectWebSocket();
        }
      }
    }, 1000); // 延迟1秒确保网络稳定
  }
}); 