import { useState } from 'react';
import { api } from '../lib/api.js';
import { detectBrand, formatExpiry, formatNumber, validateCard } from '../lib/cards.js';
import { haptic } from '../lib/telegram.js';

export default function CardForm({ onAdded, onCancel }) {
  const [form, setForm] = useState({ number: '', holder: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const brand = detectBrand(form.number);

  const set = (field, format = (v) => v) => (e) => {
    setForm((f) => ({ ...f, [field]: format(e.target.value) }));
    setErrors((er) => ({ ...er, [field]: undefined, form: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const { errors: found, card } = validateCard(form);
    if (Object.keys(found).length) { haptic.error(); setErrors(found); return; }
    setSaving(true);
    try {
      const saved = await api('/api/cards', { method: 'POST', body: card });
      haptic.success();
      onAdded(saved);
    } catch (error) {
      haptic.error();
      setErrors({ form: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card-form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Номер карты <em>{form.number ? brand.name : ''}</em></span>
        <input inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
               value={form.number} onChange={set('number', formatNumber)} aria-invalid={Boolean(errors.number)} />
        {errors.number ? <small className="error">{errors.number}</small> : null}
      </label>
      <label className="field">
        <span>Имя на карте</span>
        <input autoComplete="cc-name" placeholder="IVAN IVANOV" value={form.holder}
               onChange={set('holder', (v) => v.toUpperCase())} aria-invalid={Boolean(errors.holder)} />
        {errors.holder ? <small className="error">{errors.holder}</small> : null}
      </label>
      <div className="field-row">
        <label className="field">
          <span>Срок</span>
          <input inputMode="numeric" autoComplete="cc-exp" placeholder="ММ/ГГ" value={form.expiry}
                 onChange={set('expiry', formatExpiry)} aria-invalid={Boolean(errors.expiry)} />
          {errors.expiry ? <small className="error">{errors.expiry}</small> : null}
        </label>
        <label className="field">
          <span>CVC</span>
          <input inputMode="numeric" autoComplete="cc-csc" type="password" placeholder="•••" value={form.cvc}
                 onChange={set('cvc', (v) => v.replace(/\D/g, '').slice(0, brand.cvc))} aria-invalid={Boolean(errors.cvc)} />
          {errors.cvc ? <small className="error">{errors.cvc}</small> : null}
        </label>
      </div>
      {errors.form ? <p className="error" role="alert">{errors.form}</p> : null}
      <p className="hint">Демо-режим: деньги не списываются. Тестовая карта — 4242 4242 4242 4242.</p>
      <div className="form-actions">
        {onCancel ? <button type="button" className="btn btn-ghost" onClick={onCancel}>Отмена</button> : null}
        <button type="submit" className="btn btn-secondary" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить карту'}</button>
      </div>
    </form>
  );
}
