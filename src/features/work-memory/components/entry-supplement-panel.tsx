import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ClarificationPrompt } from '../types';

type EntrySupplementPanelProps = {
  entryContent: string;
  onAdd: (question: string | null, answer: string) => Promise<boolean> | boolean;
  onSuggest: (content: string) => Promise<ClarificationPrompt[]>;
  onClose: () => void;
};

type SuggestState = 'loading' | 'ready' | 'unavailable';

const answerFieldClass =
  'block field-sizing-content max-h-32 min-h-8 w-full resize-none rounded-md border border-app-border bg-app-surface px-2 py-1 text-[13px] leading-6 text-app-ink outline-none transition-colors duration-150 placeholder:text-[var(--app-placeholder)] focus:border-app-border-strong focus-visible:ring-0';

export function EntrySupplementPanel({
  entryContent,
  onAdd,
  onSuggest,
  onClose,
}: EntrySupplementPanelProps) {
  // Starts in 'loading' because opening the panel immediately fetches AI
  // questions; the effect only flips it from inside async callbacks.
  const [suggestState, setSuggestState] = useState<SuggestState>('loading');
  const [questions, setQuestions] = useState<ClarificationPrompt[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [manualValue, setManualValue] = useState('');
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function hasUnsavedText() {
    return Boolean(manualValue.trim()) || Object.values(answers).some((value) => value.trim());
  }

  function handlePanelBlur(event: ReactFocusEvent<HTMLDivElement>) {
    // Collapse when focus leaves the whole panel and nothing is half-typed, so
    // an empty supplement box quietly closes itself without a manual "收起".
    const nextFocus = event.relatedTarget as Node | null;

    if (containerRef.current?.contains(nextFocus)) {
      return;
    }

    if (!hasUnsavedText()) {
      onClose();
    }
  }

  useEffect(() => {
    // Opening the panel is the explicit trigger for AI follow-up. We fetch in
    // the background; manual input stays usable whether or not AI responds.
    let isMounted = true;

    void onSuggest(entryContent)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setQuestions(result);
        setSuggestState('ready');
      })
      .catch(() => {
        if (isMounted) {
          setSuggestState('unavailable');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [entryContent, onSuggest]);

  async function saveAndRemove(index: number, question: string, answer: string) {
    const saved = await onAdd(question, answer);

    if (saved) {
      setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index));
      setAnswers((current) => {
        const next = { ...current };

        delete next[index];

        return next;
      });
    }
  }

  async function submitAnswer(index: number, question: string) {
    const value = answers[index]?.trim();

    if (!value) {
      return;
    }

    await saveAndRemove(index, question, value);
  }

  // Picking a preset option is just a pre-filled answer — it saves the option text
  // verbatim as the clarification, same path as typing it.
  async function submitOption(index: number, question: string, option: string) {
    await saveAndRemove(index, question, option);
  }

  async function submitManual() {
    if (!manualValue.trim()) {
      return;
    }

    const saved = await onAdd(null, manualValue);

    if (saved) {
      setManualValue('');
      manualRef.current?.focus();
    }
  }

  function handleAnswerKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
    index: number,
    question: string,
  ) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitAnswer(index, question);
    }
  }

  function handleManualKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitManual();
    }
  }

  return (
    <div
      ref={containerRef}
      onBlur={handlePanelBlur}
      className="grid gap-2 rounded-lg border border-app-border bg-app-surface px-2.5 py-2"
    >
      {suggestState === 'loading' ? (
        <p className="flex items-center gap-1.5 text-[12px] leading-5 text-app-ink-subtle">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          正在整理几个可以补充的问题…
        </p>
      ) : null}

      {suggestState === 'ready' && questions.length > 0 ? (
        <div className="grid gap-2">
          {questions.map((prompt, index) => (
            <div key={`${prompt.question}-${index}`} className="grid gap-1">
              <p className="flex items-start gap-1 text-[12.5px] leading-5 text-app-ink-muted">
                <Sparkles className="mt-0.5 size-3 shrink-0 text-app-ink-subtle" aria-hidden="true" />
                {prompt.question}
              </p>
              {prompt.options.length > 0 ? (
                // Enum-type question: one tap on a preset saves it. Two per row,
                // with the free-text box below as the always-present fallback.
                <div className="grid grid-cols-2 gap-1">
                  {prompt.options.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-7 cursor-pointer justify-start rounded-md px-2 text-[12.5px] font-normal text-app-ink-muted hover:text-app-ink"
                      onClick={() => void submitOption(index, prompt.question, option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              ) : null}
              <textarea
                className={answerFieldClass}
                value={answers[index] ?? ''}
                onChange={(event) => {
                  // Read the value before the state updater runs: React may call
                  // it after the event settles, when event.currentTarget is null.
                  const { value } = event.target;
                  setAnswers((current) => ({ ...current, [index]: value }));
                }}
                onKeyDown={(event) => handleAnswerKeyDown(event, index, prompt.question)}
                placeholder={prompt.options.length > 0 ? '或自己写一句，回车保存' : '写一两句，回车保存'}
                rows={1}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-1">
        <Textarea
          ref={manualRef}
          className={answerFieldClass}
          value={manualValue}
          onChange={(event) => setManualValue(event.currentTarget.value)}
          onKeyDown={handleManualKeyDown}
          placeholder={
            suggestState === 'unavailable'
              ? '补一点背景，回车保存（难点、原因、后续）'
              : '也可以直接补一两句，回车保存'
          }
        />
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 cursor-pointer rounded-md px-2 text-[12.5px] text-app-ink-muted hover:bg-app-surface hover:text-app-ink"
          onClick={onClose}
        >
          收起
        </Button>
        <Button
          type="button"
          size="xs"
          className="h-7 cursor-pointer rounded-md px-2.5 text-[12.5px] font-medium"
          onClick={() => void submitManual()}
          disabled={!manualValue.trim()}
        >
          补充
        </Button>
      </div>
    </div>
  );
}
