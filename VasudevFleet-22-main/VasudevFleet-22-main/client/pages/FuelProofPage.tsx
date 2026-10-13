import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Camera, Check, CheckCircle2, CircleDollarSign, Clock3, FileCheck2, Fuel, Gauge, ImagePlus, ListFilter, Mic, Play, Plus, Search, ShieldCheck, Video, X } from "lucide-react";
import { FleetLayout } from "./Index";
import "./FuelProofPage.css";

type FuelStatus = "pending" | "approved" | "rejected";
type FuelEntry = {
  id: string;
  createdAt: string;
  driver: string;
  vehicleNumber: string;
  station: string;
  litres: number;
  rate: number;
  total: number;
  odometer: number;
  notes: string;
  status: FuelStatus;
  billPhoto: Blob;
  fillingVideo: Blob;
};
type WizardValues = { driver: string; vehicleNumber: string; station: string; litres: string; rate: string; odometer: string; notes: string };
type ViewTab = "dashboard" | "records";

const DB_NAME = "vasudev-fuel-proof";
const STORE_NAME = "entries";
const emptyValues: WizardValues = { driver: "", vehicleNumber: "", station: "", litres: "", rate: "", odometer: "", notes: "" };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Fuel records could not be opened."));
  });
}

async function getEntries() {
  const database = await openDatabase();
  try {
    return await new Promise<FuelEntry[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as FuelEntry[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      request.onerror = () => reject(request.error ?? new Error("Fuel records could not be loaded."));
    });
  } finally {
    database.close();
  }
}

