import type { Auth, User } from "firebase/auth";

export const auth: Auth | null = null;
export const DEMO_AUTH_STORAGE_KEY = "vasudev-demo-user";
export const DEMO_AUTH_EVENT = "vasudev-demo-auth-changed";

export function getDemoUser(): User | null {
	if (typeof window === "undefined" || !window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)) return null;
	return { uid: "demo-user", email: "demo@vasudevfleet.com", displayName: "Demo Operator" } as User;
}

export type TripRecord = Record<string, any>;
export type TripInput = Record<string, any>;
export type EnquiryRecord = Record<string, any>;
export type FleetUserSummary = Record<string, any>;
export type ManagedEnquiry = Record<string, any>;
export type IssueRecord = Record<string, any>;
export type UserProfile = Record<string, any>;
export type FleetUserRole = string;
export type JobRecord = {
	id: string;
	tripId: string;
	vehicleNumber: string;
	fromLocation: string;
	toLocation: string;
	status: "active" | "delayed" | "completed" | "closed";
	createdAt: string;
	customerCompanyName: string;
};

const emptyUnsubscribe = () => () => {};

export async function getCurrentUserProfile() {
	return null;
}

export async function getTrips(): Promise<TripRecord[]> {
	return [];
}

export async function getTrip(_id: string) {
	return null;
}

export async function saveTrip(trip: TripInput) {
	const savedTrip = { ...trip, documentId: trip.documentId || `trip-${Date.now()}` };
	if (typeof window !== "undefined") {
		const trips = JSON.parse(window.localStorage.getItem("vasudev-trips") ?? "[]");
		window.localStorage.setItem("vasudev-trips", JSON.stringify([...trips, savedTrip]));
	}
	return savedTrip;
}

export async function updateTrip(_id: string, trip: TripInput) {
	return trip;
}

export async function updateTripFields(_id: string, _fields: Record<string, unknown>) {}
export async function uploadTripDocument(_file: File, _purpose?: string) {
	return "";
}
export async function getFleetUsers(): Promise<FleetUserSummary[]> {
	return [];
}
export async function updateFleetUserRole(_uid: string, _role: FleetUserRole) {}
export async function getManagedEnquiries(_isAdmin = false): Promise<ManagedEnquiry[]> {
	return [];
}
export async function getReferralCodes(): Promise<string[]> {
	return [];
}
export async function createReferralCode(): Promise<string> {
	throw new Error("Referral code creation is unavailable in demo mode.");
}
export async function deleteReferralCode(_code: string) {}
export async function createManagedEnquiry(enquiry: EnquiryRecord, _assignee?: FleetUserSummary) {
	return enquiry;
}
export async function assignEnquiry(_id: string, _uid: string, _displayName?: string) {}
export async function markEnquiryNoted(_id: string) {}
export async function saveEnquiry(enquiry: EnquiryRecord) {
	return enquiry;
}
export async function signInWithEmail(email: string, _password: string) {
	if (typeof window !== "undefined") {
		window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, email);
		window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
	}
}
export async function getFleetVehicleImageUrls(): Promise<{ id: number; url: string }[]> {
	return [];
}
export async function createJobFromTrip(trip: TripRecord): Promise<JobRecord> {
	const job: JobRecord = {
		id: `job-${trip.documentId || Date.now()}`,
		tripId: String(trip.documentId || ""),
		vehicleNumber: String(trip.vehicleNumber || "Unassigned"),
		fromLocation: String(trip.fromLocation || "Loading point not set"),
		toLocation: String(trip.toLocation || "Unloading point not set"),
		status: "active",
		createdAt: new Date().toISOString(),
		customerCompanyName: String(trip.customerCompanyName || "Customer not set"),
	};
	if (typeof window !== "undefined") {
		const jobs = JSON.parse(window.localStorage.getItem("vasudev-jobs") ?? "[]");
		window.localStorage.setItem("vasudev-jobs", JSON.stringify([...jobs.filter((item: JobRecord) => item.tripId !== job.tripId), job]));
	}
	return job;
}
export async function getJobs(): Promise<JobRecord[]> {
	if (typeof window === "undefined") return [];
	return JSON.parse(window.localStorage.getItem("vasudev-jobs") ?? "[]") as JobRecord[];
}
export async function updateJobStatus(id: string, status: JobRecord["status"]) {
	if (typeof window === "undefined") return;
	const jobs = await getJobs();
	window.localStorage.setItem("vasudev-jobs", JSON.stringify(jobs.map((job) => job.id === id ? { ...job, status } : job)));
}
export async function createIssue(issue: IssueRecord) {
	return issue;
}
export async function closeIssue(_id: string) {}
export function subscribeToIssues(
	_isAdmin: boolean,
	_onIssues: (issues: IssueRecord[]) => void,
	_onError: (error: Error) => void,
) {
	return emptyUnsubscribe();
}

export function subscribeToEnquiryNotifications(
	_isAdmin: boolean,
	_onEnquiries: (enquiries: ManagedEnquiry[]) => void,
	_onError: (error: Error) => void,
) {
	return emptyUnsubscribe();
}
