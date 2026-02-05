import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/stores';
import { usageApi } from '@/services/api/usage';
import { loadModelPrices, saveModelPrices, type ModelPrice, type UsageDetail } from '@/utils/usage';
import { TrafficLog } from '@/types';

export interface UsagePayload {
  total_requests?: number;
  success_count?: number;
  failure_count?: number;
  total_tokens?: number;
  apis?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UseUsageDataReturn {
  usage: UsagePayload | null;
  loading: boolean;
  error: string;
  modelPrices: Record<string, ModelPrice>;
  setModelPrices: (prices: Record<string, ModelPrice>) => void;
  loadUsage: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleImport: () => void;
  handleImportChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  exporting: boolean;
  importing: boolean;
}

function enrichUsageWithLogs(usage: UsagePayload, logs: TrafficLog[]) {
  if (!usage || !logs || logs.length === 0) return;

  if (!usage.apis) usage.apis = {};
  const apis = usage.apis as Record<string, any>;

  // Check if we already have significant details
  let detailsCount = 0;
  for (const api of Object.values(apis)) {
    for (const model of Object.values(api?.models || {}) as any[]) {
      if (Array.isArray(model?.details)) {
        detailsCount += model.details.length;
      }
    }
  }

  // If we have a reasonable amount of details, assume backend provided them
  // and we shouldn't mix in logs (to avoid duplication).
  // Threshold is arbitrary, but if < 10 and we have logs, likely backend stripped details.
  if (detailsCount > 10) {
    return;
  }

  // Group logs by path and model
  logs.forEach(log => {
    const path = log.path || 'unknown';
    const modelName = log.model || 'unknown';

    // Try to find matching existing entry
    let apiEntry = apis[path];
    if (!apiEntry) {
        // If exact match fails, try to find one that ends with this path (basic fuzzy match)
        // or just create new one
        apiEntry = { models: {} };
        apis[path] = apiEntry;
    }

    if (!apiEntry.models) apiEntry.models = {};

    let modelEntry = apiEntry.models[modelName];
    if (!modelEntry) {
        modelEntry = { details: [] };
        apiEntry.models[modelName] = modelEntry;
    }

    if (!Array.isArray(modelEntry.details)) {
        modelEntry.details = [];
    }

    // Add detail
    const detail: UsageDetail = {
        timestamp: log.timestamp,
        source: '', // Logs don't capture source key currently
        auth_index: Number(log.auth_index) || 0,
        tokens: {
            input_tokens: log.input_tokens || 0,
            output_tokens: log.output_tokens || 0,
            reasoning_tokens: 0,
            cached_tokens: 0,
            total_tokens: log.total_tokens || 0
        },
        failed: log.status_code >= 400,
        __modelName: modelName
    };

    modelEntry.details.push(detail);
  });
}

export function useUsageData(): UseUsageDataReturn {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();

  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelPrices, setModelPrices] = useState<Record<string, ModelPrice>>({});
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Parallel fetch usage and traffic logs
      // We fetch a larger page size for logs to get good chart data
      const [usageData, logsRes] = await Promise.all([
          usageApi.getUsage(),
          usageApi.getTrafficLogs({ page: 1, size: 2000 })
      ]);

      const payload = usageData?.usage ?? usageData;

      // Enrich payload with logs if details are missing
      if (logsRes && logsRes.logs) {
          enrichUsageWithLogs(payload, logsRes.logs);
      }

      setUsage(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('usage_stats.loading_error');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsage();
    setModelPrices(loadModelPrices());
  }, [loadUsage]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await usageApi.exportUsage();
      const exportedAt =
        typeof data?.exported_at === 'string' ? new Date(data.exported_at) : new Date();
      const safeTimestamp = Number.isNaN(exportedAt.getTime())
        ? new Date().toISOString()
        : exportedAt.toISOString();
      const filename = `usage-export-${safeTimestamp.replace(/[:.]/g, '-')}.json`;
      const blob = new Blob([JSON.stringify(data ?? {}, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      showNotification(t('usage_stats.export_success'), 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    importInputRef.current?.click();
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        showNotification(t('usage_stats.import_invalid'), 'error');
        return;
      }

      const result = await usageApi.importUsage(payload);
      showNotification(
        t('usage_stats.import_success', {
          added: result?.added ?? 0,
          skipped: result?.skipped ?? 0,
          total: result?.total_requests ?? 0,
          failed: result?.failed_requests ?? 0
        }),
        'success'
      );
      await loadUsage();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(
        `${t('notification.upload_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSetModelPrices = useCallback((prices: Record<string, ModelPrice>) => {
    setModelPrices(prices);
    saveModelPrices(prices);
  }, []);

  return {
    usage,
    loading,
    error,
    modelPrices,
    setModelPrices: handleSetModelPrices,
    loadUsage,
    handleExport,
    handleImport,
    handleImportChange,
    importInputRef,
    exporting,
    importing
  };
}
