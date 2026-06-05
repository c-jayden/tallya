import { useEffect } from 'react';
import { toast } from 'sonner';
import { initializeDatabase } from '../../services/database/database';

export function DatabaseBootstrap() {
  useEffect(() => {
    void initializeDatabase().catch((error) => {
      console.error('Failed to initialize database on startup', error);
      toast.error('本地数据初始化失败，请重启后再试。');
    });
  }, []);

  return null;
}
