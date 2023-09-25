import path from 'path';

export function resolveRelativeTo(testFilePath, dependencyPath) {
  // testFilePath is e.g. vitest/main.test.js
  // dependencyPath is e.g. ../main
  // resolve to main.js
  let res = path.join(path.dirname(testFilePath), dependencyPath);
  if (!res.endsWith('.js')) res += '.js'
  return res
}

export function containsErrors(errString) {
  return /error|fail/ig.test(errString)
}
