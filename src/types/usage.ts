/**
 * 使用统计相关类型
 * 基于原项目 src/modules/usage.js
 */

// 时间段类型
export type TimePeriod = 'hour' | 'day';

// 数据点
export interface DataPoint {
  timestamp: string;
  value: number;
}

// 模型使用统计
export interface ModelUsage {
  modelName: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

// 使用统计数据
export interface UsageStats {
  overview: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
  };
  requestsData: {
    hour: DataPoint[];
    day: DataPoint[];
  };
  tokensData: {
    hour: DataPoint[];
    day: DataPoint[];
  };
  costData: {
    hour: DataPoint[];
    day: DataPoint[];
  };
  modelStats: ModelUsage[];
}

// 模型价格
export interface ModelPrice {
  modelName: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
}
// 流量记录
export interface TrafficLog {
  request_id: string;
  timestamp: string;
  model: string;
  auth_index: string;
  method: string;
  path: string;
  status_code: number;
  client_ip: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// 流量日志分页响应
export interface TrafficLogsResponse {
  logs: TrafficLog[];
  total: number;
  page: number;
  size: number;
}
