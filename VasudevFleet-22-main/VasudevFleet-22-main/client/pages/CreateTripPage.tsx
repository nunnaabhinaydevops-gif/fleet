import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { ArrowLeft, ChevronDown, Copy, MapPinned, Plus, Share2, Trash2, UploadCloud, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";
import { toast } from "sonner";
import {
  auth,
  createJobFromTrip,
  getCurrentUserProfile,
  getTrip,
  saveTrip,
  type TripInput,
  type TripRecord,
  updateTrip,
  uploadTripDocument,
} from "@/firebase";
import { auditLogService } from "@/auditLogService";
import { FleetLayout } from "./Index";

type CreateTripPageProps = {
  onSignOut: () => void;
};

type PaymentFormValue = {
  description: string;
  amount: string;
  file?: File;
  fileUrl?: string;
};

type FormValues = {
  vehicleNumber: string;
  vehicleType: string;
  billType: string;
  trvSubtype: string;
  referenceName: string;
  assigneeName: string;
  customerCompanyName: string;
  contactPerson: string;
  contactNumber: string;
  fromLocation: string;
  toLocation: string;
  materialDimensions: string;
  weight: string;
  weightUnit: string;
  loadingRadius: string;
  unloadingRadius: string;
  financialDescription: string;
  isFreightPerKm: boolean;
  freightPerKmRate: string;
  distanceKm: string;
  freightAmount: string;
  commission: string;
  advancePaymentReceived: string;
  advancePaymentReceivedFileUrl: string;
  advancePaymentReceivedFile?: File;
  thirdPartyDescription: string;
  thirdPartyTransporterName: string;
  thirdPartyTransportationPhone: string;
  thirdPartyFreightAmount: string;
  thirdPartyBookingFreight: string;
  thirdPartyAdvancePayment: string;
  thirdPartyAdvanceFileUrl: string;
  thirdPartyAdvancePaymentFile?: File;
  otherPayments: PaymentFormValue[];
  status: string;
};

const GOOGLE_MAPS_API_KEY = "AIzaSyDksQEPg9opjwP17BWPuvCeQ_QVeCl-TRY";
let googleMapsOptionsConfigured = false;

const initialForm: FormValues = {
  vehicleNumber: "",
  vehicleType: "",
  billType: "",
  trvSubtype: "",
  referenceName: "",
  assigneeName: "",
  customerCompanyName: "",
  contactPerson: "",
  contactNumber: "",
  fromLocation: "",
  toLocation: "",
  materialDimensions: "",
  weight: "",
  weightUnit: "tons",
  loadingRadius: "1",
  unloadingRadius: "1",
  financialDescription: "",
  isFreightPerKm: false,
  freightPerKmRate: "0",
  distanceKm: "0",
  freightAmount: "0",
  commission: "0.00",
  advancePaymentReceived: "0.00",
  advancePaymentReceivedFileUrl: "",
  thirdPartyDescription: "",
  thirdPartyTransporterName: "",
  thirdPartyTransportationPhone: "",
  thirdPartyFreightAmount: "0.00",
  thirdPartyBookingFreight: "0.00",
  thirdPartyAdvancePayment: "0.00",
  thirdPartyAdvanceFileUrl: "",
  otherPayments: [{ description: "", amount: "0.00" }],
  status: "confirmed",
};

function FormField({ label, required, hint, children, className = "" }: { label: ReactNode; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return <div className={`create-form-field ${className}`}><span className="create-form-label">{label}{required && <b>*</b>}</span>{children}{hint && <small>{hint}</small>}</div>;
}

function capitalizeWords(value: string) {
  return value.toUpperCase();
}

function TextInput({ value, onChange, placeholder, type = "text", required = false, min, step, disabled = false, readOnly = false }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; min?: string; step?: string; disabled?: boolean; readOnly?: boolean }) {
  const shouldCapitalize = type === "text";
  return <input className="create-form-input" type={type} value={value} onChange={(event) => onChange(shouldCapitalize ? capitalizeWords(event.target.value) : event.target.value)} placeholder={placeholder} autoCapitalize={shouldCapitalize ? "words" : "off"} required={required} min={min} step={step} disabled={disabled} readOnly={readOnly} />;
}

function SelectInput({ value, onChange, placeholder, options, required = false, disabled = false }: { value: string; onChange: (value: string) => void; placeholder: string; options: string[]; required?: boolean; disabled?: boolean }) {
  return <span className="create-select-wrap"><select className="create-form-input create-form-select" value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled}><option value="" disabled>{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={15} /></span>;
}

function LocationInput({ value, onChange, placeholder, required = false }: { value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  const inputReference = useRef<HTMLInputElement>(null);
  const onChangeReference = useRef(onChange);
  onChangeReference.current = onChange;

  useEffect(() => {
    if (!inputReference.current) return;
    if (!googleMapsOptionsConfigured) {
      setOptions({ key: GOOGLE_MAPS_API_KEY, v: "weekly" });
      googleMapsOptionsConfigured = true;
    }
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let placeChangedListener: google.maps.MapsEventListener | null = null;
    let active = true;
    void importLibrary("places").then((placesLibrary) => {
      if (!active || !inputReference.current) return;
      autocomplete = new placesLibrary.Autocomplete(inputReference.current, { fields: ["formatted_address", "name"] });
      placeChangedListener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete?.getPlace();
        const location = place?.formatted_address || place?.name;
        if (location) onChangeReference.current(capitalizeWords(location));
      });
    });
    return () => {
      active = false;
      placeChangedListener?.remove();
    };
  }, []);

  return <input ref={inputReference} className="create-form-input" type="text" value={value} onChange={(event) => onChange(capitalizeWords(event.target.value))} placeholder={placeholder} autoCapitalize="words" required={required} />;
}

type LocationTarget = "from" | "to";

type MapCoordinates = { lat: number; lng: number };

