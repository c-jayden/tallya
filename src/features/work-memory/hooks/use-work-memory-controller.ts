import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supplementFields, type SupplementField } from '../constants';
import {
  getDailyMemoryPrimaryActionLabel,
  getDailyMemorySaveGeneratedLabel,
  getDailyMemorySaveSuccessToast,
  isTodayDate,
  isFutureMemoryDate,
  getDailyMemoryPreviewCopy,
  getDailyMemoryTextareaPlaceholder,
} from '../memory-date-view-model';
import {
  getFallbackWeeklySnapshot,
  getGeneratedMemories,
  getTodayMemoryState,
  getWeeklySnapshotFromMemories,
  shouldConfirmReferencedMemoryUpdate,
} from '../memory-view-model';
import { aiService } from '../services/ai/ai-service';
import { copyDailyMemoryReport } from '../services/daily-memory-clipboard';
import { dailyMemoryRepository } from '../services/daily-memory-repository';
import { reportRepository } from '../services/report-repository';
import type {
  DailyMemory,
  DailyMemoryGeneratedContent,
  DailyMemorySupplements,
  TodayMemoryState,
  WeeklySnapshot,
} from '../types';

type UseWorkMemoryControllerOptions = {
  currentDate: string;
  todayDate: string;
};

type PendingReferencedSaveAction = 'generated';

