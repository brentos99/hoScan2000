import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Store, Stocktake } from '../api';

export default function Stocktakes() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ storeId: '', name: '', pin: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    Promise.all([api.getStocktakes(filter), api.getStores()])
      .then(([stocktakesRes, storesRes]) => {
        setStocktakes(stocktakesRes.stocktakes);
        setStores(storesRes.stores);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createStocktake(form);
      setShowModal(false);
      setForm({ storeId: '', name: '', pin: '', notes: '' });
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const generatePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setForm({ ...form, pin });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Stocktakes</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Stocktake
        </button>
      </div>

      <div className="card mb-4">
        <div className="flex gap-2">
          <button
            className={`btn ${filter === '' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          <button
            className={`btn ${filter === 'ACTIVE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('ACTIVE')}
          >
            Active
          </button>
          <button
            className={`btn ${filter === 'DRAFT' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('DRAFT')}
          >
            Draft
          </button>
          <button
            className={`btn ${filter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('COMPLETED')}
          >
            Completed
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Store</th>
              <th>Status</th>
              <th>Areas</th>
              <th>Scans</th>
              <th>Devices</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stocktakes.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  {s.notes && <div className="text-sm text-muted">{s.notes}</div>}
                </td>
                <td>{s.store?.name} ({s.store?.code})</td>
                <td>
                  <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                </td>
                <td>{s._count?.areas || 0}</td>
                <td>{s._count?.scans || 0}</td>
                <td>{s._count?.sessions || 0}</td>
                <td>
                  <Link to={`/stocktakes/${s.id}`} className="btn btn-secondary btn-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {stocktakes.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted">No stocktakes found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Stocktake</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Store</label>
                <select
                  value={form.storeId}
                  onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                  required
                >
                  <option value="">Select store...</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Stocktake Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Q1 2025 Full Stocktake"
                  required
                />
              </div>
              <div className="form-group">
                <label>PIN Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="1234"
                    required
                    maxLength={6}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={generatePin}>
                    Generate
                  </button>
                </div>
                <small className="text-muted">Devices use this PIN to join the stocktake</small>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any notes about this stocktake..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Stocktake'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
