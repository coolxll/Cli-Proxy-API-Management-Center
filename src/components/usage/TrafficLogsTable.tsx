import { useTranslation } from 'react-i18next';
import { TrafficLog } from '@/types';
import { formatDateTime } from '@/utils/format';
import styles from './TrafficLogsTable.module.scss';

export interface TrafficLogsTableProps {
    logs: TrafficLog[];
    loading: boolean;
}

/**
 * Thresholds for latency status display in milliseconds
 */
const LATENCY_THRESHOLDS = {
    HIGH: 1000,
    MID: 300,
} as const;

/**
 * Component to display traffic logs in a table format
 */
export function TrafficLogsTable({ logs, loading }: TrafficLogsTableProps) {
    const { t } = useTranslation();

    const getStatusClass = (code: number) => {
        if (code >= 200 && code < 300) return styles.statusSuccess;
        if (code >= 400 && code < 500) return styles.statusWarning;
        if (code >= 500) return styles.statusError;
        return '';
    };

    const getLatencyClass = (ms: number) => {
        if (ms >= LATENCY_THRESHOLDS.HIGH) return styles.latencyHigh;
        if (ms >= LATENCY_THRESHOLDS.MID) return styles.latencyMid;
        return styles.latencyLow;
    };

    if (loading && logs.length === 0) {
        return <div className={styles.empty}>{t('common.loading')}</div>;
    }

    if (logs.length === 0) {
        return <div className={styles.empty}>{t('traffic_logs.empty')}</div>;
    }

    return (
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.th}>{t('traffic_logs.timestamp')}</th>
                        <th className={styles.th}>{t('traffic_logs.method')}</th>
                        <th className={styles.th}>{t('traffic_logs.path')}</th>
                        <th className={styles.th}>{t('traffic_logs.status')}</th>
                        <th className={styles.th}>{t('traffic_logs.latency')}</th>
                        <th className={styles.th}>{t('traffic_logs.model')}</th>
                        <th className={styles.th}>{t('traffic_logs.ip')}</th>
                        <th className={styles.th}>{t('traffic_logs.tokens')}</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => (
                        <tr key={log.request_id} className={styles.tr}>
                            <td className={styles.td}>
                                <div title={log.request_id}>{formatDateTime(log.timestamp)}</div>
                                <div className={styles.requestId}>{log.request_id.slice(0, 8)}...</div>
                            </td>
                            <td className={styles.td}>
                                <span className={styles.method}>{log.method}</span>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.path} title={log.path}>
                                    {log.path}
                                </div>
                            </td>
                            <td className={styles.td}>
                                <span className={`${styles.status} ${getStatusClass(log.status_code)}`}>
                                    {log.status_code}
                                </span>
                            </td>
                            <td className={styles.td}>
                                <span className={`${styles.latency} ${getLatencyClass(log.latency_ms)}`}>
                                    {log.latency_ms}ms
                                </span>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.path}>{log.model || '-'}</div>
                            </td>
                            <td className={styles.td}>
                                <span className={styles.clientIp}>{log.client_ip}</span>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.tokens}>
                                    {log.total_tokens > 0 ? (
                                        <span title={`I: ${log.input_tokens} / O: ${log.output_tokens}`}>
                                            {log.total_tokens}
                                        </span>
                                    ) : (
                                        '-'
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
