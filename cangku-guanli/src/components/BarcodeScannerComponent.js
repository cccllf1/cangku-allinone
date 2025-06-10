import React, { useRef, useState, useEffect } from 'react';
import { Button, message, Modal, Input, Space, Typography, Card } from 'antd';
import { ScanOutlined, CloseCircleOutlined, SwapOutlined, QrcodeOutlined, ExclamationCircleOutlined, EditOutlined } from '@ant-design/icons';
import jsQR from 'jsqr';

const { Text, Link } = Typography;

const BarcodeScannerComponent = ({ onScan, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manualInputVisible, setManualInputVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [iOSDevice, setIOSDevice] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // 检查浏览器支持
  const checkBrowserSupport = () => {
    // 检测是否为iOS设备
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIOSDevice(isIOS);
    
    // 检测是否为Safari浏览器
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('此浏览器不支持相机功能，请使用手动输入');
      message.error('此浏览器不支持相机功能，请使用手动输入');
      setManualInputVisible(true);
      return false;
    }
    return true;
  };

  // 初始化相机设备列表
  useEffect(() => {
    const getDevices = async () => {
      if (!checkBrowserSupport()) return;
      
      try {
        // 在iOS上，我们可能需要先请求相机权限
        if (iOSDevice) {
          try {
            const constraints = {
              video: {
                facingMode: 'environment', // 优先使用后置摄像头
              }
            };
            
            const tempStream = await navigator.mediaDevices.getUserMedia(constraints);
            tempStream.getTracks().forEach(track => track.stop());
            
            // iOS Safari特殊处理
            if (isSafari) {
              message.info('Safari浏览器需要您允许相机权限');
            }
          } catch (err) {
            console.error('iOS相机权限请求失败:', err);
            setError('无法获取相机权限，请在设置中允许浏览器访问相机');
            setPermissionDenied(true);
            setManualInputVisible(true);
            return;
          }
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          setError('没有检测到相机设备，请使用手动输入');
          setManualInputVisible(true);
          return;
        }
        
        setDevices(videoDevices);
        
        // 默认选择后置摄像头（如果有的话）
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('环境') ||
          device.label.toLowerCase().includes('rear')
        );
        setSelectedDevice(backCamera || videoDevices[0]);
      } catch (err) {
        console.error('获取相机设备失败:', err);
        setError('获取相机设备失败，请使用手动输入');
        setManualInputVisible(true);
      }
    };
    
    getDevices();
    
    return () => {
      stopCamera();
    };
  }, [iOSDevice, isSafari]);

  // 当选择设备变化时启动相机
  useEffect(() => {
    if (selectedDevice) {
      startCamera();
    }
  }, [selectedDevice]);

  // 启动相机
  const startCamera = async () => {
    if (!selectedDevice || !checkBrowserSupport()) return;
    
    try {
      // 停止之前的流
      if (stream) {
        stopCamera();
      }
      
      // 针对iOS的特殊处理
      const constraints = {
        video: {
          deviceId: selectedDevice.deviceId ? { exact: selectedDevice.deviceId } : undefined,
          facingMode: 'environment', // 优先使用后置摄像头
        }
      };
      
      // 对于iOS，不要指定太高的分辨率
      if (iOSDevice) {
        // iPhone上使用较低的分辨率以提高性能
        constraints.video.width = { ideal: 640 };
        constraints.video.height = { ideal: 480 };
      } else {
        constraints.video.width = { ideal: 1280 };
        constraints.video.height = { ideal: 720 };
      }
      
      // 获取相机流
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', true); // 确保在iOS Safari内联播放
        videoRef.current.setAttribute('autoplay', true);
        
        // 在iOS上需要明确调用play，并处理自动播放限制
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('视频播放失败:', error);
            // 显示播放按钮或提示用户点击屏幕
            setError('点击屏幕启动相机');
          });
        }
      }
      
      // 开始扫描
      setScanning(true);
      setTimeout(scanBarcode, 500); // 减少延迟时间，加快首次扫描
    } catch (err) {
      console.error('启动相机失败:', err);
      setError(`启动相机失败: ${err.message || '未知错误'}`);
      message.error(`启动相机失败，请检查相机权限设置`);
      setPermissionDenied(true);
      setManualInputVisible(true);
    }
  };

  // 停止相机
  const stopCamera = () => {
    setScanning(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // 切换相机设备
  const switchCamera = () => {
    if (devices.length <= 1) return;
    
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice.deviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDevice(devices[nextIndex]);
  };

  // 扫描条码
  const scanBarcode = () => {
    if (!videoRef.current || !canvasRef.current || !stream || !scanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        // 绘制视频帧到Canvas
        const ctx = canvas.getContext('2d');
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 使用jsQR库解析QR码
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        
        if (code) {
          // 找到QR码
          console.log("扫描到条码:", code.data);
          if (onScan) {
            onScan(code.data);
            stopCamera();
            return;
          }
        }
      } catch (err) {
        console.error("条码解析错误:", err);
        // 发生错误但继续尝试
      }
      
      // 继续扫描
      if (scanning) {
        setTimeout(scanBarcode, 100);
      }
    } else {
      // 视频还没准备好，等待一下再试
      setTimeout(scanBarcode, 200);
    }
  };

  // 打开手动输入
  const handleManualInput = () => {
    stopCamera();
    setManualInputVisible(true);
  };
  
  // 提交手动输入的条码
  const submitManualCode = () => {
    if (!manualCode) {
      message.warning('请输入条码');
      return;
    }
    
    onScan(manualCode);
  };

  // 重试相机
  const retryCamera = () => {
    setError(null);
    setPermissionDenied(false);
    setManualInputVisible(false);
    checkBrowserSupport();
    startCamera();
  };

  // 关闭组件
  const handleClose = () => {
    stopCamera();
    if (onClose) {
      onClose();
    }
  };

  // 处理视频点击
  const handleVideoClick = () => {
    if (error && error.includes('点击屏幕')) {
      // 用户点击视频时尝试再次播放
      if (videoRef.current) {
        videoRef.current.play().catch(err => {
          console.error('播放视频失败:', err);
          setError('无法启动相机，请尝试重新打开或手动输入');
          setManualInputVisible(true);
        });
      }
      setError(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {!manualInputVisible ? (
        <>
          {/* 相机视图 */}
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden', backgroundColor: '#000' }}>
            <video
              ref={videoRef}
              style={{ 
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onClick={handleVideoClick}
              playsInline
              autoPlay
            ></video>
            
            {/* 扫描区域指示 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              height: '20%',
              border: '2px solid #fff',
              borderRadius: '8px',
              boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)',
              zIndex: 10
            }}></div>
            
            {/* 扫描提示 */}
            <div style={{
              position: 'absolute',
              top: '25%',
              left: '0',
              width: '100%',
              textAlign: 'center',
              color: '#fff',
              padding: '8px',
              fontSize: '14px',
              zIndex: 10,
              textShadow: '0 0 4px rgba(0,0,0,0.7)'
            }}>
              将条码放入扫描框内
            </div>
            
            {/* 错误提示 */}
            {error && (
              <div style={{
                position: 'absolute',
                bottom: '20%',
                left: '0',
                width: '100%',
                textAlign: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: '#ff4d4f',
                padding: '8px',
                fontSize: '14px',
                zIndex: 20
              }}>
                <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                {error}
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </div>
          
          {/* 底部控制栏 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px', 
            backgroundColor: '#f0f0f0',
            borderTop: '1px solid #ddd'
          }}>
            <Button onClick={handleClose} icon={<CloseCircleOutlined />}>
              取消
            </Button>
            
            <Space>
              {devices.length > 1 && (
                <Button 
                  type="primary" 
                  icon={<SwapOutlined />} 
                  onClick={switchCamera}
                >
                  切换相机
                </Button>
              )}
              
              <Button 
                type="primary" 
                icon={<EditOutlined />}
                onClick={handleManualInput}
              >
                手动输入
              </Button>
            </Space>
          </div>
        </>
      ) : (
        /* 手动输入界面 */
        <Card 
          title="手动输入条码" 
          bordered={false}
          style={{ width: '100%' }}
          extra={<Button type="link" onClick={handleClose}>关闭</Button>}
        >
          {permissionDenied && (
            <div style={{ marginBottom: 16, backgroundColor: '#fff2e8', padding: 12, borderRadius: 4 }}>
              <Text type="warning">
                <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                相机权限被拒绝。您可以:
              </Text>
              <ul style={{ marginTop: 8, paddingLeft: 24 }}>
                <li style={{ marginBottom: 4 }}>在浏览器设置中允许相机访问</li>
                {iOSDevice && (
                  <li style={{ marginBottom: 4 }}>在iOS设置 &gt; Safari &gt; 相机中授权</li>
                )}
                <li>或使用下方手动输入条码</li>
              </ul>
              <Button 
                type="primary" 
                onClick={retryCamera} 
                style={{ marginTop: 8 }}
              >
                重试相机
              </Button>
            </div>
          )}
          
          <Input
            placeholder="请输入商品条码"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onPressEnter={submitManualCode}
            suffix={
              <Button 
                type="primary" 
                onClick={submitManualCode}
              >
                确认
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
          
          <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
            提示: 您可以直接输入商品编码或外部条码
          </div>
        </Card>
      )}
    </div>
  );
};

export default BarcodeScannerComponent; 