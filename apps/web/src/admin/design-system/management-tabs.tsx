'use client';
import { useState, type ReactNode } from 'react';
import { Tabs, Tab } from 'baseui/tabs';
/** Keep form state mounted while Base Web owns tab focus and keyboard navigation. */
export function ManagementTabs({
  panels,
}: {
  panels: { id: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState<React.Key>(panels[0]?.id ?? '');
  return (
    <Tabs
      activeKey={active}
      onChange={({ activeKey }) => setActive(activeKey)}
      renderAll
      overrides={{
        TabBar: { style: { backgroundColor: 'transparent', overflowX: 'auto' } },
        TabContent: { style: { paddingLeft: 0, paddingRight: 0, paddingTop: '20px' } },
        Tab: { style: { fontSize: '13px', paddingTop: '12px', paddingBottom: '12px' } },
      }}
    >
      {panels.map((panel) => (
        <Tab key={panel.id} title={panel.label}>
          {panel.content}
        </Tab>
      ))}
    </Tabs>
  );
}
