import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const adminCardClass = "card-elevated border-border/70 bg-card/95";
export const adminInsetCardClass = "rounded-2xl border border-border/70 bg-background/70";

interface AdminPageShellProps {
  children: ReactNode;
  className?: string;
}

interface AdminHeroStat {
  label: string;
  value: string;
  meta?: string;
}

interface AdminHeroProps {
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  stats?: AdminHeroStat[];
  className?: string;
}

export function AdminPageShell({ children, className }: AdminPageShellProps) {
  return <div className={cn("mx-auto max-w-7xl space-y-6", className)}>{children}</div>;
}

export function AdminHero({
  title,
  description,
  badge,
  actions,
  stats,
  className,
}: AdminHeroProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(24,204,252,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(174,72,255,0.14),_transparent_24%),linear-gradient(135deg,#020617_0%,#0f172a_56%,#111827_100%)] p-6 text-white shadow-2xl md:p-8",
        className
      )}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            {badge ? (
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                {badge}
              </div>
            ) : null}
            <div className="space-y-3">
              <h1 className="text-4xl font-display font-bold leading-tight text-white md:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base text-white/70 md:text-lg">{description}</p>
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>

        {stats?.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.value}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <p className="text-sm text-white/55">{stat.label}</p>
                <p className="mt-2 text-3xl font-display font-bold text-white">{stat.value}</p>
                {stat.meta ? <p className="mt-1 text-sm text-white/65">{stat.meta}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
