import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useNavigate } from "react-router-dom";
import { auth, getCurrentUserProfile, subscribeToEnquiryNotifications, subscribeToIssues, type IssueRecord, type ManagedEnquiry, type UserProfile } from "@/firebase";
import { extractFleetxVehicles, fetchFleetxRealtime, readFleetxValue, type FleetxVehicle } from "@/lib/fleetx";
import {
  AlertCircle,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  BarChart3,
  Clock3,
  Download,
  ExternalLink,
  Fuel,
  Grid2X2,
  History as HistoryIcon,
  Layers3,
  LogOut,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Route,
  Search,
  Share2,
  ShieldCheck,
  Tag,
  TrafficCone,
  Truck,
  UserCircle,
  Users,
  X,
} from "lucide-react";

type VehicleStatus = "running" | "on-job" | "not-on-job" | "late";
type Tab = "vehicles" | "location";

type Vehicle = {
  id: string;
  plate: string;
  group: string;
  driver: string;
  insurance: boolean;
  status: VehicleStatus;
  fuel: string;
  fuelPercent: number;
  duration: string;
  distance: string;
  speed: string;
  odometer: string;
  location: string;
  since: string;
  x: number;
  y: number;
  latitude?: number;
  longitude?: number;
};

const DEFAULT_VEHICLE_PANEL_WIDTH = 480;
const MIN_VEHICLE_PANEL_WIDTH = 360;
const MAX_VEHICLE_PANEL_WIDTH = 680;
const GOOGLE_MAP_CENTER = { lat: 17.72, lng: 83.12 };
const GOOGLE_MAP_ZOOM = 10;
const GOOGLE_MAPS_API_KEY = 'AIzaSyDksQEPg9opjwP17BWPuvCeQ_QVeCl-TRY';
let googleMapsOptionsConfigured = false;

const vehicleStatusColors: Record<VehicleStatus, string> = {
  running: "#22a66f",
  "on-job": "#2687d8",
  "not-on-job": "#87949d",
  late: "#e05a55",
};

const vehiclePosition = (vehicle: Vehicle) => ({
  lat: vehicle.latitude ?? 17.35 + (100 - vehicle.y) * 0.007,
  lng: vehicle.longitude ?? 82.88 + vehicle.x * 0.006,
});

function vehicleMarkerIcon(vehicle: Vehicle, selected: boolean): google.maps.Icon {
  const size = selected ? 52 : 44;
  const color = vehicleStatusColors[vehicle.status];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 1.25}" height="${size}" viewBox="0 0 64 48"><defs><linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#e8f3f7"/><stop offset="1" stop-color="#9fbcc7"/></linearGradient><linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ffff"/><stop offset="1" stop-color="#b2d0db"/></linearGradient><filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#173b4d" flood-opacity=".34"/></filter></defs><ellipse cx="32" cy="42" rx="25" ry="3" fill="#173b4d" opacity=".2"/><g filter="url(#shadow)"><path d="M7 17h34v18H7z" fill="url(#body)" stroke="#3e5b68" stroke-width="1.5" stroke-linejoin="round"/><path d="M41 20h8l8 8v7H41z" fill="url(#cab)" stroke="#3e5b68" stroke-width="1.5" stroke-linejoin="round"/><path d="M44 22h5l5 5H44z" fill="#62b1ca" stroke="#3e5b68" stroke-width="1" stroke-linejoin="round"/><path d="M9 21h30v5H9z" fill="${color}"/><path d="M11 18h29" stroke="#ffffff" stroke-width="1.5" opacity=".85"/><circle cx="18" cy="37" r="4.5" fill="#263f4b" stroke="#ffffff" stroke-width="1.5"/><circle cx="49" cy="37" r="4.5" fill="#263f4b" stroke="#ffffff" stroke-width="1.5"/><circle cx="18" cy="37" r="1.5" fill="#b9d0d8"/><circle cx="49" cy="37" r="1.5" fill="#b9d0d8"/></g></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size * 1.25, size),
    anchor: new google.maps.Point(size * .625, size / 2),
  };
}

function legacyVehicleMarkerIcon(vehicle: Vehicle, selected: boolean): google.maps.Icon {
  const size = selected ? 46 : 38;
  const color = vehicleStatusColors[vehicle.status];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#dce7ed" stop-opacity=".95"/></linearGradient><linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#e8f3f7"/><stop offset="1" stop-color="#aac3ce"/></linearGradient><linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ffff"/><stop offset="1" stop-color="#b9d6e0"/></linearGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#173b4d" flood-opacity=".35"/></filter></defs><circle cx="24" cy="24" r="21" fill="${color}" opacity=".92"/><circle cx="24" cy="24" r="18.5" fill="url(#ring)" stroke="${color}" stroke-width="2.5" filter="url(#shadow)"/><path d="M10 18.5h19v13H10z" fill="url(#body)" stroke="#4c6977" stroke-width="1.4" stroke-linejoin="round"/><path d="M29 21h5.3l5 5v5.5H29z" fill="url(#cab)" stroke="#4c6977" stroke-width="1.4" stroke-linejoin="round"/><path d="M31 22.5v3h5l-2.8-3z" fill="#54a7c4" opacity=".9"/><path d="M12 21h14" stroke="#ffffff" stroke-width="1.3" opacity=".85"/><circle cx="16" cy="33" r="3.1" fill="#263f4b" stroke="#ffffff" stroke-width="1.2"/><circle cx="34" cy="33" r="3.1" fill="#263f4b" stroke="#ffffff" stroke-width="1.2"/><circle cx="16" cy="33" r="1" fill="#b9d0d8"/><circle cx="34" cy="33" r="1" fill="#b9d0d8"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function vehicleInfoWindowContent(vehicle: Vehicle) {
  const statusLabel = vehicle.status === "on-job" ? "On Job" : vehicle.status === "late" ? "Late" : vehicle.status === "running" ? "Running" : "Not On Job";
  const color = vehicleStatusColors[vehicle.status];
  return `<div class="fleet-map-info-window"><div class="fleet-map-info-header"><div><strong>${escapeHtml(vehicle.id)} <span>${escapeHtml(vehicle.plate)}</span></strong><small>Group: ${escapeHtml(vehicle.group)} · Driver: ${escapeHtml(vehicle.driver)}</small></div></div><div class="fleet-map-info-status"><i style="background:${color}"></i>${statusLabel}<span>Since ${escapeHtml(vehicle.since)}</span></div><div class="fleet-map-info-grid"><span>Fuel</span><strong>${escapeHtml(vehicle.fuel)}, ${vehicle.fuelPercent}%</strong><span>Speed</span><strong>${escapeHtml(vehicle.speed)}</strong><span>Odometer</span><strong>${escapeHtml(vehicle.odometer)}</strong></div><div class="fleet-map-info-location"><span>Location</span><strong>${escapeHtml(vehicle.location)}</strong></div></div>`;
}

let cachedProfileUserId: string | null = null;
let cachedUserProfile: UserProfile | undefined;

function getCachedUserProfile() {
  const userId = auth?.currentUser?.uid;
  return userId && userId === cachedProfileUserId ? cachedUserProfile : undefined;
}

