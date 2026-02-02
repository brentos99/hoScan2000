import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Store, Stocktake, StoreArea } from '../api';

export default function Stocktakes() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ storeId: '', name: '', pin: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Area selection
  const [storeAreas, setStoreAreas] = useState<StoreArea[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

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

  // Load areas when store is selected
  const handleStoreChange = async (storeId: string) => {
    setForm({ ...form, storeId });
    setSelectedAreaIds([]);
    setStoreAreas([]);

    if (storeId) {
      setLoadingAreas(true);
      try {
        const res = await api.getStoreAreas(storeId);
        setStoreAreas(res.areas);
        // Select all areas by default
        setSelectedAreaIds(res.areas.map((a) => a.id));
      } finally {
        setLoadingAreas(false);
      }
    }
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const selectAllAreas = () => {
    setSelectedAreaIds(storeAreas.map((a) => a.id));
  };

  const selectNoneAreas = () => {
    setSelectedAreaIds([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createStocktake({
        ...form,
        areaIds: selectedAreaIds.length > 0 ? selectedAreaIds : undefined,
      });
      setShowModal(false);
      setForm({ storeId: '', name: '', pin: '', notes: '' });
      setStoreAreas([]);
      setSelectedAreaIds([]);
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
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <h2>New Stocktake</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Store</label>
                <select
                  value={form.storeId}
                  onChange={(e) => handleStoreChange(e.target.value)}
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

              {form.storeId && (
                <div className="form-group">
                  <label>
                    Areas to Include
                    {storeAreas.length > 0 && (
                      <span className="text-muted text-sm" style={{ marginLeft: '0.5rem' }}>
                        ({selectedAreaIds.length} of {storeAreas.length} selected)
                      </span>
                    )}
                  </label>
                  {loadingAreas ? (
                    <div className="text-muted">Loading areas...</div>
                  ) : storeAreas.length === 0 ? (
                    <div className="text-muted">
                      No areas configured for this store.{' '}
                      <Link to="/stores">Configure areas</Link>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-2">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllAreas}>
                          Select All
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={selectNoneAreas}>
                          Select None
                        </button>
                      </div>
                      <div className="area-grid">
                        {storeAreas.map((area) => (
                          <label key={area.id} className="area-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedAreaIds.includes(area.id)}
                              onChange={() => toggleArea(area.id)}
                            />
                            <span className="area-info">
                              <strong>{area.code}</strong>
                              <span>{area.name}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

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

      <style>{`
        .modal-lg {
          max-width: 600px;
        }
        .area-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 0.5rem;
        }
        .area-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #f9f9f9;
          border-radius: 4px;
          cursor: pointer;
        }
        .area-checkbox:hover {
          background: #f0f0f0;
        }
        .area-checkbox input {
          margin: 0;
        }
        .area-info {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .area-info strong {
          font-size: 0.9rem;
        }
        .area-info span {
          font-size: 0.8rem;
          color: #666;
        }
        .mb-2 {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
