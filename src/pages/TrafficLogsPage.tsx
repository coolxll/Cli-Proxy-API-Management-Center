import { useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuthStore, useNotificationStore } from '@/stores';
import { usageApi } from '@/services/api/usage';
import { TrafficLog } from '@/types';
import { TrafficLogsTable } from '@/components/usage/TrafficLogsTable';
import styles from './UsagePage.module.scss'; // Reuse UsagePage styles for layout

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

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
    const pageSize = 20;

    /**
     * Formatter for time display in charts, memoized for performance
     */
    const timeFormatter = useMemo(() => 
        new Intl.DateTimeFormat(undefined, { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: false 
        }), 
    []);

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

    // Transform logs for latency chart
    const chartData = useMemo(() => {
        const reversedLogs = [...logs].reverse();
        return {
            labels: reversedLogs.map((l) => {
                try {
                    return timeFormatter.format(new Date(l.timestamp));
                } catch {
                    return '';
                }
            }),
            datasets: [
                {
                    label: t('traffic_logs.latency'),
                    data: reversedLogs.map((l) => l.latency_ms),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                },
            ],
        };
    }, [logs, t, timeFormatter]);

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: 'ms' },
                ticks: { font: { size: 10 } },
            },
            x: {
                display: false, // Hide x-axis labels for density
            },
        },
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>{t('nav.traffic_logs')}</h1>
                <div className={styles.headerActions}>
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

            <div className={styles.chartsGrid} style={{ gridTemplateColumns: '1fr', marginBottom: '24px' }}>
                <Card title={t('traffic_logs.latency_chart')}>
                    <div style={{ height: '200px', width: '100%' }}>
                        {loading && logs.length === 0 ? (
                            <div className="flex-center" style={{ height: '100%' }}>
                                <LoadingSpinner size={24} />
                            </div>
                        ) : (
                            <Line data={chartData} options={chartOptions} />
                        )}
                    </div>
                </Card>
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
