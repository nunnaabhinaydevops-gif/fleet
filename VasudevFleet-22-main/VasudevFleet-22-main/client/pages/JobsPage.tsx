import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Circle, Clock3, ExternalLink, Filter, MapPin, MoreVertical, Search, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FleetLayout } from "./Index";
import { getJobs, updateJobStatus, type JobRecord } from "@/firebase";

type JobView = "board" | "table" | "map";
type JobFilter = "all" | JobRecord["status"];
type Stage = { label: string; icon: "check" | "truck" | "warning" | "pending" };

const statusLabels: Record<JobRecord["status"], string> = { active: "Running", delayed: "Delayed", completed: "Completed", closed: "Closed" };
const stages: Stage[] = [
  { label: "In transit to loading", icon: "check" },
  { label: "Loading", icon: "check" },
  { label: "In transit to unloading", icon: "truck" },
  { label: "Unloading", icon: "pending" },
  { label: "Closed", icon: "pending" },
];

function getStages(status: JobRecord["status"]): Stage[] {
  if (status === "completed" || status === "closed") return stages.map((stage) => ({ ...stage, icon: "check" }));
  if (status === "delayed") return stages.map((stage, index) => ({ ...stage, icon: index === 2 ? "warning" : index < 2 ? "check" : "pending" }));
  return stages;
}

function StageIcon({ type }: { type: Stage["icon"] }) {
  if (type === "check") return <Check size={12} />;
  if (type === "truck") return <Truck size={12} />;
  if (type === "warning") return <AlertTriangle size={12} />;
  return <Circle size={10} />;
}

function JobProgress({ status }: { status: JobRecord["status"] }) {
  return <div className={`job-stage-tracker ${status}`} aria-label="Five-stage job progress">
    {getStages(status).map((stage, index) => <div className="job-stage-step" key={stage.label}>
      <span className={`job-stage-icon ${stage.icon}`}><StageIcon type={stage.icon} /></span><small>{stage.label}</small>
      {index < stages.length - 1 && <i className={stage.icon === "check" ? "complete" : stage.icon === "truck" || stage.icon === "warning" ? "current" : "pending"} />}
    </div>)}
  </div>;
}

function JobCard({ job, expanded, onExpand, onStatusChange, onMap }: { job: JobRecord; expanded: boolean; onExpand: () => void; onStatusChange: (status: JobRecord["status"]) => void; onMap: () => void }) {
  const progress = job.status === "completed" || job.status === "closed" ? 100 : job.status === "delayed" ? 42 : 60;
  const currentStage = job.status === "completed" || job.status === "closed" ? "Closed" : job.status === "delayed" ? "Delayed in transit" : "In transit to unloading";
  return <article className={`job-board-card ${job.status} ${expanded ? "expanded" : ""}`}>
    <div className="job-card-main">
      <div className="job-card-identity"><div><span className="job-card-kicker">TRIP {job.tripId.replace("trip-", "").slice(-8)}</span><h3>{job.vehicleNumber}</h3></div><span className={`job-status ${job.status}`}><i />{statusLabels[job.status]}</span></div>
      <div className="job-route"><div><small>FROM</small><strong>{job.fromLocation}</strong></div><ChevronRight size={18} /><div><small>TO</small><strong>{job.toLocation}</strong></div></div>
      <JobProgress status={job.status} />
      <div className="job-current-stage"><div><small>CURRENT STAGE</small><strong>{currentStage}</strong></div><div className="job-progress-value"><strong>{progress}%</strong><span><i style={{ width: `${progress}%` }} /></span></div></div>
    </div>
    <div className="job-card-side"><div className="job-live-item"><MapPin size={15} /><span><small>Current location</small><strong>{job.fromLocation}</strong></span></div><div className="job-live-item"><Truck size={15} /><span><small>Vehicle / driver</small><strong>{job.vehicleNumber}</strong><em>Driver assigned from trip</em></span></div><div className="job-card-meta"><span><small>Customer</small><strong>{job.customerCompanyName}</strong></span><span><small>Created</small><strong>{new Date(job.createdAt).toLocaleDateString()}</strong></span></div><div className="job-card-actions"><button type="button" onClick={onExpand}>{expanded ? "Hide details" : "View details"}</button><button type="button" onClick={onMap}><MapPin size={13} /> Live map</button><button type="button" className="job-more" aria-label="More job actions"><MoreVertical size={16} /></button></div></div>
    {expanded && <div className="job-expanded-details"><div className="job-detail-summary"><strong>JOB STATUS &amp; PROGRESS</strong><span>{job.fromLocation} <b>to</b> {job.toLocation}</span><span>Overall progress: {progress}%</span></div><div className="job-detail-grid"><span>Trip ID<strong>{job.tripId}</strong></span><span>Vehicle<strong>{job.vehicleNumber}</strong></span><span>Customer<strong>{job.customerCompanyName}</strong></span><span>From<strong>{job.fromLocation}</strong></span><span>To<strong>{job.toLocation}</strong></span><span>Status<strong>{statusLabels[job.status]}</strong></span></div><label className="job-status-editor">Update status<select value={job.status} onChange={(event) => onStatusChange(event.target.value as JobRecord["status"])}><option value="active">Active</option><option value="delayed">Delayed</option><option value="completed">Completed</option><option value="closed">Closed</option></select></label></div>}
  </article>;
}

