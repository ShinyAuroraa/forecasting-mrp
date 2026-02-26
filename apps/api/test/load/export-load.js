import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, getAuthHeaders } from './config.js';

/**
 * Story 5.9 — AC-14: Export endpoint load test.
 * Target: 20 concurrent users generating PDF/Excel exports.
 *
 * Run: k6 run test/load/export-load.js
 * With env: k6 run -e BASE_URL=http://localhost:3001/api/v1 -e AUTH_TOKEN=<jwt> test/load/export-load.js
 */

const errorRate = new Rate('errors');
const pdfDuration = new Trend('pdf_export_duration');
const excelDuration = new Trend('excel_export_duration');

export const options = {
  stages: [
    { duration: '15s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    ...THRESHOLDS.export,
    pdf_export_duration: ['p(95)<5000'],
    excel_export_duration: ['p(95)<5000'],
  },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_USER_EMAIL || 'admin@example.com',
      password: __ENV.TEST_USER_PASSWORD || 'admin12345',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status === 200) {
    return { token: JSON.parse(loginRes.body).accessToken };
  }

  const token = __ENV.AUTH_TOKEN;
  if (!token) {
    throw new Error('Login failed and no AUTH_TOKEN env provided. Set AUTH_TOKEN or TEST_USER_EMAIL/TEST_USER_PASSWORD.');
  }
  return { token };
}

const EXPORT_TYPES = [
  'EXECUTIVE_DASHBOARD',
  'MRP_SUMMARY',
  'FORECAST_ACCURACY',
  'SUPPLIER_PERFORMANCE',
  'INVENTORY_TURNOVER',
];

export default function (data) {
  const authOpts = getAuthHeaders(data.token);
  const exportType = EXPORT_TYPES[Math.floor(Math.random() * EXPORT_TYPES.length)];

  // Test 1: PDF export
  const pdfPayload = JSON.stringify({
    type: exportType,
    format: 'PDF',
    filters: {},
  });

  const pdfRes = http.post(`${BASE_URL}/export`, pdfPayload, authOpts);
  pdfDuration.add(pdfRes.timings.duration);
  check(pdfRes, {
    'PDF export succeeds': (r) => r.status === 200 || r.status === 201,
  }) || errorRate.add(1);

  sleep(2);

  // Test 2: Excel export
  const excelPayload = JSON.stringify({
    type: exportType,
    format: 'EXCEL',
    filters: {},
  });

  const excelRes = http.post(`${BASE_URL}/export`, excelPayload, authOpts);
  excelDuration.add(excelRes.timings.duration);
  check(excelRes, {
    'Excel export succeeds': (r) => r.status === 200 || r.status === 201,
  }) || errorRate.add(1);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'test/load/results/export-load-report.json': JSON.stringify(data, null, 2),
  };
}
