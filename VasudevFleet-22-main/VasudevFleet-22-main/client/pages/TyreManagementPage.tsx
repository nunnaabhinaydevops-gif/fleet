import { useState, type FormEvent } from "react";
import { CalendarDays, ChevronDown, ChevronUp, CircleGauge, Download, GripVertical, Pencil, Plus, Search, Settings, Truck, Upload, X } from "lucide-react";
import { FleetLayout } from "./Index";

type TyreRecord = {
  id: string;
  brand: string;
  size: string;
  vehicle: string;
  tag: string;
  attachDate: string;
  detachDate: string;
  purchaseAmount: string;
  condition: string;
};

type DetailedTyreRecord = {
  tyre: string;
  vendor: string;
  vehicle: string;
  position: string;
  attachDate: string;
  detachDate: string;
  purchaseDate: string;
  kmRun: string;
  manualKm: string;
  kmLimit: string;
  currentPrice: string;
  running: string;
  projectedCost: string;
  actualCost: string;
  profitLoss: string;
  startTread: string;
  currentTread: string;
  psi: string;
  life: string;
  state: string;
  lastUpdate: string;
  billNo: string;
  odometer: string;
};

type TyreFormValues = {
  brand: string;
  model: string;
  type: string;
  manufacturingDate: string;
  tyreNumber: string;
  billNumber: string;
  purchaseOrder: string;
  price: string;
  currentPrice: string;
  openingKm: string;
  kmLimit: string;
  purchaseDate: string;
  plyRating: string;
  psi: string;
  treadDepth: string;
  tyreSize: string;
  vendor: string;
  store: string;
  tags: string;
};

const emptyTyreForm: TyreFormValues = {
  brand: "Apollo", model: "", type: "Radial", manufacturingDate: "", tyreNumber: "", billNumber: "", purchaseOrder: "", price: "", currentPrice: "", openingKm: "", kmLimit: "", purchaseDate: "", plyRating: "", psi: "", treadDepth: "", tyreSize: "", vendor: "", store: "", tags: "",
};

const tyreRecords: TyreRecord[] = [
  { id: "Apollo", brand: "Apollo", size: "295/80 R22.5", vehicle: "AP05TM3111", tag: "TYR-0001", attachDate: "28 Mar 26, 12:42", detachDate: "09 Jul 25, 12:26", purchaseAmount: "₹ 82,976", condition: "Good" },
  { id: "Michelin", brand: "Michelin", size: "295/80 R22.5", vehicle: "AP16TE5345", tag: "TYR-0002", attachDate: "22 Mar 26, 10:15", detachDate: "14 Jun 25, 09:40", purchaseAmount: "₹ 96,450", condition: "Good" },
  { id: "Bridgestone", brand: "Bridgestone", size: "11.00 R20", vehicle: "AP39T3377", tag: "TYR-0003", attachDate: "17 Mar 26, 16:30", detachDate: "03 May 25, 11:18", purchaseAmount: "₹ 74,800", condition: "Retreaded" },
  { id: "JK Tyre", brand: "JK Tyre", size: "295/80 R22.5", vehicle: "AP31TG7821", tag: "TYR-0004", attachDate: "09 Mar 26, 14:05", detachDate: "20 Jan 25, 15:22", purchaseAmount: "₹ 68,300", condition: "Good" },
  { id: "Goodyear", brand: "Goodyear", size: "10.00 R20", vehicle: "AP05TX4218", tag: "TYR-0005", attachDate: "02 Mar 26, 09:48", detachDate: "18 Dec 24, 10:05", purchaseAmount: "₹ 71,900", condition: "Needs review" },
];

