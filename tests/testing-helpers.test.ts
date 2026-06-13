import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCsv,
  canApproveHandover,
  canSignOffUat,
  getDocumentationTemplates,
  getSeedTestCases,
  parseSteps,
  shouldCreateBugForFailedTest,
  validateBugReport,
  validateDocumentationRecord,
  validateReleaseNote,
  validateTestCase,
  validateTestRun,
  validateTrainingSession,
  validateUatSession,
} from '../src/lib/testing';

test('test case validation requires module, scenario, steps, and expected result', () => {
  assert.equal(validateTestCase({ moduleName: '', scenario: 'Login', testSteps: 'Open', expectedResult: 'Works' }), 'module is required.');
  assert.equal(validateTestCase({ moduleName: 'security', scenario: '', testSteps: 'Open', expectedResult: 'Works' }), 'scenario is required.');
  assert.equal(validateTestCase({ moduleName: 'security', scenario: 'Login', testSteps: '', expectedResult: 'Works' }), 'steps are required.');
  assert.equal(validateTestCase({ moduleName: 'security', scenario: 'Login', testSteps: 'Open', expectedResult: 'Works' }), null);
});

test('test run validation requires comments for failed runs', () => {
  assert.equal(
    validateTestRun({ testCaseId: '1', testerName: 'QA', actualResult: 'Failed', status: 'FAILED', comments: '' }),
    'comments are required for a failed test run.',
  );
  assert.equal(
    validateTestRun({ testCaseId: '1', testerName: 'QA', actualResult: 'Passed', status: 'PASSED', comments: '' }),
    null,
  );
});

test('bug, UAT, training, docs, and release validations require their core fields', () => {
  assert.equal(validateBugReport({ title: '', moduleName: 'sales', description: 'Issue', priority: 'HIGH', severity: 'HIGH' }), 'title is required.');
  assert.equal(validateUatSession({ sessionDate: '', moduleName: 'sales', participants: [{ participantName: 'A' }] }), 'date is required.');
  assert.equal(validateTrainingSession({ trainingTitle: 'Branch', trainerName: '', moduleName: 'branches', sessionDate: '2026-06-13' }), 'trainer is required.');
  assert.equal(validateDocumentationRecord({ title: 'Guide', documentType: 'User Manual', version: '', content: 'Body' }), 'version is required.');
  assert.equal(validateReleaseNote({ releaseVersion: '', releaseDate: '2026-06-13' }), 'release version is required.');
});

test('failed tests create bugs and critical bugs block UAT sign-off', () => {
  assert.equal(shouldCreateBugForFailedTest('FAILED'), true);
  assert.equal(shouldCreateBugForFailedTest('PASSED'), false);
  assert.equal(canSignOffUat([{ severity: 'CRITICAL', status: 'OPEN' }]), false);
  assert.equal(canSignOffUat([{ severity: 'HIGH', status: 'FIXED' }]), true);
});

test('handover approval blocks incomplete critical tasks', () => {
  assert.equal(
    canApproveHandover([{ isCritical: true, status: 'IN_PROGRESS', approvalStatus: 'PENDING' }]),
    false,
  );
  assert.equal(
    canApproveHandover([{ isCritical: true, status: 'COMPLETED', approvalStatus: 'APPROVED' }]),
    true,
  );
});

test('seed test cases and documentation templates are populated', () => {
  const testCases = getSeedTestCases();
  const docs = getDocumentationTemplates();

  assert.equal(testCases.length, 34);
  assert.equal(testCases.some((item) => item.scenario === 'Login and logout'), true);
  assert.equal(testCases.some((item) => item.scenario === 'Audit log report'), true);
  assert.equal(docs.length, 13);
  assert.equal(docs.some((item) => item.title === 'Backup and Restore Guide'), true);
});

test('steps parsing and CSV export normalize structured output', () => {
  assert.deepEqual(parseSteps('Step 1\nStep 2'), ['Step 1', 'Step 2']);
  const csv = buildCsv([{ module: 'sales', status: 'PASSED' }]);
  assert.equal(csv.includes('module,status'), true);
  assert.equal(csv.includes('"sales","PASSED"'), true);
});
