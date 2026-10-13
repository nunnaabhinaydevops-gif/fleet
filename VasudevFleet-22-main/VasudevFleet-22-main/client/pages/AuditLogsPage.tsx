import { FirebaseError } from "firebase/app";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, History, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auditLogService } from "@/auditLogService";
import type { AuditAction, AuditLog } from "@shared/api";
import { FleetLayout } from "./Index";

type AuditLogsPageProps = {
  onSignOut: () => void;
};

const AUDIT_LOGS_PER_PAGE = 20;
const ACTIONS: Array<AuditAction | "all"> = ["all", "create", "update", "delete", "approve", "cancel"];
const QUICK_DATE_RANGES = [
  { label: "All dates", value: "All dates" },
  { label: "Last 8 Hours", value: "Last 8 hours" },
  { label: "Last 12 Hours", value: "Last 12 hours" },
  { label: "Last 24 Hours", value: "Last 24 hours" },
  { label: "Today", value: "Today" },
  { label: "Yesterday", value: "Yesterday" },
  { label: "Last 7 Days", value: "Last 7 days" },
  { label: "This Week", value: "This week" },
  { label: "Last Week", value: "Last week" },
  { label: "Last 15 Days", value: "Last 15 days" },
  { label: "Last 30 Days", value: "Last 30 days" },
  { label: "This Month", value: "This month" },
];

type DateRange = {
  start: Date;
  end: Date;
};

