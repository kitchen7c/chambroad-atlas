import { useTranslation } from 'react-i18next';

export type TabType = 'chat' | 'sources' | 'articles';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { t } = useTranslation();

  const tabs: { id: TabType; label: string }[] = [
    { id: 'chat', label: t('tabs.chat', 'Chat') },
    { id: 'sources', label: t('tabs.sources', 'Sources') },
    { id: 'articles', label: t('tabs.articles', 'Articles') },
  ];

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