const seedVehicles: Vehicle[] = [
  {
    id: "3377",
    plate: "AP39T3377",
    group: "RUNNING VEHICLES",
    driver: "SATYAM",
    insurance: true,
    status: "not-on-job",
    fuel: "266L / 392L",
    fuelPercent: 68,
    duration: "43m",
    distance: "32.2 km",
    speed: "4 km/h",
    odometer: "18724 KM",
    location: "NAKKAPALLI 3KM RADIUS",
    since: "2003 hrs",
    x: 56,
    y: 64,
  },
  {
    id: "5345",
    plate: "AP16TE5345",
    group: "RUNNING VEHICLES",
    driver: "HARISH CHANDRA",
    insurance: true,
    status: "running",
    fuel: "311L / 392L",
    fuelPercent: 79,
    duration: "1h 18m",
    distance: "54.8 km",
    speed: "38 km/h",
    odometer: "24109 KM",
    location: "VISAKHAPATNAM HIGHWAY",
    since: "2011 hrs",
    x: 44,
    y: 35,
  },
  {
    id: "7821",
    plate: "AP31TG7821",
    group: "LONG HAUL",
    driver: "RAVI KUMAR",
    insurance: true,
    status: "on-job",
    fuel: "184L / 392L",
    fuelPercent: 47,
    duration: "2h 04m",
    distance: "87.1 km",
    speed: "51 km/h",
    odometer: "38291 KM",
    location: "TUNI CHECKPOST",
    since: "1846 hrs",
    x: 70,
    y: 45,
  },
  {
    id: "4218",
    plate: "AP05TX4218",
    group: "SERVICE VEHICLES",
    driver: "PRASAD",
    insurance: false,
    status: "late",
    fuel: "102L / 240L",
    fuelPercent: 42,
    duration: "4h 12m",
    distance: "12.6 km",
    speed: "0 km/h",
    odometer: "15901 KM",
    location: "NARSIPATNAM DEPOT",
    since: "1638 hrs",
    x: 29,
    y: 57,
  },
  {
    id: "9184",
    plate: "AP39Y9184",
    group: "RUNNING VEHICLES",
    driver: "MANOJ",
    insurance: true,
    status: "running",
    fuel: "278L / 392L",
    fuelPercent: 71,
    duration: "26m",
    distance: "18.4 km",
    speed: "29 km/h",
    odometer: "19455 KM",
    location: "KASIMKOTA ROAD",
    since: "2021 hrs",
    x: 64,
    y: 28,
  },
  {
    id: "6620",
    plate: "AP16TY6620",
    group: "IDLE VEHICLES",
    driver: "KIRAN",
    insurance: true,
    status: "not-on-job",
    fuel: "225L / 392L",
    fuelPercent: 57,
    duration: "6h 41m",
    distance: "0 km",
    speed: "0 km/h",
    odometer: "31088 KM",
    location: "ANAKAPALLI YARD",
    since: "1543 hrs",
    x: 78,
    y: 71,
  },
];

const generatedLocations = [
  "VISAKHAPATNAM HIGHWAY",
  "ANAKAPALLI YARD",
  "NAKKAPALLI 3KM RADIUS",
  "TUNI CHECKPOST",
  "NARSIPATNAM DEPOT",
  "KASIMKOTA ROAD",
];
const generatedStatuses: VehicleStatus[] = ["running", "not-on-job", "on-job", "late"];
const vehicles: Vehicle[] = Array.from({ length: 39 }, (_, index) => {
  const source = seedVehicles[index % seedVehicles.length];
  if (index < seedVehicles.length) return source;
  const fleetNumber = 1000 + index;
  return {
    ...source,
    id: String(fleetNumber),
    plate: `AP${String((index % 39) + 1).padStart(2, "0")}T${String(8500 + index)}`,
    group: index % 3 === 0 ? "RUNNING VEHICLES" : index % 3 === 1 ? "LONG HAUL" : "SERVICE VEHICLES",
    driver: `DRIVER ${String(index + 1).padStart(2, "0")}`,
    insurance: index % 5 !== 0,
    status: generatedStatuses[index % generatedStatuses.length],
    fuel: `${150 + (index * 13) % 190}L / 392L`,
    fuelPercent: 38 + (index * 7) % 58,
    duration: `${index + 1}h ${String((index * 11) % 60).padStart(2, "0")}m`,
    distance: `${(12 + index * 4.7).toFixed(1)} km`,
    speed: `${index % 4 === 3 ? 0 : 18 + (index * 5) % 42} km/h`,
    odometer: `${16000 + index * 913} KM`,
    location: generatedLocations[index % generatedLocations.length],
    since: `${1600 + index} hrs`,
    x: 14 + (index * 17) % 72,
    y: 22 + (index * 23) % 58,
  };
});

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFleetxVehicle(item: FleetxVehicle, index: number): Vehicle {
  const plate = String(readFleetxValue(item, "vehicleNumber", "registrationNumber", "vehicleNo", "number", "plate") ?? `LIVE-${index + 1}`);
  const latitude = asNumber(readFleetxValue(item, "latitude", "lat", "locationLatitude", "gpsLatitude"), Number.NaN);
  const longitude = asNumber(readFleetxValue(item, "longitude", "lng", "locationLongitude", "gpsLongitude"), Number.NaN);
  const rawStatus = String(readFleetxValue(item, "status", "vehicleStatus", "movementStatus", "tripStatus") ?? "").toLowerCase();
  const moving = readFleetxValue(item, "isMoving", "moving") === true || rawStatus.includes("running") || rawStatus.includes("moving") || rawStatus.includes("on road");
  const status: VehicleStatus = rawStatus.includes("late") ? "late" : rawStatus.includes("job") || rawStatus.includes("trip") ? "on-job" : rawStatus.includes("idle") || rawStatus.includes("parked") ? "not-on-job" : moving ? "running" : "not-on-job";
  const fuelPercent = Math.max(0, Math.min(100, asNumber(readFleetxValue(item, "fuelPercent", "fuelPercentage", "fuelLevelPercentage"), 0)));
  const x = Number.isFinite(longitude) ? (longitude - 82.88) / 0.006 : 50;
  const y = Number.isFinite(latitude) ? 100 - (latitude - 17.35) / 0.007 : 50;
  return {
    id: String(readFleetxValue(item, "vehicleId", "id", "vehicleName") ?? plate),
    plate,
    group: String(readFleetxValue(item, "groupName", "group", "vehicleGroup") ?? "LIVE FLEET"),
    driver: String(readFleetxValue(item, "driverName", "driver", "driver_name") ?? "Unassigned"),
    insurance: Boolean(readFleetxValue(item, "insurance", "insuranceValid")),
    status,
    fuel: String(readFleetxValue(item, "fuel", "fuelLevel", "fuelVolume") ?? `${fuelPercent}%`),
    fuelPercent,
    duration: String(readFleetxValue(item, "duration", "runningDuration") ?? "-"),
    distance: String(readFleetxValue(item, "distance", "distanceCovered") ?? "-"),
    speed: String(readFleetxValue(item, "speed", "speedKph", "currentSpeed") ?? "0 km/h"),
    odometer: String(readFleetxValue(item, "odometer", "odometerReading") ?? "-"),
    location: String(readFleetxValue(item, "location", "locationName", "address", "city") ?? "Location unavailable"),
    since: String(readFleetxValue(item, "since", "lastUpdated", "updatedAt") ?? "-"),
    x,
    y,
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {}),
  };
}

const navItems = [
  { label: "Realtime", icon: Navigation },
  { label: "Trips", icon: Route },
  { label: "Audit Logs", icon: HistoryIcon },
  { label: "Enquiries", icon: ClipboardList },
  { label: "Vehicles", icon: Truck },
  { label: "Jobs", icon: BriefcaseBusiness, expandable: true },
  { label: "Records", icon: CircleGauge, expandable: true },
  { label: "Issues", icon: AlertCircle },
  { label: "Users", icon: Users, adminOnly: true },
  { label: "Account", icon: UserCircle, expandable: true },
];

const topNavItems = [
  "Realtime",
  "Trips",
  "Audit Logs",
  "Enquiries",
  "Vehicles",
  "Jobs",
  "Records",
  "Issues",
  "Users",
];

const sidebarFlyouts: Record<string, { label: string; icon: typeof BriefcaseBusiness }[]> = {
  Jobs: [
    { label: "Control Room", icon: ClipboardList },
    { label: "All Jobs", icon: BriefcaseBusiness },
    { label: "Job Bookings", icon: ClipboardList },
    { label: "Routes", icon: Route },
    { label: "Clients", icon: UserCircle },
    { label: "Address Book", icon: MapPin },
    { label: "Site Analytics", icon: BarChart3 },
    { label: "Site Analytics V2", icon: BarChart3 },
    { label: "Stoppage Analytics", icon: BarChart3 },
    { label: "Fuel Station Price", icon: Fuel },
  ],
  Account: [
    { label: "Sign Out", icon: LogOut },
  ],
  Records: [
    { label: "Tyre Management", icon: CircleGauge },
    { label: "Service History", icon: ClipboardList },
    { label: "Fuel Log", icon: Fuel },
  ],
};

function FleetLogo() {
  return (
    <div className="vasudev-logo">
      <img className="vasudev-logo-image" src="/vasudev-logo.webp" alt="Vasudev" />
    </div>
  );
}

function SidebarToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <span className={`sidebar-toggle-icon ${expanded ? "expanded" : "collapsed"}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}

function TopNavigation({
  onMenu,
  onSignOut,
  onNavigate,
  activeNav,
  setActiveNav,
  sidebarExpanded,
  openDropdown,
  setOpenDropdown,
  profileName: providedProfileName,
  isAdmin,
}: {
  onMenu: () => void;
  onSignOut: () => void;
  onNavigate: (item: string) => void;
  activeNav: string;
  setActiveNav: (item: string) => void;
  sidebarExpanded: boolean;
  openDropdown: string | null;
  setOpenDropdown: (dropdown: string | null) => void;
  profileName?: string;
  isAdmin: boolean;
}) {
  const openMenu = openDropdown?.startsWith("top:") ? openDropdown.slice(4) : null;
  const profileOpen = openDropdown === "profile";
  const profileName = providedProfileName?.trim() || auth?.currentUser?.displayName?.trim() || auth?.currentUser?.email?.split("@")[0] || "Fleet User";
  return (
    <header className="top-navigation">
      <div className="top-navigation-left">
        <button className="icon-button menu-button" title="Toggle sidebar" aria-label="Toggle sidebar" aria-expanded={sidebarExpanded} onClick={onMenu}>
          <SidebarToggleIcon expanded={sidebarExpanded} />
        </button>
        <FleetLogo />
      </div>
      <nav className="top-navigation-links" aria-label="Primary navigation" onMouseLeave={() => setOpenDropdown(null)}>
        {topNavItems.filter((item) => item !== "Users" || isAdmin).map((item) => {
          const expandable = ["Jobs", "Reminders", "Records", "Account"].includes(item);
          return (
            <div className="top-navigation-menu" key={item}>
              <button
                className={`top-navigation-link ${activeNav === item ? "active" : ""}`}
                aria-expanded={expandable ? openMenu === item : undefined}
                data-dropdown-trigger={expandable ? "true" : undefined}
                onClick={() => {
                  setActiveNav(item);
                  setOpenDropdown(expandable && openMenu !== item ? `top:${item}` : null);
                  onNavigate(item);
                }}
              >
                {item}
                {expandable && <span className="top-navigation-chevron" aria-hidden="true" />}
              </button>
              {expandable && openMenu === item && <SidebarFlyout label={item} className="top-navigation-flyout" onSelect={() => setOpenDropdown(null)} onNavigate={onNavigate} onSignOut={onSignOut} profileName={profileName} isAdmin={isAdmin} />}
            </div>
          );
        })}
      </nav>
      <div className="top-navigation-actions">
        <button
          className={`icon-button profile-trigger ${profileOpen ? "active" : ""}`}
          title="Profile"
          aria-label="Open profile menu"
          aria-expanded={profileOpen}
          data-dropdown-trigger="true"
          onClick={() => setOpenDropdown(profileOpen ? null : "profile")}
        >
          <UserCircle size={20} />
        </button>
        {profileOpen && (
          <div className="profile-sheet" data-dropdown-surface="true" role="menu" aria-label="Profile menu">
            <div className="profile-sheet-heading">
              <span className="profile-sheet-avatar"><UserCircle size={22} /></span>
              <span><strong>{profileName}</strong><small>{isAdmin ? "Fleet Administrator" : "Fleet Manager"}</small></span>
            </div>
            <div className="profile-sheet-divider" />
            <button role="menuitem" onClick={onSignOut}><LogOut size={15} /> Sign Out</button>
          </div>
        )}
      </div>
    </header>
  );
}

function SidebarFlyout({
  label,
  onSelect,
  onNavigate,
  onSignOut,
  profileName,
  isAdmin,
  style,
  className,
}: {
  label: string;
  onSelect: () => void;
  onNavigate?: (item: string) => void;
  onSignOut?: () => void;
  profileName?: string;
  isAdmin?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const items = sidebarFlyouts[label] ?? [];
  const displayName = profileName?.trim() || auth?.currentUser?.displayName?.trim() || auth?.currentUser?.email?.split("@")[0] || "Fleet User";
  return (
    <div className={`sidebar-flyout ${label === "Account" ? "profile-sidebar-flyout" : ""} ${className ?? ""}`} style={style} data-dropdown-surface="true" role="menu" aria-label={`${label} menu`}>
      {label === "Account" ? <>
        <div className="profile-sheet-heading">
          <span className="profile-sheet-avatar"><UserCircle size={22} /></span>
          <span><strong>{displayName}</strong><small>{isAdmin ? "Fleet Administrator" : "Fleet Manager"}</small></span>
        </div>
        <div className="profile-sheet-divider" />
        <button role="menuitem" onClick={() => { onSelect(); onSignOut?.(); }}><LogOut size={15} /> Sign Out</button>
      </> : <>
        <div className="sidebar-flyout-heading">
          <strong>{label}</strong>
          <span>Quick access</span>
        </div>
        <div className="sidebar-flyout-grid">
          {items.map(({ label: itemLabel, icon: Icon }) => (
            <button key={itemLabel} role="menuitem" onClick={() => { onSelect(); if (itemLabel === "Sign Out") onSignOut?.(); else onNavigate?.(itemLabel); }}>
              <Icon size={14} strokeWidth={1.7} />
              <span>{itemLabel}</span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
  activeNav,
  setActiveNav,
  openDropdown,
  setOpenDropdown,
  onItemSelect,
  onNavigate,
  onSignOut,
  profileName,
  isAdmin,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  activeNav: string;
  setActiveNav: (item: string) => void;
  openDropdown: string | null;
  setOpenDropdown: (dropdown: string | null) => void;
  onItemSelect: () => void;
  onNavigate: (item: string) => void;
  onSignOut: () => void;
  profileName?: string;
  isAdmin: boolean;
}) {
  const sidebarRef = useRef<HTMLElement>(null);
  const openFlyout = openDropdown?.startsWith("sidebar:") ? openDropdown.slice(8) : null;
  const [hoverFlyoutTop, setHoverFlyoutTop] = useState(0);
  const handleItemEnter = (event: React.MouseEvent<HTMLDivElement>, label: string, expandable?: boolean) => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (!expandable) {
      setOpenDropdown(null);
      return;
    }
    const sidebarBounds = sidebarRef.current?.getBoundingClientRect();
    if (sidebarBounds) {
      const itemTop = event.currentTarget.getBoundingClientRect().top - sidebarBounds.top;
      const flyoutHeight = label === "Account" ? 126 : (sidebarFlyouts[label]?.length ?? 0) * 34 + 18;
      const maxTop = sidebarBounds.height - flyoutHeight - 8;
      setHoverFlyoutTop(Math.max(8, Math.min(itemTop, maxTop)));
    }
    setOpenDropdown(`sidebar:${label}`);
  };
  return (
    <aside
      ref={sidebarRef}
      className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-open" : ""}`}
      onMouseLeave={() => setOpenDropdown(null)}
    >
      <div className="sidebar-items">
        {navItems.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ label, icon: Icon, expandable }) => (
          <div
            className={`sidebar-item-wrap${label === "Account" ? " sidebar-account-item" : ""}`}
            key={label}
            onMouseEnter={(event) => handleItemEnter(event, label, expandable)}
          >
            <button
              title={collapsed ? label : undefined}
              className={`sidebar-item ${activeNav === label ? "active" : ""} ${openFlyout === label ? "menu-open" : ""}`}
              onClick={() => {
                setActiveNav(label);
                if (expandable) setOpenDropdown(openFlyout === label ? null : `sidebar:${label}`);
                else setOpenDropdown(null);
                if (label !== "Account") onNavigate(label);
                if (!expandable) onItemSelect();
              }}
              aria-expanded={expandable ? openFlyout === label : undefined}
              aria-haspopup={expandable ? "menu" : undefined}
              data-dropdown-trigger={expandable ? "true" : undefined}
            >
              <Icon size={18} strokeWidth={activeNav === label ? 2.3 : 1.8} />
              <span className="sidebar-label">{label}</span>
              {expandable && <ChevronDown className="sidebar-chevron" size={15} />}
            </button>
            {collapsed && !expandable && <span className="sidebar-hover-label">{label}</span>}
          </div>
        ))}
      </div>
      <div className="sidebar-version" aria-label="Application version">
        <span>VERSION</span>
        <strong>v1.0.0</strong>
      </div>
      {openFlyout && sidebarFlyouts[openFlyout] && (
        <SidebarFlyout
          label={openFlyout}
          style={{ top: hoverFlyoutTop }}
          onSelect={() => {
            setOpenDropdown(null);
            onItemSelect();
          }}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          profileName={profileName}
          isAdmin={isAdmin}
        />
      )}
    </aside>
  );
}