function extractMapCoordinates(value: string): MapCoordinates | null {
  const decodedValue = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/,
    /(?:[?&](?:q|query|ll)=)(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i,
    /(^|\s)(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?=\s|$)/,
  ];
  for (const pattern of patterns) {
    const match = decodedValue.match(pattern);
    if (!match) continue;
    const values = match.slice(-2).map(Number);
    const [lat, lng] = values;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

function normalizeLocation(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameMapPoint(first: google.maps.LatLng | google.maps.LatLngLiteral | undefined, second: google.maps.LatLng | google.maps.LatLngLiteral | undefined) {
  if (!first || !second) return false;
  const firstLat = typeof first.lat === "function" ? first.lat() : first.lat;
  const firstLng = typeof first.lng === "function" ? first.lng() : first.lng;
  const secondLat = typeof second.lat === "function" ? second.lat() : second.lat;
  const secondLng = typeof second.lng === "function" ? second.lng() : second.lng;
  return Math.abs(firstLat - secondLat) < 0.000001 && Math.abs(firstLng - secondLng) < 0.000001;
}

function locationMarkerIcon(color: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path fill="${color}" stroke="#ffffff" stroke-width="3" d="M20 2C10.6 2 3 9.6 3 19c0 12.4 17 27 17 27s17-14.6 17-27C37 9.6 29.4 2 20 2z"/><circle cx="20" cy="19" r="6" fill="#ffffff"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(32, 38), anchor: new google.maps.Point(16, 38) };
}

function LocationMapPicker({ fromLocation, toLocation, loadingRadius, unloadingRadius, onRadiusChange, onConfirm, onClose }: { fromLocation: string; toLocation: string; loadingRadius: string; unloadingRadius: string; onRadiusChange: (field: "loadingRadius" | "unloadingRadius", value: string) => void; onConfirm: (fromLocation: string, toLocation: string) => void; onClose: () => void }) {
  const mapContainerReference = useRef<HTMLDivElement>(null);
  const fromInputReference = useRef<HTMLInputElement>(null);
  const toInputReference = useRef<HTMLInputElement>(null);
  const mapReference = useRef<google.maps.Map | null>(null);
  const markerReferences = useRef<Partial<Record<LocationTarget, google.maps.Marker>>>({});
  const circleReferences = useRef<Partial<Record<LocationTarget, google.maps.Circle>>>({});
  const pointReferences = useRef<Partial<Record<LocationTarget, google.maps.LatLng | google.maps.LatLngLiteral>>>({});
  const directionsServiceReference = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererReference = useRef<google.maps.DirectionsRenderer | null>(null);
  const geocoderReference = useRef<google.maps.Geocoder | null>(null);
  const [target, setTarget] = useState<LocationTarget>("from");
  const targetReference = useRef<LocationTarget>("from");
  const [fromDraft, setFromDraft] = useState(fromLocation);
  const [toDraft, setToDraft] = useState(toLocation);
  const radiusReference = useRef({ loadingRadius, unloadingRadius });
  radiusReference.current = { loadingRadius, unloadingRadius };
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [shareOpen, setShareOpen] = useState(false);
  const locationLookupTimeoutReferences = useRef<Partial<Record<LocationTarget, ReturnType<typeof setTimeout>>>>({});
  const locationLookupSequenceReference = useRef(0);
  const autocompleteListenersReference = useRef<google.maps.MapsEventListener[]>([]);

  const updateRoute = () => {
    const origin = pointReferences.current.from;
    const destination = pointReferences.current.to;
    const directionsService = directionsServiceReference.current;
    const directionsRenderer = directionsRendererReference.current;
    if (!directionsService || !directionsRenderer) return;
    if (!origin || !destination) return;
    directionsService.route({ origin, destination, travelMode: google.maps.TravelMode.DRIVING }, (response, status) => {
      if (status === "OK" && response) directionsRenderer.setDirections(response);
    });
  };

  const setMapPoint = (pointTarget: LocationTarget, position: google.maps.LatLng | google.maps.LatLngLiteral) => {
    const map = mapReference.current;
    if (!map) return;
    const marker = markerReferences.current[pointTarget] ?? new google.maps.Marker({ map });
    marker.setMap(map);
    marker.setPosition(position);
    marker.setTitle(pointTarget === "from" ? "Loading location" : "Unloading location");
    marker.setIcon(locationMarkerIcon(pointTarget === "from" ? "#168452" : "#c68512"));
    markerReferences.current[pointTarget] = marker;
    const radius = Number(pointTarget === "from" ? radiusReference.current.loadingRadius : radiusReference.current.unloadingRadius) || 0;
    const circle = circleReferences.current[pointTarget] ?? new google.maps.Circle({ map });
    circle.setOptions({
      map,
      center: position,
      radius: radius * 1000,
      fillColor: pointTarget === "from" ? "#20a56b" : "#e6a62b",
      fillOpacity: 0.18,
      strokeColor: pointTarget === "from" ? "#168452" : "#c68512",
      strokeOpacity: 0.9,
      strokeWeight: 2,
    });
    circleReferences.current[pointTarget] = circle;
    pointReferences.current[pointTarget] = position;
    updateRoute();
  };

  const updateRadius = (field: "loadingRadius" | "unloadingRadius", value: string) => {
    onRadiusChange(field, value);
    const pointTarget = field === "loadingRadius" ? "from" : "to";
    const circle = circleReferences.current[pointTarget];
    if (circle) circle.setRadius((Number(value) || 0) * 1000);
  };

  useEffect(() => {
    if (!mapContainerReference.current) return;
    if (!googleMapsOptionsConfigured) {
      setOptions({ key: GOOGLE_MAPS_API_KEY, v: "weekly" });
      googleMapsOptionsConfigured = true;
    }
    let active = true;
    void Promise.all([importLibrary("maps"), importLibrary("geocoding"), importLibrary("routes"), importLibrary("places")]).then(([mapsLibrary, geocodingLibrary, _routesLibrary, placesLibrary]) => {
      if (!active || !mapContainerReference.current) return;
      const map = new (mapsLibrary as google.maps.MapsLibrary).Map(mapContainerReference.current, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      });
      const marker = new google.maps.Marker({ map });
      mapReference.current = map;
      markerReferences.current.from = marker;
      geocoderReference.current = new (geocodingLibrary as google.maps.GeocodingLibrary).Geocoder();
      directionsServiceReference.current = new google.maps.DirectionsService();
      directionsRendererReference.current = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        draggable: true,
        polylineOptions: { strokeColor: "#267da2", strokeOpacity: 0.9, strokeWeight: 5 },
      });
      autocompleteListenersReference.current = [];
      ([{ target: "from" as const, input: fromInputReference.current }, { target: "to" as const, input: toInputReference.current }]).forEach(({ target: pointTarget, input }) => {
        if (!input) return;
        const autocomplete = new (placesLibrary as google.maps.PlacesLibrary).Autocomplete(input, { fields: ["formatted_address", "geometry", "name"] });
        autocompleteListenersReference.current.push(autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.formatted_address || place.name;
          const position = place.geometry?.location;
          if (!location) return;
          if (pointTarget === "from") setFromDraft(capitalizeWords(location));
          else setToDraft(capitalizeWords(location));
          if (position && mapReference.current) {
            mapReference.current.panTo(position);
            mapReference.current.setZoom(15);
            setMapPoint(pointTarget, position);
          }
        }));
      });
      ([{ target: "from" as const, location: fromLocation }, { target: "to" as const, location: toLocation }]).forEach(({ target: pointTarget, location }) => {
        if (!location) return;
        void geocoderReference.current?.geocode({ address: location }).then(({ results }) => {
          const position = results[0]?.geometry.location;
          if (position) setMapPoint(pointTarget, position);
        });
      });
      map.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng || !geocoderReference.current) return;
        const pointTarget = targetReference.current;
        setMapPoint(pointTarget, event.latLng);
        void geocoderReference.current.geocode({ location: event.latLng }).then(({ results }) => {
          const location = results[0]?.formatted_address || `${event.latLng?.lat().toFixed(6)}, ${event.latLng?.lng().toFixed(6)}`;
          if (pointTarget === "from") setFromDraft(capitalizeWords(location));
          else setToDraft(capitalizeWords(location));
        });
      });
      setMapStatus("ready");
    }).catch(() => {
      if (active) setMapStatus("error");
    });
    return () => {
      active = false;
      autocompleteListenersReference.current.forEach((listener) => listener.remove());
      autocompleteListenersReference.current = [];
      mapReference.current = null;
      Object.values(markerReferences.current).forEach((marker) => marker?.setMap(null));
      Object.values(circleReferences.current).forEach((circle) => circle?.setMap(null));
      directionsRendererReference.current?.setMap(null);
      markerReferences.current = {};
      circleReferences.current = {};
      pointReferences.current = {};
      directionsServiceReference.current = null;
      directionsRendererReference.current = null;
      geocoderReference.current = null;
      Object.values(locationLookupTimeoutReferences.current).forEach((timeout) => clearTimeout(timeout));
      locationLookupTimeoutReferences.current = {};
    };
  }, []);

  const loadLocationValue = async (value: string, pointTarget: LocationTarget, sequence: number) => {
    if (!geocoderReference.current) return;
    const geocodeValue = value.trim();
    try {
      new URL(geocodeValue);
      if (value.includes("http")) return;
    } catch {
      if (sequence !== locationLookupSequenceReference.current) return;
    }
    if (sequence !== locationLookupSequenceReference.current) return;
    const coordinates = extractMapCoordinates(geocodeValue);
    if (coordinates && mapReference.current) {
      mapReference.current.panTo(coordinates);
      mapReference.current.setZoom(15);
      setMapPoint(pointTarget, coordinates);
      return;
    }
    let results: google.maps.GeocoderResult[];
    try {
      ({ results } = await geocoderReference.current.geocode({ address: geocodeValue }));
    } catch {
      return;
    }
    if (sequence !== locationLookupSequenceReference.current) return;
    const result = results[0];
    const position = result?.geometry.location;
    if (!position || !mapReference.current) return;
    mapReference.current.panTo(position);
    mapReference.current.setZoom(15);
    setMapPoint(pointTarget, position);
    const location = result.formatted_address;
    if (pointTarget === "from") setFromDraft(capitalizeWords(location));
    else setToDraft(capitalizeWords(location));
  };

  const handleLocationInput = (value: string) => {
    const pointTarget = targetReference.current;
    if (pointTarget === "from") setFromDraft(capitalizeWords(value));
    else setToDraft(capitalizeWords(value));
    const sequence = ++locationLookupSequenceReference.current;
    const existingTimeout = locationLookupTimeoutReferences.current[pointTarget];
    if (existingTimeout) clearTimeout(existingTimeout);
    const coordinates = extractMapCoordinates(value);
    if (coordinates && mapReference.current) {
      mapReference.current.panTo(coordinates);
      mapReference.current.setZoom(15);
      setMapPoint(pointTarget, coordinates);
      return;
    }
    if (value.trim().length < 3) return;
    locationLookupTimeoutReferences.current[pointTarget] = setTimeout(() => {
      void loadLocationValue(value, pointTarget, sequence);
    }, 450);
  };

  const activeLocation = target === "from" ? fromDraft : toDraft;
  const confirmLocations = () => {
    const sameLocation = normalizeLocation(fromDraft) === normalizeLocation(toDraft) || sameMapPoint(pointReferences.current.from, pointReferences.current.to);
    if (sameLocation) {
      toast.error("Loading and unloading locations must be different.");
      return;
    }
    onConfirm(fromDraft.trim(), toDraft.trim());
  };
  const routeLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromDraft.trim())}&destination=${encodeURIComponent(toDraft.trim())}`;
  const shareMessage = `Loading location: ${fromDraft.trim()}\nUnloading location: ${toDraft.trim()}\nRoute: ${routeLink}`;
  const copyRouteLink = async () => {
    try {
      await navigator.clipboard.writeText(routeLink);
      toast.success("Location route link copied.");
      setShareOpen(false);
    } catch {
      toast.error("The route link could not be copied.");
    }
  };
  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank", "noopener,noreferrer");
    setShareOpen(false);
  };
  return <div className="location-picker-backdrop" role="dialog" aria-modal="true" aria-labelledby="location-picker-title">
    <div className="location-picker-dialog">
      <header className="location-picker-header"><div><h2 id="location-picker-title"><MapPinned size={17} /> Select Location from Google Maps</h2><p>Choose a location on the map or paste coordinates.</p></div><button type="button" className="location-picker-close" onClick={onClose} aria-label="Close location picker"><X size={17} /></button></header>
      <div className="location-picker-body">
        <aside className="location-picker-sidebar">
          <div className={`location-picker-field ${target === "from" ? "active from" : "from"}`}><label htmlFor="map-from-location">FROM Location (F)</label><small>Click on map or paste link</small><input ref={fromInputReference} id="map-from-location" value={fromDraft} onFocus={() => { targetReference.current = "from"; setTarget("from"); }} onChange={(event) => handleLocationInput(event.target.value)} placeholder="Paste link or coords (lat,lng)" autoCapitalize="words" /><label htmlFor="map-loading-radius">Loading Radius (km)</label><input id="map-loading-radius" className="location-picker-radius-input" type="number" min="0" step="0.1" value={loadingRadius} onChange={(event) => updateRadius("loadingRadius", event.target.value)} /></div>
          <div className={`location-picker-field ${target === "to" ? "active to" : "to"}`}><label htmlFor="map-to-location">TO Location (T)</label><small>Click on map or paste link</small><input ref={toInputReference} id="map-to-location" value={toDraft} onFocus={() => { targetReference.current = "to"; setTarget("to"); }} onChange={(event) => handleLocationInput(event.target.value)} placeholder="Paste link or coords (lat,lng)" autoCapitalize="words" /><label htmlFor="map-unloading-radius">Unloading Radius (km)</label><input id="map-unloading-radius" className="location-picker-radius-input" type="number" min="0" step="0.1" value={unloadingRadius} onChange={(event) => updateRadius("unloadingRadius", event.target.value)} /></div>
          <p className="location-picker-hint">{mapStatus === "loading" ? "Loading Google Maps…" : mapStatus === "error" ? "Google Maps could not be loaded." : `Selecting on the map will update ${target === "from" ? "From" : "To"} Location. Drag the route line to adjust it.`}</p>
        </aside>
        <div className="location-picker-map"><div className="location-picker-map-canvas" ref={mapContainerReference} />{mapStatus === "error" && <div className="location-picker-map-error">Unable to load Google Maps.</div>}</div>
      </div>
      <footer className="location-picker-footer"><span>{activeLocation ? "Location selected" : "Select a location to continue"}</span><div className="location-picker-footer-actions"><div className="location-share-wrap"><button type="button" className="location-share-button" disabled={!fromDraft.trim() || !toDraft.trim()} onClick={() => setShareOpen((current) => !current)}><Share2 size={14} /> Share Route</button>{shareOpen && <div className="location-share-menu"><button type="button" onClick={() => void copyRouteLink()}><Copy size={14} /> Copy Link</button><button type="button" onClick={shareOnWhatsApp}><span className="whatsapp-share-icon">WA</span> Share on WhatsApp</button></div>}</div><button type="button" className="create-cancel-button" onClick={onClose}>Cancel</button><button type="button" className="trips-primary-button" disabled={!fromDraft.trim() || !toDraft.trim()} onClick={confirmLocations}>Confirm Location</button></div></footer>
    </div>
  </div>;
}

function FileUpload({ file, existingUrl, onChange, inputId, disabled = false }: { file?: File; existingUrl?: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; inputId: string; disabled?: boolean }) {
  const inputReference = useRef<HTMLInputElement>(null);
  const label = file?.name ?? (existingUrl ? "File uploaded" : "Upload File");
  return <div className="create-file-upload"><input ref={inputReference} id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={onChange} disabled={disabled} /><button type="button" onClick={() => inputReference.current?.click()} disabled={disabled}><UploadCloud size={18} /><span>{label}</span></button>{existingUrl && !file && <a href={existingUrl} target="_blank" rel="noreferrer">Open uploaded file</a>}<small>Max file size: 5 MB</small></div>;
}

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS_WORDS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const INDIAN_NUMBER_SCALES = [
  { value: 10_000_000, label: "Crore" },
  { value: 100_000, label: "Lakh" },
  { value: 1_000, label: "Thousand" },
];

function numberBelowHundredWords(value: number) {
  if (value < 20) return NUMBER_WORDS[value];
  return `${TENS_WORDS[Math.floor(value / 10)]}${value % 10 ? ` ${NUMBER_WORDS[value % 10]}` : ""}`;
}

function numberToIndianWords(value: number): string {
  if (value < 100) return numberBelowHundredWords(value);
  if (value < 1_000) {
    const remainder = value % 100;
    return `${NUMBER_WORDS[Math.floor(value / 100)]} Hundred${remainder ? ` ${numberToIndianWords(remainder)}` : ""}`;
  }

  const scale = INDIAN_NUMBER_SCALES.find(({ value: scaleValue }) => value >= scaleValue);
  if (!scale) return numberBelowHundredWords(value);

  const quotient = Math.floor(value / scale.value);
  const remainder = value % scale.value;
  return `${numberToIndianWords(quotient)} ${scale.label}${remainder ? ` ${numberToIndianWords(remainder)}` : ""}`;
}

function amountToWords(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return "";

  const [rupeesPart, paisePart] = normalized.split(".");
  const rupees = Number(rupeesPart);
  if (!Number.isSafeInteger(rupees)) return "";

  const paise = paisePart ? Number(paisePart.padEnd(2, "0")) : 0;
  const rupeeWords = `${numberToIndianWords(rupees)} Rupees`;
  return paise ? `${rupeeWords} and ${numberToIndianWords(paise)} Paise Only` : `${rupeeWords} Only`;
}

function MoneyField({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const words = amountToWords(value);

  return <><div className="money-input-wrap"><span>₹</span><input className="create-form-input" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} required={required} min="0" /></div><small aria-live="polite">{words || "Enter amount to see in words"}</small></>;
}

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeBillType(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized.startsWith("TRV")) return "TRV";
  if (normalized.startsWith("SAS")) return "SAS";
  return "";
}

function normalizeTrvSubtype(value: string) {
  const normalized = value.includes(":") ? value.split(":").pop() || "" : value;
  const subtype = normalized.trim().toUpperCase();
  return subtype === "FCM" || subtype === "RCM" ? subtype : "";
}

function auditValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function previousTripValue(trip: TripRecord, field: string) {
  const aliases: Record<string, keyof TripRecord> = {
    loadingRadius: "loadingRadius",
    unloadingRadius: "unloadingRadius",
    financialDescription: "financialDescription",
    freightPerKmRate: "freightPerKmRate",
    thirdPartyTransporterName: "thirdPartyTransporterName",
    thirdPartyTransportationPhone: "thirdPartyTransportationPhone",
    thirdPartyBookingFreight: "thirdPartyBookingFreight",
    thirdPartyAdvanceFileUrl: "thirdPartyAdvanceFileUrl",
  };
  const alias = aliases[field];
  if (alias && trip[alias] !== undefined && trip[alias] !== "") return trip[alias];
  const legacyAliases: Record<string, keyof TripRecord> = {
    loadingRadius: "loadingPointRadius",
    unloadingRadius: "unloadingPointRadius",
    financialDescription: "description",
    freightPerKmRate: "freightPerKilometer",
    thirdPartyTransporterName: "transporterName",
    thirdPartyTransportationPhone: "transporterPhone",
    thirdPartyBookingFreight: "bookingFreight",
  };
  const legacyAlias = legacyAliases[field];
  return legacyAlias ? trip[legacyAlias] : trip[field as keyof TripRecord];
}

export default function CreateTripPage({ onSignOut }: CreateTripPageProps) {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const isEditing = Boolean(documentId);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [saving, setSaving] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(isEditing);
  const [originalTrip, setOriginalTrip] = useState<TripRecord | null>(null);
  const [error, setError] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    let active = true;
    void getCurrentUserProfile().then((profile) => {
      if (!active) return;
      const assigneeName = profile?.assigneeName?.trim() || auth?.currentUser?.displayName || "";
      if (assigneeName) setForm((current) => current.assigneeName ? current : { ...current, assigneeName });
    });
    return () => { active = false; };
  }, [isEditing]);

  useEffect(() => {
    if (!documentId) return;
    let active = true;
    void getTrip(documentId).then((trip) => {
      if (!active) return;
      const payments = trip.otherPayments.length > 0
        ? trip.otherPayments.map((payment) => ({ description: payment.description, amount: payment.amount, fileUrl: payment.fileUrl }))
        : [{ description: "", amount: "0.00" }];
      const freightPerKmRate = trip.freightPerKmRate || trip.freightPerKilometer || "0";
      const distanceKm = trip.distanceKm || "0";
      const billType = normalizeBillType(trip.billType || "");
      const trvSubtype = billType === "TRV" ? normalizeTrvSubtype(trip.trvSubtype || trip.billType || "") : "";
      setOriginalTrip(trip);
      setForm({
        ...initialForm,
        vehicleNumber: trip.vehicleNumber || "",
        vehicleType: trip.vehicleType || "",
        billType,
        trvSubtype,
        referenceName: trip.referenceName || "",
        assigneeName: trip.assigneeName || "",
        customerCompanyName: trip.customerCompanyName || "",
        contactPerson: trip.contactPerson || "",
        contactNumber: trip.contactNumber || "",
        fromLocation: trip.fromLocation || "",
        toLocation: trip.toLocation || "",
        materialDimensions: trip.materialDimensions || "",
        weight: trip.weight || "",
        weightUnit: trip.weightUnit || "tons",
        loadingRadius: trip.loadingRadius || trip.loadingPointRadius || "0.5",
        unloadingRadius: trip.unloadingRadius || trip.unloadingPointRadius || "0.5",
        financialDescription: trip.financialDescription || trip.description || "",
        isFreightPerKm: trip.isFreightPerKm ?? (Number(freightPerKmRate) > 0 && Number(distanceKm) > 0),
        freightPerKmRate,
        distanceKm,
        freightAmount: trip.freightAmount || "0",
        commission: trip.commission || "0.00",
        advancePaymentReceived: trip.advancePaymentReceived || "0.00",
        advancePaymentReceivedFileUrl: trip.advancePaymentReceivedFileUrl || "",
        thirdPartyDescription: trip.thirdPartyDescription || "",
        thirdPartyTransporterName: trip.thirdPartyTransporterName || trip.transporterName || "",
        thirdPartyTransportationPhone: trip.thirdPartyTransportationPhone || trip.transporterPhone || "",
        thirdPartyFreightAmount: trip.thirdPartyFreightAmount || "0.00",
        thirdPartyBookingFreight: trip.thirdPartyBookingFreight || trip.bookingFreight || "0.00",
        thirdPartyAdvancePayment: trip.thirdPartyAdvancePayment || "0.00",
        thirdPartyAdvanceFileUrl: trip.thirdPartyAdvanceFileUrl || "",
        otherPayments: payments,
        status: normalizeStatus(trip.status || "confirmed"),
      });
      setLoadingTrip(false);
    }).catch(() => {
      if (!active) return;
      setError("The trip could not be loaded. Please try again.");
      setLoadingTrip(false);
    });
    return () => { active = false; };
  }, [documentId]);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm((current) => ({ ...current, [key]: value }));
  const handleFileChange = (key: "advancePaymentReceivedFile" | "thirdPartyAdvancePaymentFile", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Each payment file must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    update(key, file);
  };
  const handleOtherPaymentFileChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Each payment file must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    update("otherPayments", form.otherPayments.map((payment, itemIndex) => itemIndex === index ? { ...payment, file } : payment));
  };
  const addOtherPayment = () => {
    if (form.otherPayments.length >= 5) return;
    update("otherPayments", [...form.otherPayments, { description: "", amount: "0.00" }]);
  };
  const removeOtherPayment = (index: number) => {
    if (form.otherPayments.length <= 1) return;
    update("otherPayments", form.otherPayments.filter((_, itemIndex) => itemIndex !== index));
  };
  const updateOtherPayment = (index: number, key: "description" | "amount", value: string) => update("otherPayments", form.otherPayments.map((payment, itemIndex) => itemIndex === index ? { ...payment, [key]: value } : payment));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (form.fromLocation.trim() && form.toLocation.trim() && normalizeLocation(form.fromLocation) === normalizeLocation(form.toLocation)) {
      const message = "Loading and unloading locations must be different.";
      setError(message);
      toast.error(message);
      return;
    }
    setSaving(true);
    try {
      const [advancePaymentReceivedFileUrl, thirdPartyAdvanceFileUrl, ...otherPaymentFileUrls] = await Promise.all([
        form.advancePaymentReceivedFile ? uploadTripDocument(form.advancePaymentReceivedFile, "advance-payment-received") : Promise.resolve(form.advancePaymentReceivedFileUrl || ""),
        form.thirdPartyAdvancePaymentFile ? uploadTripDocument(form.thirdPartyAdvancePaymentFile, "third-party-advance-payment") : Promise.resolve(form.thirdPartyAdvanceFileUrl || ""),
        ...form.otherPayments.map((payment, index) => payment.file ? uploadTripDocument(payment.file, `other-payment-${index + 1}`) : Promise.resolve(payment.fileUrl || "")),
      ]);
      const otherPayments = form.otherPayments.map((payment, index) => ({
        description: payment.description.trim(),
        amount: payment.amount || "0.00",
        fileUrl: otherPaymentFileUrls[index] || "",
      }));
      const freightPerKmRate = Number(form.freightPerKmRate) || 0;
      const distanceKm = Number(form.distanceKm) || 0;
      const trip: TripInput = {
        vehicleNumber: form.vehicleNumber.trim(),
        vehicleType: form.vehicleType,
        billType: form.billType,
        trvSubtype: form.billType === "TRV" ? form.trvSubtype : "",
        referenceName: form.referenceName.trim(),
        assigneeName: form.assigneeName.trim(),
        customerCompanyName: form.customerCompanyName.trim(),
        contactPerson: form.contactPerson.trim(),
        contactNumber: form.contactNumber.trim(),
        fromLocation: form.fromLocation.trim(),
        toLocation: form.toLocation.trim(),
        materialDimensions: form.materialDimensions.trim(),
        weight: form.weight,
        weightUnit: form.weightUnit,
        loadingRadius: form.loadingRadius || "0.5",
        unloadingRadius: form.unloadingRadius || "0.5",
        loadingPointRadius: form.loadingRadius || "0.5",
        unloadingPointRadius: form.unloadingRadius || "0.5",
        financialDescription: form.financialDescription.trim(),
        description: form.financialDescription.trim(),
        isFreightPerKm: form.isFreightPerKm,
        freightPerKmRate: form.isFreightPerKm ? String(freightPerKmRate) : "0",
        freightPerKilometer: form.isFreightPerKm ? String(freightPerKmRate) : "0",
        distanceKm: form.isFreightPerKm ? String(distanceKm) : "0",
        freightAmount: form.isFreightPerKm ? String(freightPerKmRate * distanceKm) : form.freightAmount || "0",
        commission: form.commission || "0",
        advancePaymentReceived: form.advancePaymentReceived || "0",
        advancePaymentReceivedFileUrl,
        advancePaymentFileUrl: advancePaymentReceivedFileUrl,
        thirdPartyDescription: form.thirdPartyDescription.trim(),
        thirdPartyTransporterName: form.thirdPartyTransporterName.trim(),
        transporterName: form.thirdPartyTransporterName.trim(),
        thirdPartyTransportationPhone: form.thirdPartyTransportationPhone.trim(),
        transporterPhone: form.thirdPartyTransportationPhone.trim(),
        thirdPartyFreightAmount: form.thirdPartyFreightAmount || "0",
        thirdPartyBookingFreight: form.thirdPartyBookingFreight || "0",
        bookingFreight: form.thirdPartyBookingFreight || "0",
        thirdPartyAdvancePayment: form.thirdPartyAdvancePayment || "0",
        thirdPartyAdvanceFileUrl,
        thirdPartyAdvancePaymentFileUrl: thirdPartyAdvanceFileUrl,
        otherPayments,
        otherPaymentsDescription: otherPayments.map(({ description }) => description).filter(Boolean).join(" | "),
        otherPaymentsAmount: otherPayments.map(({ amount }) => amount).join(" | "),
        otherPaymentsFileUrl: otherPayments.map(({ fileUrl }) => fileUrl).filter(Boolean).join(" | "),
        status: normalizeStatus(form.status),
      };
      if (documentId) {
        await updateTrip(documentId, trip);
        if (originalTrip) {
          const changes: Array<[string, unknown, unknown]> = [
            ["Vehicle Number", previousTripValue(originalTrip, "vehicleNumber"), trip.vehicleNumber],
            ["Vehicle Type", previousTripValue(originalTrip, "vehicleType"), trip.vehicleType],
            ["Bill Type", previousTripValue(originalTrip, "billType"), trip.billType],
            ["TRV Subtype", previousTripValue(originalTrip, "trvSubtype"), trip.trvSubtype],
            ["Reference Name", previousTripValue(originalTrip, "referenceName"), trip.referenceName],
            ["Assignee Name", previousTripValue(originalTrip, "assigneeName"), trip.assigneeName],
            ["Customer Company Name", previousTripValue(originalTrip, "customerCompanyName"), trip.customerCompanyName],
            ["Contact Person", previousTripValue(originalTrip, "contactPerson"), trip.contactPerson],
            ["Contact Number", previousTripValue(originalTrip, "contactNumber"), trip.contactNumber],
            ["From Location", previousTripValue(originalTrip, "fromLocation"), trip.fromLocation],
            ["To Location", previousTripValue(originalTrip, "toLocation"), trip.toLocation],
            ["Material Dimensions", previousTripValue(originalTrip, "materialDimensions"), trip.materialDimensions],
            ["Weight", previousTripValue(originalTrip, "weight"), trip.weight],
            ["Weight Unit", previousTripValue(originalTrip, "weightUnit"), trip.weightUnit],
            ["Loading Radius", previousTripValue(originalTrip, "loadingRadius"), trip.loadingRadius],
            ["Unloading Radius", previousTripValue(originalTrip, "unloadingRadius"), trip.unloadingRadius],
            ["Financial Description", previousTripValue(originalTrip, "financialDescription"), trip.financialDescription],
            ["Freight Per Km", previousTripValue(originalTrip, "freightPerKmRate"), trip.freightPerKmRate],
            ["Distance Km", previousTripValue(originalTrip, "distanceKm"), trip.distanceKm],
            ["Freight Amount", previousTripValue(originalTrip, "freightAmount"), trip.freightAmount],
            ["Commission", previousTripValue(originalTrip, "commission"), trip.commission],
            ["Advance Payment Received", previousTripValue(originalTrip, "advancePaymentReceived"), trip.advancePaymentReceived],
            ["Third Party Description", previousTripValue(originalTrip, "thirdPartyDescription"), trip.thirdPartyDescription],
            ["Third Party Transporter Name", previousTripValue(originalTrip, "thirdPartyTransporterName"), trip.thirdPartyTransporterName],
            ["Third Party Transportation Phone", previousTripValue(originalTrip, "thirdPartyTransportationPhone"), trip.thirdPartyTransportationPhone],
            ["Third Party Freight Amount", previousTripValue(originalTrip, "thirdPartyFreightAmount"), trip.thirdPartyFreightAmount],
            ["Third Party Booking Freight", previousTripValue(originalTrip, "thirdPartyBookingFreight"), trip.thirdPartyBookingFreight],
            ["Third Party Advance Payment", previousTripValue(originalTrip, "thirdPartyAdvancePayment"), trip.thirdPartyAdvancePayment],
            ["Other Payments", previousTripValue(originalTrip, "otherPayments"), trip.otherPayments],
            ["Status", normalizeStatus(originalTrip.status || "confirmed"), trip.status],
          ];
          const auditTripId = originalTrip.documentId || documentId;
          const auditWrites = changes
            .filter(([field]) => field !== "Status")
            .map(([field, oldValue, newValue]) => auditLogService.logTripUpdate(auditTripId, field, auditValue(oldValue), auditValue(newValue)));
          try {
            await Promise.all(auditWrites);
          } catch (auditError) {
            console.error("Trip update audit logging failed:", auditError);
          }
          const oldStatus = normalizeStatus(originalTrip.status || "confirmed");
          if (oldStatus !== trip.status) {
            try {
              if (trip.status === "cancelled") {
                await auditLogService.logTripCancellation(auditTripId, "Status changed in the edit form");
              } else {
                await auditLogService.logTripStatusChange(auditTripId, oldStatus, trip.status);
              }
            } catch (auditError) {
              console.error("Trip status audit logging failed:", auditError);
            }
          }
        }
        toast.success("Trip updated successfully.");
      } else {
        const savedTrip = await saveTrip(trip);
        await createJobFromTrip(savedTrip);
        try {
          await auditLogService.logTripCreation(savedTrip.documentId, trip.customerCompanyName, auth?.currentUser?.uid || "system");
        } catch (auditError) {
          console.error("Trip creation audit logging failed:", auditError);
        }
        toast.success("Trip created successfully.");
      }
      navigate("/trips");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `The trip could not be ${isEditing ? "updated" : "created"}.`;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const tripTitle = isEditing ? "Edit Trip" : "Create Trip";
  return <FleetLayout onSignOut={onSignOut} activeNav="Trips"><div className="create-trip-page">
    <button className="back-to-trips" onClick={() => navigate("/trips")}><ArrowLeft size={16} /> Back to Trips</button>
    <div className="create-trip-heading"><div><h1>{tripTitle}</h1><p>{isEditing ? "Update the details for this transportation trip" : "Create a new transportation trip with all required details"}</p></div><span className="required-note"><b>*</b> Required fields</span></div>
    {error && <div className="create-form-error">{error}</div>}
    <form onSubmit={handleSubmit}>
      <section className="create-form-section"><div className="create-section-heading"><span>01</span><div><h2>Vehicle Information</h2><p>Tell us which vehicle will complete this trip.</p></div></div><div className="create-form-grid">
        <FormField label="Vehicle Number" required><TextInput value={form.vehicleNumber} onChange={(value) => update("vehicleNumber", value)} placeholder="e.g., MH-02-AB-1234" required /></FormField>
        <FormField label="Vehicle Type" required><SelectInput value={form.vehicleType} onChange={(value) => update("vehicleType", value)} placeholder="Select vehicle type" options={["LOW", "SEMI", "HIGH"]} required /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>02</span><div><h2>Billing Information</h2><p>Configure billing references for this trip.</p></div></div><div className="create-form-grid">
        <FormField label="Bill Type" required><SelectInput value={form.billType} onChange={(value) => { update("billType", value); if (value !== form.billType) update("trvSubtype", ""); }} placeholder="Select bill type" options={["TRV", "SAS"]} required /></FormField>
        {form.billType === "TRV" && <FormField label="TRV Subtype" required><SelectInput value={form.trvSubtype} onChange={(value) => update("trvSubtype", value)} placeholder="Select TRV subtype" options={["FCM", "RCM"]} required /></FormField>}
        <FormField label="Reference Name"><TextInput value={form.referenceName} onChange={(value) => update("referenceName", value)} placeholder="e.g., REF001" /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>03</span><div><h2>Assignee Information</h2><p>Assign an owner who can coordinate the trip.</p></div></div><div className="create-form-grid create-form-grid-single">
        <FormField label="Assignee Name" required><TextInput value={form.assigneeName} onChange={(value) => update("assigneeName", value)} placeholder="Enter assignee name" required readOnly /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>04</span><div><h2>Customer Information</h2><p>Capture the customer and primary contact details.</p></div></div><div className="create-form-grid">
        <FormField label="Customer Company Name" required><TextInput value={form.customerCompanyName} onChange={(value) => update("customerCompanyName", value)} placeholder="e.g., ABC Logistics" required /></FormField>
        <FormField label="Contact Person" required><TextInput value={form.contactPerson} onChange={(value) => update("contactPerson", value)} placeholder="e.g., Raj Kumar" required /></FormField>
        <FormField label="Contact Number" required><TextInput value={form.contactNumber} onChange={(value) => update("contactNumber", value)} placeholder="e.g., 9876543210" type="tel" required /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>05</span><div><h2>Location Information</h2><p>Set the route and loading thresholds for your vehicle.</p></div></div><button type="button" className="map-location-button" onClick={() => setLocationPickerOpen(true)}><MapPinned size={17} /> Select Location in Map</button><div className="create-form-grid">
        <FormField label={<span className="location-field-label location-field-loading"><MapPinned size={13} /> Loading Location</span>} required><LocationInput value={form.fromLocation} onChange={(value) => update("fromLocation", value)} placeholder="Search loading location" required /></FormField>
        <FormField label={<span className="location-field-label location-field-unloading"><MapPinned size={13} /> Unloading Location</span>} required><LocationInput value={form.toLocation} onChange={(value) => update("toLocation", value)} placeholder="Search unloading location" required /></FormField>
        <FormField label="Material Dimensions" required><TextInput value={form.materialDimensions} onChange={(value) => update("materialDimensions", value)} placeholder="e.g., 10x5x5 ft" required /></FormField>
        <FormField label="Weight" required><div className="weight-input-group"><TextInput value={form.weight} onChange={(value) => update("weight", value)} placeholder="e.g., 500" type="number" min="0" required /><SelectInput value={form.weightUnit} onChange={(value) => update("weightUnit", value)} placeholder="Unit" options={["tons", "kg"]} required /></div></FormField>
        <FormField label="Loading Point Radius (km)" hint="Distance in km where vehicle is considered at loading point"><TextInput value={form.loadingRadius} onChange={(value) => update("loadingRadius", value)} type="number" min="0.1" step="0.1" /></FormField>
        <FormField label="Unloading Point Radius (km)" hint="Distance in km where vehicle is considered at unloading point"><TextInput value={form.unloadingRadius} onChange={(value) => update("unloadingRadius", value)} type="number" min="0.1" step="0.1" /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>06</span><div><h2>Financial Information</h2><p>Record the financial details and advance payment for this trip.</p></div></div><div className="create-form-grid">
        <FormField label="Description" className="field-span-2"><textarea className="create-form-input create-form-textarea" value={form.financialDescription} onChange={(event) => update("financialDescription", capitalizeWords(event.target.value))} autoCapitalize="words" placeholder="e.g., Payment notes or financial remarks" /></FormField>
        <FormField label="Freight per kilometer"><div className="toggle-field"><input type="checkbox" checked={form.isFreightPerKm} onChange={(event) => update("isFreightPerKm", event.target.checked)} /><span>Calculate freight using a per-km rate</span></div></FormField>
        {form.isFreightPerKm ? <>
          <FormField label="Per-km Rate (₹)" required><MoneyField value={form.freightPerKmRate} onChange={(value) => update("freightPerKmRate", value)} required /></FormField>
          <FormField label="Distance (km)" required><TextInput value={form.distanceKm} onChange={(value) => update("distanceKm", value)} placeholder="e.g., 10" type="number" min="0" step="0.1" required /></FormField>
        </> : <FormField label="Freight Amount (₹)" required><MoneyField value={form.freightAmount} onChange={(value) => update("freightAmount", value)} required /></FormField>}
        <FormField label="Commission (₹)"><MoneyField value={form.commission} onChange={(value) => update("commission", value)} /></FormField>
        <FormField label="Advance Payment Received (₹)"><MoneyField value={form.advancePaymentReceived} onChange={(value) => update("advancePaymentReceived", value)} /></FormField>
        <FormField label="Advance Payment Received File" className="field-span-2"><FileUpload file={form.advancePaymentReceivedFile} existingUrl={form.advancePaymentReceivedFileUrl} onChange={(event) => handleFileChange("advancePaymentReceivedFile", event)} inputId="advance-payment-received-file" /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>07</span><div><h2>Third Party Transportation</h2><p>Add transporter details when another carrier is involved.</p></div></div><div className="create-form-grid">
        <FormField label="Description" className="field-span-2"><textarea className="create-form-input create-form-textarea" value={form.thirdPartyDescription} onChange={(event) => update("thirdPartyDescription", capitalizeWords(event.target.value))} autoCapitalize="words" placeholder="e.g., Transportation notes or remarks" /></FormField>
        <FormField label="Transporter Name"><TextInput value={form.thirdPartyTransporterName} onChange={(value) => update("thirdPartyTransporterName", value)} placeholder="e.g., XYZ Transport" /></FormField>
        <FormField label="Transporter Phone"><TextInput value={form.thirdPartyTransportationPhone} onChange={(value) => update("thirdPartyTransportationPhone", value)} placeholder="e.g., 9876543210" type="tel" /></FormField>
        <FormField label="Freight Amount (₹)"><MoneyField value={form.thirdPartyFreightAmount} onChange={(value) => update("thirdPartyFreightAmount", value)} /></FormField>
        <FormField label="Booking Freight (₹)"><MoneyField value={form.thirdPartyBookingFreight} onChange={(value) => update("thirdPartyBookingFreight", value)} /></FormField>
        <FormField label="Advance Payment (₹)"><MoneyField value={form.thirdPartyAdvancePayment} onChange={(value) => update("thirdPartyAdvancePayment", value)} /></FormField>
        <FormField label="Advance Payment File"><FileUpload file={form.thirdPartyAdvancePaymentFile} existingUrl={form.thirdPartyAdvanceFileUrl} onChange={(event) => handleFileChange("thirdPartyAdvancePaymentFile", event)} inputId="third-party-advance-payment-file" /></FormField>
      </div></section>

      <section className="create-form-section"><div className="create-section-heading"><span>08</span><div><h2>Other Payments</h2><p>Add up to five additional charges related to this trip.</p></div>{form.otherPayments.length < 5 && <button type="button" className="add-payment-button" onClick={addOtherPayment}><Plus size={15} /> Add More</button>}</div>
        {form.otherPayments.map((payment, index) => <div className="other-payment-row" key={index}><FormField label={`Entry ${index + 1} Description`}><TextInput value={payment.description} onChange={(value) => updateOtherPayment(index, "description", value)} placeholder="e.g., Additional charges" /></FormField><FormField label="Amount (₹)"><MoneyField value={payment.amount} onChange={(value) => updateOtherPayment(index, "amount", value)} /></FormField><FormField label="File Upload"><FileUpload file={payment.file} existingUrl={payment.fileUrl} onChange={(event) => handleOtherPaymentFileChange(index, event)} inputId={`other-payment-file-${index}`} /></FormField>{index > 0 && <button type="button" className="remove-payment-button" title="Remove payment" onClick={() => removeOtherPayment(index)}><Trash2 size={16} /></button>}</div>)}
      </section>

      <section className="create-form-section"><div className="create-section-heading"><span>09</span><div><h2>Order Status</h2><p>Choose the current status of this transportation order.</p></div></div><div className="create-form-grid create-form-grid-single">
        <FormField label="Status" required><SelectInput value={form.status} onChange={(value) => update("status", value)} placeholder="Select status" options={["confirmed", "cancelled"]} required /></FormField>
      </div></section>

      <div className="create-form-actions"><button type="button" className="create-cancel-button" onClick={() => navigate("/trips")} disabled={saving || loadingTrip}>Cancel</button><button type="submit" className="trips-primary-button" disabled={saving || loadingTrip}>{saving ? (isEditing ? "Saving…" : "Creating…") : isEditing ? "Save Changes" : "Create Trip"}</button></div>
    </form>
    {locationPickerOpen && <LocationMapPicker fromLocation={form.fromLocation} toLocation={form.toLocation} loadingRadius={form.loadingRadius} unloadingRadius={form.unloadingRadius} onRadiusChange={(field, value) => update(field, value)} onClose={() => setLocationPickerOpen(false)} onConfirm={(fromLocation, toLocation) => { update("fromLocation", fromLocation); update("toLocation", toLocation); setLocationPickerOpen(false); }} />}
  </div></FleetLayout>;
}
