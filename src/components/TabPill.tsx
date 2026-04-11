'use client';

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabPillProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function TabPill<T extends string>({ tabs, value, onChange }: TabPillProps<T>) {
  return (
    <div className="flex items-center flex-wrap gap-1 bg-secondary/30 p-1 rounded-2xl border border-border/40 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            value === tab.id
              ? 'bg-white text-primary shadow-sm border border-border/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