const detailedTyreRecords: DetailedTyreRecord[] = [
  { tyre: "apollo g271", vendor: "Apollo", vehicle: "AP05TM3111", position: "Stepney Tyre First", attachDate: "28 Mar 26, 12:43 PM", detachDate: "09 Jul 25, 12:26 PM", purchaseDate: "27 May 23, 12:00 AM", kmRun: "83087.76 km", manualKm: "-", kmLimit: "60000 km", currentPrice: "₹ 23,300", running: "138%", projectedCost: "₹ 0.39", actualCost: "₹ 0.28", profitLoss: "+₹9,104.21", startTread: "", currentTread: "", psi: "", life: "", state: "NEW", lastUpdate: "28 Mar 26, 12:43 PM", billNo: "-", odometer: "" },
  { tyre: "mrf3018132", vendor: "MRF", vehicle: "NL01AH8877", position: "Left Rear Fourth Outer", attachDate: "13 Apr 26, 07:06 PM", detachDate: "13 Apr 26, 07:04 PM", purchaseDate: "27 Sep 23, 08:00 AM", kmRun: "101118.62 km", manualKm: "-", kmLimit: "80000 km", currentPrice: "₹ 19,150", running: "126%", projectedCost: "₹ 0.24", actualCost: "₹ 0.19", profitLoss: "+₹5,118.51", startTread: "", currentTread: "", psi: "", life: "", state: "NEW", lastUpdate: "13 Apr 26, 07:06 PM", billNo: "-", odometer: "" },
  { tyre: "mrf3026244", vendor: "MRF", vehicle: "AP39T3377", position: "Right Rear Third Outer", attachDate: "03 Sep 25, 11:48 AM", detachDate: "27 Mar 25, 12:16 PM", purchaseDate: "12 Sep 23, 06:21 PM", kmRun: "80479.03 km", manualKm: "40393 km", kmLimit: "80000 km", currentPrice: "₹ 19,150", running: "101%", projectedCost: "₹ 0.24", actualCost: "₹ 0.24", profitLoss: "+₹1,651", startTread: "", currentTread: "", psi: "", life: "", state: "NEW", lastUpdate: "03 Sep 25, 11:48 AM", billNo: "Attach:21636 Detach:24418", odometer: "" },
  { tyre: "apollo t0246454", vendor: "Apollo", vehicle: "AP39T3377", position: "Store: SECOND HAND VEHICLE", attachDate: "26 Aug 25, 07:03 PM", detachDate: "27 Jun 26, 12:28 PM", purchaseDate: "22 Sep 23, 05:40 PM", kmRun: "16627.17 km", manualKm: "-", kmLimit: "80000 km", currentPrice: "₹ 18,000", running: "21%", projectedCost: "₹ 0.23", actualCost: "₹ 1.08", profitLoss: "-₹14,175.81", startTread: "", currentTread: "", psi: "", life: "", state: "NEW", lastUpdate: "27 Jun 26, 12:28 PM", billNo: "76", odometer: "" },
  { tyre: "mrf3039167", vendor: "MRF", vehicle: "NL01AH9838", position: "Right Rear Fourth Outer", attachDate: "05 Apr 26, 01:05 PM", detachDate: "11 May 26, 04:39 PM", purchaseDate: "14 Nov 23, 12:00 AM", kmRun: "93894.53 km", manualKm: "-", kmLimit: "70000 km", currentPrice: "₹ 40,500", running: "134%", projectedCost: "₹ 0.58", actualCost: "₹ 0.43", profitLoss: "+₹13,958.81", startTread: "", currentTread: "", psi: "", life: "", state: "NEW", lastUpdate: "05 Apr 26, 01:05 PM", billNo: "-", odometer: "" },
  { tyre: "mrf3040821", vendor: "MRF", vehicle: "AP16TE5345", position: "Left Rear Second Inner", attachDate: "03 Jul 26, 10:53 AM", detachDate: "03 Jul 26, 10:53 AM", purchaseDate: "04 Jan 24, 12:00 AM", kmRun: "84576.64 km", manualKm: "-", kmLimit: "90000 km", currentPrice: "₹ 49,500", running: "94%", projectedCost: "₹ 0.55", actualCost: "₹ 0.59", profitLoss: "-₹2,982.81", startTread: "", currentTread: "", psi: "", life: "", state: "NEW", lastUpdate: "03 Jul 26, 10:53 AM", billNo: "-", odometer: "" },
];

const summaryMetrics = [
  ["675", "Total tyres", ""],
  ["310", "New attached tyres", "info"],
  ["206", "Old attached tyres", "info"],
  ["8", "New unattached tyres", "info"],
  ["151", "Old unattached tyres", ""],
  ["188", "0 to 25%", ""],
  ["128", "25 to 50%", ""],
  ["153", "50 to 75%", ""],
  ["85", "75 to 100%", ""],
  ["121", "More than 100%", ""],
  ["121", "Total profit tyres", "profit"],
  ["554", "Total loss tyres", "loss"],
] as const;

