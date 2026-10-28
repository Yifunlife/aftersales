import './tests/accounts.mjs';
import './tests/workspace.mjs';

import './tests/migration.mjs';

import './tests/customer.mjs';

import './tests/installation-costs.mjs';

import { checkIntake } from './scripts/intake/check.mjs';
await checkIntake();

// Both synchronization directions are exercised separately by tests/intake-sync.mjs.

import './tests/customer-intake.mjs';

import './tests/reporting.mjs';

import './tests/customer-self-service.mjs';

import "./tests/knowledge-intake.mjs";

import "./tests/problem-analysis.mjs";

import './tests/work-policy.mjs';
import './tests/runtime-bridge.mjs';

await import('./tests/engineering-people.mjs');

await import("./tests/import-dates.mjs");
await import("./tests/import-file-limit.mjs");

await import("./tests/import-excel-media.mjs");
