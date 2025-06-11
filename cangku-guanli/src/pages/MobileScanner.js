import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Card, notification, Input, Space } from 'antd';
import { ScanOutlined, ClearOutlined, WifiOutlined } from '@ant-design/icons';
import './MobileScanner.css';

const { Title, Text } = Typography;

const MobileScanner = () => {
  const [scannedCode, setScannedCode] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [connectionMode, setConnectionMode] = useState('');
  const inputRef = useRef(null);

  // 检查URL参数并自动连接
  useEffect(() => {
    try {
      // 兼容老浏览器的URL参数解析
      var search = window.location.search;
      var room = null;
      var type = null;
      
      if (search) {
        var params = search.substring(1).split('&');
        for (var i = 0; i < params.length; i++) {
          var pair = params[i].split('=');
          if (pair[0] === 'room') {
            room = decodeURIComponent(pair[1]);
          } else if (pair[0] === 'type') {
            type = decodeURIComponent(pair[1]);
          }
        }
      }
      
      if (room && type) {
        setRoomId(room);
        setConnectionMode(type);
        setIsConnected(true);
        notification.success({
          message: '连接成功',
          description: '已连接到房间: ' + room,
          duration: 3
        });
      }
    } catch (error) {
      console.error('URL参数解析失败:', error);
    }
  }, []);

  // 页面加载后自动聚焦到输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  // 处理扫码输入
  const handleScanInput = function(e) {
    var code = e.target.value.trim();
    if (code) {
      setScannedCode(code);
      
      // 添加到扫码历史
      setScanHistory(function(prev) {
        var newHistory = [code].concat(prev.slice(0, 9)); // 保留最近10条
        return newHistory;
      });
      
      // 如果已连接，发送到手机端
      if (isConnected && connectionMode === 'pda-inbound') {
        sendScanResultToPhone(code);
      }
      
      notification.success({
        message: '扫码成功',
        description: '条码: ' + code,
        duration: 2
      });
      
      // 清空输入框并重新聚焦
      setTimeout(function() {
        e.target.value = '';
        e.target.focus();
      }, 100);
    }
  };

  // 发送扫码结果到手机端
  const sendScanResultToPhone = function(code) {
    try {
      console.log('发送扫码结果到房间 ' + roomId + ':', code);
      
      // 这里实际需要调用API或WebSocket发送到手机端
      // 目前先模拟
      notification.success({
        message: '已发送到手机',
        description: '条码已发送: ' + code,
        duration: 2
      });
      
      // 实际调用示例:
      // fetch('/api/scan-share', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ room: roomId, code: code })
      // });
      
    } catch (error) {
      console.error('发送失败:', error);
      notification.error({
        message: '发送失败',
        description: '无法发送到手机端',
        duration: 2
      });
    }
  };

  // 手动输入处理
  const handleManualInput = function(value) {
    setScannedCode(value);
  };

  // 手动确认扫码
  const handleManualConfirm = function() {
    if (scannedCode) {
      handleScanInput({ target: { value: scannedCode } });
    }
  };

  // 清空历史
  const clearHistory = function() {
    setScanHistory([]);
    setScannedCode('');
    notification.info('已清空扫码历史');
  };

  return (
    <div className="mobile-scanner">
      <div className="scanner-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          <ScanOutlined /> PDA扫码器
        </Title>
        <Text style={{ color: '#ccc' }}>
          {isConnected ? 
            '✅ 已连接房间: ' + roomId : 
            '请用PDA扫手机二维码连接'
          }
        </Text>
      </div>

      <div className="scanner-content">
        {/* 扫码输入区域 */}
        <Card className="scan-input-card">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong style={{ fontSize: '16px' }}>
              扫码输入区域
            </Text>
            <Text style={{ color: '#666', fontSize: '12px' }}>
              请将光标保持在下方输入框中，使用扫码枪扫描商品条码
            </Text>
            <Input
              ref={inputRef}
              placeholder="扫码枪扫码后会自动填入..."
              onPressEnter={handleScanInput}
              size="large"
              style={{ 
                fontSize: '18px', 
                textAlign: 'center',
                backgroundColor: '#f0f8f0'
              }}
              autoFocus
            />
            
            {/* 手动输入备用 */}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
              <Text style={{ fontSize: '12px', color: '#999' }}>
                手动输入（备用）:
              </Text>
              <div style={{ display: 'flex', marginTop: '8px' }}>
                <Input
                  placeholder="手动输入条码"
                  value={scannedCode}
                  onChange={function(e) { handleManualInput(e.target.value); }}
                  style={{ marginRight: '8px' }}
                />
                <Button 
                  type="primary" 
                  onClick={handleManualConfirm}
                  disabled={!scannedCode}
                >
                  确认
                </Button>
              </div>
            </div>
          </Space>
        </Card>

        {/* 连接状态 */}
        {isConnected && (
          <Card className="connection-status-card">
            <div style={{ textAlign: 'center' }}>
              <WifiOutlined style={{ color: '#52c41a', fontSize: '24px' }} />
              <div style={{ marginTop: '8px' }}>
                <Text strong style={{ color: '#52c41a' }}>
                  已连接到手机端
                </Text>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  扫码结果会自动发送到手机
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 扫码历史 */}
        {scanHistory.length > 0 && (
          <Card 
            title="扫码历史" 
            className="history-card"
            extra={
              <Button 
                size="small" 
                icon={<ClearOutlined />}
                onClick={clearHistory}
              >
                清空
              </Button>
            }
          >
            <div className="scan-history">
              {scanHistory.map(function(code, index) {
                return (
                  <div key={index} className="history-item">
                    <Text code style={{ fontSize: '14px' }}>
                      {code}
                    </Text>
                    <Text style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                      #{scanHistory.length - index}
                    </Text>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 使用说明 */}
        <Card className="help-card">
          <Title level={5}>使用说明</Title>
          <ul className="help-list">
            <li>用PDA扫手机二维码建立连接</li>
            <li>确保光标在扫码输入框中</li>
            <li>使用扫码枪扫描商品条码</li>
            <li>扫码结果会自动发送到手机端</li>
            <li>支持连续扫码，无需重复操作</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default MobileScanner; 