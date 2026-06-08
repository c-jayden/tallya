import { invoke } from '@tauri-apps/api/core';
import type { GeneratedDailyMemory, GeneratedReportContent } from '../../types';
import { AIProviderError, type AIProvider } from './ai-provider';

type TauriInvoke = typeof invoke;

const CODEX_PROVIDER_ID = 'ai-codex-cli';

export function createCodexCliProvider(invokeCommand: TauriInvoke = invoke): AIProvider {
  async function generateRangeReport(
    input: Parameters<AIProvider['generateRangeReport']>[0],
    options: Parameters<AIProvider['generateRangeReport']>[1],
  ) {
    try {
      return await invokeCommand<GeneratedReportContent>('generate_range_report_with_codex', {
        input,
        codexCommand: options.codexCommand,
        codexModel: options.codexModel,
      });
    } catch (error) {
      throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
    }
  }

  return {
    id: CODEX_PROVIDER_ID,
    name: 'Codex CLI',
    async generateDailyMemory(input, options) {
      try {
        return await invokeCommand<GeneratedDailyMemory>('generate_daily_memory_with_codex', {
          input,
          codexCommand: options.codexCommand,
          codexModel: options.codexModel,
        });
      } catch (error) {
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async generateWeeklyReport(input, options) {
      return generateRangeReport(
        {
          reportType: 'weekly',
          ...input,
        },
        options,
      );
    },
    generateRangeReport,
    async checkHealth(options) {
      try {
        const version = await checkCodexCli(invokeCommand, options.codexCommand);

        return {
          status: 'available',
          message: '服务可用',
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

  return '当前 AI 服务生成失败，请检查服务配置。';
}

async function checkCodexCli(invokeCommand: TauriInvoke, command: string) {
  try {
    return await invokeCommand<string>('check_codex_cli', { command });
  } catch (error) {
    throw Object.assign(new Error(getFriendlyCodexCheckError(error)), { cause: error });
  }
}

function getFriendlyCodexCheckError(error: unknown) {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '未检测到当前 AI 服务，请检查服务配置。';
}
