import { invoke } from '@tauri-apps/api/core';
import type {
  AnalyzedReportStyle,
  GeneratedDailyMemory,
  GeneratedReportContent,
  ReportGap,
  SuggestClarificationsInput,
  SuggestReportGapsInput,
  SuggestThreadLinkInput,
  ThreadLinkSuggestion,
} from '../../types';
import { logger } from '../logger/logger';
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
      logger.error('ai', 'codex-cli.generate_report_failed', 'Codex CLI report generation failed', {
        reportType: input.reportType,
        commandConfigured: Boolean(options.codexCommand),
        model: options.codexModel,
        errorMessage: getFriendlyCodexError(error),
      });
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
        logger.error('ai', 'codex-cli.generate_daily_memory_failed', 'Codex CLI daily memory generation failed', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
          errorMessage: getFriendlyCodexError(error),
        });
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
    async analyzeReportStyle(input, options) {
      try {
        return await invokeCommand<AnalyzedReportStyle>('analyze_report_style_with_codex', {
          input,
          codexCommand: options.codexCommand,
          codexModel: options.codexModel,
        });
      } catch (error) {
        logger.error('ai', 'codex-cli.analyze_report_style_failed', 'Codex CLI style analysis failed', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
          sampleTextLength: input.sampleText.trim().length,
          errorMessage: getFriendlyCodexError(error),
        });
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async suggestClarifications(input: SuggestClarificationsInput, options) {
      try {
        return await invokeCommand<string[]>('suggest_clarifications_with_codex', {
          input,
          codexCommand: options.codexCommand,
          codexModel: options.codexModel,
        });
      } catch (error) {
        logger.error('ai', 'codex-cli.suggest_clarifications_failed', 'Codex CLI clarification suggestion failed', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
          contentLength: input.content.trim().length,
          errorMessage: getFriendlyCodexError(error),
        });
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async suggestThreadLink(input: SuggestThreadLinkInput, options) {
      try {
        return await invokeCommand<ThreadLinkSuggestion>('suggest_thread_link_with_codex', {
          input,
          codexCommand: options.codexCommand,
          codexModel: options.codexModel,
        });
      } catch (error) {
        logger.error('ai', 'codex-cli.suggest_thread_link_failed', 'Codex CLI thread link suggestion failed', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
          candidateCount: input.candidates.length,
          errorMessage: getFriendlyCodexError(error),
        });
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async suggestReportGaps(input: SuggestReportGapsInput, options) {
      try {
        return await invokeCommand<ReportGap[]>('suggest_report_gaps_with_codex', {
          input,
          codexCommand: options.codexCommand,
          codexModel: options.codexModel,
        });
      } catch (error) {
        logger.error('ai', 'codex-cli.suggest_report_gaps_failed', 'Codex CLI report gap detection failed', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
          entryCount: input.entries.length,
          errorMessage: getFriendlyCodexError(error),
        });
        throw new AIProviderError(getFriendlyCodexError(error), CODEX_PROVIDER_ID, error);
      }
    },
    async checkHealth(options) {
      try {
        logger.debug('provider', 'codex-cli.check_start', 'Codex CLI health check started', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
        });
        const version = await checkCodexCli(invokeCommand, options.codexCommand);

        logger.info('provider', 'codex-cli.check_available', 'Codex CLI is available', {
          model: options.codexModel,
          versionPreview: version,
        });
        return {
          status: 'available',
          message: '服务可用',
          detail: version,
        };
      } catch (error) {
        logger.warn('provider', 'codex-cli.check_failed', 'Codex CLI health check failed', {
          commandConfigured: Boolean(options.codexCommand),
          model: options.codexModel,
          errorMessage: getFriendlyCodexCheckError(error),
        });
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
