export type AgentEnrollmentActionState = {
  error: string | null;
  createdToken: string | null;
  facilityName: string | null;
  enrollmentName: string | null;
};

export const agentEnrollmentInitialState: AgentEnrollmentActionState = {
  error: null,
  createdToken: null,
  facilityName: null,
  enrollmentName: null,
};
