/** Shared by the feedback form and /api/feedback. Keep in sync with the check in the feedback migration. */
export const FEEDBACK_TOPICS = [
  { value: "idea", label: "Idea or feature request" },
  { value: "bug", label: "Something's broken" },
  { value: "invoice", label: "Invoices, GST or templates" },
  { value: "account", label: "Account and login" },
  { value: "other", label: "Something else" },
] as const

export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]["value"]

export const isFeedbackTopic = (v: unknown): v is FeedbackTopic => FEEDBACK_TOPICS.some((t) => t.value === v)
