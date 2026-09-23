import React from 'react';
import type { TimelineEvent } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { User, ShieldAlert } from 'lucide-react';

interface ComplaintTimelineProps {
  timeline: TimelineEvent[];
  isEscalated?: boolean;
  slaBreachTime?: string;
}

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({
  timeline,
  isEscalated = false,
}) => {
  const { language } = useLanguage();

  return (
    <div className="relative pl-6 space-y-7 before:absolute before:left-2 before:top-2.5 before:bottom-2.5 before:w-[1px] before:bg-[var(--border-standard)] text-left">
      {timeline.map((event, index) => {
        const isLast = index === timeline.length - 1;
        const isBreached = event.isBreached || event.status === 'sla_breached';
        const isResolved = event.status === 'resolved';

        return (
          <div key={event.id || index} className="relative">
            {/* Minimal step marker: ✓, ●, or ○ */}
            <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-center text-[10px]">
              {isResolved ? (
                <span className="text-[var(--semantic-success)] font-bold">✓</span>
              ) : isBreached ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--semantic-error)]" />
              ) : isLast ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
              ) : (
                <span className="text-[var(--brand)] font-bold">✓</span>
              )}
            </div>

            {/* Event Typography (NO Card Wrapper) */}
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {language === 'ml' && event.titleMl ? event.titleMl : event.title}
                  </h4>
                  {isBreached && (
                    <span className="text-[10px] font-mono uppercase text-[var(--semantic-error)] font-bold">
                      [SLA Overdue]
                    </span>
                  )}
                  {event.status === 'escalated' && (
                    <span className="text-[10px] font-mono uppercase text-[var(--semantic-error)] font-bold">
                      [Escalated to DTO]
                    </span>
                  )}
                  {isLast && !isBreached && !isResolved && (
                    <span className="text-[10px] font-mono uppercase text-[var(--brand)] font-medium">
                      [Current Stage]
                    </span>
                  )}
                </div>

                <time className="text-[12px] font-mono text-[var(--text-muted)]">
                  {event.timestamp}
                </time>
              </div>

              {event.description && (
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {language === 'ml' && event.descriptionMl ? event.descriptionMl : event.description}
                </p>
              )}

              {event.actor && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] pt-0.5">
                  <User className="w-3 h-3 text-[var(--brand)]" />
                  <span>Action by: {event.actor}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isEscalated && (
        <div className="pt-2 flex items-start gap-2.5 text-[13px] text-[var(--semantic-error)]">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Escalation Active:</strong> Because this grievance breached the depot resolution SLA, it was automatically forwarded to the District Transport Officer for executive inquiry.
          </p>
        </div>
      )}
    </div>
  );
};
