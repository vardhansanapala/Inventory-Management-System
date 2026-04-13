import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers, createUser, updateUser, resetUserPassword } from '../api/inventory';
import { SectionCard } from '../components/SectionCard';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles.js';



export function UsersPage({ refreshSetupData }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [resetId, setResetId] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', role: 'ADMIN', isActive: true });
  const [message, setMessage] = useState('');
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H4", location: "UsersPage.jsx:25", message: "users page state", data: { role: currentUser?.role || null, hasResetOverlay: Boolean(resetId) }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
  }, [currentUser?.role, resetId]);

  if (currentUser?.role !== ROLES.SUPER_ADMIN) {
    useEffect(() => navigate('/'), []);
    return null;
  }

  const fetchUsers = async () => {
    try {
      setError('');
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createUser(formData);
      setFormData({ firstName: '', lastName: '', email: '', role: 'ADMIN', isActive: true });
      await fetchUsers();
      setMessage('User created');
      if (refreshSetupData) refreshSetupData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = async (user) => {
    try {
      await updateUser(user._id, formData);
      setEditingId(null);
      await fetchUsers();
      setMessage('User updated');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPw = async () => {
    try {
      await resetUserPassword(resetId, { newPassword: resetPw });
      setResetId(null);
      setResetPw('');
      setMessage('Password reset');
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (user) => {
    setEditingId(user._id);
    setFormData({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive });
  };

  return (
    <div className="page-stack">
      {message && <div className="page-message success">{message}</div>}
      {error && <div className="page-message error">{error}</div>}

      <SectionCard title="Create User" subtitle="Add new admin or employee">
        <form className="form-grid" onSubmit={handleCreate}>
          <input className="input" name="firstName" placeholder="First name" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} required />
          <input className="input" name="lastName" placeholder="Last name" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} required />
          <input className="input" type="email" name="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
          <select className="input" name="role" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
            <option value={ROLES.ADMIN}>{ROLES.ADMIN}</option>
            <option value={ROLES.SUPER_ADMIN}>{ROLES.SUPER_ADMIN}</option>
            <option value={ROLES.EMPLOYEE}>{ROLES.EMPLOYEE}</option>
          </select>
          <label className="checkbox-label">
            <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} />
            Active
          </label>
          <button className="button" type="submit" disabled={loading}>Add User</button>
        </form>
      </SectionCard>

      <SectionCard title="Users List">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    {editingId === user._id ? (
                      <input value={formData.firstName + ' ' + formData.lastName} />
                    ) : (
                      <strong>{user.firstName} {user.lastName}</strong>
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td><StatusPill status={user.role} /></td>
                  <td><StatusPill status={user.isActive ? 'Active' : 'Inactive'} /></td>
                  <td>
                    {editingId === user._id ? (
                      <>
                        <button onClick={() => handleEdit(user)}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(user)}>Edit</button>
                        <button onClick={() => setResetId(user._id)}>Reset Password</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {resetId && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Reset Password</h2>
            <input type="password" placeholder="New Password (min 6 chars)" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
            <div>
              <button onClick={handleResetPw} disabled={resetPw.length < 6}>Reset</button>
              <button onClick={() => setResetId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

