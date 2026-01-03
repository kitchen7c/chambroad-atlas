import { useTranslation } from 'react-i18next';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

export function Toggle({ label, checked, onChange, disabled, hint }: ToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="toggle-container">
      <span className="toggle-label">{label}</span>
      <div className="toggle-control">
        <button
          type="button"
          className={`toggle-option ${!checked ? 'active' : ''}`}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          {t('browserTools.off', 'Off')}
        </button>
        <button
          type="button"
          className={`toggle-option ${checked ? 'active' : ''}`}
          onClick={() => onChange(true)}
          disabled={disabled}
        >
          {t('browserTools.on', 'On')}
        </button>
      </div>
      {hint && <span className="toggle-hint">{hint}</span>}
    </div>
  );
}
