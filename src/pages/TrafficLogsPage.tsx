import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useAuthStore, useNotificationStore } from '@/stores';
import { usageApi } from '@/services/api/usage';
import { configApi } from '@/services/api/config';
import { TrafficLog } from '@/types';
import { TrafficLogsTable } from '@/components/usage/TrafficLogsTable';
import styles from './UsagePage.module.scss'; // Reuse UsagePage styles for layout

/**
 * Page component for displaying and auditing traffic logs
 */
export function TrafficLogsPage() {
    const { t } = useTranslation();
    const connectionStatus = useAuthStore((state) => state.connectionStatus);
    const { showNotification } = useNotificationStore();

    const [logs, setLogs] = useState<TrafficLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [modelFilter, setModelFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
    const [recording, setRecording] = useState(false);
    const [pageSize, setPageSize] = useState(20);
    const [pageSizeInput, setPageSizeInput] = useState('20');
    const [recordingUpdating, setRecordingUpdating] = useState(false);

    // Check recording status on mount
    useEffect(() => {
        if (connectionStatus === 'connected') {
            configApi.getEnableRequestLog().then(setRecording).catch(() => setRecording(false));
        }
    }, [connectionStatus]);

    /**
     * Fetch logs with optional filters
     */
    const fetchLogs = useCallback(async (p: number, model?: string, status?: number, size?: number) => {
        if (connectionStatus !== 'connected') return;
        setLoading(true);
        try {
            const res = await usageApi.getTrafficLogs({
                page: p,
                size: size || pageSize,
                model: model || undefined,
                status: status
            });
            setLogs(res.logs || []);
            setTotal(res.total || 0);
            setPage(res.page || p);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showNotification(message || t('notification.refresh_failed'), 'error');
        } finally {
            setLoading(false);
        }
    }, [connectionStatus, pageSize, showNotification, t]);

    useEffect(() => {
        fetchLogs(1, modelFilter, statusFilter, pageSize);
    }, [fetchLogs, modelFilter, statusFilter, pageSize]);

    const handleRecordingToggle = async (enabled: boolean) => {
        if (recordingUpdating) return;
        setRecordingUpdating(true);
        const previous = recording;
        setRecording(enabled); // Optimistic update

        try {
            // We need to use updateConfig to set enable_request_log
            // Assuming configApi.updateConfig accepts partial config
            // However, looking at usage in other files, we might need to check how to update this specific setting
            // Based on previous reads, enable_request_log is part of the config

            // Let's verify configApi structure if possible, but for now assuming updateConfig works
            // If there isn't a direct method, we might need to implement one or use updateConfig

            // Re-checking configApi import... it is imported.

            // The method name might need verification.
            // In SettingsPage usually we update config.
            // Let's assume updateConfig({ enable_request_log: enabled }) works as per standard pattern

            // Wait, I should check if there is a specific endpoint or if I need to update the whole config object.
            // Usually updateConfig takes a partial object.

            await configApi.updateEnableRequestLog(enabled);

            showNotification(
                enabled ? t('traffic_logs.recording_enabled_success') : t('traffic_logs.recording_disabled_success'),
                'success'
            );
        } catch (err: unknown) {
            setRecording(previous);
            const message = err instanceof Error ? err.message : String(err);
            showNotification(`${t('notification.update_failed')}: ${message}`, 'error');
        } finally {
            setRecordingUpdating(false);
        }
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPageSizeInput(e.target.value);
    };

    const commitPageSize = () => {
        const val = parseInt(pageSizeInput);
        if (!isNaN(val) && val > 0) {
            const newSize = Math.min(100, Math.max(1, val));
            setPageSize(newSize);
            setPageSizeInput(String(newSize));
            // fetchLogs will be triggered by useEffect dependency on pageSize
        } else {
            setPageSizeInput(String(pageSize));
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>{t('nav.traffic_logs')}</h1>
                <div className={styles.headerActions}>
                    <div
                        className={styles.recordingStatus}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginRight: '12px',
                            padding: '0 12px',
                            height: '32px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            fontSize: '13px',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: recording ? '#22c55e' : '#9ca3af',
                                animation: recording ? 'pulse 1.5s infinite' : 'none',
                            }}
                        />
                        <span style={{ marginRight: '8px' }}>
                            {recording ? t('traffic_logs.recording_on') : t('traffic_logs.recording_off')}
                        </span>
                        <ToggleSwitch
                            checked={recording}
                            onChange={handleRecordingToggle}
                            disabled={recordingUpdating || connectionStatus !== 'connected'}
                            ariaLabel={t('traffic_logs.recording_on')}
                        />
                    </div>
                    <style>{`
                        @keyframes pulse {
                            0% { opacity: 1; }
                            50% { opacity: 0.5; }
                            100% { opacity: 1; }
                        }
                    `}</style>
                    <Input
                        placeholder={t('traffic_logs.filter_model')}
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        style={{ width: '150px', margin: 0 }}
                        className="sm"
                    />
                    <Input
                        type="number"
                        placeholder={t('traffic_logs.filter_status')}
                        value={statusFilter || ''}
                        onChange={(e) => setStatusFilter(e.target.value ? parseInt(e.target.value) : undefined)}
                        style={{ width: '100px', margin: 0 }}
                        className="sm"
                    />
                    <Button variant="secondary" size="sm" onClick={() => fetchLogs(1, modelFilter, statusFilter, pageSize)} disabled={loading}>
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>



            <TrafficLogsTable logs={logs} loading={loading} />

            {totalPages > 0 && (
                <div className="flex-center" style={{ marginTop: '20px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {t('auth_files.page_size_label')}:
                        </span>
                        <Input
                            type="number"
                            value={pageSizeInput}
                            onChange={handlePageSizeChange}
                            onBlur={commitPageSize}
                            onKeyDown={(e) => e.key === 'Enter' && commitPageSize()}
                            style={{ width: '60px', margin: 0, height: '28px', fontSize: '13px' }}
                            className="sm"
                        />
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => fetchLogs(page - 1, modelFilter, statusFilter, pageSize)}
                    >
                        {t('auth_files.pagination_prev')}
                    </Button>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {t('auth_files.pagination_info', { current: page, total: totalPages, count: total })}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages || loading}
                        onClick={() => fetchLogs(page + 1, modelFilter, statusFilter, pageSize)}
                    >
                        {t('auth_files.pagination_next')}
                    </Button>
                </div>
            )}
        </div>
    );
}
