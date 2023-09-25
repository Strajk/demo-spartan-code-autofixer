import { strict as assert } from 'node:assert';
import { sum } from '../main.js';

assert.strictEqual(sum(1, 2), 3);
