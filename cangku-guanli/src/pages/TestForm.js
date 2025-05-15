import React from 'react';
import { Modal, Form, Input, Button } from 'antd';

export default function TestForm() {
  const [visible, setVisible] = React.useState(false);
  const [form] = Form.useForm();

  return (
    <div style={{padding:24}}>
      <Button onClick={() => setVisible(true)}>弹窗</Button>
      <Modal open={visible} onOk={async () => {
        const values = await form.validateFields();
        alert(JSON.stringify(values));
        setVisible(false);
      }} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="货位编码" rules={[{ required: true }]}> <Input /> </Form.Item>
        </Form>
      </Modal>
    </div>
  );
} 