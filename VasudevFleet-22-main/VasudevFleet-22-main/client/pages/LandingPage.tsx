import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPinned,
  MessageCircle,
  Phone,
  Building2,
  Menu,
  Radio,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { getFleetVehicleImageUrls, saveEnquiry, signInWithEmail } from "@/firebase";

const WHATSAPP_URL = "https://api.whatsapp.com/send?phone=917995577810&forceIntent=true&load=loadInIOSExternalSafari";
const FLEET_HERO_IMAGE_URL = "https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/fleet-vehicles%2F1.jpeg?alt=media&token=1e7b74a3-28a1-4474-922c-63ccfe1e2064";
const ABOUT_US_IMAGE_URL = "https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/about_us%2Fabout_us.webp?alt=media&token=bbf9ad1e-0894-4f60-93e3-f66aae3a4414";
const DIRECTORS_IMAGE_URL = "https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/staff_images%2Fdirectors.webp?alt=media&token=ee1e4ae7-a7c2-4db1-a6bb-47d6956d7f34";
const OFFICE_TEAM_IMAGE_URLS = [
  "https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/staff_images%2F1.webp?alt=media&token=869609d2-bb89-47dc-97ab-61ededf7191d",
  "https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/staff_images%2F2.webp?alt=media&token=4d53d41b-9926-4804-b841-176528d41581",
  "https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/staff_images%2F3.webp?alt=media&token=77263c3f-7db9-47b8-92b2-32a90464caaf",
] as const;
const CLIENT_LOGO_URLS = Array.from({ length: 12 }, (_, index) => `https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/client_images%2F${index + 1}.webp?alt=media&token=45c3fbba-2746-42d5-8e6e-44e91af463de`);
const SERVICE_IMAGE_URLS = Array.from({ length: 4 }, (_, index) => `https://firebasestorage.googleapis.com/v0/b/vasudevfleet-c84d6.firebasestorage.app/o/service_images%2F${index + 1}.webp?alt=media&token=89a3f896-8672-4ef7-afda-406799663a5d`);
const SERVICE_CARDS = [
  { title: "Trailers on hiring", description: "40 feet trailers are available on rental basis at reasonable prices." },
  { title: "Machines on hiring", description: "JCB, 200/210/300 machines and cement bulkers available for hiring." },
  { title: "ODC shiftings", description: "Over-dimensional cargo such as tanks, crushers, tippers, and wheel loaders can be shifted across India." },
  { title: "Semi trailers", description: "Utilized to carry bulk and heavier cargo safely and efficiently." },
] as const;
const TESTIMONIALS = [
  { quote: "Best service till date. They delivered my good within the stated time.", name: "Yash Sharma" },
  { quote: "I feel that I have always been given honest and truthful answers without being hurried, so we can work through a situation immediately.", name: "Vineela Challapalli" },
  { quote: "We have been working with Transport N Service for a number of years. They provide excellent service and assistance.", name: "Sujatha Pasupuleti" },
  { quote: "I always prefer them for transporting my goods as they are quick and reliable.", name: "Aditi Bhatt" },
  { quote: "I had hired them to transport some delicate goods and they did an amazing job.", name: "Riya Rao" },
  { quote: "I also enjoy the easy-going and professional way things are handled, along with good humour.", name: "Kakarapalli Naveen Kumar" },
] as const;

type EnquiryFormData = {
  name: string;
  company: string;
  email: string;
  phone: string;
  referral: string;
  fromLocation: string;
  toLocation: string;
  materialWeight: string;
  materialDimensions: string;
  vehicleType: string;
  service: string;
  message: string;
  duration: string;
  preferredBrand: string;
  equipment: string;
  serviceDate: string;
};


const EMPTY_ENQUIRY_FORM: EnquiryFormData = {
  name: "",
  company: "",
  email: "",
  phone: "",
  referral: "",
  fromLocation: "",
  toLocation: "",
  materialWeight: "",
  materialDimensions: "",
  vehicleType: "",
  service: "",
  message: "",
  duration: "",
  preferredBrand: "",
  equipment: "",
  serviceDate: "",
};

