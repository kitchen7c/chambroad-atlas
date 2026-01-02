import { useTranslation } from 'react-i18next';

interface ViewHeaderProps {
  title: string;
  onBack: () => void;
  rightAction?: {
    label: string;
    onClick: () => void;
  };
}

export function ViewHeader({ title, onBack, rightAction }: ViewHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="view-header">
      <button className="view-header-back" onClick={onBack} title={t('common.back')}>
        ←
      </button>
      <h1 className="view-header-title">{title}</h1>
      {rightAction && (
        <button className="view-header-action" onClick={rightAction.onClick}>
          {rightAction.label}
        </button>
      )}
    </div>
  );
}
