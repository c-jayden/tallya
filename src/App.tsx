import { WorkMemoryHome } from '@/features/work-memory/work-memory-home';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <>
      <WorkMemoryHome />
      <Toaster position="top-center" />
    </>
  );
}

export default App;
