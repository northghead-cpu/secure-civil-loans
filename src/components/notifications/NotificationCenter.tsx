import { Bell, CheckCircle2, Clock3, FileWarning, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type BorrowerNotificationType =
  | "verification"
  | "action_required"
  | "application_update"
  | "decision"
  | "disbursement";

export interface BorrowerNotification {
  id: string;
  type: BorrowerNotificationType;
  title: string;
  message: string;
  createdAt: string;
  href?: string;
  read?: boolean;
}

const typeIcon = {
  verification: CheckCircle2,
  action_required: FileWarning,
  application_update: Clock3,
  decision: CheckCircle2,
  disbursement: CheckCircle2,
} satisfies Record<BorrowerNotificationType, typeof CheckCircle2>;

const priority: BorrowerNotificationType[] = [
  "action_required",
  "decision",
  "verification",
  "application_update",
  "disbursement",
];

interface NotificationCenterProps {
  notifications?: BorrowerNotification[];
  onNavigate?: (href: string) => void;
}

export function NotificationCenter({ notifications = [], onNavigate }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => [...notifications].sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type)),
    [notifications],
  );

  const unreadCount = visible.filter((item) => !item.read && !readIds.has(item.id)).length;
  const hasAction = visible.some(
    (item) => item.type === "action_required" && !item.read && !readIds.has(item.id),
  );

  const markRead = (notification: BorrowerNotification) => {
    setReadIds((current) => new Set(current).add(notification.id));
    if (notification.href) onNavigate?.(notification.href);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-1 top-1 h-2 w-2 rounded-full",
                hasAction ? "bg-destructive" : "bg-primary",
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">Only important updates appear here.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close notifications">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-medium">You're all caught up.</p>
            <p className="mt-1 text-sm text-muted-foreground">There is nothing that needs your attention.</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {visible.map((notification) => {
              const Icon = typeIcon[notification.type];
              const unread = !notification.read && !readIds.has(notification.id);
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markRead(notification)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    unread && "bg-muted/30",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", notification.type === "action_required" && "text-destructive")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {notification.title}
                      {unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
