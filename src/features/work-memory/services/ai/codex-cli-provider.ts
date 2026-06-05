import { invoke } from '@tauri-apps/api/core';
import type { GeneratedDailyMemory, GeneratedReportContent } from '../../types';
import { AIProviderError, type AIProvider, type GenerateDailyMemoryOptions } from './ai-provider';

type TauriInvoke = typeof invoke;

const CODEX_PROVIDER_ID = 'ai-codex-cli';
// Health checks include a tiny generation request because `codex --version`
// cannot prove the user is logged in or that generation can return content.
const HEALTH_CHECK_INPUT = {
  date: '2026-06-03',
  rawContent: '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。',
  supplements: {},
};

export function createCodexCliProvider(invokeCommand: TauriInvoke = invoke): AIProvider {
  return {
    id: CODEX_PROVIDER_ID,
    name: 'Codex CLI',
    async generateDailyMemory(input, options) {
      try {
        return await invokeCommand<GeneratedDailyMemory>('generate_daily_memory_with_codex', {
          input,
          codexCommand: options.codexCommand,
        });
      } catch (error) {
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async generateWeeklyReport(input, options) {
      try {
        return await invokeCommand<GeneratedReportContent>('generate_weekly_report_with_codex', {
          input,
          codexCommand: options.codexCommand,
        });
      } catch (error) {
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async checkHealth(options) {
      try {
        const version = await checkCodexCli(invokeCommand, options.codexCommand);
        await runCodexHealthGeneration(invokeCommand, options);

        return {
          status: 'available',
          message: '可用',
          detail: version,
        };
      } catch (error) {
        return {
          status: 'unavailable',
          message: '检测失败',
          detail: getFriendlyCodexCheckError(error),
        };
      }
    },
  };
}

export function createCodexCliTools(invokeCommand: TauriInvoke = invoke) {
  return {
    async checkCodexCli(command: string) {
      return checkCodexCli(invokeCommand, command);
    },
  };
}

export const codexCliProvider = createCodexCliProvider();
export const codexCliTools = createCodexCliTools();

function getFriendlyCodexError(error: unknown) {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Codex 生成失败，请检查 Codex CLI 是否可用。';
}

async function checkCodexCli(invokeCommand: TauriInvoke, command: string) {
  try {
    return await invokeCommand<string>('check_codex_cli', { command });
  } catch (error) {
    throw Object.assign(new Error(getFriendlyCodexCheckError(error)), { cause: error });
  }
}

async function runCodexHealthGeneration(
  invokeCommand: TauriInvoke,
  options: GenerateDailyMemoryOptions,
) {
  try {
    await invokeCommand<GeneratedDailyMemory>('generate_daily_memory_with_codex', {
      input: HEALTH_CHECK_INPUT,
      codexCommand: options.codexCommand,
    });
  } catch (error) {
    throw Object.assign(new Error(getFriendlyCodexError(error)), { cause: error });
  }
}

function getFriendlyCodexCheckError(error: unknown) {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '未检测到 Codex，请检查命令路径或登录状态。';
}
