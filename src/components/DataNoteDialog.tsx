import { useId } from 'react';
import { Modal } from './Modal';

interface DataNoteDialogProps {
  onClose: () => void;
}

export function DataNoteDialog({ onClose }: DataNoteDialogProps) {
  const titleId = useId();
  return (
    <Modal onCancel={onClose} labelledBy={titleId} className="dialog dialog--note">
      <div className="dialog-head">
        <div>
          <p className="eyebrow">数据说明</p>
          <h2 id={titleId}>数据保存在哪里？</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="关闭数据说明" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="dialog-body prose">
        <p>任务和清单只保存在当前浏览器的本地存储中，不会上传到服务器。</p>
        <ul>
          <li>清除本站浏览器数据、更换浏览器或设备后，已有数据不会自动恢复。</li>
          <li>无痕 / 隐私模式中的数据可能不会保留。</li>
          <li>同一浏览器的多个标签页会同步最新保存的数据。</li>
          <li>首版没有账号、云同步和回收站。</li>
        </ul>
        <p className="muted">建议在重要数据场景中自行备份浏览器存储。</p>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" autoFocus onClick={onClose}>
          知道了
        </button>
      </div>
    </Modal>
  );
}
