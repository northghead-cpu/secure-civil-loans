import type { BorrowerNotification } from "@/components/notifications/NotificationCenter";

type ApplicationStatus =
  | "selected"
  | "authorized"
  | "preparing"
  | "sent"
  | "received"
  | "under_review"
  | "additional_information_required"
  | "approved"
  | "declined"
  | "disbursed";

export function notificationForApplicationStatus(
  status: ApplicationStatus,
  lenderName: string,
  id = status,
): BorrowerNotification | null {
  const base = { id, createdAt: new Date().toISOString() };
  switch (status) {
    case "additional_information_required":
      return { ...base, type: "action_required", title: "Action required", message: `${lenderName} needs additional information to continue reviewing your application.`, href: "/application-status" };
    case "approved":
      return { ...base, type: "decision", title: "Application update", message: `${lenderName} has approved your application.`, href: "/application-status" };
    case "declined":
      return { ...base, type: "decision", title: "Application update", message: `${lenderName} has made a decision on your application.`, href: "/application-status" };
    case "received":
      return { ...base, type: "application_update", title: "Application received", message: `${lenderName} has received your application.`, href: "/application-status" };
    case "under_review":
      return { ...base, type: "application_update", title: "Application update", message: `${lenderName} is reviewing your application. No action is needed right now.`, href: "/application-status" };
    case "disbursed":
      return { ...base, type: "disbursement", title: "Loan update", message: `${lenderName} has confirmed that your loan has been disbursed.`, href: "/application-status" };
    default:
      return null;
  }
}