export function useWorkMemoryController({ currentDate, todayDate }: UseWorkMemoryControllerOptions) {
  const [workNote, setWorkNote] = useState('');
  const [isSupplementOpen, setIsSupplementOpen] = useState(false);
  const [activeSupplementFields, setActiveSupplementFields] = useState<SupplementField[]>([]);
  const [supplementValues, setSupplementValues] = useState<Record<SupplementField, string>>({
    '项目/主题': '',
    明日计划: '',
    补充说明: '',
  });
  const [todayMemory, setTodayMemory] = useState<TodayMemoryState>({
    officialStatus: 'notGenerated',
    hasDraft: false,
    hasGeneratedHistory: false,
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  });
  const [currentMemory, setCurrentMemory] = useState<DailyMemory | null>(null);
  const [memories, setMemories] = useState<DailyMemory[]>([]);
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklySnapshot>(getFallbackWeeklySnapshot);
  const [primaryPulse, setPrimaryPulse] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isGeneratingMemory, setIsGeneratingMemory] = useState(false);
  const [isSavingGeneratedMemory, setIsSavingGeneratedMemory] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCurrentMemoryReferenced, setIsCurrentMemoryReferenced] = useState(false);
  const [pendingReferencedSaveAction, setPendingReferencedSaveAction] =
    useState<PendingReferencedSaveAction | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<DailyMemoryGeneratedContent | null>(
    null,
  );
  const [viewingMemory, setViewingMemory] = useState<DailyMemory | null>(null);
  const [isViewingMemoryReferenced, setIsViewingMemoryReferenced] = useState(false);
  const [isMemoryDialogOpen, setIsMemoryDialogOpen] = useState(false);
  const [isMemoryListOpen, setIsMemoryListOpen] = useState(false);
  const [memoryListItems, setMemoryListItems] = useState<DailyMemory[]>([]);
  const [referencedMemoryIds, setReferencedMemoryIds] = useState<string[]>([]);
  const workNoteInputRef = useRef<HTMLTextAreaElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const pulseTimeoutsRef = useRef<number[]>([]);

  const isSelectedDateToday = isTodayDate(currentDate, todayDate);
  const hasGeneratedToday = todayMemory.officialStatus !== 'notGenerated';
  const isLocked = todayMemory.officialStatus === 'locked';
  const primaryActionLabel = getDailyMemoryPrimaryActionLabel({
    isToday: isSelectedDateToday,
    hasGeneratedMemory: hasGeneratedToday,
  });
  const saveGeneratedLabel = getDailyMemorySaveGeneratedLabel({
    isToday: isSelectedDateToday,
    hasGeneratedMemory: hasGeneratedToday,
  });
  const previewCopy = getDailyMemoryPreviewCopy(isSelectedDateToday);
  const workNotePlaceholder = getDailyMemoryTextareaPlaceholder(isSelectedDateToday);

  const buildDailyMemoryInput = useCallback(() => {
    const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;
    const supplements: DailyMemorySupplements = {};

    if (activeSupplementFields.includes(projectTopicField)) {
      supplements.projectTopic = supplementValues[projectTopicField];
    }

    if (activeSupplementFields.includes(tomorrowPlanField)) {
      supplements.tomorrowPlan = supplementValues[tomorrowPlanField];
    }

    if (activeSupplementFields.includes(extraNoteField)) {
      supplements.extraNote = supplementValues[extraNoteField];
    }

    return {
      date: currentDate,
      rawContent: workNote,
      supplements,
    };
  }, [activeSupplementFields, currentDate, supplementValues, workNote]);

  const applyDailyMemory = useCallback(
    (memory: DailyMemory | null, memories: DailyMemory[] = []) => {
      // Keep the editor, status card, and weekly snapshot in sync whenever a
      // draft or generated memory is loaded back into the home screen.
      setCurrentMemory(memory);
      setMemories(memories);
      setTodayMemory(getTodayMemoryState(memory, memories));
      setWeeklySnapshot(getWeeklySnapshotFromMemories(memories, todayDate));

      if (!memory) {
        const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;

        setWorkNote('');
        setSupplementValues({
          [projectTopicField]: '',
          [tomorrowPlanField]: '',
          [extraNoteField]: '',
        });
        setActiveSupplementFields([]);
        setIsSupplementOpen(false);
        return;
      }

      const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;

      setWorkNote(memory.rawContent);
      setSupplementValues((current) => ({
        ...current,
        [projectTopicField]: memory.supplements.projectTopic ?? '',
        [tomorrowPlanField]: memory.supplements.tomorrowPlan ?? '',
        [extraNoteField]: memory.supplements.extraNote ?? '',
      }));
      setActiveSupplementFields(
        [
          memory.supplements.projectTopic ? projectTopicField : null,
          memory.supplements.tomorrowPlan ? tomorrowPlanField : null,
          memory.supplements.extraNote ? extraNoteField : null,
        ].filter((field): field is SupplementField => field !== null),
      );
      setIsSupplementOpen(
        Boolean(
          memory.supplements.projectTopic ||
          memory.supplements.tomorrowPlan ||
          memory.supplements.extraNote,
        ),
      );
    },
    [todayDate],
  );

  const pulseAction = useCallback((setter: (value: boolean) => void) => {
    // The pulse is purely visual, but the timeout still needs centralized
    // cleanup because the primary action can be triggered by keyboard shortcut.
    setter(true);
    primaryActionRef.current?.focus({ preventScroll: true });
    const timeoutId = window.setTimeout(() => setter(false), 700);
    pulseTimeoutsRef.current.push(timeoutId);
  }, []);

  const loadCurrentDateData = useCallback(async () => {
    const [memory, memories] = await Promise.all([
      dailyMemoryRepository.getByDate(currentDate),
      dailyMemoryRepository.list(),
    ]);
    const isReferenced = memory
      ? await reportRepository.hasReportsUsingDailyMemory(memory.id)
      : false;

    return { memory, memories, isReferenced };
  }, [currentDate]);

  const settleTodayMemory = useCallback(async () => {
    if (isLocked || isGeneratingMemory || isSavingDraft || isFutureMemoryDate(currentDate, todayDate)) {
      return;
    }

    if (!workNote.trim()) {
      toast.warning('可以先写一点内容，再整理成工作记忆');
      return;
    }

    setIsGeneratingMemory(true);
    pulseAction(setPrimaryPulse);

    try {
      const generatedContent = await aiService.generateDailyMemory(buildDailyMemoryInput());

      setGeneratedPreview(generatedContent);
      setIsPreviewOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 生成失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsGeneratingMemory(false);
    }
  }, [
    buildDailyMemoryInput,
    currentDate,
    isGeneratingMemory,
    isLocked,
    isSavingDraft,
    pulseAction,
    todayDate,
    workNote,
  ]);

  useEffect(() => {
    let isMounted = true;

    // Initial load restores today's editable state and also reads history for
    // the status card without exposing storage details to the component.
    void loadCurrentDateData().then(({ memory, memories, isReferenced }) => {
      if (isMounted) {
        setIsCurrentMemoryReferenced(isReferenced);
        setGeneratedPreview(null);
        setIsPreviewOpen(false);
        setPendingReferencedSaveAction(null);
        applyDailyMemory(memory, memories);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [applyDailyMemory, loadCurrentDateData]);

  useEffect(() => {
    return () => {
      pulseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pulseTimeoutsRef.current = [];
    };
  }, []);

  function toggleSupplementPanel() {
    setIsSupplementOpen((current) => !current);
  }

  function updateSupplementValue(field: SupplementField, value: string) {
    setSupplementValues((current) => ({ ...current, [field]: value }));
  }

  function toggleSupplementField(field: SupplementField) {
    setActiveSupplementFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  async function saveDraft() {
    await saveDraftWithoutReferenceCheck();
  }

  async function saveDraftWithoutReferenceCheck() {
    if (isLocked || isSavingDraft || isGeneratingMemory || isFutureMemoryDate(currentDate, todayDate)) {
      return;
    }

    if (!workNote.trim()) {
      toast.warning('可以先写一点内容，再保存草稿');
      return;
    }

    setIsSavingDraft(true);

    try {
      const memory = await dailyMemoryRepository.saveDraft(buildDailyMemoryInput());
      const memories = await dailyMemoryRepository.list();

      setCurrentMemory(memory);
      setMemories(memories);
      setTodayMemory(getTodayMemoryState(memory, memories));
      setWeeklySnapshot(getWeeklySnapshotFromMemories(memories, todayDate));
      toast.success('草稿已保存');
    } catch (error) {
      const message = error instanceof Error ? error.message : '草稿保存失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function saveGeneratedMemory() {
    if (shouldConfirmReferencedMemorySave()) {
      setPendingReferencedSaveAction('generated');
      return;
    }

    await saveGeneratedMemoryWithoutReferenceCheck();
  }

  async function saveGeneratedMemoryWithoutReferenceCheck() {
    if (!generatedPreview || isSavingGeneratedMemory) {
      return;
    }

    setIsSavingGeneratedMemory(true);

    try {
      const memory = await dailyMemoryRepository.saveGenerated({
        ...buildDailyMemoryInput(),
        generated: generatedPreview,
      });

      if (isCurrentMemoryReferenced && currentMemory) {
        await reportRepository.markReportsStaleByDailyMemoryId(currentMemory.id);
      }

      const memories = await dailyMemoryRepository.list();

      setCurrentMemory(memory);
      setMemories(memories);
      setMemoryListItems(getGeneratedMemories(memories));
      setTodayMemory((current) => ({
        ...getTodayMemoryState(memory, memories),
        reportFreshness: current.referencedByWeeklyReport ? 'stale' : current.reportFreshness,
      }));
      setWeeklySnapshot(getWeeklySnapshotFromMemories(memories, todayDate));
      setIsPreviewOpen(false);
      toast.success(getDailyMemorySaveSuccessToast(isSelectedDateToday));
    } catch (error) {
      const message = error instanceof Error ? error.message : '今日记忆保存失败，请稍后重试。';

      toast.error(message);
    } finally {
      setIsSavingGeneratedMemory(false);
    }
  }

  async function confirmReferencedMemorySave() {
    const action = pendingReferencedSaveAction;

    setPendingReferencedSaveAction(null);

    if (action === 'generated') {
      await saveGeneratedMemoryWithoutReferenceCheck();
    }
  }

  function cancelReferencedMemorySave() {
    setPendingReferencedSaveAction(null);
  }

  function shouldConfirmReferencedMemorySave() {
    return (
      shouldConfirmReferencedMemoryUpdate({
        isReferenced: isCurrentMemoryReferenced,
        currentStatus: currentMemory?.status ?? null,
      }) &&
      pendingReferencedSaveAction === null
    );
  }

  function viewDraft() {
    if (currentMemory) {
      applyDailyMemory(currentMemory, memories);
    }
  }

  async function viewMemoryList() {
    const [items, sources] = await Promise.all([
      dailyMemoryRepository.getGeneratedMemories(),
      reportRepository.getAllReportSources(),
    ]);

    setMemoryListItems(items);
    setReferencedMemoryIds([...new Set(sources.map((source) => source.dailyMemoryId))]);
    setIsMemoryListOpen(true);
  }

  async function clearLocalData() {
    await dailyMemoryRepository.clearLocalData();
    const [projectTopicField, tomorrowPlanField, extraNoteField] = supplementFields;

    setWorkNote('');
    setActiveSupplementFields([]);
    setSupplementValues({
      [projectTopicField]: '',
      [tomorrowPlanField]: '',
      [extraNoteField]: '',
    });
    setIsSupplementOpen(false);
    setGeneratedPreview(null);
    setViewingMemory(null);
    setIsViewingMemoryReferenced(false);
    setMemoryListItems([]);
    setReferencedMemoryIds([]);
    setIsPreviewOpen(false);
    setIsMemoryDialogOpen(false);
    setIsMemoryListOpen(false);
    applyDailyMemory(null, []);
  }

  async function reloadCurrentDate() {
    const { memory, memories, isReferenced } = await loadCurrentDateData();

    setIsCurrentMemoryReferenced(isReferenced);
    setGeneratedPreview(null);
    setViewingMemory(null);
    setIsViewingMemoryReferenced(false);
    setMemoryListItems(getGeneratedMemories(memories));
    setIsPreviewOpen(false);
    setIsMemoryDialogOpen(false);
    setIsMemoryListOpen(false);
    setPendingReferencedSaveAction(null);
    applyDailyMemory(memory, memories);
  }

  function openMemoryDetail(memory: DailyMemory) {
    if (!memory.generated) {
      return;
    }

    setViewingMemory(memory);
    setIsViewingMemoryReferenced(false);
    setIsMemoryListOpen(false);
    setIsMemoryDialogOpen(true);
    void reportRepository
      .hasReportsUsingDailyMemory(memory.id)
      .then(setIsViewingMemoryReferenced)
      .catch(() => setIsViewingMemoryReferenced(false));
  }

  async function editOriginalRecord(memory = viewingMemory) {
    if (memory) {
      const isReferenced = await reportRepository.hasReportsUsingDailyMemory(memory.id);

      setIsCurrentMemoryReferenced(isReferenced);
      applyDailyMemory(memory, memories);
    }

    setIsMemoryListOpen(false);
    setIsMemoryDialogOpen(false);
  }

  async function copyMemoryDailyReport(memory: DailyMemory | null) {
    if (!memory) {
      return;
    }

    try {
      await copyDailyMemoryReport(memory);
      toast.success('日报已复制');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制失败，请稍后重试';

      toast.error(message);
    }
  }

  async function copyViewingMemoryDailyReport() {
    await copyMemoryDailyReport(viewingMemory);
  }

  return {
    activeSupplementFields,
    clearLocalData,
    currentMemory,
    copyViewingMemoryDailyReport,
    copyMemoryDailyReport,
    editOriginalRecord,
    generatedPreview,
    previewDescription: previewCopy.description,
    previewTitle: previewCopy.title,
    cancelReferencedMemorySave,
    confirmReferencedMemorySave,
    isGeneratingMemory,
    isLocked,
    isMemoryDialogOpen,
    isMemoryListOpen,
    isViewingMemoryReferenced,
    isPreviewOpen,
    isSavingDraft,
    isSavingGeneratedMemory,
    isSupplementOpen,
    isReferenceConfirmOpen: pendingReferencedSaveAction !== null,
    memoryListItems,
    referencedMemoryIds,
    memories,
    openMemoryDetail,
    primaryActionLabel,
    primaryActionRef,
    primaryPulse,
    reloadCurrentDate,
    saveDraft,
    saveGeneratedLabel,
    saveGeneratedMemory,
    setIsMemoryDialogOpen,
    setIsMemoryListOpen,
    setIsPreviewOpen,
    setWorkNote,
    settleTodayMemory,
    supplementValues,
    todayMemory,
    toggleSupplementField,
    toggleSupplementPanel,
    updateSupplementValue,
    viewDraft,
    viewingMemory,
    viewMemoryList,
    weeklySnapshot,
    workNoteInputRef,
    workNotePlaceholder,
    workNote,
  };
}
