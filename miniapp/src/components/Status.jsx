export function Spinner({ label = 'Загрузка…' }) {
  return (
    <div className="state" role="status">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state" role="alert">
      <p className="state-title">Не получилось загрузить</p>
      <p>{message}</p>
      {onRetry ? <button type="button" className="btn btn-ghost" onClick={onRetry}>Повторить</button> : null}
    </div>
  );
}

export function OrderStatus({ status }) {
  return status === 'ready'
    ? <span className="pill pill-ready">Готов</span>
    : <span className="pill pill-processing">Собираем</span>;
}