const brandMetrics = [
  ["283", "Apollo"],
  ["252", "Mrf"],
  ["81", "Jk"],
  ["33", "Ceat"],
  ["21", "Kaizen"],
  ["4", "Bridgestone"],
  ["1", "Bravia"],
] as const;

const sizeMetrics = [
  ["262", "10r20"],
  ["211", "Size not set"],
  ["34", "295r20"],
  ["30", "10.20"],
  ["25", "10.00-20"],
  ["19", "295/90"],
  ["10", "11.20"],
  ["4", "295/d20"],
  ["4", "11 r 20"],
  ["4", "295/20"],
  ["3", "295/95d20"],
  ["3", "295r"],
] as const;

const amountMetrics = [
  ["₹ 1,16,87,340", "Total amount of attached tyres"],
  ["₹ 44,71,276", "Total amount of idle tyres"],
  ["₹ 0", "Total amount of in repair tyres"],
  ["₹ 1,48,500", "Total amount of new tyres"],
] as const;

const tyreColumns = [
  "Tyre Name", "Vendor", "Store", "Vehicle Assign", "Tyre Tag", "Tyre Attach Date", "Tyre Detach Date", "Tyre Purchase Date", "Opening Km", "Km Run", "Manual Km Run", "KM Limit", "Current Price", "Running %", "Projected Cost / Km", "Actual Cost / Km", "Profit/Loss", "Start Tread Depth", "Current Tread Depth", "PSI", "RFID Tag", "Life", "Tyre State", "Odometer Reading", "Last State Update", "Bill No.",
] as const;

function InfoMark() {
  return <span className="tyre-info-mark" aria-label="More information">i</span>;
}

