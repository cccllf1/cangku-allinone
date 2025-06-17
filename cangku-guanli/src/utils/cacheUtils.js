// 缓存工具函数
const CACHE_PREFIX = 'wms_cache_';
const DEFAULT_EXPIRE_TIME = 30 * 60 * 1000; // 30分钟

// 设置缓存
export const setCache = (key, data, expireTime = DEFAULT_EXPIRE_TIME) => {
  const cacheData = {
    data,
    timestamp: Date.now(),
    expireTime
  };
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
};

// 获取缓存
export const getCache = (key) => {
  try {
    const cacheString = localStorage.getItem(CACHE_PREFIX + key);
    if (!cacheString) return null;

    const cache = JSON.parse(cacheString);
    const now = Date.now();
    
    // 检查是否过期
    if (now - cache.timestamp > cache.expireTime) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return cache.data;
  } catch (error) {
    console.error('读取缓存失败:', error);
    return null;
  }
};

// 清除缓存
export const clearCache = (key) => {
  if (key) {
    localStorage.removeItem(CACHE_PREFIX + key);
  } else {
    // 清除所有以 CACHE_PREFIX 开头的缓存
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
};

// 更新缓存过期时间
export const updateCacheExpireTime = (key) => {
  try {
    const cacheString = localStorage.getItem(CACHE_PREFIX + key);
    if (!cacheString) return;

    const cache = JSON.parse(cacheString);
    cache.timestamp = Date.now();
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cache));
  } catch (error) {
    console.error('更新缓存过期时间失败:', error);
  }
}; 