async function putEntry(entry: FuelEntry) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Fuel record could not be saved."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Fuel record could not be saved."));
    });
  } finally {
    database.close();
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StoredMedia({ blob, video = false, className = "" }: { blob: Blob; video?: boolean; className?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);
  if (!url) return <div className={`fuel-media-loading ${className}`} />;
  return video
    ? <video className={className} src={url} controls playsInline preload="metadata" />
    : <img className={className} src={url} alt="Fuel purchase bill" />;
}

function StatusPill({ status }: { status: FuelStatus }) {
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? X : Clock3;
  return <span className={`fuel-status ${status}`}><Icon size={13} />{status[0].toUpperCase() + status.slice(1)}</span>;
}

export default function FuelProofPage({ onSignOut }: { onSignOut: () => void }) {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [tab, setTab] = useState<ViewTab>("dashboard");
  const [statusFilter, setStatusFilter] = useState<"all" | FuelStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [billPhoto, setBillPhoto] = useState<Blob | null>(null);
  const [fillingVideo, setFillingVideo] = useState<Blob | null>(null);
  const [values, setValues] = useState<WizardValues>(emptyValues);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void getEntries().then((loaded) => { if (active) setEntries(loaded); }).catch((error: unknown) => {
      if (active) setStorageError(error instanceof Error ? error.message : "Fuel records could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const todayEntries = useMemo(() => entries.filter((entry) => new Date(entry.createdAt).toDateString() === new Date().toDateString()), [entries]);
  const litresToday = todayEntries.reduce((sum, entry) => sum + entry.litres, 0);
  const spendToday = todayEntries.reduce((sum, entry) => sum + entry.total, 0);
  const pendingCount = entries.filter((entry) => entry.status === "pending").length;
  const filteredEntries = entries.filter((entry) => {
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const query = search.trim().toLowerCase();
    return matchesStatus && (!query || [entry.vehicleNumber, entry.driver, entry.station, entry.odometer].some((item) => String(item).toLowerCase().includes(query)));
  });
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const calculatedTotal = (Number(values.litres) || 0) * (Number(values.rate) || 0);

  function clearCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (cameraRef.current) cameraRef.current.srcObject = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function closeWizard() {
    clearCamera();
    setWizardOpen(false);
    setStep(1);
    setBillPhoto(null);
    setFillingVideo(null);
    setValues(emptyValues);
    setCameraError("");
    setFeedback("");
    setRecordingSeconds(0);
  }

  async function startRecording() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
      streamRef.current = stream;
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
        await cameraRef.current.play();
      }
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        if (chunks.length) setFillingVideo(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cameraRef.current) cameraRef.current.srcObject = null;
        setRecording(false);
      };
      recorderRef.current = recorder;
      setFillingVideo(null);
      setRecordingSeconds(0);
      recorder.start(500);
      setRecording(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Camera and microphone access is unavailable.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!billPhoto || !fillingVideo || saving) return;
    const entry: FuelEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      driver: values.driver.trim(),
      vehicleNumber: values.vehicleNumber.trim().toUpperCase(),
      station: values.station.trim(),
      litres: Number(values.litres),
      rate: Number(values.rate),
      total: calculatedTotal,
      odometer: Number(values.odometer),
      notes: values.notes.trim(),
      status: "pending",
      billPhoto,
      fillingVideo,
    };
    setSaving(true);
    setStorageError("");
    try {
      await putEntry(entry);
      setEntries((current) => [entry, ...current]);
      closeWizard();
      setTab("dashboard");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Fuel entry could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(entry: FuelEntry, status: FuelStatus) {
    const updated = { ...entry, status };
    try {
      await putEntry(updated);
      setEntries((current) => current.map((item) => item.id === entry.id ? updated : item));
      setSelectedEntryId(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Review decision could not be saved.");
    }
  }

  const pageTitle = selectedEntry ? "Fuel entry" : "FuelProof";

  return <FleetLayout onSignOut={onSignOut} activeNav="Records">
    <section className="fuelproof-page">
      <header className="fuelproof-header">
        <div className="fuelproof-heading">
          {selectedEntry && <button type="button" className="fuel-icon-button fuel-back" aria-label="Back to fuel records" onClick={() => setSelectedEntryId(null)}><ArrowLeft size={18} /></button>}
          <span className="fuelproof-mark"><Fuel size={21} /></span>
          <div><div className="fuelproof-eyebrow">FLEET OPERATIONS / FUEL LOG</div><h1>{pageTitle}</h1></div>
        </div>
        {!selectedEntry && <button type="button" className="fuel-primary-button" onClick={() => { setWizardOpen(true); setFeedback(""); }}><Plus size={17} /> Log fuel entry</button>}
      </header>

      {storageError && <div className="fuel-inline-error" role="alert">{storageError}<button type="button" aria-label="Dismiss error" onClick={() => setStorageError("")}><X size={15} /></button></div>}

      {selectedEntry ? <section className="fuel-detail-view">
        <div className="fuel-detail-top"><div><div className="fuelproof-eyebrow">{formatDate(selectedEntry.createdAt)}</div><h2>{selectedEntry.vehicleNumber}</h2><p>{selectedEntry.driver} <span>/</span> {selectedEntry.station}</p></div><StatusPill status={selectedEntry.status} /></div>
        <div className="fuel-detail-layout">
          <div className="fuel-evidence-column">
            <figure className="fuel-evidence-frame"><figcaption><ImagePlus size={15} /> PURCHASE BILL</figcaption><StoredMedia blob={selectedEntry.billPhoto} className="fuel-bill-full" /></figure>
            <figure className="fuel-evidence-frame"><figcaption><Video size={15} /> FILLING VIDEO</figcaption><StoredMedia blob={selectedEntry.fillingVideo} video className="fuel-video-full" /></figure>
          </div>
          <div className="fuel-detail-facts">
            <div className="fuel-facts-heading"><FileCheck2 size={18} /><h3>Entry details</h3></div>
            <div className="fuel-facts-grid"><span>Fuel quantity<strong>{selectedEntry.litres.toFixed(2)} L</strong></span><span>Rate per litre<strong>{formatMoney(selectedEntry.rate)}</strong></span><span>Total spend<strong>{formatMoney(selectedEntry.total)}</strong></span><span>Odometer<strong>{selectedEntry.odometer.toLocaleString("en-IN")} km</strong></span></div>
            {selectedEntry.notes && <div className="fuel-notes"><small>DRIVER NOTES</small><p>{selectedEntry.notes}</p></div>}
            {selectedEntry.status === "pending" && <div className="fuel-review-actions"><button type="button" className="fuel-reject-button" onClick={() => void changeStatus(selectedEntry, "rejected")}><X size={16} /> Reject entry</button><button type="button" className="fuel-approve-button" onClick={() => void changeStatus(selectedEntry, "approved")}><Check size={17} /> Approve</button></div>}
          </div>
        </div>
      </section> : <>
        <div className="fuelproof-tabs" role="tablist" aria-label="Fuel views">
          <button type="button" role="tab" aria-selected={tab === "dashboard"} className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>Overview</button>
          <button type="button" role="tab" aria-selected={tab === "records"} className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>Records <span>{entries.length}</span></button>
        </div>
        {tab === "dashboard" ? <>
          <div className="fuelproof-intro"><div><span className="fuelproof-eyebrow">TODAY / {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}</span><h2>Fuel, accounted for.</h2></div><div className="fuelproof-live"><i /> DEVICE STORAGE ACTIVE</div></div>
          <div className="fuel-metrics-grid">
            <article className="fuel-metric"><div className="fuel-metric-label"><Fuel size={16} /> FILL-UPS TODAY</div><strong>{todayEntries.length.toString().padStart(2, "0")}</strong><span>fuel entries</span></article>
            <article className="fuel-metric"><div className="fuel-metric-label"><Gauge size={16} /> LITRES LOGGED</div><strong>{litresToday.toLocaleString("en-IN", { maximumFractionDigits: 1 })}<small>L</small></strong><span>total volume today</span></article>
            <article className="fuel-metric"><div className="fuel-metric-label"><CircleDollarSign size={16} /> TODAY'S SPEND</div><strong className="fuel-spend-value">{formatMoney(spendToday)}</strong><span>across all entries</span></article>
            <article className="fuel-metric fuel-metric-pending"><div className="fuel-metric-label"><Clock3 size={16} /> AWAITING REVIEW</div><strong>{pendingCount.toString().padStart(2, "0")}</strong><span>needs your decision</span></article>
          </div>
          <div className="fuel-section-heading"><div><span className="fuelproof-eyebrow">LATEST ACTIVITY</span><h3>Recent fuel entries</h3></div><button type="button" className="fuel-text-button" onClick={() => setTab("records")}>View all records <ArrowLeft size={14} /></button></div>
          <FuelEntryList entries={entries.slice(0, 4)} loading={loading} onOpen={(entry) => setSelectedEntryId(entry.id)} />
        </> : <>
          <div className="fuel-records-heading"><div><span className="fuelproof-eyebrow">FUEL PROOF ARCHIVE</span><h2>All records</h2></div><div className="fuel-record-controls">
            <label className="fuel-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, driver, station" /></label>
            <label className="fuel-filter"><ListFilter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | FuelStatus)} aria-label="Filter records by status"><option value="all">All status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
          </div></div>
          <FuelEntryList entries={filteredEntries} loading={loading} onOpen={(entry) => setSelectedEntryId(entry.id)} />
        </>}
      </>}
    </section>

    {wizardOpen && <div className="fuel-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWizard(); }}>
      <section className="fuel-wizard" role="dialog" aria-modal="true" aria-labelledby="fuel-wizard-title">
        <header className="fuel-wizard-header"><div><span className="fuelproof-eyebrow">NEW FUEL ENTRY</span><h2 id="fuel-wizard-title">Proof of fill</h2></div><button type="button" className="fuel-icon-button" aria-label="Close fuel entry" onClick={closeWizard}><X size={19} /></button></header>
        <div className="fuel-stepper" aria-label={`Step ${step} of 3`}>
          {["Bill photo", "Filling video", "Details"].map((label, index) => <div className={`fuel-step ${step === index + 1 ? "current" : step > index + 1 ? "complete" : ""}`} key={label}><span>{step > index + 1 ? <Check size={13} /> : `0${index + 1}`}</span><small>{label}</small>{index < 2 && <i />}</div>)}
        </div>
        {step === 1 && <div className="fuel-wizard-body">
          <div className="fuel-camera-guide"><div className="fuel-corner top-left" /><div className="fuel-corner top-right" /><div className="fuel-corner bottom-left" /><div className="fuel-corner bottom-right" />{billPhoto ? <StoredMedia blob={billPhoto} className="fuel-photo-preview" /> : <div className="fuel-capture-placeholder"><Camera size={35} /><strong>Frame the complete bill</strong><span>Keep the date, litres and total visible</span></div>}</div>
          <div className="fuel-capture-actions"><button type="button" className="fuel-secondary-button" onClick={() => photoInputRef.current?.click()}><Camera size={16} /> Take photo</button><button type="button" className="fuel-secondary-button" onClick={() => document.getElementById("fuel-photo-library")?.click()}><ImagePlus size={16} /> Photo library</button></div>
          <input ref={photoInputRef} className="fuel-hidden-input" type="file" accept="image/*" capture="environment" onChange={(event) => setBillPhoto(event.target.files?.[0] ?? null)} />
          <input id="fuel-photo-library" className="fuel-hidden-input" type="file" accept="image/*" onChange={(event) => setBillPhoto(event.target.files?.[0] ?? null)} />
          {billPhoto && <p className="fuel-file-ready"><ShieldCheck size={15} /> Bill photo attached <button type="button" onClick={() => setBillPhoto(null)}>Replace</button></p>}
          <div className="fuel-wizard-footer"><span>01 / 03</span><button type="button" className="fuel-primary-button" disabled={!billPhoto} onClick={() => setStep(2)}>Continue <ArrowLeft size={15} /></button></div>
        </div>}
        {step === 2 && <div className="fuel-wizard-body">
          <div className={`fuel-video-stage ${recording ? "is-recording" : ""}`}>
            {fillingVideo ? <StoredMedia blob={fillingVideo} video className="fuel-video-preview" /> : <><video ref={cameraRef} className={`fuel-camera-live ${recording ? "visible" : ""}`} muted playsInline /><div className="fuel-video-placeholder"><Video size={33} /><strong>{recording ? "Filling proof in progress" : "Record the diesel filling"}</strong><span>Show the nozzle and vehicle during refuelling</span></div>{recording && <div className="fuel-recording-badge"><i /> REC <b>{String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}</b></div>}</>}
          </div>
          {cameraError && <p className="fuel-camera-error" role="alert">{cameraError}</p>}
          <div className="fuel-recording-actions">{!recording && !fillingVideo && <button type="button" className="fuel-record-button" onClick={() => void startRecording()}><span><Mic size={16} /></span> Start recording</button>}{recording && <button type="button" className="fuel-record-button stop" onClick={stopRecording}><span /> Stop recording</button>}{fillingVideo && <><p className="fuel-file-ready"><CheckCircle2 size={15} /> Video ready to review</p><button type="button" className="fuel-secondary-button" onClick={() => { setFillingVideo(null); setRecordingSeconds(0); }}>Record again</button></>}</div>
          <div className="fuel-wizard-footer"><button type="button" className="fuel-back-step" onClick={() => setStep(1)}>Back</button><button type="button" className="fuel-primary-button" disabled={!fillingVideo || recording} onClick={() => setStep(3)}>Continue <ArrowLeft size={15} /></button></div>
        </div>}
        {step === 3 && <form className="fuel-wizard-body fuel-details-form" onSubmit={(event) => void submitEntry(event)}>
          <div className="fuel-form-grid"><label>Driver name<input required value={values.driver} onChange={(event) => setValues({ ...values, driver: event.target.value })} placeholder="Driver's name" /></label><label>Vehicle number<input required value={values.vehicleNumber} onChange={(event) => setValues({ ...values, vehicleNumber: event.target.value.toUpperCase() })} placeholder="e.g. AP 31 AB 1234" /></label><label className="wide">Fuel station<input required value={values.station} onChange={(event) => setValues({ ...values, station: event.target.value })} placeholder="Station name or location" /></label><label>Litres<input required type="number" min="0.01" step="0.01" value={values.litres} onChange={(event) => setValues({ ...values, litres: event.target.value })} placeholder="0.00" /></label><label>Rate / litre<input required type="number" min="0.01" step="0.01" value={values.rate} onChange={(event) => setValues({ ...values, rate: event.target.value })} placeholder="0.00" /></label><label>Odometer (km)<input required type="number" min="0" step="1" value={values.odometer} onChange={(event) => setValues({ ...values, odometer: event.target.value })} placeholder="0" /></label><label className="wide">Notes <span>OPTIONAL</span><textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} placeholder="Anything the reviewer should know" rows={2} /></label></div>
          <div className="fuel-total-preview"><span><CircleDollarSign size={16} /> CALCULATED TOTAL</span><strong>{formatMoney(calculatedTotal)}</strong></div>
          {feedback && <p className="fuel-camera-error">{feedback}</p>}
          <div className="fuel-wizard-footer"><button type="button" className="fuel-back-step" onClick={() => setStep(2)}>Back</button><button type="submit" className="fuel-primary-button" disabled={saving}>{saving ? "Saving proof..." : <><Check size={16} /> Submit fuel proof</>}</button></div>
        </form>}
      </section>
    </div>}
  </FleetLayout>;
}

