// Popup界面逻辑
document.addEventListener('DOMContentLoaded', function() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusInfo = document.getElementById('statusInfo');
    const toggleBtn = document.getElementById('toggleBtn');
    const openPdaBtn = document.getElementById('openPdaBtn');
    const testBtn = document.getElementById('testBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const connectionModeSelect = document.getElementById('connectionMode');
    const apiUrlInput = document.getElementById('apiUrl');
    const pollIntervalInput = document.getElementById('pollInterval');
    const pollIntervalContainer = document.getElementById('pollIntervalContainer');
    const appendTypeSelect = document.getElementById('appendType');
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const recentDataList = document.getElementById('recentDataList');
    
    // 获取并显示插件状态
    function updateStatus() {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
            if (response) {
                if (response.enabled) {
                    statusDot.classList.remove('disabled');
                    
                    // 显示连接类型
                    let connectionText = '';
                    let connectionInfo = '';
                    
                    switch(response.connectionType) {
                        case 'websocket':
                            connectionText = '✅ 已启用 (WebSocket)';
                            connectionInfo = `🔗 实时连接 | 已接收 ${response.lastResultCount} 条记录`;
                            break;
                        case 'polling':
                            connectionText = '✅ 已启用 (轮询)';
                            connectionInfo = `🔄 轮询模式 | 已接收 ${response.lastResultCount} 条记录`;
                            break;
                        case 'disconnected':
                            connectionText = '⚠️ 已启用 (未连接)';
                            connectionInfo = '🔌 正在尝试连接到PDA服务器...';
                            break;
                        default:
                            connectionText = '✅ 已启用';
                            connectionInfo = `已接收 ${response.lastResultCount} 条扫码记录`;
                    }
                    
                    statusText.textContent = connectionText;
                    statusInfo.textContent = connectionInfo;
                    toggleBtn.textContent = '🔴 禁用插件';
                } else {
                    statusDot.classList.add('disabled');
                    statusText.textContent = '❌ 已禁用';
                    statusInfo.textContent = '插件已暂停，不会接收扫码数据';
                    toggleBtn.textContent = '🟢 启用插件';
                }
            }
        });
    }
    
    // 切换插件启用状态
    toggleBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED' }, (response) => {
            if (response) {
                updateStatus();
                
                // 显示反馈
                const feedback = response.enabled ? '插件已启用，正在连接...' : '插件已禁用';
                showFeedback(feedback);
            }
        });
    });
    
    // 打开PDA页面
    openPdaBtn.addEventListener('click', function() {
        chrome.tabs.create({ 
            url: 'http://192.168.11.252:8610/pda-app.html',
            active: true
        });
        window.close();
    });
    
    // 测试连接并获取最新数据
    testBtn.addEventListener('click', function() {
        testBtn.textContent = '🔄 测试中...';
        testBtn.disabled = true;
        
        // 首先获取当前设置
        chrome.storage.sync.get(['apiUrl'], function(result) {
            const apiUrl = result.apiUrl || 'http://192.168.11.252:8611';
            
            // 同时测试API和WebSocket
            Promise.all([
                testApiConnection(apiUrl),
                testWebSocketConnection(apiUrl)
            ]).then(([apiResult, wsResult]) => {
                let message = '';
                if (apiResult.success && wsResult.success) {
                    message = '✅ API和WebSocket都可用';
                } else if (apiResult.success) {
                    message = '⚠️ API可用，WebSocket不可用（将使用轮询）';
                } else {
                    message = '❌ 无法连接到PDA服务器';
                }
                
                if (apiResult.success) {
                    const count = apiResult.count || 0;
                    const latestBarcode = apiResult.latestBarcode;
                    
                    if (latestBarcode) {
                        // 复制最新条码到剪贴板
                        navigator.clipboard.writeText(latestBarcode).then(() => {
                            message += `\n📋 最新条码已复制: ${latestBarcode}`;
                            statusInfo.textContent = `服务器有 ${count} 条记录，最新: ${latestBarcode}`;
                        }).catch(() => {
                            message += `\n📱 最新条码: ${latestBarcode}`;
                            statusInfo.textContent = `服务器有 ${count} 条记录，最新: ${latestBarcode}`;
                        });
                    } else {
                        statusInfo.textContent = `服务器有 ${count} 条记录，暂无数据`;
                    }
                }
                
                showFeedback(message);
            }).finally(() => {
                testBtn.textContent = '📋 测试并获取最新';
                testBtn.disabled = false;
            });
        });
    });
    
    // 测试API连接
    function testApiConnection(apiUrl = 'http://192.168.11.252:8611') {
        const fullApiUrl = apiUrl + '/api/scan-results';
        return fetch(fullApiUrl)
            .then(response => response.json())
            .then(data => {
                let latestBarcode = null;
                if (data.success && data.results && data.results.length > 0) {
                    // 按时间排序获取最新的条码
                    const sortedResults = data.results.sort((a, b) => 
                        new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp)
                    );
                    latestBarcode = sortedResults[0].barcode;
                }
                return {
                    success: data.success,
                    count: data.results?.length || 0,
                    latestBarcode: latestBarcode
                };
            })
            .catch(() => ({ success: false }));
    }
    
    // 测试WebSocket连接
    function testWebSocketConnection(apiUrl = 'http://192.168.11.252:8611') {
        return new Promise((resolve) => {
            // 将http://替换为ws://构建WebSocket URL
            const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/scan-notifications';
            const testWs = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
                testWs.close();
                resolve({ success: false });
            }, 3000); // 3秒超时
            
            testWs.onopen = () => {
                clearTimeout(timeout);
                testWs.close();
                resolve({ success: true });
            };
            
            testWs.onerror = () => {
                clearTimeout(timeout);
                resolve({ success: false });
            };
        });
    }
    
    // 显示反馈信息
    function showFeedback(message) {
        const originalInfo = statusInfo.textContent;
        statusInfo.textContent = message;
        statusInfo.style.color = '#48bb78';
        
        setTimeout(() => {
            statusInfo.textContent = originalInfo;
            statusInfo.style.color = '#718096';
        }, 2000);
    }
    
    // 显示/隐藏设置面板
    settingsBtn.addEventListener('click', function() {
        if (settingsPanel.style.display === 'none') {
            loadSettings();
            settingsPanel.style.display = 'block';
            settingsBtn.textContent = '❌ 关闭设置';
        } else {
            settingsPanel.style.display = 'none';
            settingsBtn.textContent = '⚙️ 设置';
        }
    });
    
    // 保存设置
    saveSettingsBtn.addEventListener('click', function() {
        const apiUrl = apiUrlInput.value.trim();
        const pollInterval = parseFloat(pollIntervalInput.value) || 2;
        
        if (!apiUrl) {
            showFeedback('❌ 请输入API地址');
            return;
        }
        
        // 验证URL格式
        try {
            new URL(apiUrl);
        } catch (e) {
            showFeedback('❌ API地址格式不正确');
            return;
        }
        
        // 验证轮询间隔
        if (pollInterval < 0 || pollInterval > 60) {
            showFeedback('❌ 轮询间隔设置无效');
            return;
        }
        
        const settings = {
            apiUrl: apiUrl,
            pollInterval: pollInterval,
            appendType: appendTypeSelect.value,
            connectionMode: connectionModeSelect.value
        };
        
        chrome.storage.sync.set(settings, function() {
            chrome.runtime.sendMessage({ 
                type: 'UPDATE_SETTINGS', 
                settings: settings 
            });
            showFeedback('✅ 设置已保存，正在重新连接...');
            setTimeout(() => {
                settingsPanel.style.display = 'none';
                settingsBtn.textContent = '⚙️ 设置';
                updateStatus();
            }, 1500);
        });
    });
    
    // 重置设置
    resetSettingsBtn.addEventListener('click', function() {
        const defaultSettings = {
            apiUrl: 'http://192.168.11.252:8611',
            pollInterval: 10,
            appendType: 'none',
            connectionMode: 'websocket'
        };
        
        chrome.storage.sync.set(defaultSettings, function() {
            loadSettings();
            chrome.runtime.sendMessage({ 
                type: 'UPDATE_SETTINGS', 
                settings: defaultSettings 
            });
            showFeedback('✅ 设置已重置为默认值');
        });
    });
    
    // 加载设置
    function loadSettings() {
        chrome.storage.sync.get(['apiUrl', 'pollInterval', 'appendType', 'connectionMode'], function(result) {
            connectionModeSelect.value = result.connectionMode || 'websocket';
            apiUrlInput.value = result.apiUrl || 'http://192.168.11.252:8611';
            pollIntervalInput.value = result.pollInterval || 10;
            appendTypeSelect.value = result.appendType || 'none';
            
            // 根据连接模式显示/隐藏轮询设置
            updatePollIntervalVisibility();
        });
    }
    
    // 连接模式变化时更新界面
    connectionModeSelect.addEventListener('change', function() {
        updatePollIntervalVisibility();
    });
    
    // 根据连接模式显示/隐藏轮询设置
    function updatePollIntervalVisibility() {
        const isPollingMode = connectionModeSelect.value === 'polling';
        pollIntervalContainer.style.opacity = isPollingMode ? '1' : '0.5';
        pollIntervalInput.disabled = !isPollingMode;
        
        if (!isPollingMode) {
            document.getElementById('pollIntervalHint').textContent = 'WebSocket模式下无需轮询，实时接收数据';
        } else {
            document.getElementById('pollIntervalHint').textContent = '设置轮询间隔以检查新的扫码数据';
        }
    }
    
    // 刷新数据列表
    refreshDataBtn.addEventListener('click', function() {
        loadRecentData();
    });
    
    // 加载最近的数据
    function loadRecentData() {
        refreshDataBtn.textContent = '🔄 加载中...';
        refreshDataBtn.disabled = true;
        
        chrome.storage.sync.get(['apiUrl'], function(result) {
            const apiUrl = result.apiUrl || 'http://192.168.11.252:8611';
            const fullApiUrl = apiUrl + '/api/scan-results';
            
            fetch(fullApiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.results) {
                        // 按时间倒序排列，取最新的5条
                        const sortedResults = data.results
                            .sort((a, b) => new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp))
                            .slice(0, 5);
                        displayRecentData(sortedResults);
                    } else {
                        recentDataList.innerHTML = '<div style="text-align: center; color: #f56565; font-size: 12px; padding: 20px;">获取数据失败</div>';
                    }
                })
                .catch(error => {
                    console.error('加载数据失败:', error);
                    recentDataList.innerHTML = '<div style="text-align: center; color: #f56565; font-size: 12px; padding: 20px;">连接服务器失败</div>';
                })
                .finally(() => {
                    refreshDataBtn.textContent = '🔄 刷新';
                    refreshDataBtn.disabled = false;
                });
        });
    }
    
    // 显示最近的数据
    function displayRecentData(dataList) {
        if (!dataList || dataList.length === 0) {
            recentDataList.innerHTML = '<div style="text-align: center; color: #718096; font-size: 12px; padding: 20px;">暂无数据</div>';
            return;
        }
        
        recentDataList.innerHTML = '';
        
        dataList.forEach((item, index) => {
            const dataItem = document.createElement('div');
            dataItem.className = 'data-item';
            dataItem.innerHTML = `
                <div class="data-barcode">#${index + 1} ${item.barcode}</div>
                <div class="data-time">${item.time || item.timestamp}</div>
            `;
            
            // 点击复制功能
            dataItem.addEventListener('click', function(event) {
                navigator.clipboard.writeText(item.barcode).then(() => {
                    showCopyFeedback(event.target, '已复制!');
                }).catch(() => {
                    showCopyFeedback(event.target, '复制失败');
                });
            });
            
            recentDataList.appendChild(dataItem);
        });
    }
    
    // 显示复制反馈
    function showCopyFeedback(element, message) {
        const feedback = document.createElement('div');
        feedback.className = 'copy-feedback';
        feedback.textContent = message;
        
        const rect = element.getBoundingClientRect();
        feedback.style.left = rect.left + 'px';
        feedback.style.top = (rect.top - 30) + 'px';
        
        document.body.appendChild(feedback);
        
        // 显示动画
        setTimeout(() => {
            feedback.style.opacity = '1';
        }, 10);
        
        // 隐藏并移除
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 200);
        }, 1500);
    }
    
    // 页面加载时更新状态和数据
    updateStatus();
    loadRecentData();
    
    // 根据设置的间隔更新状态和数据
    function startAutoRefresh() {
        chrome.storage.sync.get(['pollInterval'], function(result) {
            const interval = parseFloat(result.pollInterval) || 10;
            
            if (interval > 0) {
                setInterval(() => {
                    updateStatus();
                    
                    // 检查扩展是否启用，只有启用时才自动刷新数据
                    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
                        if (response && response.enabled) {
                            loadRecentData();
                        }
                    });
                }, interval * 1000);
                
                console.log(`📊 自动刷新已启动，间隔 ${interval} 秒`);
            } else {
                console.log('📊 仅手动刷新模式，不自动发送请求');
            }
        });
    }
    
    startAutoRefresh();
}); 