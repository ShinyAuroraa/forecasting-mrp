import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, PROFILES, getAuthHeaders } from './config.js';

/**
 * Story 5.9 — AC-13: CRUD endpoint load test.
 * Target: 100 concurrent users, p95 < 500ms.
 *
 * Run: k6 run test/load/crud-load.js
 * With env: k6 run -e BASE_URL=http://localhost:3001/api/v1 -e AUTH_TOKEN=<jwt> test/load/crud-load.js
 */

const errorRate = new Rate('errors');
const productListDuration = new Trend('product_list_duration');
const productGetDuration = new Trend('product_get_duration');

export const options = {
  ...PROFILES.normal,
  thresholds: {
    ...THRESHOLDS.crud,
    product_list_duration: ['p(95)<500'],
    product_get_duration: ['p(95)<500'],
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

  // Fallback to env token if login fails
  const token = __ENV.AUTH_TOKEN;
  if (!token) {
    throw new Error('Login failed and no AUTH_TOKEN env provided. Set AUTH_TOKEN or TEST_USER_EMAIL/TEST_USER_PASSWORD.');
  }
  return { token };
}

export default function (data) {
  const AUTH_TOKEN = data.token;
  const authOpts = getAuthHeaders(AUTH_TOKEN);

  // Test 1: List products
  const listRes = http.get(`${BASE_URL}/produtos?page=1&limit=20`, authOpts);
  productListDuration.add(listRes.timings.duration);
  check(listRes, {
    'list products status 200': (r) => r.status === 200,
    'list products has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 2: List suppliers
  const suppRes = http.get(`${BASE_URL}/fornecedores?page=1&limit=20`, authOpts);
  check(suppRes, {
    'list suppliers status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 3: List BOM
  const bomRes = http.get(`${BASE_URL}/bom?page=1&limit=20`, authOpts);
  check(bomRes, {
    'list bom status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 4: Health check (no auth required)
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'test/load/results/crud-load-report.json': JSON.stringify(data, null, 2),
  };
}
