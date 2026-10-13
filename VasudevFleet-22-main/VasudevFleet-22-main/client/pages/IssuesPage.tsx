import { FirebaseError } from "firebase/app";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { auth, closeIssue, createIssue, getCurrentUserProfile, subscribeToIssues, type IssueRecord } from "@/firebase";
import { FleetLayout } from "./Index";

type IssuesPageProps = { onSignOut: () => void };
const ISSUES_PER_PAGE = 10;

function formatDate(value: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function issueError(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "You do not have permission to access issues.";
  return error instanceof Error ? error.message : "Issues could not be loaded.";
}

export default function IssuesPage({ onSignOut }: IssuesPageProps) {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchParams] = useSearchParams();
  const selectedIssueId = searchParams.get("issue");

  useEffect(() => {
    let active = true;
    void getCurrentUserProfile().then((profile) => {
      if (active) setIsAdmin(profile?.isAdmin === true || profile?.role === "admin");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError("");
    const unsubscribe = subscribeToIssues(
      isAdmin,
      (nextIssues) => {
        setIssues(nextIssues);
        setLoading(false);
      },
      (nextError) => {
        setError(issueError(nextError));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [isAdmin]);

  const openIssues = useMemo(() => issues.filter((issue) => issue.status === "open"), [issues]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(issues.length / ISSUES_PER_PAGE));
  const paginatedIssues = issues.slice((currentPage - 1) * ISSUES_PER_PAGE, currentPage * ISSUES_PER_PAGE);
  const paginatedOpenIssues = paginatedIssues.filter((issue) => issue.status === "open");
  const paginatedClosedIssues = paginatedIssues.filter((issue) => issue.status === "closed");
  const firstVisibleIssue = issues.length ? (currentPage - 1) * ISSUES_PER_PAGE + 1 : 0;
  const lastVisibleIssue = Math.min(currentPage * ISSUES_PER_PAGE, issues.length);

  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)); }, [pageCount]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim() || saving) return;
    if (imageFile && (imageFile.size > 5 * 1024 * 1024 || !imageFile.type.startsWith("image/"))) {
      setFeedback("Choose an image smaller than 5 MB.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      await createIssue({ title: title.trim(), description: description.trim(), category, imageFile: imageFile ?? undefined });
      setTitle("");
      setDescription("");
      setCategory("General");
      setImageFile(null);
      setShowForm(false);
      setFeedback("Issue raised successfully.");
    } catch (caughtError) {
      setFeedback(issueError(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(issueId: string) {
    if (closingId) return;
    setClosingId(issueId);
    setFeedback("");
    try {
      await closeIssue(issueId);
    } catch (caughtError) {
      setFeedback(issueError(caughtError));
    } finally {
      setClosingId("");
    }
  }

  const renderIssue = (issue: IssueRecord) => (
    <article className={`issue-ticket ${issue.status === "closed" ? "closed" : ""} ${selectedIssueId === issue.id ? "selected" : ""}`} key={issue.id} id={`issue-${issue.id}`}>
      <div className="issue-ticket-heading">
        <div>
          <span className={`issue-status ${issue.status}`}><span />{issue.status === "closed" ? "Closed" : "Open"}</span>
          <h2>{issue.title}</h2>
        </div>
        <span className="issue-category">{issue.category}</span>
      </div>
      <p className="issue-description">{issue.description}</p>
      {issue.imageUrl && <a className="issue-attachment" href={issue.imageUrl} target="_blank" rel="noreferrer"><img src={issue.imageUrl} alt={`Attachment for ${issue.title}`} /><span>View uploaded image</span></a>}
      <div className="issue-ticket-meta">
        <span><strong>Raised by</strong> {issue.createdByName}{issue.createdByEmail ? ` · ${issue.createdByEmail}` : ""}</span>
        <span><strong>Created</strong> {formatDate(issue.createdAt)}</span>
        {issue.status === "closed" && <span><strong>Closed by</strong> {issue.closedByName || "Fleet administrator"} · {formatDate(issue.closedAt)}</span>}
      </div>
      {issue.status === "open" && <button className="issue-close-button" type="button" onClick={() => void handleClose(issue.id)} disabled={Boolean(closingId)}><CheckCircle2 size={15} /> {closingId === issue.id ? "Closing…" : "Close ticket"}</button>}
    </article>
  );

  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Issues">
      <div className="issues-page trips-page">
        <div className="trips-page-header issues-page-header">
          <div>
            <div className="trips-breadcrumb"><span>Fleet Management</span><span>→</span><strong>Issues</strong></div>
            <h1>Issues <span className="trips-count">({openIssues.length} open)</span></h1>
            <p>Raise a ticket for a problem and track its resolution.</p>
          </div>
          <button className="trips-primary-button" type="button" onClick={() => setShowForm((open) => !open)}><Plus size={15} /> Raise an issue</button>
        </div>

        {feedback && <div className="issues-feedback" role="status"><span>{feedback}</span><button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message"><X size={15} /></button></div>}
        {showForm && <form className="issue-form trips-card" onSubmit={handleSubmit}>
          <div className="issue-form-heading"><div><strong>Raise a new issue</strong><span>Describe the problem so the fleet team can resolve it.</span></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Close issue form"><X size={16} /></button></div>
          <div className="issue-form-grid">
            <label><span>Issue title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="What is going wrong?" /></label>
            <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>General</option><option>Vehicle</option><option>Trip</option><option>Account</option><option>Technical</option></select></label>
            <label className="issue-form-wide"><span>Details</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} required placeholder="Add the details, steps, or context that will help resolve this issue." /></label>
            <label className="issue-form-wide"><span>Screenshot or image <em>(optional, max 5 MB)</em></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
            {imageFile && <div className="issue-selected-file"><span>{imageFile.name}</span><button type="button" onClick={() => setImageFile(null)} aria-label="Remove selected image"><X size={14} /></button></div>}
          </div>
          <div className="issue-form-actions"><button className="trips-primary-button" type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit ticket"}</button></div>
        </form>}

        <section className="issues-list-card trips-card">
          <div className="issues-list-heading"><div><strong>{isAdmin ? "All issue tickets" : "Your issue tickets"}</strong><span>{isAdmin ? "Review tickets raised by fleet users." : "Track the issues you have raised."}</span></div><span className="issues-live"><span />Live updates</span></div>
          {error && <div className="trips-error"><span>{error}</span><button type="button" onClick={() => window.location.reload()}><RefreshCw size={14} /> Try again</button></div>}
          {loading && <div className="issues-empty"><span className="trips-spinner" />Loading issue tickets…</div>}
          {!loading && !error && !issues.length && <div className="issues-empty"><AlertCircle size={28} /><strong>No issue tickets yet</strong><span>Raise a ticket when you need help from the fleet team.</span></div>}
          {!loading && !error && Boolean(paginatedOpenIssues.length) && <div className="issues-ticket-list">{paginatedOpenIssues.map(renderIssue)}</div>}
          {!loading && !error && Boolean(paginatedClosedIssues.length) && <div className="issues-closed-section"><h3>Closed tickets</h3><div className="issues-ticket-list">{paginatedClosedIssues.map(renderIssue)}</div></div>}
          {!loading && !error && Boolean(issues.length) && <div className="trips-pagination" aria-label="Issues pagination"><span>Showing {firstVisibleIssue}–{lastVisibleIssue} of {issues.length} issues</span><div className="trips-pagination-controls"><button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button><span>Page {currentPage} of {pageCount}</span><button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}><ChevronRight size={16} /></button></div></div>}
        </section>
      </div>
    </FleetLayout>
  );
}
