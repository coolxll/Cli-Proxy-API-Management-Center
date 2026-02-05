import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
    const pageSize = 20;

    // Check recording status on mount
    useEffect(() => {
        if (connectionStatus === 'connected') {
            configApi.getEnableRequestLog().then(setRecording).catch(console.error);
        }
    }, [connectionStatus]);

    const toggleRecording = async () => {
        try {
            await configApi.updateEnableRequestLog(!recording);
            setRecording(!recording);
            showNotification(
                !recording ? t('traffic_logs.recording_started') : t('traffic_logs.recording_stopped'),
                'success'
            );
        } catch (err) {
            showNotification(t('traffic_logs.recording_toggle_failed'), 'error');
        }
    };

    /**
     * Fetch logs with optional filters
     */
    const fetchLogs = useCallback(async (p: number, model?: string, status?: number) => {
        if (connectionStatus !== 'connected') return;
        setLoading(true);
        try {
            const res = await usageApi.getTrafficLogs({
                page: p,
                size: pageSize,
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
    }, [connectionStatus, showNotification, t]);

    useEffect(() => {
        fetchLogs(1, modelFilter, statusFilter);
    }, [fetchLogs, modelFilter, statusFilter]);

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>{t('nav.traffic_logs')}</h1>
                <div className={styles.headerActions}>
                    <Button
                        variant={recording ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={toggleRecording}
                        className={styles.recordingButton}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}
                    >
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: recording ? '#fff' : '#666',
                                animation: recording ? 'pulse 1.5s infinite' : 'none',
                            }}
                        />
                        {recording ? t('traffic_logs.recording_on') : t('traffic_logs.recording_off')}
                    </Button>
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
                    <Button variant="secondary" size="sm" onClick={() => fetchLogs(1, modelFilter, statusFilter)} disabled={loading}>
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>



            <TrafficLogsTable logs={logs} loading={loading} />

            {totalPages > 1 && (
                <div className="flex-center" style={{ marginTop: '20px', gap: '12px' }}>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => fetchLogs(page - 1, modelFilter, statusFilter)}
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
                        onClick={() => fetchLogs(page + 1, modelFilter, statusFilter)}
                    >
                        {t('auth_files.pagination_next')}
                    </Button>
                </div>
            )}
        </div>
    );
}