export default function JobsPage({ onSignOut }: { onSignOut: () => void }) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [view, setView] = useState<JobView>("board");
  const [filter, setFilter] = useState<JobFilter>("all");
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("All vehicles");
  const [customerFilter, setCustomerFilter] = useState("All customers");
  const [sort, setSort] = useState("Latest updated");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sections, setSections] = useState({ running: true, delayed: true, completed: true });

  useEffect(() => { void getJobs().then(setJobs); }, []);
  const vehicles = useMemo(() => ["All vehicles", ...new Set(jobs.map((job) => job.vehicleNumber))], [jobs]);
  const customers = useMemo(() => ["All customers", ...new Set(jobs.map((job) => job.customerCompanyName))], [jobs]);
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const query = search.trim().toLowerCase();
    return (!query || [job.id, job.tripId, job.vehicleNumber, job.customerCompanyName, job.fromLocation, job.toLocation].some((value) => value.toLowerCase().includes(query))) && (filter === "all" || job.status === filter) && (vehicleFilter === "All vehicles" || job.vehicleNumber === vehicleFilter) && (customerFilter === "All customers" || job.customerCompanyName === customerFilter);
  }).sort((first, second) => sort === "Vehicle number" ? first.vehicleNumber.localeCompare(second.vehicleNumber) : second.createdAt.localeCompare(first.createdAt)), [customerFilter, filter, jobs, search, sort, vehicleFilter]);
  const runningJobs = visibleJobs.filter((job) => job.status === "active");
  const delayedJobs = visibleJobs.filter((job) => job.status === "delayed");
  const completedJobs = visibleJobs.filter((job) => job.status === "completed" || job.status === "closed");
  const updateStatus = async (job: JobRecord, status: JobRecord["status"]) => { await updateJobStatus(job.id, status); setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status } : item)); };
  const clearFilters = () => { setSearch(""); setFilter("all"); setVehicleFilter("All vehicles"); setCustomerFilter("All customers"); };
  const section = (key: "running" | "delayed" | "completed", title: string, sectionJobs: JobRecord[]) => <section className="jobs-board-section"><button className="jobs-section-heading" type="button" onClick={() => setSections((current) => ({ ...current, [key]: !current[key] }))}><span><ChevronDown className={sections[key] ? "open" : ""} size={16} /><strong>{title}</strong><em>{sectionJobs.length}</em></span><small>{sections[key] ? "Collapse" : "Expand"}</small></button>{sections[key] && sectionJobs.map((job) => <JobCard key={job.id} job={job} expanded={expanded === job.id} onExpand={() => setExpanded((current) => current === job.id ? null : job.id)} onStatusChange={(status) => void updateStatus(job, status)} onMap={() => navigate("/realtime")} />)}</section>;
  const summary = [["active", "ACTIVE", jobs.filter((job) => job.status === "active").length], ["loading", "LOADING", 0], ["transit", "IN TRANSIT", jobs.filter((job) => job.status === "active").length], ["unloading", "UNLOADING", 0], ["delayed", "DELAYED", jobs.filter((job) => job.status === "delayed").length], ["completed", "COMPLETED", jobs.filter((job) => job.status === "completed").length]] as const;

  return <FleetLayout onSignOut={onSignOut} activeNav="Jobs"><div className="jobs-page jobs-enterprise-page">
    <header className="jobs-enterprise-header"><div><span>FLEET OPERATIONS</span><h1>Jobs</h1><p>Monitor active trips, vehicle movement, job progress and delivery status.</p></div><button type="button" onClick={() => navigate("/trips/create")}><Truck size={16} /> Create Job</button></header>
    <div className="jobs-view-switcher"><button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>Board view</button><button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Table view</button><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Map view</button></div>
    <label className="jobs-enterprise-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Trip ID, Vehicle, Driver, Customer, or Location..." /></label>
    <div className="jobs-filter-bar"><label><Clock3 size={14} /><select><option>Date range</option><option>Today</option><option>This week</option><option>This month</option></select></label><label><select value={filter} onChange={(event) => setFilter(event.target.value as JobFilter)}><option value="all">All jobs</option><option value="active">Active</option><option value="delayed">Delayed</option><option value="completed">Completed</option></select></label><label><select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle}>{vehicle}</option>)}</select></label><label><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>{customers.map((customer) => <option key={customer}>{customer}</option>)}</select></label><label><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Latest updated</option><option>Vehicle number</option></select></label><button type="button" onClick={clearFilters}><Filter size={14} /> Clear filters</button></div>
    <div className="jobs-summary-cards">{summary.map(([value, label, count]) => <button type="button" key={value} className={`jobs-summary-card ${value}`} onClick={() => setFilter(value === "transit" ? "active" : value as JobFilter)}><small>{label}</small><strong>{count}</strong></button>)}</div>
    {view === "board" && <div className="jobs-board">{section("running", "RUNNING JOBS", runningJobs)}{section("delayed", "DELAYED JOBS", delayedJobs)}{section("completed", "COMPLETED TODAY", completedJobs)}{!visibleJobs.length && <div className="jobs-empty"><span><Truck size={24} /></span><strong>No jobs match these filters</strong><p>Jobs are created automatically when a trip is saved.</p></div>}</div>}
    {view === "table" && <section className="jobs-list-card jobs-enterprise-table"><div className="jobs-table-wrap"><table className="jobs-table"><thead><tr><th>#</th><th>Date &amp; Time</th><th>Trip</th><th>Vehicle / Driver</th><th>Route</th><th>Job status &amp; progress</th><th>Overall progress</th><th>ETA</th><th>Action</th></tr></thead><tbody>{visibleJobs.map((job, index) => <tr key={job.id}><td>{index + 1}</td><td>{new Date(job.createdAt).toLocaleString()}</td><td><strong>{job.tripId}</strong></td><td><strong>{job.vehicleNumber}</strong><small>Driver assigned from trip</small></td><td>{job.fromLocation} to {job.toLocation}</td><td><JobProgress status={job.status} /></td><td>{job.status === "completed" ? "100%" : "60%"}</td><td>Not set</td><td><button type="button" onClick={() => setExpanded(job.id)}>View</button></td></tr>)}</tbody></table></div></section>}
    {view === "map" && <section className="jobs-map-handoff"><MapPin size={38} /><h2>Live vehicle map</h2><p>Use the existing Realtime map to see vehicle positions, current speed, and GPS updates.</p><button type="button" onClick={() => navigate("/realtime")}><ExternalLink size={15} /> Open Realtime map</button></section>}
  </div></FleetLayout>;
}