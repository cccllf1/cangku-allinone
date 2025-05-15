import React, { useState } from 'react';
import { Modal, Form, Input, Button } from 'antd';
import 'antd/dist/reset.css';

function App() {
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();

  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => setVisible(true)}>弹窗</Button>
      <Modal open={visible} onOk={async () => {
        const values = await form.validateFields();
        alert(JSON.stringify(values));
        setVisible(false);
      }} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="货位编码" rules={[{ required: true }]}> <Input placeholder="货位编码" /> </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default App;
