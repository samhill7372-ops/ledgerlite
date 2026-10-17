import { useState } from 'react';
import { AppProvider, useApp } from '@/store/useApp';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { AddScreen } from '@/features/add/AddScreen';
import { ExpensesScreen } from '@/features/expenses/ExpensesScreen';
import { InsightsScreen } from '@/features/insights/InsightsScreen';
import { BottomNav } from '@/components/BottomNav';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Toast } from '@/components/Toast';
import type { RangeKey } from '@/lib/dates';

function Shell() {
  const { ready, session, needsUnlock, view, setView } = useApp();
  const [listRange, setListRange] = useState<RangeKey | undefined>(undefined);
  if (!ready) return null;
  if (!session || needsUnlock) return <><AuthScreen /><Toast /></>;
  return (
    <>
      <div className="wrap">
        {view === 'home' && <HomeScreen />}
        {view === 'add' && <AddScreen />}
        {view === 'expenses' && <ExpensesScreen key={listRange ?? 'default'} initialRange={listRange} />}
        {view === 'insights' && <InsightsScreen onPickMonth={(k) => { setListRange(`m:${k}`); setView('expenses'); }} />}
      </div>
      <InstallPrompt />
      <BottomNav />
      <Toast />
    </>
  );
}

export default function App() { return <AppProvider><Shell /></AppProvider>; }
