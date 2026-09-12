import React from 'react';
import { Modal, Input, Button, message } from 'antd';
import api from '../../services/api';

function MailPreviewModal({ open, onClose, event, contact }) {
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  React.useEffect(() => {
    if (!open || !event) return;
    setLoading(true);
    api.post('/api/mail/preview', { eventId: event.id, contactId: contact?.id || event.contact_id, event, contact })
      .then((resp) => {
        const data = resp.data.data;
        setPreview(data);
        setSubject(data.subject || '');
        setBody(data.body || '');
      })
      .catch(() => message.error('邮件预览生成失败'))
      .finally(() => setLoading(false));
  }, [open, event?.id]);

  const refreshPreview = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/mail/preview', {
        eventId: event.id,
        contactId: contact?.id || event.contact_id,
        event: { ...event, mail_subject: subject },
        contact,
        bodyOverride: body,
      });
      setPreview(data.data);
    } catch {
      message.error('预览刷新失败');
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!event?.id) return;
    try {
      await api.put(`/api/mail/events/${event.id}/draft`, { subject, body });
      message.success('邮件草稿已保存');
      onClose?.();
    } catch {
      message.error('保存失败');
    }
  };

  return (
    <Modal
      title="邮件实时预览"
      open={open}
      onCancel={onClose}
      width={920}
      footer={[
        <Button key="refresh" onClick={refreshPreview} loading={loading}>刷新预览</Button>,
        <Button key="save" type="primary" onClick={saveDraft}>保存草稿</Button>,
      ]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">主题</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">正文微调</label>
            <Input.TextArea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <div className="bg-slate-100 rounded-xl p-4 overflow-auto max-h-[520px]">
          <div dangerouslySetInnerHTML={{ __html: preview?.html || '<div style="padding:32px;color:#94a3b8;">正在生成预览...</div>' }} />
        </div>
      </div>
    </Modal>
  );
}

export default MailPreviewModal;