function FuelEntryList({ entries, loading, onOpen }: { entries: FuelEntry[]; loading: boolean; onOpen: (entry: FuelEntry) => void }) {
  if (loading) return <div className="fuel-empty-state"><span className="fuel-loading-dot" />Loading local fuel records</div>;
  if (!entries.length) return <div className="fuel-empty-state"><Fuel size={25} /><strong>No fuel entries yet</strong><span>Submitted fill-ups and their proof will appear here.</span></div>;
  return <div className="fuel-entry-list">{entries.map((entry) => <button type="button" className="fuel-entry-row" key={entry.id} onClick={() => onOpen(entry)}>
    <StoredMedia blob={entry.billPhoto} className="fuel-entry-thumb" />
    <span className="fuel-entry-primary"><strong>{entry.vehicleNumber}</strong><small>{entry.driver} <i>/</i> {entry.station}</small></span>
    <span className="fuel-entry-volume"><strong>{entry.litres.toFixed(2)} L</strong><small>{formatDate(entry.createdAt)}</small></span>
    <span className="fuel-entry-cost"><strong>{formatMoney(entry.total)}</strong><small>{entry.odometer.toLocaleString("en-IN")} km</small></span>
    <StatusPill status={entry.status} /><Play className="fuel-entry-open" size={15} />
  </button>)}</div>;
}