function RealtimeStats({ vehicles: liveVehicles }: { vehicles: Vehicle[] }) {
  const [expanded, setExpanded] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };
  const scheduleExpansion = () => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setExpanded(true), 320);
  };
  const scheduleCollapse = () => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setExpanded(false), 180);
  };
  useEffect(() => clearHoverTimer, []);
  const counts = {
    vehicles: liveVehicles.length,
    running: liveVehicles.filter((vehicle) => vehicle.status === "running").length,
    notOnJob: liveVehicles.filter((vehicle) => vehicle.status === "not-on-job").length,
    onJob: liveVehicles.filter((vehicle) => vehicle.status === "on-job").length,
    late: liveVehicles.filter((vehicle) => vehicle.status === "late").length,
  };
  const compactStats = [
    { value: String(counts.vehicles), label: "Vehicles" },
    { value: String(counts.running), label: "Running", tone: "green" },
    { value: String(counts.notOnJob), label: "Not On Job" },
    { value: String(counts.onJob), label: "On Job" },
    { value: String(counts.late), label: "Late" },
  ];
  const detailColumns = [
    [
      { value: String(counts.vehicles), label: "Vehicles" },
      { value: "2", label: "Idle", tone: "yellow" },
      { value: "4", label: "2<Parked<4 Hr" },
      { value: "6", label: "Parked>5 Hr" },
      { value: "3", label: "Not Online", tone: "red" },
    ],
    [
      { value: String(counts.running), label: "Running", tone: "green" },
      { value: "18", label: "Parked" },
      { value: "0", label: "4<Parked<5 Hr" },
      { value: "7", label: "Discharged", tone: "red" },
    ],
    [
      { value: String(counts.notOnJob), label: "Not On Job" },
      { value: "0", label: "Waiting To Load" },
      { value: "0", label: "Loaded" },
      { value: "0", label: "Unloading" },
      { value: "0", label: "Scheduled" },
    ],
    [
      { value: String(counts.onJob), label: "On Job" },
      { value: "0", label: "Loading" },
      { value: "0", label: "Waiting To Unload" },
      { value: "0", label: "Waiting In Garage" },
      { value: "0", label: "In Garage" },
      { value: "0", label: "Empty" },
      { value: "0", label: "Unloading Completed" },
    ],
    [
      { value: String(counts.late), label: "Late" },
      { value: "0", label: "On Time" },
      { value: "0", label: "Early" },
    ],
  ];
  return (
    <section
      className={`realtime-stats ${expanded ? "expanded" : ""}`}
      aria-label="Fleet statistics"
      onMouseEnter={scheduleExpansion}
      onMouseLeave={scheduleCollapse}
    >
      {expanded ? (
        <div className="expanded-stats-grid">
          {detailColumns.map((column, index) => (
            <div className="expanded-stats-column" key={index}>
              {column.map((stat) => (
                <div className="expanded-stat" key={stat.label}>
                  <strong className={stat.tone}>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-list">
          {compactStats.map((stat) => (
            <div className="stat" key={stat.label}>
              <strong className={stat.tone}>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FleetReport({ vehicles: liveVehicles }: { vehicles: Vehicle[] }) {
  const running = liveVehicles.filter((vehicle) => vehicle.status === "running");
  const idle = liveVehicles.filter((vehicle) => vehicle.status === "not-on-job");
  const onJob = liveVehicles.filter((vehicle) => vehicle.status === "on-job");
  const late = liveVehicles.filter((vehicle) => vehicle.status === "late");
  const locations = Array.from(liveVehicles.reduce<Map<string, Vehicle[]>>((groups, vehicle) => {
    const location = vehicle.location || "Location unavailable";
    groups.set(location, [...(groups.get(location) ?? []), vehicle]);
    return groups;
  }, new Map()).entries()).sort(([, first], [, second]) => second.length - first.length);

  const downloadReport = () => {
    const rows = [
      ["Vehicle", "Registration", "Status", "Location", "Driver", "Speed"],
      ...liveVehicles.map((vehicle) => [vehicle.id, vehicle.plate, vehicle.status === "not-on-job" ? "Idle" : vehicle.status, vehicle.location, vehicle.driver, vehicle.speed]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `fleet-realtime-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const statusCards = [
    ["Total vehicles", liveVehicles.length, "total"],
    ["Running", running.length, "running"],
    ["Idle", idle.length, "idle"],
    ["On job", onJob.length, "on-job"],
    ["Late", late.length, "late"],
  ];
  return (
    <section className="fleet-report" aria-label="Live fleet report">
      <div className="fleet-report-heading">
        <div><span>LIVE FLEET REPORT</span><h2>Vehicle status and locations</h2><p>Current counts from Fleetx realtime data.</p></div>
        <button type="button" className="fleet-report-download" onClick={downloadReport}><Download size={14} /> Export CSV</button>
      </div>
      <div className="fleet-report-statuses">
        {statusCards.map(([label, value, tone]) => <div className={`fleet-report-status ${tone}`} key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <div className="fleet-report-locations">
        <strong>Vehicles by location</strong>
        <div className="fleet-report-location-grid">
          {locations.map(([location, locationVehicles]) => <div className="fleet-report-location" key={location}><div><strong>{location}</strong><span>{locationVehicles.length} vehicle{locationVehicles.length === 1 ? "" : "s"}</span></div><small>{locationVehicles.map((vehicle) => vehicle.plate).join(", ")}</small></div>)}
        </div>
      </div>
    </section>
  );
}

function FilterPanel({
  vehicles: liveVehicles,
  filters,
  setFilters,
  onClose,
}: {
  vehicles: Vehicle[];
  filters: Record<string, boolean>;
  setFilters: (next: Record<string, boolean>) => void;
  onClose: () => void;
}) {
  const count = (status: VehicleStatus) => liveVehicles.filter((vehicle) => vehicle.status === status).length;
  const options = [
    ["running", "Running", `${count("running")} vehicles`],
    ["on-job", "On Job", `${count("on-job")} vehicles`],
    ["not-on-job", "Not On Job", `${count("not-on-job")} vehicles`],
    ["late", "Late", `${count("late")} vehicles`],
    ["insurance", "Insurance", `${liveVehicles.filter((vehicle) => vehicle.insurance).length} vehicles`],
  ];
  return (
    <div className="filter-panel" data-dropdown-surface="true">
      <div className="filter-panel-header">
        <div><strong>Filter vehicles</strong><span>Choose vehicle status</span></div>
        <button className="icon-button" onClick={onClose} title="Close filters"><X size={16} /></button>
      </div>
      <div className="filter-options">
        {options.map(([value, label, count]) => (
          <label className="filter-option" key={value}>
            <input
              type="checkbox"
              checked={Boolean(filters[value])}
              onChange={(event) => setFilters({ ...filters, [value]: event.target.checked })}
            />
            <span className="custom-checkbox">{filters[value] && <Check size={12} />}</span>
            <span className="filter-option-label">{label}</span>
            <small>{count}</small>
          </label>
        ))}
      </div>
      <button className="filter-clear" onClick={() => setFilters({})}>Clear all filters</button>
    </div>
  );
}

function VehicleSearch({
  search,
  setSearch,
  tab,
  setTab,
}: {
  search: string;
  setSearch: (value: string) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
}) {
  return (
    <div className="vehicle-search">
      <div className="search-row">
        <label className="search-field">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicles / groups" />
          {search && <button type="button" onClick={() => setSearch("")} title="Clear search"><X size={14} /></button>}
        </label>
        <div className="vehicle-tabs" role="tablist" aria-label="Vehicle views">
          <button className={tab === "vehicles" ? "active" : ""} onClick={() => setTab("vehicles")} role="tab" aria-selected={tab === "vehicles"}>Vehicles</button>
          <button className={tab === "location" ? "active" : ""} onClick={() => setTab("location")} role="tab" aria-selected={tab === "location"}>Location</button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: VehicleStatus }) {
  const label = status === "running" ? "Running" : status === "on-job" ? "On Job" : status === "late" ? "Late" : "Not On Job";
  return <span className={`status-badge ${status}`}><span />{label}</span>;
}

function VehicleCard({ vehicle, selected, onSelect, onHover }: { vehicle: Vehicle; selected: boolean; onSelect: () => void; onHover: () => void }) {
  return (
    <article className={`vehicle-card ${selected ? "selected" : ""}`} style={{ "--vehicle-accent": vehicleStatusColors[vehicle.status] } as CSSProperties} tabIndex={0} onClick={onSelect} onMouseEnter={onHover} onFocus={onHover}>
      <div className="vehicle-card-content">
        <div className="vehicle-card-header">
          <div className="vehicle-name"><span className="hierarchy-icon" style={{ color: vehicleStatusColors[vehicle.status] }}><Route size={13} /></span><strong>{vehicle.id}</strong><span>{vehicle.plate}</span></div>
          <div className="vehicle-card-badges">
            {vehicle.insurance && <span className="insurance-badge"><ShieldCheck size={11} /> Insurance</span>}
            <span className="more-badge">8 More</span>
            <button className={`locate-button ${vehicle.status}`} title={`Locate ${vehicle.plate}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}><Navigation size={13} fill="currentColor" strokeWidth={1.5} /></button>
          </div>
        </div>
        <div className="vehicle-subline"><span>Group: {vehicle.group}</span><span className="subline-divider">|</span><span>Driver: {vehicle.driver}</span><Pencil size={11} /></div>
        <div className="vehicle-tags"><span>Sent To Loading</span><span>Booked By Razia</span></div>
        <div className="vehicle-fuel-row">
          <span className="data-label"><Fuel size={14} /> Fuel:</span>
          <strong>{vehicle.fuel}, {vehicle.fuelPercent}%</strong>
          <span className="fuel-track"><span style={{ width: `${vehicle.fuelPercent}%` }} /></span>
          <ExternalLink size={12} className="muted-icon" />
        </div>
        <div className="vehicle-metrics">
          <span><Clock3 size={13} /> {vehicle.duration}</span><i />
          <span>{vehicle.distance}</span><i />
          <span>Speed: {vehicle.speed}</span><i />
          <span>Odometer:</span>
        </div>
        <div className="odometer">{vehicle.odometer}</div>
        <div className="vehicle-location"><MapPin size={15} /><strong>{vehicle.location}</strong></div>
        <div className="vehicle-job-status" style={{ color: vehicleStatusColors[vehicle.status] }}><BriefcaseBusiness size={14} /><strong>{vehicle.status === "on-job" ? "On Job" : vehicle.status === "late" ? "Late" : "Not On Job"}</strong></div>
        <div className="vehicle-since">Since: {vehicle.since}</div>
        <div className="vehicle-comment">
          <div className="vehicle-comment-header"><strong>Comment:</strong><Pencil size={14} /></div>
          <div className="vehicle-comment-author">by Munna TRV on 17 Jun 26, 04:59 PM</div>
        </div>
        <div className="vehicle-card-actions" aria-label="Vehicle actions">
          <button title="Call driver" onClick={(event) => event.stopPropagation()}><Phone size={13} fill="currentColor" /></button>
          <button title="Share vehicle" onClick={(event) => event.stopPropagation()}><Share2 size={13} fill="currentColor" /></button>
          <button title="View comments" onClick={(event) => event.stopPropagation()}><MessageCircle size={13} fill="currentColor" /></button>
        </div>
        <div className="vehicle-card-footer">
          <button>History</button><button>Overview</button><button>Details</button><button><Tag size={12} /> Add Tag</button>
          <button>Historical Location</button><button>View Comments</button>
        </div>
      </div>
    </article>
  );
}

function LocationList({ vehicles: visibleVehicles }: { vehicles: Vehicle[] }) {
  const locations = visibleVehicles.reduce<Record<string, number>>((acc, vehicle) => {
    const location = vehicle.location.split(" ").slice(0, 2).join(" ");
    acc[location] = (acc[location] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="location-list">
      <div className="location-view-heading"><MapPinnedIcon /><div><strong>Fleet by location</strong><span>Active vehicles grouped by their latest location</span></div></div>
      {Object.entries(locations).map(([location, count]) => (
        <div className="location-row" key={location}><span className="location-dot" /><strong>{location}</strong><span>{count} vehicle{count > 1 ? "s" : ""}</span><ChevronDown size={14} /></div>
      ))}
    </div>
  );
}

function MapPinnedIcon() {
  return <span className="location-view-icon"><MapPin size={18} /></span>;
}

function VehicleList({ vehicles: visibleVehicles, selectedId, onSelect, onHover, onScroll, tab }: { vehicles: Vehicle[]; selectedId: string; onSelect: (id: string) => void; onHover: (vehicle: Vehicle) => void; onScroll: (event: React.UIEvent<HTMLDivElement>) => void; tab: Tab }) {
  return (
    <div className="vehicle-list" onScroll={onScroll}>
      {tab === "vehicles" ? visibleVehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} selected={vehicle.id === selectedId} onSelect={() => onSelect(vehicle.id)} onHover={() => onHover(vehicle)} />
      )) : <LocationList vehicles={visibleVehicles} />}
      {!visibleVehicles.length && <div className="empty-list"><Search size={22} /><strong>No vehicles found</strong><span>Try a different registration, driver, or group.</span></div>}
    </div>
  );
}

function MapControls({
  zoom,
  setZoom,
  onFullscreen,
  mapType,
  onMapTypeChange,
  trafficEnabled,
  onToggleTraffic,
  onShowAll,
  onRecenter,
}: {
  zoom: number;
  setZoom: (zoom: number) => void;
  onFullscreen: () => void;
  mapType: "roadmap" | "satellite";
  onMapTypeChange: (type: "roadmap" | "satellite") => void;
  trafficEnabled: boolean;
  onToggleTraffic: () => void;
  onShowAll: () => void;
  onRecenter: () => void;
}) {
  return (
    <>
      <div className="map-style-controls">
        <div className="map-style-toggle">
          <button className={mapType === "roadmap" ? "active" : ""} onClick={() => onMapTypeChange("roadmap")}><Layers3 size={13} /> Default</button>
          <button className={mapType === "satellite" ? "active" : ""} onClick={() => onMapTypeChange("satellite")}><span className="satellite-thumb" /> Satellite</button>
        </div>
        <button className={`traffic-button${trafficEnabled ? " active" : ""}`} onClick={onToggleTraffic}><TrafficCone size={13} /> Traffic</button>
      </div>
      <div className="map-action-controls">
        <button><MapPin size={12} /> Show Address</button>
        <button onClick={onFullscreen}><Maximize2 size={12} /> Fullscreen</button>
        <button onClick={onShowAll}><Grid2X2 size={12} /> Show All</button>
      </div>
      <div className="map-zoom-controls">
        <button onClick={() => setZoom(Math.min(18, zoom + 1))} title="Zoom in"><Plus size={17} /></button>
        <button onClick={() => setZoom(Math.max(3, zoom - 1))} title="Zoom out"><Minus size={17} /></button>
      </div>
      <button className="map-compass" title="Recenter map" onClick={onRecenter}><Navigation size={17} /></button>
    </>
  );
}

function MapArtwork() {
  return (
    <svg className="map-artwork" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
      <rect width="1000" height="700" fill="#f3f0e9" />
      <path d="M70 0 C105 130 86 188 150 248 C190 286 178 342 220 391 C265 442 254 506 330 548 C385 579 405 634 452 700" fill="none" stroke="#dce6ef" strokeWidth="45" opacity=".9" />
      <path d="M70 0 C105 130 86 188 150 248 C190 286 178 342 220 391 C265 442 254 506 330 548 C385 579 405 634 452 700" fill="none" stroke="#9db9ca" strokeWidth="30" opacity=".75" />
      <path d="M70 0 C105 130 86 188 150 248 C190 286 178 342 220 391 C265 442 254 506 330 548 C385 579 405 634 452 700" fill="none" stroke="#8ca9bc" strokeWidth="24" opacity=".9" />
      <path d="M0 500 C130 450 176 481 300 426 C424 371 504 416 610 364 C726 307 790 282 1000 298" fill="none" stroke="#d5dce0" strokeWidth="32" />
      <path d="M0 500 C130 450 176 481 300 426 C424 371 504 416 610 364 C726 307 790 282 1000 298" fill="none" stroke="#f6f8f7" strokeWidth="20" />
      <path d="M0 500 C130 450 176 481 300 426 C424 371 504 416 610 364 C726 307 790 282 1000 298" fill="none" stroke="#88a9c1" strokeWidth="12" />
      <path d="M-30 118 C130 160 214 138 324 180 C472 236 584 186 690 136 C798 86 882 112 1030 72" fill="none" stroke="#d9dedc" strokeWidth="18" />
      <path d="M-30 118 C130 160 214 138 324 180 C472 236 584 186 690 136 C798 86 882 112 1030 72" fill="none" stroke="#fffefa" strokeWidth="10" />
      <path d="M405 -20 C407 88 390 173 432 251 C471 324 450 381 492 458 C532 532 513 604 557 731" fill="none" stroke="#d2d9d8" strokeWidth="13" />
      <path d="M405 -20 C407 88 390 173 432 251 C471 324 450 381 492 458 C532 532 513 604 557 731" fill="none" stroke="#fffefa" strokeWidth="7" />
      <path d="M760 0 C706 86 715 150 773 218 C824 278 798 339 838 391 C886 452 872 553 943 710" fill="none" stroke="#d2d8d9" strokeWidth="11" />
      <path d="M760 0 C706 86 715 150 773 218 C824 278 798 339 838 391 C886 452 872 553 943 710" fill="none" stroke="#fffefa" strokeWidth="6" />
      <path d="M0 632 C124 585 205 609 300 576 C408 538 474 579 564 552 C666 521 745 560 1015 472" fill="none" stroke="#d5dbda" strokeWidth="8" />
      <path d="M120 288 L292 288 L368 346 L510 325 L598 262 L715 274" fill="none" stroke="#dadfdd" strokeWidth="6" />
      <path d="M210 72 L291 163 L289 288 M598 262 L628 351 L701 432 M510 325 L571 406 L581 548" fill="none" stroke="#dce1df" strokeWidth="5" />
      <path d="M0 402 C126 390 184 356 262 370 C352 385 409 352 472 319 M645 497 C735 469 782 477 1000 418" fill="none" stroke="#e0e4e1" strokeWidth="4" />
      <path d="M676 110 C692 127 715 140 747 143 C775 146 790 134 804 117 C821 97 839 88 863 96 C887 104 896 127 916 142" fill="none" stroke="#b9d4e2" strokeWidth="10" opacity=".8" />
      <path d="M689 109 C708 127 723 132 748 135 C773 138 790 120 807 104 C823 89 841 84 859 90 C883 97 894 121 910 136" fill="none" stroke="#83bad2" strokeWidth="7" opacity=".8" />
      <g fill="#65747e" fontFamily="Inter, Arial, sans-serif" fontSize="13">
        <text x="711" y="175">NYAYAMPUDI LAKE</text><text x="88" y="202">Nakkapalli</text><text x="118" y="538">Kasimkota</text><text x="814" y="249">MANU HOME</text><text x="525" y="215">KANDERAPALLI</text><text x="742" y="438">Anakapalli</text><text x="320" y="121">DURGARAO</text><text x="845" y="592">Narsipatnam Road</text><text x="393" y="462">Nakkapalli Ramalayam</text>
      </g>
      <g fill="#74858d" fontFamily="Inter, Arial, sans-serif" fontSize="10">
        <text x="708" y="194">lake &amp; reservoir</text><text x="800" y="265">residential area</text><text x="270" y="305">NH 16</text><text x="646" y="302">Pendurthi</text><text x="98" y="568">Rajupeta</text><text x="493" y="610">Tuni Road</text>
      </g>
      <g fill="#f08c43" stroke="#fff" strokeWidth="3">
        <circle cx="676" cy="397" r="9" /><circle cx="759" cy="430" r="9" /><circle cx="579" cy="449" r="9" /><circle cx="823" cy="513" r="9" /><circle cx="296" cy="418" r="9" />
      </g>
      <g fill="#fff" fontFamily="Arial" fontSize="10" textAnchor="middle"><text x="676" y="401">★</text><text x="759" y="434">★</text><text x="579" y="453">★</text><text x="823" y="517">★</text><text x="296" y="422">★</text></g>
      <g fill="#566a75" fontFamily="Inter, Arial, sans-serif" fontSize="11"><text x="642" y="415">Sri Kanakadurga Hotel</text><text x="728" y="452">GEM CHURCH</text><text x="548" y="474">Cafe &amp; Dhaba</text><text x="802" y="536">Roadside Restaurant</text><text x="235" y="441">Nakkapalli Market</text></g>
      <g fill="#9ba9ad" stroke="#fff" strokeWidth="2"><circle cx="616" cy="226" r="8" /><circle cx="735" cy="216" r="8" /><circle cx="488" cy="516" r="8" /><circle cx="374" cy="270" r="8" /><circle cx="148" cy="396" r="8" /></g>
      <g fill="#62737c" fontFamily="Inter, Arial, sans-serif" fontSize="9"><text x="609" y="212">KANDERAPALLI</text><text x="728" y="201">DURGARAOPETA</text><text x="478" y="537">Gajuwaka</text><text x="358" y="290">Sabbavaram</text><text x="125" y="416">Koduru</text></g>
      <g stroke="#fff" strokeWidth="4" opacity=".8"><path d="M42 234 l8 8 M50 234 l-8 8" /><path d="M915 358 l8 8 M923 358 l-8 8" /><path d="M383 580 l8 8 M391 580 l-8 8" /></g>
    </svg>
  );
}

function MapPanel({ vehicles: liveVehicles, selected, focusedVehicle, onSelect, onFullscreen }: { vehicles: Vehicle[]; selected: Vehicle; focusedVehicle: Vehicle | null; onSelect: (id: string) => void; onFullscreen: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapsLibraryRef = useRef<google.maps.MapsLibrary | null>(null);
  const markerLibraryRef = useRef<google.maps.MarkerLibrary | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef(new Map<string, google.maps.Marker>());
  const [zoom, setZoom] = useState(GOOGLE_MAP_ZOOM);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  const handleZoom = (nextZoom: number) => {
    const boundedZoom = Math.min(18, Math.max(3, nextZoom));
    setZoom(boundedZoom);
    mapRef.current?.setZoom(boundedZoom);
  };

  const handleMapTypeChange = (nextType: "roadmap" | "satellite") => {
    setMapType(nextType);
    mapRef.current?.setMapTypeId(nextType);
  };

  const handleToggleTraffic = () => {
    const nextEnabled = !trafficEnabled;
    setTrafficEnabled(nextEnabled);
    if (!trafficLayerRef.current && mapsLibraryRef.current) {
      trafficLayerRef.current = new mapsLibraryRef.current.TrafficLayer();
    }
    trafficLayerRef.current?.setMap(nextEnabled ? mapRef.current : null);
  };

  const handleShowAll = () => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    liveVehicles.forEach((vehicle) => bounds.extend(vehiclePosition(vehicle)));
    mapRef.current.fitBounds(bounds);
  };

  const handleRecenter = () => {
    mapRef.current?.panTo(GOOGLE_MAP_CENTER);
    handleZoom(GOOGLE_MAP_ZOOM);
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapStatus("error");
      return;
    }

    let active = true;
    if (!googleMapsOptionsConfigured) {
      setOptions({ key: GOOGLE_MAPS_API_KEY, v: "weekly" });
      googleMapsOptionsConfigured = true;
    }
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([mapsLibrary, markerLibrary]) => {
        if (!active || !mapContainerRef.current) return;
        const map = new (mapsLibrary as google.maps.MapsLibrary).Map(mapContainerRef.current, {
          center: GOOGLE_MAP_CENTER,
          zoom: GOOGLE_MAP_ZOOM,
          mapTypeId: "roadmap",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        mapsLibraryRef.current = mapsLibrary as google.maps.MapsLibrary;
        markerLibraryRef.current = markerLibrary as google.maps.MarkerLibrary;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapStatus("ready");
      })
      .catch(() => {
        if (active) setMapStatus("error");
      });

    return () => {
      active = false;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      trafficLayerRef.current?.setMap(null);
      trafficLayerRef.current = null;
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
      mapsLibraryRef.current = null;
      markerLibraryRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLibrary = markerLibraryRef.current;
    if (mapStatus !== "ready" || !map || !markerLibrary) return;

    liveVehicles.forEach((vehicle) => {
      const isSelected = vehicle.id === selected.id;
      const marker = markersRef.current.get(vehicle.id) ?? new markerLibrary.Marker({
        map,
        position: vehiclePosition(vehicle),
        title: `${vehicle.id} · ${vehicle.plate}`,
        clickable: true,
      });
      marker.setMap(map);
      marker.setPosition(vehiclePosition(vehicle));
      marker.setIcon(vehicleMarkerIcon(vehicle, isSelected));
      if (!markersRef.current.has(vehicle.id)) {
        marker.addListener("click", () => onSelect(vehicle.id));
        markersRef.current.set(vehicle.id, marker);
      }
    });
  }, [liveVehicles, mapStatus, onSelect, selected.id]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = focusedVehicle ? markersRef.current.get(focusedVehicle.id) : null;
    const infoWindow = infoWindowRef.current;
    if (mapStatus !== "ready" || !map || !marker || !infoWindow || !focusedVehicle) return;

    map.panTo(vehiclePosition(focusedVehicle));
    map.setZoom(Math.max(map.getZoom() ?? GOOGLE_MAP_ZOOM, 14));
    infoWindow.setContent(vehicleInfoWindowContent(focusedVehicle));
    infoWindow.open({ map, anchor: marker });
  }, [focusedVehicle, mapStatus]);

  return (
    <section className="map-panel">
      <div className="map-viewport google-map-viewport">
        <div ref={mapContainerRef} className="google-map" aria-label="Realtime fleet map" />
        {mapStatus === "loading" && <div className="map-status"><span className="map-status-spinner" />Loading realtime map</div>}
        {mapStatus === "error" && <div className="map-status map-status-error"><strong>Map unavailable</strong><span>Check the Google Maps API key and allowed domains.</span></div>}
        {mapStatus === "ready" && <MapControls zoom={zoom} setZoom={handleZoom} onFullscreen={onFullscreen} mapType={mapType} onMapTypeChange={handleMapTypeChange} trafficEnabled={trafficEnabled} onToggleTraffic={handleToggleTraffic} onShowAll={handleShowAll} onRecenter={handleRecenter} />}
        <div className="map-legend" aria-label="Vehicle status legend">
          {(Object.entries(vehicleStatusColors) as [VehicleStatus, string][]).map(([status, color]) => (
            <span key={status}><i style={{ background: color }} />{status === "on-job" ? "On job" : status === "not-on-job" ? "Not on job" : status[0].toUpperCase() + status.slice(1)}</span>
          ))}
        </div>
        <div className="map-attribution">Google Maps · {selected.plate} selected</div>
      </div>
    </section>
  );
}

function IssueNotificationBanner({ isAdmin, dismissedIds, onDismiss }: { isAdmin: boolean; dismissedIds: string[]; onDismiss: (issueId: string) => void }) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => subscribeToIssues(isAdmin, setIssues, setError), [isAdmin]);

  const notification = issues.find((issue) => issue.status === "open" && !dismissedIds.includes(issue.id));
  if (!notification || error) return null;

  return (
    <div className={`issue-notification-banner ${notification.status === "closed" ? "resolved" : ""}`} role="status">
      <button type="button" className="issue-notification-content" onClick={() => navigate(`/issues?issue=${notification.id}`)}>
        <strong>{notification.status === "closed" ? "Issue resolved" : "New issue ticket"}</strong>
        <span>{notification.status === "closed" ? `${notification.title} was closed by ${notification.closedByName || "an administrator"}.` : `${notification.title} was raised by ${notification.createdByName}.`}</span>
        <u>View issue</u>
      </button>
      <button type="button" className="issue-notification-dismiss" onClick={() => onDismiss(notification.id)} aria-label="Dismiss issue notification"><X size={14} /></button>
    </div>
  );
}

function EnquiryNotificationBanner({ isAdmin, dismissedIds, onDismiss }: { isAdmin: boolean; dismissedIds: string[]; onDismiss: (enquiryId: string) => void }) {
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState<ManagedEnquiry[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => subscribeToEnquiryNotifications(isAdmin, setEnquiries, setError), [isAdmin]);

  const notification = enquiries.find((enquiry) => enquiry.status !== "noted" && !dismissedIds.includes(enquiry.id));
  if (!notification || error) return null;

  const isReferred = Boolean(notification.referral && notification.referralCodeOwnerId);
  return (
    <div className="issue-notification-banner enquiry-notification-banner" role="status">
      <button type="button" className="issue-notification-content" onClick={() => navigate(`/enquiries?enquiry=${notification.id}`)}>
        <strong>{isReferred ? "New referred enquiry" : "New unassigned enquiry"}</strong>
        <span>{isReferred ? `${notification.name || "A customer"} used referral code ${notification.referral}.` : `${notification.name || "A customer"} submitted an enquiry without a referral code.`}</span>
        <u>View enquiry</u>
      </button>
      <button type="button" className="issue-notification-dismiss" onClick={() => onDismiss(notification.id)} aria-label="Dismiss enquiry notification"><X size={14} /></button>
    </div>
  );
}

export type FleetLayoutContext = {
  openDropdown: string | null;
  setOpenDropdown: (dropdown: string | null) => void;
  dismissEnquiryBanner: (enquiryId: string) => void;
};

function readDismissedEnquiryIds(storageKey: string) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function FleetLayout({
  onSignOut,
  activeNav: initialActiveNav,
  fullscreen = false,
  profileName,
  children,
}: {
  onSignOut: () => void;
  activeNav: string;
  fullscreen?: boolean;
  profileName?: string;
  children: ReactNode | ((context: FleetLayoutContext) => ReactNode);
}) {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(initialActiveNav);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>(getCachedUserProfile);
  const [dismissedIssueIds, setDismissedIssueIds] = useState<string[]>([]);
  const enquiryDismissalStorageKey = `vasudev-fleet:dismissed-enquiries:${auth?.currentUser?.uid ?? "unknown"}`;
  const [dismissedEnquiryIds, setDismissedEnquiryIds] = useState<string[]>(() => readDismissedEnquiryIds(enquiryDismissalStorageKey));
  const compactViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 960px)").matches;

  useEffect(() => {
    setActiveNav(initialActiveNav);
  }, [initialActiveNav]);

  useEffect(() => {
    sessionStorage.setItem(enquiryDismissalStorageKey, JSON.stringify(dismissedEnquiryIds));
  }, [dismissedEnquiryIds, enquiryDismissalStorageKey]);

  useEffect(() => {
    const userId = auth?.currentUser?.uid;
    if (!userId || userId === cachedProfileUserId) return;

    let active = true;
    void getCurrentUserProfile().then((profile) => {
      cachedProfileUserId = userId;
      cachedUserProfile = profile;
      if (active) setUserProfile(profile);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sidebarOpen || !compactViewport) return;

    const closeSidebar = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
      } else {
        const target = event.target;
        if (target instanceof Element && (target.closest(".sidebar") || target.closest(".menu-button"))) return;
      }
      setSidebarOpen(false);
      setOpenDropdown(null);
    };
    document.addEventListener("keydown", closeSidebar);
    document.addEventListener("pointerdown", closeSidebar, true);
    return () => {
      document.removeEventListener("keydown", closeSidebar);
      document.removeEventListener("pointerdown", closeSidebar, true);
    };
  }, [compactViewport, sidebarOpen]);

  useEffect(() => {
    const closeDropdown = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
      } else {
        const target = event.target;
        if (target instanceof Element && (target.closest("[data-dropdown-trigger]") || target.closest("[data-dropdown-surface]"))) return;
      }
      setOpenDropdown(null);
    };
    document.addEventListener("keydown", closeDropdown);
    document.addEventListener("pointerdown", closeDropdown, true);
    return () => {
      document.removeEventListener("keydown", closeDropdown);
      document.removeEventListener("pointerdown", closeDropdown, true);
    };
  }, []);

  const navigationPaths: Record<string, string> = {
    Trips: "/trips",
    "Audit Logs": "/audit-logs",
    Enquiries: "/enquiries",
    Realtime: "/realtime",
    Overview: "/overview",
    Vehicles: "/vehicles",
    Jobs: "/jobs",
    Records: "/records",
    "Fuel Log": "/fuel",
    Issues: "/issues",
    Users: "/users",
    Alarms: "/alarms",
    Reports: "/reports",
    Account: "/account",
  };
  const handleNavigate = (item: string) => {
    const path = navigationPaths[item];
    if (path) navigate(path);
  };
  const handleSidebarItemSelect = () => {
    if (compactViewport) {
      setSidebarOpen(false);
      setOpenDropdown(null);
    }
  };
  const sidebarExpanded = compactViewport ? sidebarOpen : !sidebarCollapsed;
  const toggleSidebar = () => {
    if (compactViewport) {
      setSidebarOpen((open) => !open);
      setSidebarCollapsed(false);
    } else {
      setSidebarCollapsed((collapsed) => !collapsed);
      setSidebarOpen(false);
    }
    setOpenDropdown(null);
  };
  const resolvedProfileName = userProfile?.assigneeName?.trim() || profileName;
  const resolvedIsAdmin = userProfile?.isAdmin === true || userProfile?.role === "admin";
  const dismissEnquiryBanner = (enquiryId: string) => setDismissedEnquiryIds((current) => current.includes(enquiryId) ? current : [...current, enquiryId]);

  return (
    <div className={`fleet-app ${fullscreen ? "map-fullscreen" : ""}`}>
      <IssueNotificationBanner isAdmin={resolvedIsAdmin} dismissedIds={dismissedIssueIds} onDismiss={(issueId) => setDismissedIssueIds((current) => current.includes(issueId) ? current : [...current, issueId])} />
      <EnquiryNotificationBanner isAdmin={resolvedIsAdmin} dismissedIds={dismissedEnquiryIds} onDismiss={dismissEnquiryBanner} />
      <TopNavigation onMenu={toggleSidebar} onSignOut={onSignOut} onNavigate={handleNavigate} activeNav={activeNav} setActiveNav={setActiveNav} sidebarExpanded={sidebarExpanded} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} profileName={resolvedProfileName} isAdmin={resolvedIsAdmin} />
      <div className="fleet-body">
        {compactViewport && sidebarOpen && <button className="sidebar-mobile-backdrop" type="button" aria-label="Close navigation menu" onClick={() => { setSidebarOpen(false); setOpenDropdown(null); }} />}
        <Sidebar collapsed={sidebarCollapsed} mobileOpen={sidebarOpen} activeNav={activeNav} setActiveNav={setActiveNav} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} onItemSelect={handleSidebarItemSelect} onNavigate={handleNavigate} onSignOut={onSignOut} profileName={resolvedProfileName} isAdmin={resolvedIsAdmin} />
        <main className="main-view">{typeof children === "function" ? children({ openDropdown, setOpenDropdown, dismissEnquiryBanner }) : children}</main>
      </div>
    </div>
  );
}

export default function Index({ onSignOut }: { onSignOut: () => void }) {
  const [liveVehicles, setLiveVehicles] = useState<Vehicle[]>(vehicles);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("vehicles");
  const [selectedId, setSelectedId] = useState(vehicles[0].id);
  const [focusedVehicle, setFocusedVehicle] = useState<Vehicle | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [loadedVehicleCount, setLoadedVehicleCount] = useState(5);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [vehiclePanelWidth, setVehiclePanelWidth] = useState(DEFAULT_VEHICLE_PANEL_WIDTH);
  const [isResizingVehiclePanel, setIsResizingVehiclePanel] = useState(false);
  const vehiclePanelResize = useRef({ active: false, startX: 0, startWidth: DEFAULT_VEHICLE_PANEL_WIDTH });

  useEffect(() => {
    let active = true;
    const loadRealtime = async () => {
      try {
        const payload = await fetchFleetxRealtime();
        const nextVehicles = extractFleetxVehicles(payload).map(normalizeFleetxVehicle);
        if (active && nextVehicles.length) {
          setLiveVehicles(nextVehicles);
          setSelectedId((current) => nextVehicles.some((vehicle) => vehicle.id === current) ? current : nextVehicles[0].id);
          setRealtimeError(null);
        }
      } catch (error) {
        if (active) setRealtimeError(error instanceof Error ? error.message : "Fleetx realtime data is unavailable.");
      }
    };
    void loadRealtime();
    const interval = window.setInterval(loadRealtime, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const setClampedVehiclePanelWidth = (width: number) => {
    setVehiclePanelWidth(Math.min(MAX_VEHICLE_PANEL_WIDTH, Math.max(MIN_VEHICLE_PANEL_WIDTH, width)));
  };

  const handleVehiclePanelResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    vehiclePanelResize.current = { active: true, startX: event.clientX, startWidth: vehiclePanelWidth };
    setIsResizingVehiclePanel(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleVehiclePanelResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!vehiclePanelResize.current.active) return;
    setClampedVehiclePanelWidth(vehiclePanelResize.current.startWidth + event.clientX - vehiclePanelResize.current.startX);
  };

  const handleVehiclePanelResizeEnd = () => {
    vehiclePanelResize.current.active = false;
    setIsResizingVehiclePanel(false);
  };

  const handleVehiclePanelResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const adjustment = event.key === "ArrowLeft" ? -20 : event.key === "ArrowRight" ? 20 : 0;
    if (!adjustment) return;
    event.preventDefault();
    setClampedVehiclePanelWidth(vehiclePanelWidth + adjustment);
  };

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return liveVehicles.filter((vehicle) => {
      const matchesSearch = !query || [vehicle.plate, vehicle.id, vehicle.driver, vehicle.group, vehicle.location].some((value) => value.toLowerCase().includes(query));
      const selectedFilters = Object.entries(filters).filter(([, checked]) => checked).map(([key]) => key);
      const matchesFilters = !selectedFilters.length || selectedFilters.some((filter) => filter === "insurance" ? vehicle.insurance : vehicle.status === filter);
      return matchesSearch && matchesFilters;
    });
  }, [liveVehicles, search, filters]);

  useEffect(() => {
    setLoadedVehicleCount(5);
  }, [search, filters]);

  const handleVehicleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    if (nearBottom) setLoadedVehicleCount((count) => Math.min(count + 5, filteredVehicles.length));
  };

  const selectedVehicle = liveVehicles.find((vehicle) => vehicle.id === selectedId) ?? liveVehicles[0];
  const loadedVehicles = filteredVehicles.slice(0, loadedVehicleCount);
  const focusVehicle = (vehicleId: string) => {
    const vehicle = liveVehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) return;
    setSelectedId(vehicle.id);
    setFocusedVehicle({ ...vehicle });
  };
  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Realtime" fullscreen={mapFullscreen}>
      {({ openDropdown, setOpenDropdown }) => (
        <>
          <div className="stats-wrap">
            {realtimeError && <div className="realtime-api-status" role="status">Live Fleetx data unavailable. Showing the latest available fleet snapshot.</div>}
            <RealtimeStats vehicles={liveVehicles} />
            <FleetReport vehicles={liveVehicles} />
            {openDropdown === "filter" && <FilterPanel vehicles={liveVehicles} filters={filters} setFilters={setFilters} onClose={() => setOpenDropdown(null)} />}
          </div>
          <div className={`realtime-workspace${isResizingVehiclePanel ? " resizing" : ""}`}>
            <section className="vehicle-panel" style={{ "--vehicle-panel-width": `${vehiclePanelWidth}px` } as CSSProperties}>
              <VehicleSearch search={search} setSearch={setSearch} tab={tab} setTab={setTab} />
              <VehicleList vehicles={loadedVehicles} selectedId={selectedId} onSelect={focusVehicle} onHover={(vehicle) => focusVehicle(vehicle.id)} onScroll={handleVehicleListScroll} tab={tab} />
            </section>
            <div
              className="vehicle-panel-resize-handle"
              role="separator"
              aria-label="Resize vehicle panel"
              aria-orientation="vertical"
              aria-valuemin={MIN_VEHICLE_PANEL_WIDTH}
              aria-valuemax={MAX_VEHICLE_PANEL_WIDTH}
              aria-valuenow={vehiclePanelWidth}
              tabIndex={0}
              onPointerDown={handleVehiclePanelResizeStart}
              onPointerMove={handleVehiclePanelResizeMove}
              onPointerUp={handleVehiclePanelResizeEnd}
              onPointerCancel={handleVehiclePanelResizeEnd}
              onKeyDown={handleVehiclePanelResizeKeyDown}
            />
            <MapPanel vehicles={liveVehicles} selected={selectedVehicle} focusedVehicle={focusedVehicle} onSelect={focusVehicle} onFullscreen={() => setMapFullscreen((open) => !open)} />
          </div>
        </>
      )}
    </FleetLayout>
  );
}
