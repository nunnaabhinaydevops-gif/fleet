import { FirebaseError } from "firebase/app";
import { ChevronLeft, ChevronRight, Check, Copy, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { assignEnquiry, createManagedEnquiry, createReferralCode, deleteReferralCode, getCurrentUserProfile, getFleetUsers, getManagedEnquiries, getReferralCodes, markEnquiryNoted, type EnquiryRecord, type FleetUserSummary, type ManagedEnquiry } from "@/firebase";
import { FleetLayout } from "./Index";

type EnquiriesPageProps = { onSignOut: () => void };
const ENQUIRIES_PER_PAGE = 10;
const EMPTY_ENQUIRY: EnquiryRecord = {
  name: "", company: "", email: "", phone: "", referral: "", fromLocation: "", toLocation: "",
  materialWeight: "", materialDimensions: "", vehicleType: "", service: "", message: "", duration: "",
  preferredBrand: "", equipment: "", serviceDate: "",
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "You do not have permission to view these enquiries.";
  return error instanceof Error ? error.message : "Enquiries could not be loaded.";
}

export default function EnquiriesPage({ onSignOut }: EnquiriesPageProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [enquiries, setEnquiries] = useState<ManagedEnquiry[]>([]);
  const [referralCodes, setReferralCodes] = useState<string[]>([]);
  const [fleetUsers, setFleetUsers] = useState<FleetUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [deletingCode, setDeletingCode] = useState("");
  const [assigningId, setAssigningId] = useState("");
  const [notingId, setNotingId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEnquiry, setNewEnquiry] = useState<EnquiryRecord>(EMPTY_ENQUIRY);
  const [newAssignee, setNewAssignee] = useState("");
  const [creatingEnquiry, setCreatingEnquiry] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams] = useSearchParams();
  const selectedEnquiryId = searchParams.get("enquiry");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const profile = await getCurrentUserProfile();
      const admin = profile?.isAdmin === true || profile?.role === "admin";
      setIsAdmin(admin);
      const [nextEnquiries, nextCodes, nextUsers] = await Promise.all([
        getManagedEnquiries(admin),
        getReferralCodes(),
        admin ? getFleetUsers() : Promise.resolve([]),
      ]);
      setEnquiries(nextEnquiries);
      setReferralCodes(nextCodes);
      setFleetUsers(nextUsers);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const visibleEnquiries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enquiries;
    return enquiries.filter((enquiry) => [enquiry.name, enquiry.company, enquiry.email, enquiry.referral, enquiry.assignedToName].some((value) => value.toLowerCase().includes(query)));
  }, [enquiries, search]);
  const pageCount = Math.max(1, Math.ceil(visibleEnquiries.length / ENQUIRIES_PER_PAGE));
  const paginatedEnquiries = visibleEnquiries.slice((currentPage - 1) * ENQUIRIES_PER_PAGE, currentPage * ENQUIRIES_PER_PAGE);
  const firstVisibleEnquiry = visibleEnquiries.length ? (currentPage - 1) * ENQUIRIES_PER_PAGE + 1 : 0;
  const lastVisibleEnquiry = Math.min(currentPage * ENQUIRIES_PER_PAGE, visibleEnquiries.length);

  useEffect(() => { setCurrentPage(1); }, [search]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);
  useEffect(() => {
    if (!selectedEnquiryId) return;
    const selectedIndex = visibleEnquiries.findIndex((enquiry) => enquiry.id === selectedEnquiryId);
    if (selectedIndex >= 0) setCurrentPage(Math.floor(selectedIndex / ENQUIRIES_PER_PAGE) + 1);
  }, [selectedEnquiryId, visibleEnquiries]);

  async function handleCreateCode() {
    if (creatingCode) return;
    setCreatingCode(true);
    try {
      const code = await createReferralCode();
      setReferralCodes((current) => [...current, code].sort());
      setFeedback(`Referral code ${code} is ready to share.`);
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
    } finally {
      setCreatingCode(false);
    }
  }

  async function handleCopy(code: string) {
    await navigator.clipboard.writeText(code);
    setFeedback(`Copied ${code}.`);
  }

  async function handleDeleteCode(code: string) {
    if (deletingCode) return;
    setDeletingCode(code);
    try {
      await deleteReferralCode(code);
      setReferralCodes((current) => current.filter((item) => item !== code));
      setFeedback("Referral code removed. You can generate a replacement.");
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
    } finally {
      setDeletingCode("");
    }
  }

  async function handleNoted(enquiryId: string, dismissEnquiryBanner: (id: string) => void) {
    if (notingId) return;
    setNotingId(enquiryId);
    try {
      await markEnquiryNoted(enquiryId);
      setEnquiries((current) => current.map((item) => item.id === enquiryId ? { ...item, status: "noted" } : item));
      dismissEnquiryBanner(enquiryId);
      setFeedback("Enquiry marked as noted.");
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
    } finally {
      setNotingId("");
    }
  }

  async function handleAssign(enquiry: ManagedEnquiry, assignedTo: string) {
    if (!assignedTo || assigningId) return;
    const assignee = fleetUsers.find((user) => user.uid === assignedTo);
    if (!assignee) return;
    setAssigningId(enquiry.id);
    try {
      await assignEnquiry(enquiry.id, assignee.uid, assignee.displayName || assignee.email || assignee.uid);
      setEnquiries((current) => current.map((item) => item.id === enquiry.id ? { ...item, assignedTo: assignee.uid, assignedToName: assignee.displayName || assignee.email } : item));
      setFeedback("Enquiry assigned successfully.");
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
    } finally {
      setAssigningId("");
    }
  }

  async function handleCreateEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingEnquiry) return;
    setCreatingEnquiry(true);
    try {
      const assignee = isAdmin ? fleetUsers.find((user) => user.uid === newAssignee) : undefined;
      await createManagedEnquiry(newEnquiry, assignee);
      setNewEnquiry(EMPTY_ENQUIRY);
      setNewAssignee("");
      setShowCreateForm(false);
      setFeedback("Enquiry created successfully.");
      await loadDashboard();
    } catch (caughtError) {
      setFeedback(errorMessage(caughtError));
    } finally {
      setCreatingEnquiry(false);
    }
  }

  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Enquiries">
      {({ dismissEnquiryBanner }) => <div className="enquiries-page trips-page">
        <div className="trips-page-header">
          <div><div className="trips-breadcrumb"><span>Fleet Management</span><span>→</span><strong>Enquiries</strong></div><h1>Enquiries <span className="trips-count">({visibleEnquiries.length})</span></h1><p>Share referral codes and follow up with incoming enquiries.</p></div>
          <div className="enquiry-header-actions"><button className="trips-secondary-button" type="button" onClick={() => setShowCreateForm((visible) => !visible)}><Plus size={15} /> {showCreateForm ? "Close form" : "Create enquiry"}</button><button className="trips-primary-button" type="button" onClick={() => void loadDashboard()} disabled={loading}><RefreshCw size={15} /> {loading ? "Refreshing…" : "Refresh"}</button></div>
        </div>
        {showCreateForm && <section className="create-enquiry-card trips-card"><div className="create-enquiry-heading"><div><strong>Create an enquiry</strong><span>{isAdmin ? "Add an enquiry and optionally assign it to a fleet manager." : "Add an enquiry for your own follow-up."}</span></div></div><form className="create-enquiry-form" onSubmit={handleCreateEnquiry}><div className="create-enquiry-fields"><label><span>Name</span><input value={newEnquiry.name} onChange={(event) => setNewEnquiry((current) => ({ ...current, name: event.target.value }))} required /></label><label><span>Company</span><input value={newEnquiry.company} onChange={(event) => setNewEnquiry((current) => ({ ...current, company: event.target.value }))} required /></label><label><span>Phone</span><input type="tel" value={newEnquiry.phone} onChange={(event) => setNewEnquiry((current) => ({ ...current, phone: event.target.value }))} required /></label><label><span>Service date</span><input type="date" value={newEnquiry.serviceDate} onChange={(event) => setNewEnquiry((current) => ({ ...current, serviceDate: event.target.value }))} required /></label><label><span>Referral code</span><input value={newEnquiry.referral} onChange={(event) => setNewEnquiry((current) => ({ ...current, referral: event.target.value }))} placeholder="Optional" /></label>{isAdmin && <label><span>Assign to fleet manager</span><select value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)}><option value="">Leave unassigned</option>{fleetUsers.filter((user) => !user.disabled).map((user) => <option value={user.uid} key={user.uid}>{user.displayName || user.email}</option>)}</select></label>}</div><label><span>Message</span><textarea value={newEnquiry.message} onChange={(event) => setNewEnquiry((current) => ({ ...current, message: event.target.value }))} placeholder="Describe the requirement" rows={4} required /></label><div className="create-enquiry-actions"><button className="trips-primary-button" type="submit" disabled={creatingEnquiry}>{creatingEnquiry ? "Creating…" : "Create enquiry"}</button></div></form></section>}
        {feedback && <div className="issues-feedback" role="status"><span>{feedback}</span><button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message"><X size={15} /></button></div>}
        {error && <div className="trips-error"><span>{error}</span><button type="button" onClick={() => void loadDashboard()}>Try again</button></div>}

        <section className="referral-card trips-card">
          <div><span className="referral-eyebrow">Your referral codes</span><h2>Bring enquiries to your dashboard</h2><p>Share a code with a customer. Enquiries using your code are visible only to you and administrators. Codes do not expire.</p></div>
          <div className="referral-code-list">{referralCodes.slice(0, 2).map((code) => <div className="referral-code" key={code}><strong>{code}</strong><button type="button" onClick={() => void handleCopy(code)} aria-label="Copy referral code" title="Copy referral code"><Copy size={14} /></button><button className="referral-remove-button" type="button" onClick={() => void handleDeleteCode(code)} disabled={Boolean(deletingCode)} aria-label="Remove referral code" title="Remove referral code"><Trash2 size={13} /></button></div>)}{!referralCodes.length && <span className="referral-empty">No referral code yet.</span>}<button className="referral-new-button" type="button" onClick={() => void handleCreateCode()} disabled={creatingCode || referralCodes.length >= 2}><Plus size={14} /> {referralCodes.length >= 2 ? "2 codes active" : creatingCode ? "Generating…" : "Generate new code"}</button></div>
        </section>

        <section className="enquiries-list-card trips-card">
          <div className="enquiries-list-heading"><div><strong>{isAdmin ? "All incoming enquiries" : "Enquiries linked to you"}</strong><span>{isAdmin ? "Unreferred enquiries can be assigned to a fleet manager." : "Only enquiries linked to your referral code or assigned to you appear here."}</span></div><Users size={19} /></div>
          <div className="trips-toolbar"><input className="enquiries-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search enquiries" /></div>
          {loading ? <div className="issues-empty"><span className="trips-spinner" />Loading enquiries…</div> : !visibleEnquiries.length ? <div className="issues-empty"><strong>No enquiries found</strong><span>Enquiries submitted with your referral code will appear here.</span></div> : <div className="enquiry-list">{paginatedEnquiries.map((enquiry) => <article className={`enquiry-card ${selectedEnquiryId === enquiry.id ? "selected" : ""}`} key={enquiry.id} id={`enquiry-${enquiry.id}`}><div className="enquiry-card-top"><div><span className="enquiry-status">{enquiry.status}</span><h2>{enquiry.name || "Unnamed enquiry"}</h2><span className="enquiry-company">{enquiry.company || enquiry.email}</span></div><span className="enquiry-date">{formatDate(enquiry.createdAt)}</span></div><p>{enquiry.message || `${enquiry.service || enquiry.vehicleType} enquiry from ${enquiry.fromLocation} to ${enquiry.toLocation}.`}</p><div className="enquiry-meta"><span><strong>Referral</strong> {enquiry.referral || "None"}</span><span><strong>Service date</strong> {enquiry.serviceDate || "—"}</span><span><strong>Phone</strong> {enquiry.phone || "—"}</span></div>{enquiry.status !== "noted" && <button className="trips-primary-button enquiry-noted-button" type="button" onClick={() => void handleNoted(enquiry.id, dismissEnquiryBanner)} disabled={Boolean(notingId)}>{notingId === enquiry.id ? "Saving…" : "Noted"}</button>}{isAdmin && !enquiry.referral && <label className="enquiry-assignment"><span>Assign to fleet manager</span><select value={enquiry.assignedTo} onChange={(event) => void handleAssign(enquiry, event.target.value)} disabled={assigningId === enquiry.id}><option value="">Select a user</option>{fleetUsers.filter((user) => user.role === "fleet_manager" || user.role === "admin").map((user) => <option value={user.uid} key={user.uid}>{user.displayName || user.email}</option>)}</select></label>}{enquiry.assignedToName && <span className="enquiry-assigned">Assigned to {enquiry.assignedToName}</span>}</article>)}</div>}
          {!loading && !error && Boolean(visibleEnquiries.length) && <div className="trips-pagination" aria-label="Enquiries pagination"><span>Showing {firstVisibleEnquiry}–{lastVisibleEnquiry} of {visibleEnquiries.length} enquiries</span><div className="trips-pagination-controls"><button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button><span>Page {currentPage} of {pageCount}</span><button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}><ChevronRight size={16} /></button></div></div>}
        </section>
      </div>}
    </FleetLayout>
  );
}