const DURATION_OPTIONS = ["1 - 10", "11 - 20", "21 - 30", "30 or more"];
const SERVICE_OPTIONS = ["Earthmovers Rentals", "Excavator Rentals", "Road Rollers Rentals", "Dumper Truck Rentals"];
const BRAND_OPTIONS = ["Hitachi", "Caterpillar", "Komatsu", "Mitsubishi", "JCB", "Sumitomo", "Others"];
const EQUIPMENT_OPTIONS = ["Suction", "Dragline", "Crawlers", "Trenchers", "Backhoe Loaders", "Bulldozers"];

function getSelectedValues(value: string) {
  return value ? value.split("|") : [];
}

function updateSelectedValues(value: string, option: string) {
  const selectedValues = getSelectedValues(value);
  return selectedValues.includes(option)
    ? selectedValues.filter((selectedValue) => selectedValue !== option).join("|")
    : [...selectedValues, option].join("|");
}

function FleetVehicleShowcase() {
  const [images, setImages] = useState<{ id: number; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    getFleetVehicleImageUrls().then((nextImages) => {
      if (isMounted) {
        setImages(nextImages);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => current === null ? current : (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => current === null ? current : (current + 1) % images.length);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  const activeImage = activeIndex === null ? null : images[activeIndex];
  const showPrevious = () => setActiveIndex((current) => current === null ? current : (current - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((current) => current === null ? current : (current + 1) % images.length);

  return (
    <section className="landing-fleet-showcase" id="fleet-showcase" aria-labelledby="fleet-showcase-title">
      <div className="landing-section-heading fleet-showcase-heading">
        <p className="landing-eyebrow"><span /><strong>THE FLEET IN MOTION</strong></p>
        <h2 id="fleet-showcase-title">Built for the road ahead.</h2>
        <p>A closer look at the vehicles and teams that keep every delivery moving with confidence.</p>
        <button className="fleet-showcase-action" type="button" onClick={() => setActiveIndex(0)} disabled={images.length === 0} aria-haspopup="dialog">
          Show fleet <ArrowRight size={17} />
        </button>
      </div>
      {isLoading ? (
        <div className="fleet-gallery-loading" aria-busy="true">Loading fleet vehicles…</div>
      ) : images.length > 0 ? (
        <div className="fleet-gallery">
          {images.map(({ id, url }, index) => (
            <button key={id} className="fleet-gallery-card" type="button" onClick={() => setActiveIndex(index)} aria-label={`View Vasudev Fleet vehicle ${id}`}>
              <img src={url} alt={`Vasudev Fleet vehicle ${id}`} loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <p className="fleet-gallery-empty">Fleet vehicles will appear here shortly.</p>
      )}
      {activeImage && activeIndex !== null && (
        <div className="fleet-lightbox-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveIndex(null)}>
          <section className="fleet-lightbox" role="dialog" aria-modal="true" aria-labelledby="fleet-lightbox-title">
            <div className="fleet-lightbox-header">
              <span id="fleet-lightbox-title">Vehicle {String(activeImage.id).padStart(2, "0")}</span>
              <button className="fleet-lightbox-close" type="button" onClick={() => setActiveIndex(null)} aria-label="Close fleet slideshow"><X size={21} /></button>
            </div>
            <div className="fleet-lightbox-stage">
              <button className="fleet-lightbox-nav" type="button" onClick={showPrevious} aria-label="Previous fleet vehicle"><ChevronLeft size={26} /></button>
              <img src={activeImage.url} alt={`Vasudev Fleet vehicle ${activeImage.id}`} />
              <button className="fleet-lightbox-nav" type="button" onClick={showNext} aria-label="Next fleet vehicle"><ChevronRight size={26} /></button>
            </div>
            <div className="fleet-lightbox-footer"><span>{activeIndex + 1} / {images.length}</span><span>Use ← → to browse</span></div>
          </section>
        </div>
      )}
    </section>
  );
}

type LoginModalProps = {
  email: string;
  password: string;
  signInError: string;
  isSigningIn: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

function LoginModal({
  email,
  password,
  signInError,
  isSigningIn,
  onClose,
  onSubmit,
  onEmailChange,
  onPasswordChange,
}: LoginModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSigningIn) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSigningIn, onClose]);

  return (
    <div className="landing-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSigningIn && onClose()}>
      <section className="landing-login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <button className="landing-modal-close" type="button" aria-label="Close sign-in" onClick={onClose} disabled={isSigningIn}><X size={18} /></button>
        <div className="landing-modal-heading">
          <span className="landing-modal-mark"><LockKeyhole size={19} /></span>
          <div><strong id="login-modal-title">Welcome back</strong><span>Sign in to your fleet workspace</span></div>
        </div>
        <p className="landing-modal-intro">Access live vehicle visibility, trip control, and operational insights in one place.</p>
        <form className="landing-login-form" onSubmit={onSubmit}>
          <label>
            <span>Work email</span>
            <span className="landing-input-wrap"><Mail size={16} /><input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></span>
          </label>
          <label>
            <span>Password</span>
            <span className="landing-input-wrap landing-password-wrap"><LockKeyhole size={16} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="landing-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} disabled={isSigningIn}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
          </label>
          {signInError && <p className="landing-modal-error" role="alert">{signInError}</p>}
          <button className="landing-modal-submit" type="submit" disabled={isSigningIn}>
            {isSigningIn ? "Signing you in…" : "Sign in to workspace"}
            {!isSigningIn && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="landing-modal-footnote"><ShieldCheck size={14} /> Your sign-in is secured by Firebase Authentication</p>
      </section>
    </div>
  );
}

function getSignInErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "That email or password isn’t recognized. Please try again.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code.includes("operation-not-allowed")) {
    return "Email and password sign-in is not enabled for this Firebase project.";
  }
  return "We couldn’t complete sign-in. Please check your details and try again.";
}

type EnquiryModalProps = {
  form: EnquiryFormData;
  submitted: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onChange: (field: keyof EnquiryFormData, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

type OptionGroupProps = {
  label: string;
  options: string[];
  value: string;
  multiple?: boolean;
  onChange: (value: string) => void;
};

function OptionGroup({ label, options, value, multiple = false, onChange }: OptionGroupProps) {
  const selectedValues = getSelectedValues(value);

  return (
    <fieldset className="landing-service-option-group">
      <legend>{label}</legend>
      <div className="landing-service-options">
        {options.map((option, index) => (
          <label key={option}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={label}
              value={option}
              checked={multiple ? selectedValues.includes(option) : value === option}
              onChange={() => onChange(multiple ? updateSelectedValues(value, option) : option)}
              required={selectedValues.length === 0 && (multiple ? index === 0 : true)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ServiceEnquiryFields({ form, onChange }: { form: EnquiryFormData; onChange: (field: keyof EnquiryFormData, value: string) => void }) {
  return (
    <div className="landing-service-form">
      <label className="landing-service-input-field">
        <span>Name</span>
        <input value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Name *" autoComplete="name" required />
      </label>
      <label className="landing-service-input-field">
        <span>Company name</span>
        <input value={form.company} onChange={(event) => onChange("company", event.target.value)} placeholder="Company name *" autoComplete="organization" required />
      </label>
      <label className="landing-service-input-field">
        <span>Email</span>
        <input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} placeholder="you@company.com *" autoComplete="email" required />
      </label>
      <label className="landing-service-input-field">
        <span>From location</span>
        <input value={form.fromLocation} onChange={(event) => onChange("fromLocation", event.target.value)} placeholder="From location *" autoComplete="street-address" required />
      </label>
      <label className="landing-service-input-field">
        <span>To location</span>
        <input value={form.toLocation} onChange={(event) => onChange("toLocation", event.target.value)} placeholder="To location *" autoComplete="street-address" required />
      </label>
      <label className="landing-service-input-field landing-service-phone-field">
        <span className="landing-service-country-code">+91</span>
        <input type="tel" value={form.phone} onChange={(event) => onChange("phone", event.target.value)} placeholder="Mobile Number *" autoComplete="tel" required />
      </label>
      <OptionGroup label="What service do you need?" options={SERVICE_OPTIONS} value={form.vehicleType} onChange={(value) => onChange("vehicleType", value)} />
      <OptionGroup label="For how many days do you need to rent the machine?" options={DURATION_OPTIONS} value={form.duration} multiple onChange={(value) => onChange("duration", value)} />
      <OptionGroup label="Which brand would you prefer?" options={BRAND_OPTIONS} value={form.preferredBrand} onChange={(value) => onChange("preferredBrand", value)} />
      <OptionGroup label="What do you need on hire?" options={EQUIPMENT_OPTIONS} value={form.equipment} onChange={(value) => onChange("equipment", value)} />
      <label className="landing-service-date-field">
        <span>When do you need the service?</span>
        <input type="date" value={form.serviceDate} onChange={(event) => onChange("serviceDate", event.target.value)} required />
      </label>
      <label className="landing-service-input-field">
        <span>Referral code <em>(optional)</em></span>
        <input value={form.referral} onChange={(event) => onChange("referral", event.target.value)} placeholder="Enter referral code" autoComplete="off" />
      </label>
    </div>
  );
}

function EnquiryModal({ form, submitted, submitting, error, onClose, onChange, onSubmit }: EnquiryModalProps) {
  const isServiceForm = Boolean(form.service);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="landing-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <section className="landing-login-modal landing-enquiry-modal" role="dialog" aria-modal="true" aria-labelledby="enquiry-modal-title">
        <button className="landing-modal-close" type="button" aria-label="Close enquiry form" onClick={onClose} disabled={submitting}><X size={18} /></button>
        {submitted ? (
          <div className="landing-enquiry-success" role="status">
            <span className="landing-modal-mark"><Check size={20} /></span>
            <strong id="enquiry-modal-title">Thanks for reaching out.</strong>
            <p>Our team will review your enquiry and get back to you shortly.</p>
            <button className="landing-modal-submit" type="button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="landing-modal-heading">
              <span className="landing-modal-mark"><MessageCircle size={19} /></span>
              <div><strong id="enquiry-modal-title">{isServiceForm ? "We are here to serve you" : "Start a conversation"}</strong><span>{isServiceForm ? "Let us know your requirement" : "Tell us how we can support your operation"}</span></div>
            </div>
            <p className="landing-modal-intro">{isServiceForm ? "Tell us what you need and the Vasudev Fleet team will help you find the right equipment." : "Share a few details and the Vasudev Fleet team will help you find the right next step."}</p>
            <form id="landing-enquiry-form" className={isServiceForm ? "landing-service-enquiry-form" : "landing-enquiry-form"} onSubmit={onSubmit}>
              {isServiceForm ? (
                <ServiceEnquiryFields form={form} onChange={onChange} />
              ) : (
                <>
                  <div className="landing-enquiry-fields">
                    <label><span>Name</span><input value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Your full name" autoComplete="name" required /></label>
                    <label><span>Company</span><span className="landing-enquiry-input"><Building2 size={15} /><input value={form.company} onChange={(event) => onChange("company", event.target.value)} placeholder="Your company name" autoComplete="organization" required /></span></label>
                    <label><span>Email</span><span className="landing-enquiry-input"><Mail size={15} /><input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} placeholder="you@company.com" autoComplete="email" required /></span></label>
                    <label><span>Phone</span><span className="landing-enquiry-input"><Phone size={15} /><input type="tel" value={form.phone} onChange={(event) => onChange("phone", event.target.value)} placeholder="+91 98765 43210" autoComplete="tel" required /></span></label>
                    <label><span>From location</span><input value={form.fromLocation} onChange={(event) => onChange("fromLocation", event.target.value)} placeholder="Pickup city or site" required /></label>
                    <label><span>To location</span><input value={form.toLocation} onChange={(event) => onChange("toLocation", event.target.value)} placeholder="Destination city or site" required /></label>
                    <label><span>Material weight (in tons)</span><input value={form.materialWeight} onChange={(event) => onChange("materialWeight", event.target.value)} placeholder="e.g. 10 tons" required /></label>
                    <label><span>Material dimensions</span><input value={form.materialDimensions} onChange={(event) => onChange("materialDimensions", event.target.value)} placeholder="e.g. 20 x 8 x 9 ft" required /></label>
                    <label><span>Vehicle type</span><select value={form.vehicleType} onChange={(event) => onChange("vehicleType", event.target.value)} required><option value="" disabled>Select vehicle type</option><option value="Low Bed">Low Bed</option><option value="Semi Bed">Semi Bed</option><option value="High Bed">High Bed</option></select></label>
                  </div>
                  <label><span>Enquiry / message</span><textarea value={form.message} onChange={(event) => onChange("message", event.target.value)} placeholder="Tell us what you would like to explore" rows={4} required /></label>
                  <label><span>When do you need the service?</span><input type="date" value={form.serviceDate} onChange={(event) => onChange("serviceDate", event.target.value)} required /></label>
                  <label><span>Referral code</span><input value={form.referral} onChange={(event) => onChange("referral", event.target.value)} placeholder="Enter referral code" /></label>
                </>
              )}
              {error && <p className="landing-modal-error" role="alert">{error}</p>}
            </form>
            <div className="landing-enquiry-actions-sticky">
              <button className="landing-modal-submit" type="submit" form="landing-enquiry-form" disabled={submitting}>{submitting ? "Sending enquiry…" : isServiceForm ? "Submit" : "Send enquiry"} {!submitting && <ArrowRight size={16} />}</button>
              <a className="landing-enquiry-whatsapp" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Prefer WhatsApp? Chat with our team</a>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function LandingPage() {
  const landingPageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquirySubmitted, setEnquirySubmitted] = useState(false);
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);
  const [enquiryError, setEnquiryError] = useState("");
  const [enquiryForm, setEnquiryForm] = useState<EnquiryFormData>(EMPTY_ENQUIRY_FORM);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activeOfficeTeam, setActiveOfficeTeam] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    const page = landingPageRef.current;
    const hero = heroRef.current;
    if (!page || !hero) return;

    const updateBackToTopVisibility = () => {
      setShowBackToTop(page.scrollTop > hero.offsetTop + hero.offsetHeight);
    };
    updateBackToTopVisibility();
    page.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    return () => page.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);

  const scrollToTop = () => {
    landingPageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenEnquiry = (service = "") => {
    setEnquirySubmitted(false);
    setEnquiryError("");
    setEnquiryForm({ ...EMPTY_ENQUIRY_FORM, service });
    setEnquiryOpen(true);
  };

  const handleCloseEnquiry = () => {
    if (!isSubmittingEnquiry) setEnquiryOpen(false);
  };

  const handleEnquiryChange = (field: keyof EnquiryFormData, value: string) => {
    setEnquiryForm((current) => ({ ...current, [field]: value }));
  };

  const handleEnquirySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnquiryError("");
    setIsSubmittingEnquiry(true);
    try {
      await saveEnquiry({
        name: enquiryForm.name.trim(),
        company: enquiryForm.company.trim(),
        email: enquiryForm.email.trim(),
        phone: enquiryForm.phone.trim(),
        referral: enquiryForm.referral.trim(),
        fromLocation: enquiryForm.fromLocation.trim(),
        toLocation: enquiryForm.toLocation.trim(),
        materialWeight: enquiryForm.materialWeight.trim(),
        materialDimensions: enquiryForm.materialDimensions.trim(),
        vehicleType: enquiryForm.vehicleType,
        service: enquiryForm.service,
        message: enquiryForm.message.trim(),
        duration: enquiryForm.duration,
        preferredBrand: enquiryForm.preferredBrand,
        equipment: enquiryForm.equipment,
        serviceDate: enquiryForm.serviceDate,
      });
      setEnquirySubmitted(true);
      setEnquiryForm(EMPTY_ENQUIRY_FORM);
    } catch {
      setEnquiryError("We couldn’t send your enquiry right now. Please try again or use WhatsApp.");
    } finally {
      setIsSubmittingEnquiry(false);
    }
  };

  const handleOpenLogin = () => {
    setSignInError("");
    setLoginOpen(true);
  };

  const handleCloseLogin = () => {
    if (!isSigningIn) setLoginOpen(false);
  };

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignInError("");
    setIsSigningIn(true);
    try {
      await signInWithEmail(email.trim(), password);
      setLoginOpen(false);
    } catch (error) {
      setSignInError(getSignInErrorMessage(error));
    } finally {
      setIsSigningIn(false);
    }
  };


  return (
    <div ref={landingPageRef} className="landing-page">
      <header className={`landing-header${mobileNavOpen ? " mobile-nav-open" : ""}`}>
        <a className="landing-brand" href="#top" aria-label="Vasudev Fleet home" onClick={() => setMobileNavOpen(false)}>
          <span className="landing-brand-logo"><img src="/vasudev-logo.webp" alt="Vasudev Fleet logo" /></span>
          <span className="landing-brand-copy"><strong>VASUDEV FLEET</strong><small>OPERATIONS PLATFORM</small></span>
        </a>
        <nav id="landing-navigation" className="landing-nav" aria-label="Landing page navigation">
          <a href="#top" onClick={() => setMobileNavOpen(false)}>Home</a>
          <a href="#about-us" onClick={() => setMobileNavOpen(false)}>About</a>
          <a href="#services" onClick={() => setMobileNavOpen(false)}>Services</a>
          <a href="#fleet-showcase" onClick={() => setMobileNavOpen(false)}>Fleet</a>
          <a href="#office-team" onClick={() => setMobileNavOpen(false)}>Team</a>
          <a href="#testimonials-title" onClick={() => setMobileNavOpen(false)}>Testimonials</a>
          <a href="#clients" onClick={() => setMobileNavOpen(false)}>Clients</a>
          <a href="#enquiry" onClick={(event) => { event.preventDefault(); setMobileNavOpen(false); handleOpenEnquiry(); }}>Enquiry</a>
          <button className="landing-mobile-login" type="button" onClick={() => { setMobileNavOpen(false); handleOpenLogin(); }} aria-haspopup="dialog">
            Sign in <ArrowRight size={15} />
          </button>
        </nav>
        <div className="landing-header-actions">
          <span className="landing-system-status"><i /> SYSTEMS OPERATIONAL</span>
          <button className="landing-login-link" onClick={handleOpenLogin} aria-haspopup="dialog">
            Sign in <ArrowRight size={15} />
          </button>
          <button className="landing-menu-toggle" type="button" aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"} aria-controls="landing-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {mobileNavOpen && <button className="landing-menu-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} />}

      {showBackToTop && (
        <button className="landing-back-to-top" type="button" onClick={scrollToTop} aria-label="Back to top">
          <ChevronUp size={25} strokeWidth={2.5} />
        </button>
      )}
      <a className="landing-whatsapp-float" href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Chat with Vasudev Fleet on WhatsApp">
        <MessageCircle size={19} /><span>WhatsApp</span>
      </a>

      <main id="top">
        <section ref={heroRef} className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span /><strong>LIVE FLEET INTELLIGENCE</strong></p>
            <h1 id="landing-title">Every mile,<br /><em>under control.</em></h1>
            <p className="landing-summary">
              A command center for the teams moving India forward. See every vehicle, protect every delivery, and make better decisions in real time.
            </p>
            <div className="landing-actions">
              <button className="landing-primary-action" onClick={() => handleOpenEnquiry()} aria-haspopup="dialog">
                Enquiry <ArrowRight size={18} />
              </button>
              <a className="landing-text-action" href="#services">Explore our services <ChevronRight size={16} /></a>
            </div>
            <div className="landing-trust-row" aria-label="Platform highlights">
              <span><ShieldCheck size={17} /> Enterprise-grade security</span>
              <span><Radio size={17} /> Real-time visibility</span>
            </div>
          </div>

          <div className="landing-command-card" aria-label="Vasudev Fleet vehicle showcase">
            <div className="command-card-topline">
              <div><span className="command-card-kicker">VASUDEV FLEET</span><strong>Built to keep moving.</strong></div>
              <span className="command-live"><i /> LIVE FLEET</span>
            </div>
            <div className="command-photo">
              <img src={FLEET_HERO_IMAGE_URL} alt="Vasudev Fleet transport vehicle on the road" />
            </div>
            <div className="command-card-bottom">
              <span><i className="indicator running" /> Fleet visibility</span>
              <span><i className="indicator resting" /> Real-time operations</span>
              <a href="#fleet-showcase">View full fleet <ArrowRight size={14} /></a>
            </div>
          </div>
        </section>

        <section className="landing-about" id="about-us" aria-labelledby="about-title">
          <div className="landing-about-copy">
            <h2 id="about-title">About Us</h2>
            <p>TR Vasudev Engineering Private Limited has been a trusted provider of excavator rental and hiring services since 2009. Our services include rental service, hiring services, and trailer service, delivered with quality assurance, high reliability, and market-leading prices.</p>
            <p>We maintain cordial relationships with our clients through experienced engineers, deep industrial experience, and transparent business policies. Guided by knowledgeable professionals and supported by our mentor Mr. Vasudev, our expert team delivers dependable excavator rental and hiring services around customer needs.</p>
          </div>
          <div className="landing-about-image"><img src={ABOUT_US_IMAGE_URL} alt="About TR Vasudev Engineering and its services" /></div>
        </section>

        <section className="landing-directors" id="directors" aria-labelledby="directors-title">
          <div className="landing-directors-copy">
            <p id="directors-title">Distinguished members of the transportation fraternity with vast experience in this field are on the Board of Directors. The Directors have formidable talent and knowledge.</p>
          </div>
          <div className="landing-directors-image">
            <img src={DIRECTORS_IMAGE_URL} alt="Our Directors" loading="lazy" />
          </div>
        </section>

        <section className="landing-services" id="services" aria-labelledby="services-title">
          <div className="landing-section-heading landing-services-heading">
            <p className="landing-eyebrow"><span /><strong>OUR SERVICES</strong></p>
            <h2 id="services-title">Services for every move.</h2>
            <p>Reliable equipment and transport support for the work that keeps India moving.</p>
          </div>
          <div className="landing-services-grid">
            {SERVICE_CARDS.map(({ title, description }, index) => (
              <article className="landing-service-card" key={title}>
                <div className="landing-service-image"><img src={SERVICE_IMAGE_URLS[index]} alt={`${title} service`} loading="lazy" /></div>
                <div className="landing-service-content">
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <button type="button" onClick={() => handleOpenEnquiry(title)} aria-haspopup="dialog">Enquire Now <ArrowRight size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-proof" aria-label="Operational results">
          <div><strong>99.9<span>%</span></strong><p>Platform availability</p></div>
          <div><strong>50M<span>+</span></strong><p>Kilometres monitored</p></div>
          <div><strong>24<span>/</span>7</strong><p>Operational support</p></div>
          <div><strong>1<span> view</span></strong><p>Across every vehicle</p></div>
        </section>

        <FleetVehicleShowcase />

        <section className="landing-office-team" id="office-team" aria-labelledby="office-team-title">
          <div className="landing-section-heading office-team-heading">
            <p className="landing-eyebrow"><span /><strong>OUR OFFICE TEAM</strong></p>
            <h2 id="office-team-title">Our Office Team</h2>
          </div>
          <div className="office-team-slider" aria-live="polite">
            <button className="office-team-nav office-team-nav-previous" type="button" onClick={() => setActiveOfficeTeam((current) => (current - 1 + OFFICE_TEAM_IMAGE_URLS.length) % OFFICE_TEAM_IMAGE_URLS.length)} aria-label="Show previous office team member">
              <ChevronLeft size={25} />
            </button>
            <article className="office-team-slide">
              <img src={OFFICE_TEAM_IMAGE_URLS[activeOfficeTeam]} alt={`Office team member ${activeOfficeTeam + 1}`} />
            </article>
            <button className="office-team-nav office-team-nav-next" type="button" onClick={() => setActiveOfficeTeam((current) => (current + 1) % OFFICE_TEAM_IMAGE_URLS.length)} aria-label="Show next office team member">
              <ChevronRight size={25} />
            </button>
          </div>
          <div className="office-team-dots" aria-label="Choose an office team member">
            {OFFICE_TEAM_IMAGE_URLS.map((url, index) => (
              <button key={url} className={`office-team-dot${index === activeOfficeTeam ? " active" : ""}`} type="button" onClick={() => setActiveOfficeTeam(index)} aria-label={`Show office team member ${index + 1}`} aria-pressed={index === activeOfficeTeam} />
            ))}
          </div>
        </section>

        <section className="landing-testimonials" aria-labelledby="testimonials-title">
          <div className="landing-testimonials-heading">
            <p className="landing-eyebrow"><span /><strong>WHAT OUR CLIENTS SAY</strong></p>
            <h2 id="testimonials-title">Testimonials</h2>
          </div>
          <div className="landing-testimonial-card" key={activeTestimonial} aria-live="polite">
            <span className="landing-testimonial-quote-mark landing-testimonial-quote-open" aria-hidden="true">“</span>
            <p className="landing-testimonial-text">{TESTIMONIALS[activeTestimonial].quote}</p>
            <div className="landing-testimonial-author"><UsersRound size={24} /><strong>{TESTIMONIALS[activeTestimonial].name}</strong></div>
            <span className="landing-testimonial-quote-mark landing-testimonial-quote-close" aria-hidden="true">”</span>
          </div>
          <div className="landing-testimonial-dots" aria-label="Choose a testimonial">
            {TESTIMONIALS.map((testimonial, index) => (
              <button key={testimonial.name} className={`landing-testimonial-dot${index === activeTestimonial ? " active" : ""}`} type="button" onClick={() => setActiveTestimonial(index)} aria-label={`Show testimonial from ${testimonial.name}`} aria-pressed={index === activeTestimonial} />
            ))}
          </div>
        </section>

        <section className="landing-clients" id="clients" aria-labelledby="clients-title">
          <div className="landing-clients-heading">
            <h2 id="clients-title">Our clients</h2>
          </div>
          <div className="landing-clients-marquee" aria-label="Our clients">
            <div className="landing-clients-track">
              {[...CLIENT_LOGO_URLS, ...CLIENT_LOGO_URLS].map((url, index) => (
                <div className="landing-client-logo" key={`${url}-${index}`}>
                  <img src={url} alt="" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top" aria-label="Vasudev Fleet home">
          <span className="landing-brand-logo"><img src="/vasudev-logo.webp" alt="Vasudev Fleet logo" /></span>
          <span className="landing-brand-copy"><strong>Vasudev Fleet</strong><small>Operations platform</small></span>
        </a>
        <p>Operational clarity for every mile.</p>
        <a className="landing-footer-location" href="https://www.google.com/maps/search/?api=1&query=Vasudev+Transport%2C+Kakinada" target="_blank" rel="noreferrer" aria-label="Open Vasudev Transport Kakinada in Google Maps">
          <MapPinned size={16} />
          <span><strong>Vasudev Transport</strong><small>Kakinada office · Open in Google Maps</small></span>
        </a>
        <button onClick={() => handleOpenEnquiry()} aria-haspopup="dialog">Send an enquiry <ArrowRight size={15} /></button>
      </footer>
      {loginOpen && (
        <LoginModal
          email={email}
          password={password}
          signInError={signInError}
          isSigningIn={isSigningIn}
          onClose={handleCloseLogin}
          onSubmit={handleEmailSignIn}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />
      )}
      {enquiryOpen && <EnquiryModal form={enquiryForm} submitted={enquirySubmitted} submitting={isSubmittingEnquiry} error={enquiryError} onClose={handleCloseEnquiry} onChange={handleEnquiryChange} onSubmit={handleEnquirySubmit} />}
    </div>
  );
}
