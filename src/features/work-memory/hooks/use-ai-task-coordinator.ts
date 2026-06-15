import { useCallback, useState } from 'react';
import {
  getMainWindowState,
  isMainWindowForeground,
  sendTallyaNotification,
  setActiveAiTaskRunning,
  type MainWindowState,
} from '../services/window-service';

export type AiTaskKind = 'daily-report' | 'range-report' | 'report-gaps' | 'style-extract';
export type AiTaskStatus = 'running' | 'needs-input' | 'completed' | 'failed';
export type AiTaskAlertTone = 'info' | 'success' | 'warning' | 'error';

export type AiTask = {
  id: string;
  kind: AiTaskKind;
  status: AiTaskStatus;
  message: string;
  openTarget?: AiTaskKind;
};

export type AiTaskAlert = {
  id: string;
  tone: AiTaskAlertTone;
  message: string;
  actionLabel?: string;
  target?: AiTaskKind;
};

export type AiTaskCoordinatorControls = {
  beginTask: (kind: AiTaskKind, message?: string) => Promise<AiTask>;
  updateTask: (task: AiTask) => Promise<void>;
};

type NotifyDependencies = {
  getMainWindowState: () => Promise<MainWindowState>;
  sendNotification: (body: string) => Promise<void>;
};

const taskMessages: Record<AiTaskStatus, Partial<Record<AiTaskKind, string>>> = {
  running: {
    'daily-report': 'Tallya 会在后台继续整理。',
    'range-report': 'Tallya 会在后台继续整理。',
    'report-gaps': 'Tallya 会在后台继续整理。',
    'style-extract': 'Tallya 会在后台继续提取风格。',
  },
  'needs-input': {
    'report-gaps': '整理需要补充一点信息，点击继续。',
  },
  completed: {
    'daily-report': '整理好了，点击查看。',
    'range-report': '整理好了，点击查看。',
    'style-extract': '风格提取好了，点击查看。',
  },
  failed: {
    'daily-report': '整理没有完成，点击查看详情。',
    'range-report': '整理没有完成，点击查看详情。',
    'report-gaps': '整理没有完成，点击查看详情。',
    'style-extract': '风格提取没有完成，点击查看详情。',
  },
};

const alertToneByStatus: Record<AiTaskStatus, AiTaskAlertTone> = {
  running: 'info',
  'needs-input': 'warning',
  completed: 'success',
  failed: 'error',
};

export function createAiTask(
  kind: AiTaskKind,
  status: AiTaskStatus,
  message = taskMessages[status][kind] ?? 'AI 任务状态已更新。',
): AiTask {
  return {
    id: `${kind}-${status}`,
    kind,
    status,
    message,
    openTarget: kind,
  };
}

export function createAiTaskAlert(task: AiTask): AiTaskAlert {
  return {
    id: task.id,
    tone: alertToneByStatus[task.status],
    message: task.message,
    actionLabel: task.status === 'running' ? undefined : '查看',
    target: task.openTarget,
  };
}

export function createCloseBlockedAlert(): AiTaskAlert {
  return {
    id: 'ai-close-blocked',
    tone: 'warning',
    message: '正在整理，先等它完成后再关闭。',
    actionLabel: '继续等待',
  };
}

export async function notifyIfWindowNotForeground(
  task: AiTask,
  dependencies: NotifyDependencies = {
    getMainWindowState,
    sendNotification: sendTallyaNotification,
  },
) {
  const state = await dependencies.getMainWindowState();

  if (isMainWindowForeground(state)) {
    return false;
  }

  await dependencies.sendNotification(task.message);
  return true;
}

export function shouldPersistAiTaskAlert(task: AiTask, wasNotified: boolean) {
  if (task.status === 'running') {
    return false;
  }

  if (task.status === 'completed') {
    return wasNotified;
  }

  return true;
}

export function useAiTaskCoordinator() {
  const [activeTask, setActiveTask] = useState<AiTask | null>(null);
  const [alert, setAlert] = useState<AiTaskAlert | null>(null);

  const beginTask = useCallback(async (kind: AiTaskKind, message?: string) => {
    const task = createAiTask(kind, 'running', message);

    setActiveTask(task);
    setAlert(null);
    await setActiveAiTaskRunning(true);
    return task;
  }, []);

  const updateTask = useCallback(async (task: AiTask) => {
    const wasNotified = await notifyIfWindowNotForeground(task);

    setActiveTask(task.status === 'running' ? task : null);
    setAlert(shouldPersistAiTaskAlert(task, wasNotified) ? createAiTaskAlert(task) : null);

    if (task.status !== 'running') {
      await setActiveAiTaskRunning(false);
    }
  }, []);

  const handleWindowHidden = useCallback(async () => {
    if (!activeTask || activeTask.status !== 'running') {
      return;
    }

    await notifyIfWindowNotForeground(activeTask);
  }, [activeTask]);

  const handleCloseBlocked = useCallback(() => {
    setAlert(createCloseBlockedAlert());
  }, []);

  return {
    activeTask,
    alert,
    dismissAlert: () => setAlert(null),
    beginTask,
    updateTask,
    handleWindowHidden,
    handleCloseBlocked,
  };
}
