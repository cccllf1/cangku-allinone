import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { Button, List, Toast } from 'antd-mobile';

function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/locations/')
      .then(res => setLocations(res.data))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Navbar />
      <div style={{ padding: 16 }}>
        <h3>库位管理</h3>
        <Button color="primary" block onClick={() => Toast.show('新增库位功能待实现')}>新增库位</Button>
        {loading ? <div>加载中...</div> : (
          <List header="库位列表">
            {locations.length === 0 ? <List.Item>暂无库位</List.Item> :
              locations.map(item => (
                <List.Item key={item.id}>{item.name}（{item.code}）</List.Item>
              ))}
          </List>
        )}
      </div>
    </div>
  );
}

export default Locations;