function TyreFormModal({ values, editing, onChange, onClose, onSubmit }: { values: TyreFormValues; editing: boolean; onChange: (field: keyof TyreFormValues, value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const field = (label: string, name: keyof TyreFormValues, required = false, type = "text") => (
    <label className="tyre-form-field"><span>{label}{required && <b>*</b>}</span><input type={type} value={values[name]} onChange={(event) => onChange(name, event.target.value)} required={required} /></label>
  );
  return (
    <div className="tyre-form-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="tyre-form-modal" onSubmit={onSubmit}>
        <header className="tyre-form-header"><div><span>{editing ? "EDIT DETAILS" : "ADD TYRE"}</span><h2>{editing ? "Edit Tyre Details" : "Add Tyre"}</h2></div><button type="button" className="tyre-form-close" onClick={onClose} aria-label="Close tyre form"><X size={19} /></button></header>
        <div className="tyre-form-body">
          <section className="tyre-form-section"><h3>Tyre details</h3><div className="tyre-form-grid">
            {field("Brand", "brand", true)}{field("Model", "model", true)}
            <label className="tyre-form-field"><span>Type</span><select value={values.type} onChange={(event) => onChange("type", event.target.value)}><option>Radial</option><option>Bias</option><option>Solid</option></select></label>
            {field("Manufacturing Date", "manufacturingDate", false, "date")}{field("Tyre Number", "tyreNumber", true)}{field("Bill Number", "billNumber")}{field("Purchase Order [P.O.]", "purchaseOrder")}{field("Price", "price", true, "number")}{field("Current Price", "currentPrice", true, "number")}{field("Opening km", "openingKm", false, "number")}{field("Km Limit", "kmLimit", true, "number")}{field("Purchase Date", "purchaseDate", false, "date")}{field("Ply Rating", "plyRating", false, "number")}{field("PSI", "psi", false, "number")}{field("Tread Depth (mm)", "treadDepth", false, "number")}{field("Tyre Size", "tyreSize")}
          </div></section>
          <section className="tyre-form-section"><h3>Inventory assignment</h3><div className="tyre-form-grid">
            <label className="tyre-form-field"><span>Vendor</span><select value={values.vendor} onChange={(event) => onChange("vendor", event.target.value)}><option value="">Select...</option><option>Apollo</option><option>MRF</option><option>Bridgestone</option><option>JK Tyre</option><option>Goodyear</option></select><a href="https://app.fleetx.io/dashboard/settings/vendors/add" target="_blank" rel="noreferrer">Can&apos;t Find Vendor? Create Here!</a></label>
            <label className="tyre-form-field"><span>Store</span><select value={values.store} onChange={(event) => onChange("store", event.target.value)}><option value="">Select...</option><option>Main Store</option><option>Second Hand Vehicle</option><option>Scrap Store</option></select><a href="https://app.fleetx.io/dashboard/settings/stores/add" target="_blank" rel="noreferrer">Can&apos;t Find Store? Create Here!</a></label>
            <label className="tyre-form-field"><span>Tags</span><select value={values.tags} onChange={(event) => onChange("tags", event.target.value)}><option value="">Select...</option><option>New</option><option>Retreaded</option><option>Second Hand</option></select></label>
            <label className="tyre-form-field"><span>Upload Documents</span><input type="file" multiple /></label>
          </div></section>
        </div>
        <footer className="tyre-form-footer"><button type="button" className="tyre-form-cancel" onClick={onClose}>Cancel</button><button type="submit" className="tyre-form-save">{editing ? "Save Changes" : "Add Tyre"}</button></footer>
      </form>
    </div>
  );
}

function TreadDepthModal({ value, date, onChange, onDateChange, onClose, onSubmit }: { value: string; date: string; onChange: (value: string) => void; onDateChange: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="tread-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="tread-modal" onSubmit={onSubmit}>
        <header className="tread-modal-header"><h2>Change Tread Depth</h2><button type="button" onClick={onClose} aria-label="Close tread depth dialog"><X size={17} /></button></header>
        <div className="tread-modal-body">
          <label className="tread-modal-field"><span>Add Tread Depth (mm) <b>*</b></span><input type="number" min="0" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} required /></label>
          <label className="tread-modal-field"><span>Measurement Date</span><span className="tread-date-input"><CalendarDays size={16} /><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /><button type="button" onClick={() => onDateChange("")} aria-label="Clear measurement date"><X size={14} /></button><ChevronDown size={15} /></span></label>
        </div>
        <footer className="tread-modal-footer"><button type="submit" className="tread-submit">Submit</button><button type="button" className="tread-cancel" onClick={onClose}>Cancel</button></footer>
      </form>
    </div>
  );
}

function CustomiseColumnsModal({ columns, selected, onToggle, onMove, onApply, onClose }: { columns: string[]; selected: string[]; onToggle: (column: string) => void; onMove: (from: number, to: number) => void; onApply: () => void; onClose: () => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  return (
    <div className="columns-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="columns-modal" role="dialog" aria-modal="true" aria-labelledby="columns-modal-title">
        <header className="columns-modal-header"><h2 id="columns-modal-title">Customise columns</h2><button type="button" onClick={onClose} aria-label="Close customise columns"><X size={20} /></button></header>
        <div className="columns-modal-body">
          <strong className="columns-selected-count">{selected.length} columns selected</strong>
          <p>Drag to change the order in which the columns will appear in your view. This customised view will only be applied to your account</p>
          <div className="columns-modal-headings"><div><strong>Selected columns</strong><span>below columns are draggable</span></div><strong>Non - Selected Columns</strong></div>
          <div className="columns-modal-lists"><div className="columns-selected-list">
            {columns.filter((column) => selected.includes(column)).map((column) => { const index = columns.indexOf(column); return <div className="column-option" key={column} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index); setDragIndex(null); }}><input type="checkbox" checked readOnly onChange={() => onToggle(column)} /><span>{column}</span><GripVertical size={18} /></div>; })}
          </div><div className="columns-unselected-list">{columns.filter((column) => !selected.includes(column)).length ? columns.filter((column) => !selected.includes(column)).map((column) => <label className="column-option" key={column}><input type="checkbox" checked={false} onChange={() => onToggle(column)} /><span>{column}</span></label>) : <span className="columns-all-selected">All columns are selected</span>}</div></div>
        </div>
        <footer className="columns-modal-footer"><button type="button" className="columns-apply" onClick={onApply}>Apply</button><button type="button" className="columns-close" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}

function InwardTyreModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const input = (label: string, required = false, type = "text") => <label className="inward-field"><span>{label}{required && <b>*</b>}</span><input type={type} required={required} /></label>;
  const select = (label: string, value = "Select...", required = false) => <label className="inward-field"><span>{label}{required && <b>*</b>}</span><select defaultValue={value} required={required}><option value="Select...">Select...</option><option>Tyre Entry</option><option>Main Store</option><option>Apollo</option><option>Radial</option></select></label>;
  return (
    <div className="inward-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="inward-modal" onSubmit={onSubmit}>
        <div className="inward-modal-scroll">
          <header className="inward-heading"><h2>Inward Tyre</h2><button type="button" onClick={onClose} aria-label="Close inward tyre form"><X size={20} /></button></header>
          <section className="inward-section"><div className="inward-header-grid">
            {select("Branch")}{select("Book Type", "Tyre Entry")}{input("Client PO Number")}{select("Nature", "Tyre MRN", true)}{input("MRN Date", true, "datetime-local")}{select("Store", "Select...", true)}{input("Purchase Date", true, "date")}{input("Bill Number")}{input("PO Date", true, "date")}{select("Vendor", "Select...", true)}{select("Purchase Order")}
          </div></section>
          <section className="inward-tyre-card"><div className="inward-tyre-card-heading"><strong>⌃ Tyre #1</strong><button type="button" aria-label="Remove tyre"><X size={17} /></button></div><div className="inward-tyre-grid">
            {input("Tyre Number", true)}{select("Type", "Select...", true)}{input("Manufacturing Date", true, "date")}{select("Brand", "Select...", true)}{input("Model", true)}{input("Price", true, "number")}{input("Discount", false, "number")}{input("KM Limit", true, "number")}{input("Opening KM", false, "number")}{input("Ply Rating", false, "number")}{input("Tread Depth", false, "number")}{input("Tyre Size")}{input("Remarks")}{input("PSI", false, "number")}{select("Tags")}
          </div></section>
          <section className="inward-upload-section"><h3>Upload Documents</h3><label className="inward-upload-label"><Upload size={18} /> Attach Documents<input type="file" multiple /></label></section>
          <button className="inward-add-more" type="button"><Plus size={18} /> Add More Tyres</button>
        </div>
        <footer className="inward-footer"><button type="button" className="inward-cancel" onClick={onClose}>Cancel</button><button type="submit" className="inward-submit">Submit</button></footer>
      </form>
    </div>
  );
}

