'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

function useTestingQuery<T>(key: unknown[], path: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['testing', userId, ...key],
    queryFn: () => apiFetch<T>(path),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

function useTestingMutation(path: string, method: 'POST' | 'PATCH' = 'POST') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown = {}) =>
      apiFetch(path, { method, body: JSON.stringify(body) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['testing'] });
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useTestingDashboard() {
  return useTestingQuery<Record<string, unknown>>(['dashboard'], API_ROUTES.TESTING.DASHBOARD);
}

export function useTestingTestCases() {
  return useTestingQuery<Array<Record<string, unknown>>>(['test-cases'], API_ROUTES.TESTING.TEST_CASES);
}

export function useCreateTestingTestCase() {
  return useTestingMutation(API_ROUTES.TESTING.TEST_CASES);
}

export function useUpdateTestingTestCase(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.TEST_CASE(id), 'PATCH');
}

export function useTestingTestRuns() {
  return useTestingQuery<Array<Record<string, unknown>>>(['test-runs'], API_ROUTES.TESTING.TEST_RUNS);
}

export function useCreateTestingTestRun() {
  return useTestingMutation(API_ROUTES.TESTING.TEST_RUNS);
}

export function useUpdateTestingTestRun(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.TEST_RUN(id), 'PATCH');
}

export function useTestingBugs() {
  return useTestingQuery<Array<Record<string, unknown>>>(['bugs'], API_ROUTES.TESTING.BUGS);
}

export function useCreateTestingBug() {
  return useTestingMutation(API_ROUTES.TESTING.BUGS);
}

export function useUpdateTestingBug(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.BUG(id), 'PATCH');
}

export function useAssignTestingBug(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.BUG_ASSIGN(id));
}

export function useCloseTestingBug(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.BUG_CLOSE(id));
}

export function useReopenTestingBug(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.BUG_REOPEN(id));
}

export function useTestingUatSessions() {
  return useTestingQuery<Array<Record<string, unknown>>>(['uat-sessions'], API_ROUTES.TESTING.UAT_SESSIONS);
}

export function useCreateTestingUatSession() {
  return useTestingMutation(API_ROUTES.TESTING.UAT_SESSIONS);
}

export function useUpdateTestingUatSession(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.UAT_SESSION(id), 'PATCH');
}

export function useSignOffTestingUatSession(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.UAT_SIGN_OFF(id));
}

export function useTestingTrainingSessions() {
  return useTestingQuery<Array<Record<string, unknown>>>(['training-sessions'], API_ROUTES.TESTING.TRAINING_SESSIONS);
}

export function useCreateTestingTrainingSession() {
  return useTestingMutation(API_ROUTES.TESTING.TRAINING_SESSIONS);
}

export function useUpdateTestingTrainingSession(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.TRAINING_SESSION(id), 'PATCH');
}

export function useRecordTestingAttendance(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.TRAINING_ATTENDANCE(id));
}

export function useTestingDocumentation() {
  return useTestingQuery<Array<Record<string, unknown>>>(['documentation'], API_ROUTES.TESTING.DOCUMENTATION);
}

export function useCreateTestingDocumentation() {
  return useTestingMutation(API_ROUTES.TESTING.DOCUMENTATION);
}

export function useUpdateTestingDocumentation(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.DOCUMENT(id), 'PATCH');
}

export function useTestingReleaseNotes() {
  return useTestingQuery<Array<Record<string, unknown>>>(['release-notes'], API_ROUTES.TESTING.RELEASE_NOTES);
}

export function useCreateTestingReleaseNote() {
  return useTestingMutation(API_ROUTES.TESTING.RELEASE_NOTES);
}

export function useUpdateTestingReleaseNote(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.RELEASE_NOTE(id), 'PATCH');
}

export function useTestingHandoverChecklist() {
  return useTestingQuery<Array<Record<string, unknown>>>(['handover'], API_ROUTES.TESTING.HANDOVER_CHECKLIST);
}

export function useCreateTestingHandoverItem() {
  return useTestingMutation(API_ROUTES.TESTING.HANDOVER_CHECKLIST);
}

export function useUpdateTestingHandoverItem(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.HANDOVER_ITEM(id), 'PATCH');
}

export function useApproveTestingHandoverItem(id: string) {
  return useTestingMutation(API_ROUTES.TESTING.HANDOVER_APPROVE(id));
}
