import { Fragment, useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, Download, FileText, Pencil, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth, getCurrentUserProfile, getTrips, type TripRecord, updateTripFields } from "@/firebase";
import { auditLogService } from "@/auditLogService";
import { downloadPdf, generateLrPdf, generateTripPdf } from "@/tripPdf";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FleetLayout } from "./Index";

type TripsPageProps = {
  onSignOut: () => void;
};

const TRIPS_PER_PAGE = 20;

type DateRange = {
  start: Date;
  end: Date;
};

type LrFormValues = {
  lrNumber: string;
  date: string;
  eWayBillNumber: string;
  vehicleNumber: string;
  fromLocation: string;
  toLocation: string;
  consignorName: string;
  consignorAddress?: string;
  consignorGstin?: string;
  placeOfDispatch?: string;
  consigneeName: string;
  consigneeAddress?: string;
  consigneeGstin?: string;
  placeOfDelivery?: string;
  freightPayer?: "Consignor" | "Consignee";
  packages?: string;
  materialDescription: string;
  actualWeight?: string;
  chargedWeight?: string;
  weight: string;
  rate?: string;
  freightAmount: string;
  mazdoorHireCharges?: string;
  handlingCharges?: string;
  riskDetentionCharges?: string;
  totalFreightAmount?: string;
  thirdPartyName: string;
  insuranceStatus?: "not-insured" | "insured";
  insuranceCompany?: string;
  policyNumber?: string;
  riskAmount?: string;
};

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

function tripField(trip: TripRecord, key: keyof TripRecord) {
  const value = trip[key];
  return typeof value === "string" && value.trim() ? value : "—";
}