export default function TyreManagementPage({ onSignOut }: { onSignOut: () => void }) {
  const [view, setView] = useState("Inventory");
  const [summaryTab, setSummaryTab] = useState("Summary");
  const [vehicle, setVehicle] = useState("Select Vehicle");
  const [period, setPeriod] = useState("This Month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [inwardOpen, setInwardOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([...tyreColumns]);
  const [draftColumns, setDraftColumns] = useState<string[]>([...tyreColumns]);
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [detailRows, setDetailRows] = useState(detailedTyreRecords);
  const [formOpen, setFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<TyreFormValues>(emptyTyreForm);
  const [treadRecordKey, setTreadRecordKey] = useState<string | null>(null);
  const [treadDepth, setTreadDepth] = useState("");
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const visibleRecords = tyreRecords.filter((record) => {
    const query = search.trim().toLowerCase();
    return !query || Object.values(record).some((value) => value.toLowerCase().includes(query));
  });
  const getRecordKey = (record: DetailedTyreRecord) => `${record.tyre}-${record.vehicle}-${record.position}`;
  const openTyreForm = (record?: DetailedTyreRecord) => {
    setEditingKey(record ? getRecordKey(record) : null);
    setFormValues(record ? {
      ...emptyTyreForm,
      brand: record.vendor,
      model: record.tyre,
      tyreNumber: record.tyre,
      billNumber: record.billNo,
      currentPrice: record.currentPrice.replace(/[^0-9.]/g, ""),
      price: record.currentPrice.replace(/[^0-9.]/g, ""),
      openingKm: record.kmRun.replace(/[^0-9.]/g, ""),
      kmLimit: record.kmLimit.replace(/[^0-9.]/g, ""),
      purchaseDate: "",
      vendor: record.vendor,
      store: record.position.startsWith("Store:") ? record.position.replace("Store:", "").trim() : "",
      tags: record.state,
    } : emptyTyreForm);
    setFormOpen(true);
  };
  const handleTyreFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const existing = editingKey ? detailRows.find((record) => getRecordKey(record) === editingKey) : undefined;
    const nextRecord: DetailedTyreRecord = {
      ...(existing ?? detailedTyreRecords[0]),
      tyre: formValues.tyreNumber || formValues.model || "new-tyre",
      vendor: formValues.vendor || formValues.brand,
      position: formValues.store ? `Store: ${formValues.store}` : existing?.position ?? "Unassigned",
      currentPrice: formValues.currentPrice ? `₹ ${formValues.currentPrice}` : existing?.currentPrice ?? "-",
      kmRun: formValues.openingKm ? `${formValues.openingKm} km` : existing?.kmRun ?? "-",
      kmLimit: formValues.kmLimit ? `${formValues.kmLimit} km` : existing?.kmLimit ?? "-",
      purchaseDate: formValues.purchaseDate || existing?.purchaseDate || "-",
      billNo: formValues.billNumber || existing?.billNo || "-",
      state: formValues.tags || existing?.state || "NEW",
      lastUpdate: new Date().toLocaleString(),
    };
    setDetailRows((current) => editingKey ? current.map((record) => getRecordKey(record) === editingKey ? nextRecord : record) : [nextRecord, ...current]);
    setFormOpen(false);
  };
  const openTreadModal = (record: DetailedTyreRecord) => {
    setTreadRecordKey(getRecordKey(record));
    setTreadDepth(record.currentTread);
    setMeasurementDate(new Date().toISOString().slice(0, 10));
  };
  const handleTreadSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!treadRecordKey) return;
    setDetailRows((current) => current.map((record) => getRecordKey(record) === treadRecordKey ? { ...record, currentTread: `${treadDepth} mm`, lastUpdate: measurementDate } : record));
    setTreadRecordKey(null);
  };
  const openColumns = () => { setDraftColumns([...selectedColumns]); setColumnsOpen(true); };
  const submitInward = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setInwardOpen(false); };
  const toggleColumn = (column: string) => setDraftColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  const moveColumn = (from: number, to: number) => setDraftColumns((current) => { const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });

  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Records">
      <div className="tyre-management-page">
        <header className="tyre-page-header">
          <div className="tyre-page-title">
            <span className="tyre-page-icon"><CircleGauge size={28} strokeWidth={2.1} /></span>
            <h1>Tyre Management</h1>
          </div>
          <div className="tyre-toolbar">
            <label className="tyre-control tyre-vehicle-control">
              <Truck size={16} />
              <select value={vehicle} onChange={(event) => setVehicle(event.target.value)} aria-label="Select vehicle">
                <option>Select Vehicle</option>
                <option>AP05TM3111</option>
                <option>AP16TE5345</option>
                <option>AP39T3377</option>
              </select>
              <ChevronDown size={16} />
            </label>
            <div className="tyre-period-menu-wrap">
              <button className="tyre-control tyre-period-control" type="button" onClick={() => setPeriodOpen((open) => !open)} aria-expanded={periodOpen} aria-label="Select date range">
                <CalendarDays size={16} /><span>{period}</span><ChevronDown size={16} />
              </button>
              {periodOpen && <div className="tyre-period-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setPeriod("This Month"); setPeriodOpen(false); }}>This Month</button>
                <button type="button" role="menuitem" onClick={() => { setPeriod("Last Month"); setPeriodOpen(false); }}>Last Month</button>
                <button type="button" role="menuitem" onClick={() => { setPeriod("This Quarter"); setPeriodOpen(false); }}>This Quarter</button>
                <button type="button" role="menuitem" onClick={() => { setPeriod("This Year"); setPeriodOpen(false); }}>This Year</button>
                <label className="tyre-calendar-field"><span>Choose date</span><input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setPeriod(event.target.value || "This Month"); }} /></label>
              </div>}
            </div>
            <div className="tyre-add-menu-wrap">
              <button className="tyre-add-button" type="button" aria-label="Add tyre options" onClick={() => setAddMenuOpen((open) => !open)} aria-expanded={addMenuOpen}><Plus size={21} /></button>
              {addMenuOpen && <div className="tyre-add-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setInwardOpen(true); }}><Plus size={18} /> Tyre Inward</button>
                <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setView("Outward List"); }}><Plus size={18} /> Tyre Outward</button>
                <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); openTyreForm(); }}><Upload size={18} /> <span>Upload Tyres<br /><small>(Inward)</small></span></button>
                <button type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setSelectedMetric(null); setView("Inventory"); }}><Plus size={18} /> Tyre Checklist</button>
              </div>}
            </div>
            <div className="tyre-report-menu-wrap">
              <button className="tyre-report-button" type="button" onClick={() => setReportOpen((open) => !open)} aria-expanded={reportOpen}>
                <Download size={17} /> Reports <ChevronDown size={15} />
              </button>
              {reportOpen && (
                <div className="tyre-report-menu" role="menu">
                  <button type="button" role="menuitem">Inventory report</button>
                  <button type="button" role="menuitem">Inward report</button>
                  <button type="button" role="menuitem">Outward report</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="tyre-view-tabs" role="tablist" aria-label="Tyre records views">
          {["Inventory", "Inward List", "Outward List"].map((item) => (
            <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>
          ))}
        </div>

        <section className="tyre-content-card">
          <div className="tyre-summary-tabs" role="tablist" aria-label="Inventory breakdown">
            {["Summary", "Brand Wise", "Size Wise", "Amount"].map((item) => (
              <button key={item} type="button" role="tab" aria-selected={summaryTab === item} className={summaryTab === item ? "active" : ""} onClick={() => setSummaryTab(item)}>{item}</button>
            ))}
          </div>
          {view === "Inventory" && summaryTab === "Summary" ? (
            <div className="tyre-summary-grid">
              {summaryMetrics.map(([value, label, tone]) => (
                <button className={`tyre-summary-metric ${label === "Total tyres" ? "clickable" : ""}`} key={label} type="button" onClick={() => label === "Total tyres" && setSelectedMetric("total")}>
                  <strong className={tone}>{value}</strong>
                  <span>{label}{tone === "info" && <InfoMark />}</span>
                </button>
              ))}
            </div>
          ) : view === "Inventory" && summaryTab === "Brand Wise" ? (
            <div className="tyre-brand-summary">
              <h3>Summary</h3>
              <div className="tyre-brand-grid">
                {brandMetrics.map(([value, brand]) => <div className="tyre-brand-metric" key={brand}><strong>{value}</strong><span>{brand}</span></div>)}
              </div>
            </div>
          ) : view === "Inventory" && summaryTab === "Size Wise" ? (
            <div className="tyre-size-summary">
              <h3>Summary</h3>
              <div className={`tyre-size-grid ${showAllSizes ? "expanded" : ""}`}>
                {(showAllSizes ? sizeMetrics : sizeMetrics.slice(0, 8)).map(([value, size]) => <div className="tyre-size-metric" key={size}><strong>{value}</strong><span>{size}</span></div>)}
              </div>
              <div className="tyre-size-summary-footer">
                <button type="button" onClick={() => setShowAllSizes((open) => !open)}>{showAllSizes ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {showAllSizes ? "Show less" : "Show more"}</button>
                {showAllSizes && <button type="button" onClick={() => setShowAllSizes(false)} aria-label="Collapse size summary"><X size={15} /></button>}
              </div>
            </div>
          ) : view === "Inventory" && summaryTab === "Amount" ? (
            <div className="tyre-amount-summary">
              <h3>Amount</h3>
              <div className="tyre-amount-grid">
                {amountMetrics.map(([value, label]) => <div className="tyre-amount-metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}
              </div>
            </div>
          ) : (
            <div className="tyre-tab-placeholder"><CircleGauge size={22} /><strong>{summaryTab}</strong><span>Tyre analytics will appear here.</span></div>
          )}
        </section>

        <section className="tyre-inventory-section">
          <div className="tyre-inventory-heading">
            <h2>{selectedMetric === "total" ? "Total Tyres" : view === "Inventory" ? "Inventory" : view}</h2>
            {selectedMetric === "total" && <button className="tyre-detail-close" type="button" onClick={() => setSelectedMetric(null)}><X size={14} /> Close details</button>}
            <button className="tyre-customise-button" type="button" onClick={openColumns}><Settings size={15} /> Customise</button>
            <button className="tyre-filter-button" type="button"><Search size={14} /> Filter</button>
            <label className="tyre-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tyres" aria-label="Search tyres" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
          </div>
          <div className="tyre-table-wrap">
            {selectedMetric === "total" ? <table className="tyre-table tyre-detail-table">
              <thead><tr><th>Tyre Info</th><th>Vendor</th><th>Vehicle Assign</th><th>Tyre Position</th><th>Tyre Attach Date</th><th>Tyre Detach Date</th><th>Purchase Date</th><th>KM Run</th><th>Manual KM Run</th><th>KM Limit</th><th>Current Price</th><th>Running</th><th>Projected Cost/km</th><th>Actual Cost/km</th><th>Profit/Loss</th><th>Start Tread Depth</th><th>Current Tread Depth</th><th>PSI</th><th>Life</th><th>Tyre State</th><th>Last State Update</th><th>Bill No.</th><th>Odometer Reading</th><th>Actions</th></tr></thead>
              <tbody>{detailRows.filter((record) => Object.values(record).some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))).map((record) => <tr key={getRecordKey(record)}><td><strong>{record.tyre}</strong><small>{record.state}</small></td><td>{record.vendor}</td><td>{record.vehicle}</td><td>{record.position}</td><td>{record.attachDate}</td><td>{record.detachDate}</td><td>{record.purchaseDate}</td><td>{record.kmRun}</td><td>{record.manualKm}</td><td>{record.kmLimit}</td><td>{record.currentPrice}</td><td>{record.running}</td><td>{record.projectedCost}</td><td>{record.actualCost}</td><td><span className={`tyre-profit ${record.profitLoss.startsWith("-") ? "loss" : "profit"}`}>{record.profitLoss}</span></td><td>{record.startTread || "-"}</td><td>{record.currentTread || "-"}</td><td>{record.psi || "-"}</td><td>{record.life || "-"}</td><td><span className="tyre-condition">{record.state}</span></td><td>{record.lastUpdate}</td><td>{record.billNo}</td><td>{record.odometer || "-"}</td><td><div className="tyre-row-actions"><button className="tyre-icon-action" type="button" onClick={() => openTyreForm(record)} aria-label={`Edit ${record.tyre}`} title="Edit tyre details"><Pencil size={15} /></button><button className="tyre-icon-action tread-action" type="button" onClick={() => openTreadModal(record)} aria-label={`Change tread depth for ${record.tyre}`} title="Change tread depth"><CircleGauge size={16} /></button></div></td></tr>)}</tbody>
            </table> : <table className="tyre-table">
              <thead><tr><th>Tyre Info</th><th>Vendor</th><th>Vehicle Assign</th><th>Tyre Tag</th><th>Tyre Attach<br />Date</th><th>Tyre Detach<br />Date</th><th>Tyre Purchase<br />Amount</th><th>Condition</th></tr></thead>
              <tbody>
                {visibleRecords.map((record) => <tr key={record.tag}><td><strong>{record.id}</strong><small>{record.size}</small></td><td>{record.brand}</td><td>{record.vehicle}</td><td>{record.tag}</td><td>{record.attachDate}</td><td>{record.detachDate}</td><td>{record.purchaseAmount}</td><td><span className={`tyre-condition ${record.condition === "Needs review" ? "review" : ""}`}>{record.condition}</span></td></tr>)}
                {visibleRecords.length === 0 && <tr><td className="tyre-empty" colSpan={8}>No tyres match your search.</td></tr>}
              </tbody>
            </table>}
          </div>
        </section>
      </div>
      {formOpen && <TyreFormModal values={formValues} editing={Boolean(editingKey)} onChange={(field, value) => setFormValues((current) => ({ ...current, [field]: value }))} onClose={() => setFormOpen(false)} onSubmit={handleTyreFormSubmit} />}
      {treadRecordKey && <TreadDepthModal value={treadDepth} date={measurementDate} onChange={setTreadDepth} onDateChange={setMeasurementDate} onClose={() => setTreadRecordKey(null)} onSubmit={handleTreadSubmit} />}
      {columnsOpen && <CustomiseColumnsModal columns={[...new Set([...tyreColumns, ...draftColumns])]} selected={draftColumns} onToggle={toggleColumn} onMove={moveColumn} onApply={() => { setSelectedColumns([...draftColumns]); setColumnsOpen(false); }} onClose={() => setColumnsOpen(false)} />}
      {inwardOpen && <InwardTyreModal onClose={() => setInwardOpen(false)} onSubmit={submitInward} />}
    </FleetLayout>
  );
}
