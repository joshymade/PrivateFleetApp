"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DailyEarningsReminderModal,
  type DailyEarningsReminderReason,
} from "@/components/loads/daily-earnings-reminder-modal";
import {
  consumePendingEarningsReminder,
  datesMissingDailyEarnings,
  PENDING_EARNINGS_REMINDER_KEY,
  periodReminderSessionKey,
  previousWorkDayNeedsDailyEarnings,
  writePendingEarningsReminder,
  type EarningsDaySnapshot,
} from "@/lib/loads/daily-earnings-reminder";
import { todayDateString } from "@/lib/loads/date";

type PunchSavedInfo = {
  workDate: string;
  /** Punch times before this save. */
  prevStart: string | null;
  prevEnd: string | null;
  /** Punch times after this save. */
  nextStart: string | null;
  nextEnd: string | null;
};

type DailyEarningsRemindersContextValue = {
  notifyPunchSaved: (info: PunchSavedInfo) => void;
  requestOpenDailyPay: (date: string) => void;
  registerDailyPayOpener: (date: string, open: () => void) => () => void;
};

const DailyEarningsRemindersContext =
  createContext<DailyEarningsRemindersContextValue | null>(null);

export function useDailyEarningsReminders() {
  return useContext(DailyEarningsRemindersContext);
}

type ReminderState = {
  dates: string[];
  reason: DailyEarningsReminderReason;
} | null;

function dayNeedsEarnings(
  day: EarningsDaySnapshot | null | undefined,
): boolean {
  if (!day) return false;
  if (day.loadCount > 0) return false;
  if (day.dailyPayAmount != null) return false;
  return true;
}

function canEnterDailyPayFor(date: string): boolean {
  return date < todayDateString();
}

export function DailyEarningsRemindersProvider({
  days,
  periodStart = null,
  periodEnd = null,
  enabled,
  children,
}: {
  /** Period (or week) day cards plus optional lookback days for prior punches. */
  days: EarningsDaySnapshot[];
  /** Inclusive start of the visible pay period / week. */
  periodStart?: string | null;
  /** Friday end of the current pay period (session dismiss key). */
  periodEnd?: string | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const [reminder, setReminder] = useState<ReminderState>(null);
  const openersRef = useRef(new Map<string, () => void>());
  const bootstrappedRef = useRef(false);

  const dayByDate = useMemo(() => {
    const map = new Map<string, EarningsDaySnapshot>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const showReminder = useCallback(
    (
      dates: string[],
      reason: DailyEarningsReminderReason,
      opts?: { persistPending?: boolean },
    ) => {
      const unique = [...new Set(dates)].filter(Boolean).sort();
      if (unique.length === 0) return;
      if (opts?.persistPending) {
        writePendingEarningsReminder({ dates: unique, reason });
      }
      setReminder({ dates: unique, reason });
    },
    [],
  );

  // Punch pending (survives refresh) first; else period-missing once per visit.
  // Defer setState so we sync from sessionStorage without cascading in-effect renders.
  useEffect(() => {
    if (!enabled || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const pending = consumePendingEarningsReminder();
    if (pending && pending.dates.length > 0) {
      const dates = pending.dates;
      const reason = pending.reason;
      queueMicrotask(() => showReminder(dates, reason));
      return;
    }

    const missing = datesMissingDailyEarnings(days).filter((date) => {
      if (periodStart && date < periodStart) return false;
      if (periodEnd && date > periodEnd) return false;
      return true;
    });
    if (missing.length === 0) return;

    const key = periodReminderSessionKey(periodEnd, missing);
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch {
      // sessionStorage may be unavailable; still show once this mount.
    }

    queueMicrotask(() => showReminder(missing, "period_missing"));
  }, [days, enabled, periodEnd, periodStart, showReminder]);

  const dismiss = useCallback(() => {
    setReminder((current) => {
      if (current?.reason === "period_missing") {
        try {
          sessionStorage.setItem(
            periodReminderSessionKey(periodEnd, current.dates),
            "1",
          );
        } catch {
          // ignore
        }
      }
      try {
        sessionStorage.removeItem(PENDING_EARNINGS_REMINDER_KEY);
      } catch {
        // ignore
      }
      return null;
    });
  }, [periodEnd]);

  const requestOpenDailyPay = useCallback((date: string) => {
    const open = openersRef.current.get(date);
    if (!open) return;
    window.requestAnimationFrame(() => {
      open();
      const el = document.querySelector(`[data-daily-pay-date="${date}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const registerDailyPayOpener = useCallback(
    (date: string, open: () => void) => {
      openersRef.current.set(date, open);
      return () => {
        if (openersRef.current.get(date) === open) {
          openersRef.current.delete(date);
        }
      };
    },
    [],
  );

  const notifyPunchSaved = useCallback(
    (info: PunchSavedInfo) => {
      if (!enabled) return;

      const newlyEnded = info.prevEnd == null && info.nextEnd != null;
      const day = dayByDate.get(info.workDate);

      // 1) End-of-shift: first time an end punch is saved for this day.
      if (newlyEnded && dayNeedsEarnings(day)) {
        showReminder([info.workDate], "end_punch", { persistPending: true });
        return;
      }

      // 2) New-day punch while prior completed work day lacks daily earnings.
      const startedOrTouched =
        info.nextStart != null || info.nextEnd != null;
      if (!startedOrTouched) return;

      const prev = previousWorkDayNeedsDailyEarnings(days, info.workDate);
      if (!prev) return;
      if (info.workDate <= prev.date) return;

      const isStartingFresh =
        info.prevStart == null && info.nextStart != null;
      const isFirstPunchOnDay =
        info.prevStart == null && info.prevEnd == null;

      if (isStartingFresh || isFirstPunchOnDay) {
        showReminder([prev.date], "new_day_punch", { persistPending: true });
      }
    },
    [dayByDate, days, enabled, showReminder],
  );

  const value = useMemo(
    () => ({
      notifyPunchSaved,
      requestOpenDailyPay,
      registerDailyPayOpener,
    }),
    [notifyPunchSaved, requestOpenDailyPay, registerDailyPayOpener],
  );

  const enterTarget = reminder?.dates[0] ?? null;
  const canEnter =
    enterTarget != null &&
    canEnterDailyPayFor(enterTarget) &&
    (dayByDate.get(enterTarget)?.loadCount ?? 0) === 0;

  return (
    <DailyEarningsRemindersContext.Provider value={value}>
      {children}
      {reminder ? (
        <DailyEarningsReminderModal
          dates={reminder.dates}
          reason={reminder.reason}
          canEnter={canEnter}
          onEnter={() => {
            const date = enterTarget;
            dismiss();
            if (date) requestOpenDailyPay(date);
          }}
          onDismiss={dismiss}
        />
      ) : null}
    </DailyEarningsRemindersContext.Provider>
  );
}