function actionLabel(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function auditDateValue(value: string) {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(timestamp: string) {
  if (!timestamp) return "—";
  const parsed = auditDateValue(timestamp);
  if (!parsed) return timestamp;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const daysFromMonday = result.getDay() === 0 ? 6 : result.getDay() - 1;
  result.setDate(result.getDate() - daysFromMonday);
  return result;
}

function matchesDateFilter(value: string, filter: string, customRange: DateRange | null) {
  const date = auditDateValue(value);
  if (!date) return false;
  if (filter === "All dates") return true;
  if (filter === "Custom range") return date >= (customRange?.start ?? date) && date <= (customRange?.end ?? date);

  const now = new Date();
  const today = startOfDay(now);
  const dateTime = date.getTime();
  const todayTime = today.getTime();
  const nowTime = now.getTime();
  if (filter === "Last 8 hours") return dateTime >= nowTime - 8 * 3600000 && dateTime <= nowTime;
  if (filter === "Last 12 hours") return dateTime >= nowTime - 12 * 3600000 && dateTime <= nowTime;
  if (filter === "Last 24 hours") return dateTime >= nowTime - 24 * 3600000 && dateTime <= nowTime;
  if (filter === "Today") return dateTime >= todayTime && dateTime <= nowTime;
  if (filter === "Yesterday") return dateTime >= todayTime - 86400000 && dateTime < todayTime;
  if (filter === "Last 7 days") return dateTime >= todayTime - 6 * 86400000 && dateTime <= nowTime;
  if (filter === "This week") return dateTime >= startOfWeek(now).getTime() && dateTime <= nowTime;
  if (filter === "Last week") {
    const thisWeek = startOfWeek(now);
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return dateTime >= lastWeek.getTime() && dateTime < thisWeek.getTime();
  }
  if (filter === "Last 15 days") return dateTime >= todayTime - 14 * 86400000 && dateTime <= nowTime;
  if (filter === "Last 30 days") return dateTime >= todayTime - 29 * 86400000 && dateTime <= nowTime;
  if (filter === "This month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return true;
}

function formatPickerDate(date: Date | null) {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Select date";
}

function isSameDay(first: Date | null, second: Date) {
  return Boolean(first && first.toDateString() === second.toDateString());
}

function dateWithTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function getTimeParts(time: string) {
  const [rawHours, minutes] = time.split(":").map(Number);
  const period = rawHours >= 12 ? "PM" : "AM";
  return { hour: String(rawHours % 12 || 12).padStart(2, "0"), minute: String(minutes).padStart(2, "0"), period };
}

function updateTime(time: string, part: "hour" | "minute" | "period", value: string) {
  const current = getTimeParts(time);
  const hour = part === "hour" ? Number(value) : Number(current.hour);
  const minute = part === "minute" ? Number(value) : Number(current.minute);
  const period = part === "period" ? value : current.period;
  const hours24 = period === "PM" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return `${String(hours24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function TimeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parts = getTimeParts(value);
  return <div className="date-picker-time-selects">
    <select value={parts.hour} onChange={(event) => onChange(updateTime(value, "hour", event.target.value))} aria-label="Hour">{Array.from({ length: 12 }, (_, index) => { const hour = String(index + 1).padStart(2, "0"); return <option key={hour}>{hour}</option>; })}</select>
    <span>:</span>
    <select value={parts.minute} onChange={(event) => onChange(updateTime(value, "minute", event.target.value))} aria-label="Minute">{Array.from({ length: 60 }, (_, index) => { const minute = String(index).padStart(2, "0"); return <option key={minute}>{minute}</option>; })}</select>
    <select value={parts.period} onChange={(event) => onChange(updateTime(value, "period", event.target.value))} aria-label="AM or PM"><option>AM</option><option>PM</option></select>
  </div>;
}

function DateCalendar({ month, start, end, onSelect }: { month: Date; start: Date | null; end: Date | null; onSelect: (date: Date) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });
  return <div className="date-picker-calendar">
    <div className="date-picker-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="date-picker-days">{days.map((day) => {
      const currentMonth = day.getMonth() === month.getMonth();
      const selected = isSameDay(start, day) || isSameDay(end, day);
      const inRange = Boolean(start && end && day > start && day < end);
      return <button type="button" key={day.toISOString()} className={`${currentMonth ? "" : "muted"} ${selected ? "selected" : ""} ${inRange ? "in-range" : ""}`} onClick={() => onSelect(day)}>{day.getDate()}</button>;
    })}</div>
  </div>;
}

function DateFilterMenu({ activeFilter, customRange, onQuickRange, onApplyCustom, onClose }: { activeFilter: string; customRange: DateRange | null; onQuickRange: (value: string) => void; onApplyCustom: (range: DateRange) => void; onClose: () => void }) {
  const now = new Date();
  const [start, setStart] = useState<Date | null>(() => customRange?.start ?? startOfDay(now));
  const [end, setEnd] = useState<Date | null>(() => customRange?.end ?? now);
  const [startTime, setStartTime] = useState(() => customRange ? `${String(customRange.start.getHours()).padStart(2, "0")}:${String(customRange.start.getMinutes()).padStart(2, "0")}` : "00:00");
  const [endTime, setEndTime] = useState(() => customRange ? `${String(customRange.end.getHours()).padStart(2, "0")}:${String(customRange.end.getMinutes()).padStart(2, "0")}` : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date((customRange?.start ?? now).getFullYear(), (customRange?.start ?? now).getMonth(), 1));

  const selectDate = (date: Date) => {
    if (!start || end) {
      setStart(date);
      setEnd(null);
      return;
    }
    if (date < start) {
      setStart(date);
      setEnd(start);
    } else {
      setEnd(date);
    }
  };
  const applyCustomRange = () => {
    if (!start || !end) return;
    const first = dateWithTime(start, startTime);
    const last = dateWithTime(end, endTime);
    onApplyCustom(first <= last ? { start: first, end: last } : { start: last, end: first });
  };
  const previousMonth = () => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const nextCalendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  const isCurrentMonth = calendarMonth.getFullYear() === now.getFullYear() && calendarMonth.getMonth() === now.getMonth();

  return <div className="date-filter-menu" data-date-filter>
    <div className="date-picker-main">
      <div className="date-picker-header">
        <strong>{formatPickerDate(start)} — {formatPickerDate(end)}</strong>
        <button type="button" onClick={onClose} aria-label="Close date filter"><X size={16} /></button>
      </div>
      <div className="date-picker-time-row">
        <label><span><Clock3 size={14} />Start time</span><TimeSelect value={startTime} onChange={setStartTime} /></label>
        <label><span><Clock3 size={14} />End time</span><TimeSelect value={endTime} onChange={setEndTime} /></label>
      </div>
      <div className="date-picker-months">
        <button type="button" className="date-picker-month-arrow" onClick={previousMonth} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <div><strong>{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><DateCalendar month={calendarMonth} start={start} end={end} onSelect={selectDate} /></div>
        <div><strong>{nextCalendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><DateCalendar month={nextCalendarMonth} start={start} end={end} onSelect={selectDate} /></div>
        {!isCurrentMonth && <button type="button" className="date-picker-month-arrow" onClick={nextMonth} aria-label="Next month"><ChevronRight size={16} /></button>}
      </div>
      <div className="date-picker-actions"><button type="button" className="date-picker-clear" onClick={() => { setStart(null); setEnd(null); }}>Clear</button><button type="button" className="date-picker-apply" disabled={!start || !end} onClick={applyCustomRange}>Apply</button></div>
    </div>
    <div className="date-picker-quick-ranges"><span>Quick ranges</span>{QUICK_DATE_RANGES.map((range) => <button type="button" key={range.value} className={activeFilter === range.value ? "active" : ""} onClick={() => onQuickRange(range.value)}>{range.label}</button>)}</div>
  </div>;
}

function auditValue(value: string | null) {
  return value?.trim() ? value : "—";
}

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "You do not have permission to view audit logs.";
  }
  return error instanceof Error ? error.message : "Audit logs could not be loaded.";
}

export default function AuditLogsPage({ onSignOut }: AuditLogsPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [dateFilter, setDateFilter] = useState("All dates");
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void auditLogService.getAllAuditLogs().then((nextLogs) => {
      if (active) setLogs(nextLogs);
    }).catch((caughtError) => {
      if (active) setError(errorMessage(caughtError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!dateMenuOpen) return;
    const closeDateMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-date-filter]")) return;
      setDateMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeDateMenu, true);
    return () => document.removeEventListener("pointerdown", closeDateMenu, true);
  }, [dateMenuOpen]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (!matchesDateFilter(log.timestamp, dateFilter, customDateRange)) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (!query) return true;
      return [
        log.tripId,
        log.action,
        log.fieldChanged,
        log.oldValue ?? "",
        log.newValue ?? "",
        log.updatedBy,
        log.comments,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [actionFilter, customDateRange, dateFilter, logs, search]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / AUDIT_LOGS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * AUDIT_LOGS_PER_PAGE, currentPage * AUDIT_LOGS_PER_PAGE);
  const firstVisibleLog = filteredLogs.length ? (currentPage - 1) * AUDIT_LOGS_PER_PAGE + 1 : 0;
  const lastVisibleLog = Math.min(currentPage * AUDIT_LOGS_PER_PAGE, filteredLogs.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, customDateRange, dateFilter, search]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const dateFilterLabel = dateFilter === "All dates"
    ? "Filter by Date"
    : dateFilter === "Custom range" && customDateRange
      ? `${formatPickerDate(customDateRange.start)} — ${formatPickerDate(customDateRange.end)}`
      : QUICK_DATE_RANGES.find((range) => range.value === dateFilter)?.label ?? "Filter by Date";

  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Audit Logs">
      <div className="audit-logs-page trips-page">
        <div className="trips-page-header">
          <div>
            <div className="trips-breadcrumb"><span>Fleet Management</span><span>→</span><strong>Audit Logs</strong></div>
            <h1>Audit Logs <span className="trips-count">({filteredLogs.length})</span></h1>
            <p>Review changes and activity recorded across transportation trips.</p>
          </div>
          <button className="trips-primary-button" type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
            <RefreshCw size={15} /> {loading ? "Refreshing…" : "Refresh Logs"}
          </button>
        </div>

        <section className="trips-card">
          <div className="trips-toolbar">
            <label className="trips-search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by trip, field, user, or action" />
            </label>
            <div className="trips-select-field trips-date-filter" data-date-filter>
              <CalendarDays size={15} />
              <button type="button" className="trips-user-filter-trigger" aria-expanded={dateMenuOpen} onClick={() => setDateMenuOpen((open) => !open)}>
                <span>{dateFilterLabel}</span>
                <ChevronDown size={14} />
              </button>
              {dateMenuOpen && <DateFilterMenu activeFilter={dateFilter} customRange={customDateRange} onClose={() => setDateMenuOpen(false)} onQuickRange={(value) => { setDateFilter(value); setCustomDateRange(null); setDateMenuOpen(false); }} onApplyCustom={(range) => { setCustomDateRange(range); setDateFilter("Custom range"); setDateMenuOpen(false); }} />}
            </div>
            <label className="trips-select-field audit-log-filter">
              <History size={15} />
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as AuditAction | "all")} aria-label="Filter audit logs by action">
                {ACTIONS.map((action) => <option key={action} value={action}>{action === "all" ? "All actions" : actionLabel(action)}</option>)}
              </select>
            </label>
          </div>

          {error && <div className="trips-error"><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}
          <div className="trips-table-wrap">
            <table className="trips-table audit-logs-table">
              <thead>
                <tr><th>Timestamp</th><th>Trip ID</th><th>Action</th><th>Field Changed</th><th>Change</th><th>Updated By</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="trips-empty"><span className="trips-spinner" />Loading audit logs…</td></tr>}
                {!loading && !error && !filteredLogs.length && <tr><td colSpan={7} className="trips-empty"><History size={25} /><strong>{logs.length ? "No logs match your filters" : "No audit logs found"}</strong><span>{logs.length ? "Try changing your search or action filter." : "Activity will appear here as trips are created and updated."}</span></td></tr>}
                {!loading && paginatedLogs.map((log) => <tr key={log.id}>
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td><strong className="trip-id">{log.tripId || "—"}</strong></td>
                  <td><span className={`audit-log-action audit-log-action-${log.action}`}>{actionLabel(log.action)}</span></td>
                  <td>{log.fieldChanged || "—"}</td>
                  <td><span className="audit-log-change"><span>{auditValue(log.oldValue)}</span><b>→</b><span>{auditValue(log.newValue)}</span></span></td>
                  <td>{log.updatedBy || "—"}</td>
                  <td><span className={`audit-log-status audit-log-status-${log.status}`}>{actionLabel(log.status)}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="trips-pagination" aria-label="Audit logs pagination">
            <span>Showing {firstVisibleLog}–{lastVisibleLog} of {filteredLogs.length} audit logs</span>
            <div className="trips-pagination-controls">
              <button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1 || !filteredLogs.length}><ChevronLeft size={16} /></button>
              <span>Page {currentPage} of {pageCount}</span>
              <button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount || !filteredLogs.length}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="trips-pagination-meta"><span>Showing {filteredLogs.length} of {logs.length} audit logs</span></div>
        </section>
      </div>
    </FleetLayout>
  );
}
