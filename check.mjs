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
