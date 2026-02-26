import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, getAuthHeaders } from './config.js';

/**
 * Story 5.9 — AC-15: MRP execution load test.
 * Target: 5 concurrent MRP runs, completion < 30s each.
 *
 * Run: k6 run test/load/mrp-load.js
 * With env: k6 run -e BASE_URL=http://localhost:3001/api/v1 -e AUTH_TOKEN=<jwt> test/load/mrp-load.js
 */

const errorRate = new Rate('errors');
const mrpDuration = new Trend('mrp_execution_duration');

export const options = {
  stages: [
    { duration: '10s', target: 2 },
    { duration: '1m', target: 5 },
    { duration: '2m', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    ...THRESHOLDS.mrp,
    mrp_execution_duration: ['p(95)<30000'],
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

export default function (data) {
  const AUTH_TOKEN = data.token;
  const authOpts = getAuthHeaders(AUTH_TOKEN);

  // Trigger MRP execution
  const mrpPayload = JSON.stringify({
    horizonte: 12,
    estrategia: 'MRP_CLASSICO',
    incluirCrp: true,
  });

  const mrpRes = http.post(`${BASE_URL}/mrp/execute`, mrpPayload, authOpts);
  mrpDuration.add(mrpRes.timings.duration);

  check(mrpRes, {
    'MRP execution accepted': (r) => r.status === 200 || r.status === 201 || r.status === 202,
    'MRP response time < 30s': (r) => r.timings.duration < 30000,
  }) || errorRate.add(1);

  // Wait longer between MRP runs to avoid overwhelming the system
  sleep(10);

  // Check execution status
  const statusRes = http.get(`${BASE_URL}/mrp/executions?page=1&limit=5`, authOpts);
  check(statusRes, {
    'MRP status check succeeds': (r) => r.status === 200,
  });

  sleep(5);
}

export function handleSummary(data) {
  return {
    'test/load/results/mrp-load-report.json': JSON.stringify(data, null, 2),
  };
}
