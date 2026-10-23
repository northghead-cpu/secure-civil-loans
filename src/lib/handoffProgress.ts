export function handoffProgress(status: string): {
  completed: number;
  current: number | null;
} {
  if (["approved", "declined", "disbursed"].includes(status))
    return { completed: 5, current: null };
  if (status === "sent_to_lender") return { completed: 3, current: 3 };
  if (["lender_review", "additional_information_requested"].includes(status))
    return { completed: 3, current: 3 };
  if (["authorized", "preparing"].includes(status))
    return { completed: 2, current: 2 };
  return { completed: 0, current: null };
}
export function handoffStatusLabel(status: string): string {
  return (
    (
      {
        authorized: "Information sharing authorized",
        preparing: "Preparing your application",
        sent_to_lender: "Application sent",
        lender_review: "Financial institution review",
        additional_information_requested: "Additional information requested",
        approved: "Approved by the institution",
        declined: "Declined by the institution",
        disbursed: "Institution reported disbursement",
      } as Record<string, string>
    )[status] || status.replace(/_/g, " ")
  );
}
