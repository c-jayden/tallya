import { ThemeProvider } from 'next-themes';
import { WorkMemoryHome } from '@/features/work-memory/work-memory-home';
import { Toaster } from '@/components/ui/sonner';
import { AppThemeBootstrap } from '@/features/work-memory/components/settings/app-theme-bootstrap';
import { DatabaseBootstrap } from '@/features/work-memory/components/settings/database-bootstrap';
import { ReminderBootstrap } from '@/features/work-memory/components/settings/reminder-bootstrap';
import { WindowBehaviorBootstrap } from '@/features/work-memory/components/settings/window-behavior-bootstrap';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DatabaseBootstrap />
      <AppThemeBootstrap />
      <WindowBehaviorBootstrap />
      <ReminderBootstrap />
      <WorkMemoryHome />
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}

export default App;
