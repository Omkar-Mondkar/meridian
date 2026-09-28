import React from 'react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'roster',   label: 'Roster'   },
  { id: 'tasks',    label: 'Tasks'    },
] as const;

export type TabId = typeof TABS[number]['id'];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Dashboard sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab${activeTab === t.id ? ' active' : ''}`}
          data-tab={t.id}
          role="tab"
          aria-selected={activeTab === t.id}
          aria-controls={`view-${t.id}`}
          id={`tab-${t.id}`}
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
