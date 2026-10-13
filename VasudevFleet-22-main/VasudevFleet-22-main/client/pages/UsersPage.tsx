import { FirebaseError } from "firebase/app";
import { RefreshCw, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auth, getCurrentUserProfile, getFleetUsers, updateFleetUserRole, type FleetUserRole, type FleetUserSummary } from "@/firebase";
import { FleetLayout } from "./Index";

type UsersPageProps = {
  onSignOut: () => void;
};

type RoleFeedback = {
  uid: string;
  kind: "success" | "error";
  message: string;
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "Only fleet administrators can view users.";
  }
  return error instanceof Error ? error.message : "Users could not be loaded.";
}

export default function UsersPage({ onSignOut }: UsersPageProps) {
  const [users, setUsers] = useState<FleetUserSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingUid, setUpdatingUid] = useState("");
  const [roleFeedback, setRoleFeedback] = useState<RoleFeedback | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRoleFeedback(null);
    void getCurrentUserProfile().then((profile) => {
      if (active) setIsAdmin(profile?.isAdmin === true || profile?.role === "admin");
    });
    void getFleetUsers().then((nextUsers) => {
      if (active) setUsers(nextUsers);
    }).catch((caughtError) => {
      if (active) setError(errorMessage(caughtError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [reloadKey]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => [user.email, user.displayName, user.uid].some((value) => value.toLowerCase().includes(query)));
  }, [search, users]);

  async function handleRoleChange(userId: string, role: FleetUserRole) {
    if (!isAdmin || auth.currentUser?.uid === userId || updatingUid) return;

    setUpdatingUid(userId);
    setRoleFeedback(null);
    try {
      await updateFleetUserRole(userId, role);
      setUsers((currentUsers) => currentUsers.map((user) => user.uid === userId ? { ...user, role } : user));
      setRoleFeedback({ uid: userId, kind: "success", message: "Saved" });
    } catch (caughtError) {
      const message = caughtError instanceof FirebaseError && caughtError.code === "permission-denied"
        ? "Only administrators can change roles."
        : caughtError instanceof Error ? caughtError.message : "Role could not be updated.";
      setRoleFeedback({ uid: userId, kind: "error", message });
    } finally {
      setUpdatingUid("");
    }
  }

  return (
    <FleetLayout onSignOut={onSignOut} activeNav="Users">
      <div className="users-page trips-page">
        <div className="trips-page-header">
          <div>
            <div className="trips-breadcrumb"><span>Fleet Management</span><span>→</span><strong>Users</strong></div>
            <h1>Users <span className="trips-count">({filteredUsers.length})</span></h1>
            <p>View users registered in this fleet workspace.</p>
          </div>
          <button className="trips-primary-button" type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
            <RefreshCw size={15} /> {loading ? "Refreshing…" : "Refresh Users"}
          </button>
        </div>

        <section className="trips-card">
          <div className="trips-toolbar">
            <label className="trips-search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or UID" />
            </label>
          </div>

          {error && <div className="trips-error"><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}
          <div className="trips-table-wrap">
            <table className="trips-table users-table">
              <thead>
                <tr><th>User</th><th>Email</th><th>Role</th><th>UID</th><th>Created</th><th>Last Sign-in</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="trips-empty"><span className="trips-spinner" />Loading users…</td></tr>}
                {!loading && !error && !filteredUsers.length && <tr><td colSpan={7} className="trips-empty"><Users size={25} /><strong>{users.length ? "No users match your search" : "No users found"}</strong><span>{users.length ? "Try a different search term." : "No users are available in the users collection."}</span></td></tr>}
                {!loading && filteredUsers.map((user) => <tr key={user.uid}>
                  <td><strong>{user.displayName || "Unnamed user"}</strong></td>
                  <td>{user.email || "—"}</td>
                  <td>
                    {isAdmin && auth.currentUser?.uid !== user.uid && user.role ? <>
                      <select
                        className="user-role-select"
                        value={user.role}
                        onChange={(event) => void handleRoleChange(user.uid, event.target.value as FleetUserRole)}
                        disabled={Boolean(updatingUid)}
                        aria-label={`Role for ${user.displayName || user.email || user.uid}`}
                      >
                        <option value="fleet_manager">fleet_manager</option>
                        <option value="admin">admin</option>
                      </select>
                      {updatingUid === user.uid && <span className="user-role-feedback">Saving…</span>}
                      {roleFeedback?.uid === user.uid && <span className={`user-role-feedback ${roleFeedback.kind}`}>{roleFeedback.message}</span>}
                    </> : user.role || "—"}
                  </td>
                  <td><span className="user-uid">{user.uid}</span></td>
                  <td>{formatDate(user.creationTime)}</td>
                  <td>{formatDate(user.lastSignInTime)}</td>
                  <td><span className={`user-status ${user.disabled ? "disabled" : "active"}`}>{user.disabled ? "Disabled" : "Active"}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="trips-pagination-meta"><span>Showing {filteredUsers.length} of {users.length} users</span></div>
        </section>
      </div>
    </FleetLayout>
  );
}