function tripDateValue(value: unknown) {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") return value.toDate() as Date;
  if (typeof value === "object" && value !== null && "seconds" in value && typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTripDate(value: unknown) {
  const date = tripDateValue(value);
  return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
}

function formatTripDateTime(value: unknown) {
  const date = tripDateValue(value);
  if (!date) return "—";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function tripDateInputValue(value: unknown) {
  const date = tripDateValue(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function getLocationLink(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}

function getRouteLink(from: string, to: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from.trim())}&destination=${encodeURIComponent(to.trim())}`;
}

function getInitialLrForm(trip: TripRecord): LrFormValues {
  return {
    lrNumber: trip.id,
    date: tripDateInputValue(trip.createdAt),
    eWayBillNumber: "",
    vehicleNumber: trip.vehicleNumber,
    fromLocation: trip.fromLocation,
    toLocation: trip.toLocation,
    consignorName: trip.customerCompanyName,
    consignorAddress: "",
    consignorGstin: "",
    placeOfDispatch: trip.fromLocation,
    consigneeName: trip.contactPerson,
    consigneeAddress: "",
    consigneeGstin: "",
    placeOfDelivery: trip.toLocation,
    freightPayer: "Consignor",
    packages: "1",
    materialDescription: trip.materialDimensions,
    actualWeight: trip.weight,
    chargedWeight: trip.weight,
    weight: trip.weight,
    rate: trip.isFreightPerKm && trip.distanceKm ? trip.freightPerKmRate || "" : "",
    freightAmount: trip.freightAmount,
    mazdoorHireCharges: "",
    handlingCharges: "",
    riskDetentionCharges: "",
    totalFreightAmount: trip.freightAmount,
    thirdPartyName: trip.transporterName,
    insuranceStatus: "not-insured",
    insuranceCompany: "",
    policyNumber: "",
    riskAmount: "",
  };
}

function normalizeTripStatus(status: string) {
  return status.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

function capitalizeName(name: string) {
  return name.trim().toLowerCase().split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatStatusLabel(status: string) {
  return normalizeTripStatus(status).split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatBillType(billType: string) {
  const value = billType.trim();
  if (!value) return "—";
  const normalized = value.toUpperCase();
  if (normalized.startsWith("TRV")) return "TRV";
  if (normalized.startsWith("SAS")) return "SAS";
  return value;
}

function formatTrvSubtype(trip: Pick<TripRecord, "billType" | "trvSubtype">) {
  const storedSubtype = trip.trvSubtype?.trim();
  const legacySubtype = trip.billType.split(":").pop()?.trim();
  const subtype = (storedSubtype || legacySubtype || "").toUpperCase();
  return subtype === "FCM" || subtype === "RCM" ? subtype : "—";
}

function TripStatus({ status }: { status: string }) {
  const label = formatStatusLabel(status || "confirmed");
  return <span className={`trip-status ${normalizeTripStatus(status || "confirmed")}`}><i />{label}</span>;
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

function matchesDateFilter(value: unknown, filter: string, customRange: DateRange | null) {
  const tripDate = tripDateValue(value);
  if (!tripDate) return false;
  if (filter === "All dates") return true;
  if (filter === "Custom range") return tripDate >= (customRange?.start ?? tripDate) && tripDate <= (customRange?.end ?? tripDate);

  const now = new Date();
  const today = startOfDay(now);
  const tripTime = tripDate.getTime();
  const todayTime = today.getTime();
  const nowTime = now.getTime();
  if (filter === "Last 8 hours") return tripTime >= nowTime - 8 * 3600000 && tripTime <= nowTime;
  if (filter === "Last 12 hours") return tripTime >= nowTime - 12 * 3600000 && tripTime <= nowTime;
  if (filter === "Last 24 hours") return tripTime >= nowTime - 24 * 3600000 && tripTime <= nowTime;
  if (filter === "Today") return tripTime >= todayTime && tripTime <= nowTime;
  if (filter === "Yesterday") return tripTime >= todayTime - 86400000 && tripTime < todayTime;
  if (filter === "Last 7 days") return tripTime >= todayTime - 6 * 86400000 && tripTime <= nowTime;
  if (filter === "This week") return tripTime >= startOfWeek(now).getTime() && tripTime <= nowTime;
  if (filter === "Last week") {
    const thisWeek = startOfWeek(now);
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return tripTime >= lastWeek.getTime() && tripTime < thisWeek.getTime();
  }
  if (filter === "Last 15 days") return tripTime >= todayTime - 14 * 86400000 && tripTime <= nowTime;
  if (filter === "Last 30 days") return tripTime >= todayTime - 29 * 86400000 && tripTime <= nowTime;
  if (filter === "This month") return tripDate.getFullYear() === now.getFullYear() && tripDate.getMonth() === now.getMonth();
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

export default function TripsPage({ onSignOut }: TripsPageProps) {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [dateFilter, setDateFilter] = useState("All dates");
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("All Users");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);
  const [tripPdfContactNumber, setTripPdfContactNumber] = useState("");
  const [tripPdfRemarks, setTripPdfRemarks] = useState("");
  const [includeCompanyName, setIncludeCompanyName] = useState(true);
  const [tripPdfSaving, setTripPdfSaving] = useState(false);
  const [lrTrip, setLrTrip] = useState<TripRecord | null>(null);
  const [lrForm, setLrForm] = useState<LrFormValues | null>(null);

  const handleViewTrip = (trip: TripRecord) => {
    setSelectedTrip(trip);
    setTripPdfContactNumber(trip.contactNumber || "");
    setTripPdfRemarks(trip.description || trip.financialDescription || "");
    setIncludeCompanyName(true);
  };
  const handleOpenLrForm = (trip: TripRecord) => {
    setLrTrip(trip);
    setLrForm(getInitialLrForm(trip));
  };
  const updateLrForm = (field: keyof LrFormValues, value: string) => setLrForm((current) => current ? { ...current, [field]: value } : current);
  const copyTripPdfLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };
  const handleSaveTripPdfFields = async () => {
    if (!selectedTrip?.documentId) return;
    const contactNumber = tripPdfContactNumber.trim();
    const remarks = tripPdfRemarks.trim();
    setTripPdfSaving(true);
    try {
      await updateTripFields(selectedTrip.documentId, {
        contactNumber,
        description: remarks,
        financialDescription: remarks,
      });
      try {
        const auditTripId = selectedTrip.documentId || selectedTrip.id;
        await Promise.all([
          auditLogService.logTripUpdate(auditTripId, "Contact Number", selectedTrip.contactNumber, contactNumber),
          auditLogService.logTripUpdate(auditTripId, "Financial Description", selectedTrip.description || selectedTrip.financialDescription, remarks),
        ]);
      } catch (auditError) {
        console.error("Trip document audit logging failed:", auditError);
      }
      setSelectedTrip((current) => current ? { ...current, contactNumber, description: remarks, financialDescription: remarks } : current);
      setTrips((current) => current.map((trip) => trip.documentId === selectedTrip.documentId ? { ...trip, contactNumber, description: remarks, financialDescription: remarks } : trip));
      toast.success("Trip document details saved.");
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Trip document details could not be saved.");
    } finally {
      setTripPdfSaving(false);
    }
  };
  const handleDownloadTripPdf = async () => {
    if (!selectedTrip) return;
    const result = await generateTripPdf(selectedTrip, tripPdfRemarks, tripPdfContactNumber, includeCompanyName);
    downloadPdf(result.blob, result.fileName);
  };
  const handleDownloadLrPdf = async () => {
    if (!lrForm) return;
    const result = await generateLrPdf(lrForm);
    downloadPdf(result.blob, result.fileName);
  };

  const loadTrips = async () => {
    setLoading(true);
    setError("");
    try {
      setTrips(await getTrips());
    } catch (caughtError) {
      if (caughtError instanceof FirebaseError && caughtError.code === "permission-denied") {
        setError("Firestore denied access to trips. Deploy the latest Firestore rules and verify your user profile has the expected role and ownership fields are set on trips.");
      } else {
        setError("Trips could not be loaded. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void getCurrentUserProfile().then((profile) => {
      if (active) setIsAdmin(profile?.isAdmin === true || profile?.role === "admin");
    });
    void loadTrips();
    return () => { active = false; };
  }, []);

  const userOptions = useMemo(() => {
    const users = new Map<string, string>();
    trips.forEach((trip) => {
      if (trip.userId) users.set(trip.userId, trip.assigneeName || trip.userId);
    });
    return Array.from(users.entries()).sort(([, firstName], [, secondName]) => firstName.localeCompare(secondName));
  }, [trips]);
  const profileAssigneeName = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return undefined;
    return trips.find((trip) => trip.assigneeName.trim() && (trip.createdBy === currentUserId || trip.userId === currentUserId))?.assigneeName.trim();
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trips.filter((trip) => {
      const matchesSearch = !query || [trip.id, trip.vehicleNumber, trip.customerCompanyName, trip.fromLocation, trip.toLocation, trip.assigneeName, trip.userName]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
      const tripStatus = normalizeTripStatus(trip.status || "Confirmed");
      const selectedStatus = normalizeTripStatus(statusFilter);
      const matchesStatus = statusFilter === "All Statuses" || tripStatus === selectedStatus;
      const matchesUser = userFilter === "All Users" || trip.userId === userFilter;
      return matchesSearch && matchesStatus && matchesUser && matchesDateFilter(trip.createdAt, dateFilter, customDateRange);
    });
  }, [customDateRange, dateFilter, search, statusFilter, trips, userFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTrips.length / TRIPS_PER_PAGE));
  const paginatedTrips = filteredTrips.slice((currentPage - 1) * TRIPS_PER_PAGE, currentPage * TRIPS_PER_PAGE);
  const firstVisibleTrip = filteredTrips.length ? (currentPage - 1) * TRIPS_PER_PAGE + 1 : 0;
  const lastVisibleTrip = Math.min(currentPage * TRIPS_PER_PAGE, filteredTrips.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [customDateRange, dateFilter, search, statusFilter, userFilter]);

  useEffect(() => {
    if (!dateMenuOpen && !userMenuOpen && !statusMenuOpen) return;
    const closeFilterMenus = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-date-filter], [data-user-filter], [data-status-filter]")) return;
      setDateMenuOpen(false);
      setUserMenuOpen(false);
      setStatusMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeFilterMenus, true);
    return () => document.removeEventListener("pointerdown", closeFilterMenus, true);
  }, [dateMenuOpen, statusMenuOpen, userMenuOpen]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const dateFilterLabel = dateFilter === "All dates"
    ? "Filter by Date"
    : dateFilter === "Custom range" && customDateRange
      ? `${formatPickerDate(customDateRange.start)} — ${formatPickerDate(customDateRange.end)}`
      : QUICK_DATE_RANGES.find((range) => range.value === dateFilter)?.label ?? "Filter by Date";

  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Trips" profileName={profileAssigneeName}>
      <div className="trips-page">
        <div className="trips-page-header">
          <div>
            <div className="trips-breadcrumb"><span>Fleet Management</span><ArrowRight size={13} /><strong>Trips</strong></div>
            <h1>Trips <span className="trips-count">({filteredTrips.length})</span></h1>
            <p>Manage and track all transportation trips</p>
          </div>
          <button className="trips-primary-button" onClick={() => navigate("/trips/create")}><Plus size={17} /> Create Trip</button>
        </div>

        <section className="trips-card">
          <div className="trips-toolbar">
            <label className="trips-search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by trip, vehicle, or customer" />
            </label>
            <div className="trips-select-field trips-date-filter" data-date-filter>
              <CalendarDays size={15} />
              <button type="button" className="trips-user-filter-trigger" aria-expanded={dateMenuOpen} onClick={() => { setDateMenuOpen((open) => !open); setUserMenuOpen(false); setStatusMenuOpen(false); }}>
                <span>{dateFilterLabel}</span>
                <ChevronDown size={14} />
              </button>
              {dateMenuOpen && <DateFilterMenu activeFilter={dateFilter} customRange={customDateRange} onClose={() => setDateMenuOpen(false)} onQuickRange={(value) => { setDateFilter(value); setCustomDateRange(null); setDateMenuOpen(false); }} onApplyCustom={(range) => { setCustomDateRange(range); setDateFilter("Custom range"); setDateMenuOpen(false); }} />}
            </div>
            <div className="trips-select-field trips-status-filter" data-status-filter>
              <button type="button" className="trips-user-filter-trigger" aria-expanded={statusMenuOpen} onClick={() => { setStatusMenuOpen((open) => !open); setUserMenuOpen(false); setDateMenuOpen(false); }}>
                <span>{statusFilter === "All Statuses" ? "Filter by Status" : formatStatusLabel(statusFilter)}</span>
                <ChevronDown size={14} />
              </button>
              {statusMenuOpen && <div className="trips-filter-menu" role="listbox" aria-label="Filter by status">
                <button type="button" className={statusFilter === "All Statuses" ? "active" : ""} onClick={() => { setStatusFilter("All Statuses"); setStatusMenuOpen(false); }}>Filter by Status</button>
                <button type="button" role="option" aria-selected={statusFilter === "Confirmed"} className={statusFilter === "Confirmed" ? "active" : ""} onClick={() => { setStatusFilter("Confirmed"); setStatusMenuOpen(false); }}>Confirmed</button>
                <button type="button" role="option" aria-selected={statusFilter === "Cancelled"} className={statusFilter === "Cancelled" ? "active" : ""} onClick={() => { setStatusFilter("Cancelled"); setStatusMenuOpen(false); }}>Cancelled</button>
              </div>}
            </div>
            {isAdmin && <div className="trips-select-field trips-user-filter" data-user-filter>
              <Users size={15} />
              <button type="button" className="trips-user-filter-trigger" aria-expanded={userMenuOpen} onClick={() => { setUserMenuOpen((open) => !open); setStatusMenuOpen(false); setDateMenuOpen(false); }}>
                <span>{userFilter === "All Users" ? "Filter by User" : capitalizeName(userOptions.find(([userId]) => userId === userFilter)?.[1] ?? "") || "Filter by User"}</span>
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && <div className="trips-filter-menu" role="listbox" aria-label="Filter by user">
                <button type="button" className={userFilter === "All Users" ? "active" : ""} onClick={() => { setUserFilter("All Users"); setUserMenuOpen(false); }}>Filter by User</button>
                {userOptions.map(([userId, userName]) => <button type="button" role="option" aria-selected={userFilter === userId} className={userFilter === userId ? "active" : ""} key={userId} onClick={() => { setUserFilter(userId); setUserMenuOpen(false); }}>{capitalizeName(userName)}</button>)}
              </div>}
            </div>}
            <button className="trips-refresh-button" onClick={() => void loadTrips()} title="Refresh trips"><RefreshCw size={15} /></button>
          </div>

          {error && <div className="trips-error"><span>{error}</span><button onClick={() => void loadTrips()}>Try again</button></div>}
          <div className="trips-table-wrap">
            <table className="trips-table">
              <thead>
                <tr><th className="trip-expand-column" aria-label="Expand trip" /><th>Trip ID</th><th>Vehicle</th><th>Customer</th><th>From → To</th><th>Assignee</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} className="trips-empty"><span className="trips-spinner" />Loading trips…</td></tr>}
                {!loading && !filteredTrips.length && <tr><td colSpan={9} className="trips-empty"><FileText size={25} /><strong>{trips.length ? "No trips match your filters" : "No trips found"}</strong><span>{trips.length ? "Try changing the search or filters." : "Create your first transportation trip to see it here."}</span></td></tr>}
                {!loading && paginatedTrips.map((trip, index) => {
                  const tripKey = trip.documentId ?? trip.id;
                  const isExpanded = expandedTripId === tripKey;
                  const otherPaymentDescriptions = trip.otherPayments.map((payment) => payment.description).filter(Boolean).join(", ") || "—";
                  const otherPaymentAmounts = trip.otherPayments.map((payment) => payment.amount).filter(Boolean).join(", ") || "—";
                  const details = [
                    ["Created At", formatTripDateTime(trip.createdAt)],
                    ["Trip ID", tripField(trip, "id")],
                    ["Vehicle Number", tripField(trip, "vehicleNumber")],
                    ["Vehicle Type", tripField(trip, "vehicleType")],
                    ["Bill Type", formatBillType(trip.billType)],
                    ...(trip.billType.trim().toUpperCase().startsWith("TRV") ? [["TRV Subtype", formatTrvSubtype(trip)]] : []),
                    ["Assignee Name", tripField(trip, "assigneeName")],
                    ["Reference Name", tripField(trip, "referenceName")],
                    ["Customer Company Name", tripField(trip, "customerCompanyName")],
                    ["Contact Person", tripField(trip, "contactPerson")],
                    ["Contact Number", tripField(trip, "contactNumber")],
                    ["From Location", tripField(trip, "fromLocation")],
                    ["To Location", tripField(trip, "toLocation")],
                    ["Material & Dimensions", `${tripField(trip, "materialDimensions")} · ${tripField(trip, "weight")} ${trip.weightUnit || "tons"}`],
                    ["Freight Amount", tripField(trip, "freightAmount")],
                    ["Commission", tripField(trip, "commission")],
                    ["Freight per Kilometer", tripField(trip, "freightPerKilometer")],
                    ["Advance Payment Received", tripField(trip, "advancePaymentReceived")],
                    ["Description", tripField(trip, "description")],
                    ["3rd Party Description", tripField(trip, "thirdPartyDescription")],
                    ["3rd Party Transporter Name", tripField(trip, "transporterName")],
                    ["3rd Party Transportation Phone", tripField(trip, "transporterPhone")],
                    ["3rd Party Freight Amount", tripField(trip, "thirdPartyFreightAmount")],
                    ["3rd Party Booking Freight", tripField(trip, "bookingFreight")],
                    ["3rd Party Advance Payment", tripField(trip, "thirdPartyAdvancePayment")],
                    ["Other Payments Description", otherPaymentDescriptions],
                    ["Other Payments Amount", otherPaymentAmounts],
                    ["Order Status", formatStatusLabel(trip.status || "Confirmed")],
                    ["Created By", tripField(trip, "createdBy")],
                  ];
                  return <Fragment key={tripKey}>
                    <tr className={`trip-summary-row ${isExpanded ? "expanded" : ""}`} onClick={() => setExpandedTripId((current) => current === tripKey ? null : tripKey)}>
                      <td className="trip-expand-cell"><button type="button" className={`trip-expand-button ${isExpanded ? "expanded" : ""}`} aria-label={`${isExpanded ? "Collapse" : "Expand"} trip ${trip.id}`} aria-expanded={isExpanded} aria-controls={`trip-details-${tripKey}`} onClick={(event) => { event.stopPropagation(); setExpandedTripId((current) => current === tripKey ? null : tripKey); }}><ChevronDown size={15} /></button></td>
                      <td><strong className="trip-id">{trip.id.slice(0, 8).toUpperCase() || `TRP-${index + 1}`}</strong></td>
                      <td><strong>{tripField(trip, "vehicleNumber")}</strong><small>{tripField(trip, "vehicleType")}</small></td>
                      <td>{tripField(trip, "customerCompanyName")}<small>{tripField(trip, "contactPerson")}</small></td>
                      <td><span className="trip-route"><b>{tripField(trip, "fromLocation")}</b><ArrowRight size={13} /><b>{tripField(trip, "toLocation")}</b></span><small>{tripField(trip, "materialDimensions")} · {tripField(trip, "weight")} {trip.weightUnit || "tons"}</small></td>
                      <td>{tripField(trip, "assigneeName")}</td>
                      <td>{formatTripDate(trip.createdAt)}</td>
                      <td><TripStatus status={trip.status || "Confirmed"} /></td>
                      <td><div className="trip-row-actions" onClick={(event) => event.stopPropagation()}><button type="button" title="Edit trip" aria-label={`Edit trip ${trip.id}`} onClick={() => trip.documentId && navigate(`/trips/${encodeURIComponent(trip.documentId)}/edit`)}><Pencil size={15} /></button><button type="button" className="trip-document-button trip-document-button-red" title="Open trip document" aria-label={`Open trip document for ${trip.id}`} onClick={() => handleViewTrip(trip)}><FileText size={16} /></button><button type="button" className="trip-document-button trip-document-button-green" title="Open trip receipt" aria-label={`Open trip receipt for ${trip.id}`} onClick={() => handleOpenLrForm(trip)}><FileText size={16} /></button></div></td>
                    </tr>
                    {isExpanded && <tr id={`trip-details-${tripKey}`} className="trip-details-row"><td colSpan={9}><div className="trip-details-grid">{details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></td></tr>}
                  </Fragment>;
                })}
              </tbody>
            </table>
          </div>
          <div className="trips-pagination" aria-label="Trips pagination">
            <span>Showing {firstVisibleTrip}–{lastVisibleTrip} of {filteredTrips.length} trips</span>
            <div className="trips-pagination-controls">
              <button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1 || !filteredTrips.length}><ChevronLeft size={16} /></button>
              <span>Page {currentPage} of {pageCount}</span>
              <button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount || !filteredTrips.length}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="trips-pagination-meta"><span>Data synced from Firestore</span></div>
        </section>
        <Dialog open={Boolean(selectedTrip)} onOpenChange={(open) => { if (!open) setSelectedTrip(null); }}>
          <DialogContent className="trips-pdf-dialog">
            <DialogHeader>
              <DialogTitle>{selectedTrip ? `Trip ${selectedTrip.id}` : "Trip Details"}</DialogTitle>
              <DialogDescription>Review the trip information or download a PDF copy.</DialogDescription>
            </DialogHeader>
            {selectedTrip && <>
              <div className="trip-document-summary">
                <div className="trip-document-heading"><strong>Trip {selectedTrip.id}</strong><span>{selectedTrip.customerCompanyName || "—"}</span></div>
                <div className="trip-document-grid">
                  <div className="trip-document-field"><span>From Location</span><strong>{selectedTrip.fromLocation || "—"}</strong><div className="trip-document-link"><a href={getLocationLink(selectedTrip.fromLocation)} target="_blank" rel="noreferrer">{getLocationLink(selectedTrip.fromLocation)}</a><button type="button" aria-label="Copy from location link" onClick={() => void copyTripPdfLink(getLocationLink(selectedTrip.fromLocation))}><Copy size={14} /></button></div></div>
                  <div className="trip-document-field"><span>To Location</span><strong>{selectedTrip.toLocation || "—"}</strong><div className="trip-document-link"><a href={getLocationLink(selectedTrip.toLocation)} target="_blank" rel="noreferrer">{getLocationLink(selectedTrip.toLocation)}</a><button type="button" aria-label="Copy to location link" onClick={() => void copyTripPdfLink(getLocationLink(selectedTrip.toLocation))}><Copy size={14} /></button></div></div>
                  <div className="trip-document-field"><span>Material / Dimensions</span><strong>{selectedTrip.materialDimensions || "—"}</strong></div>
                  <div className="trip-document-field"><span>Weight</span><strong>{selectedTrip.weight || "—"} {selectedTrip.weightUnit || "tons"}</strong></div>
                  <div className="trip-document-field"><span>Trip ID</span><strong>{selectedTrip.id}</strong></div>
                  <div className="trip-document-field"><span>Customer / Company</span><strong>{selectedTrip.customerCompanyName || "—"}</strong><label className="trip-document-checkbox"><input type="checkbox" checked={includeCompanyName} onChange={(event) => setIncludeCompanyName(event.target.checked)} /><span>Include company name in PDF</span></label></div>
                  <div className="trip-document-field"><span>Date</span><strong>{formatTripDateTime(selectedTrip.createdAt)}</strong></div>
                  <div className="trip-document-field"><span>Vehicle No.</span><strong>{selectedTrip.vehicleNumber || "—"}</strong></div>
                </div>
                <div className="trip-document-field trip-document-route"><span>Trip Route Link</span><div className="trip-document-link"><a href={getRouteLink(selectedTrip.fromLocation, selectedTrip.toLocation)} target="_blank" rel="noreferrer">{getRouteLink(selectedTrip.fromLocation, selectedTrip.toLocation)}</a><button type="button" aria-label="Copy trip route link" onClick={() => void copyTripPdfLink(getRouteLink(selectedTrip.fromLocation, selectedTrip.toLocation))}><Copy size={14} /></button></div></div>
                <div className="trips-pdf-edit-grid trip-document-edit-grid">
                  <label><span>Remarks</span><textarea value={tripPdfRemarks} onChange={(event) => setTripPdfRemarks(event.target.value)} placeholder="Enter remarks here..." /></label>
                  <label><span>Contact Number</span><input value={tripPdfContactNumber} onChange={(event) => setTripPdfContactNumber(event.target.value)} placeholder="Enter contact number" /></label>
                </div>
              </div>
              <DialogFooter className="trip-document-actions">
                <button type="button" className="trips-pdf-download-button" onClick={() => void handleDownloadTripPdf()}><Download size={15} /> Download PDF</button>
                <button type="button" className="trip-document-save-button" onClick={() => void handleSaveTripPdfFields()} disabled={tripPdfSaving || !selectedTrip.documentId}>{tripPdfSaving ? "Saving…" : "Save Changes"}</button>
              </DialogFooter>
            </>}
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(lrForm)} onOpenChange={(open) => { if (!open) { setLrTrip(null); setLrForm(null); } }}>
          <DialogContent className="trips-pdf-dialog trips-lr-dialog">
            <DialogHeader>
              <DialogTitle>Create LR PDF</DialogTitle>
              <DialogDescription>Enter the LR details for trip {lrTrip?.id || "—"} before downloading the receipt.</DialogDescription>
            </DialogHeader>
            {lrForm && <>
              <div className="trips-lr-section">
                <h3>Receipt details</h3>
                <div className="trips-lr-grid">
                  {([
                    ["lrNumber", "LR / Receipt Number", "text"],
                    ["date", "Date", "date"],
                    ["eWayBillNumber", "E-Way Bill Number", "text"],
                    ["vehicleNumber", "Truck / Vehicle Number", "text"],
                    ["fromLocation", "From", "text"],
                    ["toLocation", "To", "text"],
                  ] as Array<[keyof LrFormValues, string, string]>).map(([field, label, type]) => <label className="trips-lr-field" key={field}><span>{label}</span><input type={type} value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} /></label>)}
                </div>
              </div>

              <div className="trips-lr-section">
                <h3>Consignor (bill from / dispatch)</h3>
                <div className="trips-lr-grid">
                  {([
                    ["consignorName", "Name", "text"],
                    ["consignorGstin", "GSTIN", "text"],
                    ["consignorAddress", "Address", "textarea"],
                    ["placeOfDispatch", "Place of Dispatch", "text"],
                  ] as Array<[keyof LrFormValues, string, string]>).map(([field, label, type]) => <label className={`trips-lr-field ${type === "textarea" ? "trips-lr-field-wide" : ""}`} key={field}><span>{label}</span>{type === "textarea" ? <textarea value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} /> : <input type={type} value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} />}</label>)}
                </div>
              </div>

              <div className="trips-lr-section">
                <h3>Consignee (bill to / delivery)</h3>
                <div className="trips-lr-grid">
                  {([
                    ["consigneeName", "Name", "text"],
                    ["consigneeGstin", "GSTIN", "text"],
                    ["consigneeAddress", "Address", "textarea"],
                    ["placeOfDelivery", "Place of Delivery", "text"],
                  ] as Array<[keyof LrFormValues, string, string]>).map(([field, label, type]) => <label className={`trips-lr-field ${type === "textarea" ? "trips-lr-field-wide" : ""}`} key={field}><span>{label}</span>{type === "textarea" ? <textarea value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} /> : <input type={type} value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} />}</label>)}
                </div>
              </div>

              <div className="trips-lr-section">
                <h3>Billing party</h3>
                <div className="trips-lr-grid trips-lr-grid-single">
                  <label className="trips-lr-field"><span>Freight paid by</span><select value={lrForm.freightPayer ?? "Consignor"} onChange={(event) => updateLrForm("freightPayer", event.target.value)}><option value="Consignor">Consignor</option><option value="Consignee">Consignee</option></select></label>
                </div>
              </div>

              <div className="trips-lr-section">
                <h3>Consignment and freight</h3>
                <div className="trips-lr-grid">
                  {([
                    ["packages", "Packages", "text"],
                    ["actualWeight", "Actual Weight", "text"],
                    ["chargedWeight", "Charged Weight", "text"],
                    ["rate", "Rate (Rs.)", "text"],
                    ["freightAmount", "Freight Charges (Rs.)", "text"],
                    ["mazdoorHireCharges", "Mazdoor Hire Charges (Rs.)", "text"],
                    ["handlingCharges", "Stationary / Handling (Rs.)", "text"],
                    ["riskDetentionCharges", "Risk & Detention (Rs.)", "text"],
                    ["totalFreightAmount", "Total Freight Amount (Rs.)", "text"],
                    ["thirdPartyName", "Third Party", "text"],
                  ] as Array<[keyof LrFormValues, string, string]>).map(([field, label, type]) => <label className="trips-lr-field" key={field}><span>{label}</span><input type={type} value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} /></label>)}
                  <label className="trips-lr-field trips-lr-field-wide"><span>Description (said to contain)</span><textarea value={lrForm.materialDescription} onChange={(event) => updateLrForm("materialDescription", event.target.value)} /></label>
                </div>
              </div>

              <div className="trips-lr-section">
                <h3>Insurance declaration</h3>
                <div className="trips-lr-grid">
                  <label className="trips-lr-field"><span>Insurance status</span><select value={lrForm.insuranceStatus ?? "not-insured"} onChange={(event) => updateLrForm("insuranceStatus", event.target.value)}><option value="not-insured">Consignment Not Insured</option><option value="insured">Consignment Insured</option></select></label>
                  {([
                    ["insuranceCompany", "Company Name"],
                    ["policyNumber", "Policy Number"],
                    ["riskAmount", "Risk Amount (Rs.)"],
                  ] as Array<[keyof LrFormValues, string]>).map(([field, label]) => <label className="trips-lr-field" key={field}><span>{label}</span><input value={lrForm[field] ?? ""} onChange={(event) => updateLrForm(field, event.target.value)} /></label>)}
                </div>
              </div>

              <DialogFooter><button type="button" className="create-cancel-button" onClick={() => { setLrTrip(null); setLrForm(null); }}>Cancel</button><button type="button" className="trips-pdf-download-button trips-pdf-download-button-green" onClick={handleDownloadLrPdf}><Download size={15} /> Download LR PDF</button></DialogFooter>
            </>}
          </DialogContent>
        </Dialog>
      </div>
    </FleetLayout>
  );
}
