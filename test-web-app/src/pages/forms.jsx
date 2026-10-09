import { useState } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';
import { languages } from '../settings.mjs';

const Forms = () => {
  const { t } = useLab();
  const { checks, check } = useChecks(['submit', 'reset']);
  const [name, setName] = useState(''); const [contact, setContact] = useState('');
  const [country, setCountry] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    check('submit', { ...Object.fromEntries(data), interests: data.getAll('interests') });
  };
  return <><Task>{t('formsTask')}</Task><div className="two-columns"><form className="panel" onSubmit={submit} onReset={() => {
    setName(''); setContact(''); setCountry(''); check('reset', true);
  }}><div className="panel-title"><span className="eyebrow">HTML + REACT</span><h2>{t('requiredFields')}</h2></div>
    <div className="field-grid"><label>{t('name')} *<input name="name" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></label>
      <label>{t('email')} *<input name="email" type="email" required autoComplete="off" /></label>
      <label>{t('password')}<input name="password" type="password" autoComplete="off" minLength={4} /></label>
      <label>{t('quantity')}<input name="quantity" type="number" min="1" max="100" step="1" /></label>
      <label>{t('date')}<input name="date" type="date" /></label><label>{t('time')}<input name="time" type="time" /></label>
      <label>{t('datetime')}<input name="datetime" type="datetime-local" /></label><label>{t('month')}<input name="month" type="month" /></label>
      <label>{t('week')}<input name="week" type="week" /></label><label>{t('color')}<input name="color" type="color" /></label>
      <label>{t('country')} *<select name="country" required value={country} onChange={(event) => setCountry(event.target.value)}>
        <option value="">{t('choose')}</option>{['DE', 'FR', 'ES', 'CN', 'JP', 'IR', 'IN', 'RU'].map((code) => <option key={code}>{code}</option>)}</select></label>
      <label>{t('region')} *<select name="region" required disabled={!country} key={country}><option value="">{t('choose')}</option>
        {country && [1, 2, 3].map((value) => <option key={value} value={`${country}-${value}`}>{country} / {value}</option>)}</select></label>
    </div><fieldset><legend>{t('contact')} *</legend>{['email', 'phone'].map((value) => <label className="check-label" key={value}>
      <input type="radio" name="contact" value={value} required checked={contact === value} onChange={() => setContact(value)} />{t(value)}</label>)}</fieldset>
    {contact === 'phone' && <label>{t('phone')} *<input name="phone" type="tel" required /></label>}
    <label>{t('multiSelect')}<select name="interests" multiple size={4}><option value="" disabled>{t('choose')}</option>
      {languages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>{t('message')}<textarea name="message" rows={3} /></label><label className="check-label"><input type="checkbox" name="terms" required />{t('terms')}</label>
    <div className="button-row"><button className="primary" type="submit">{t('submit')}</button><button type="reset">{t('reset')}</button></div>
  </form><div><Result value={checks.submit} /><details className="panel native-controls"><summary>{t('details')}</summary><p>{t('fixtureNotice')}</p>
    <input aria-label={t('name')} disabled /><input aria-label={t('email')} readOnly /><progress max="2" value={Object.keys(checks).length} /></details></div></div></>;
};
export default Forms;
