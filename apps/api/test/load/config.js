/**
 * Story 5.9 — AC-11: k6 load test configuration.
 *
 * Base configuration for all load test scenarios.
 * Usage: k6 run --config config.js <scenario.js>
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

export const THRESHOLDS = {
  // AC-13: p95 < 500ms for CRUD endpoints
  crud: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
  // AC-14: p95 < 5000ms for export endpoints
  export: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
  // AC-15: p95 < 30000ms for MRP execution
  mrp: {
    http_req_duration: ['p(95)<30000'],
    http_req_failed: ['rate<0.05'],
  },
};

/**
 * AC-12: Workload profiles.
 */
export const PROFILES = {
  // Normal traffic: gradual ramp to 50 VUs
  normal: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '30s', target: 0 },
    ],
  },
  // Peak traffic: ramp to 100 VUs
  peak: {
    stages: [
      { duration: '30s', target: 20 },
      { duration: '1m', target: 100 },
      { duration: '3m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
  // Stress test: ramp to 200 VUs
  stress: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '1m', target: 200 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
  },
};

/**
 * Helper to get a JWT token for authenticated requests.
 * In a real load test, this would call the login endpoint.
 */
export function getAuthHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}
