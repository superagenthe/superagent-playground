export function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>正在读取本地数据…</p>
    </div>
  );
}
