import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'antd-mobile/es/global';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
