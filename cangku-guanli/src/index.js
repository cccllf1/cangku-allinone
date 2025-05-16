import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './mobile.css'; // 引入移动端样式

const root = createRoot(document.getElementById('root'));
root.render(<App />); 