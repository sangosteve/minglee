import React, { useState } from 'react';
import { SettingsSidebar, SettingsSection } from '@/components/settings/SettingsSidebar';
import { TagsSettings } from '@/components/settings/TagsSettings';
import { QuickRepliesSettings } from '@/components/settings/QuickRepliesSettings';


export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('quick-replies');

  const renderContent = () => {
    switch (activeSection) {
      case 'tags':
        return <TagsSettings />;
      case 'quick-replies':
        return <QuickRepliesSettings />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">This section is coming soon</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <SettingsSidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
