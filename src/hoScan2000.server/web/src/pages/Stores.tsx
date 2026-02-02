import { useEffect, useState } from 'react';
import { api, Store, StoreArea } from '../api';

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '' });
  const [saving, setSaving] = useState(false);

  // Selected store for editing areas
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeAreas, setStoreAreas] = useState<StoreArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaForm, setAreaForm] = useState({ name: '', code: '', description: '' });

  const loadStores = () => {
    api.getStores().then((res) => {
      setStores(res.stores);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadStores();
  }, []);

  const loadStoreAreas = async (store: Store) => {
    setSelectedStore(store);
    setLoadingAreas(true);
    try {
      const res = await api.getStoreAreas(store.id);
      setStoreAreas(res.areas);
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createStore(form);
      setShowModal(false);
      setForm({ name: '', code: '', address: '' });
      loadStores();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create store');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this store? This will also delete all associated data.')) return;
    try {
      await api.deleteStore(id);
      if (selectedStore?.id === id) {
        setSelectedStore(null);
        setStoreAreas([]);
      }
      loadStores();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    setSaving(true);
    try {
      await api.createStoreArea(selectedStore.id, areaForm);
      setShowAreaModal(false);
      setAreaForm({ name: '', code: '', description: '' });
      loadStoreAreas(selectedStore);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create area');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!selectedStore) return;
    if (!confirm('Delete this area?')) return;
    try {
      await api.deleteStoreArea(selectedStore.id, areaId);
      loadStoreAreas(selectedStore);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="stores-page">
      <div className="page-header">
        <h1>Stores</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Store
        </button>
      </div>

      <div className="stores-layout">
        {/* Store list */}
        <div className="card">
          <h3>Stores</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Address</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr
                  key={store.id}
                  className={selectedStore?.id === store.id ? 'selected' : ''}
                  onClick={() => loadStoreAreas(store)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><strong>{store.code}</strong></td>
                  <td>{store.name}</td>
                  <td className="text-muted">{store.address || '-'}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(store.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">No stores yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Area editor */}
        {selectedStore && (
          <div className="card">
            <div className="page-header" style={{ marginBottom: '1rem' }}>
              <h3>Areas for {selectedStore.name}</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAreaModal(true)}>
                + Add Area
              </button>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              Configure the areas for this store. When creating a stocktake, you can select which areas to include.
            </p>

            {loadingAreas ? (
              <div>Loading areas...</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {storeAreas.map((area) => (
                    <tr key={area.id}>
                      <td><strong>{area.code}</strong></td>
                      <td>{area.name}</td>
                      <td className="text-muted">{area.description || '-'}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteArea(area.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {storeAreas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted">
                        No areas configured. Add areas to use them in stocktakes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Create store modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Store</h2>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label>Store Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="WH01"
                    required
                    maxLength={10}
                  />
                </div>
                <div className="form-group">
                  <label>Store Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Main Warehouse"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address (optional)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Warehouse St"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create area modal */}
      {showAreaModal && (
        <div className="modal-overlay" onClick={() => setShowAreaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Area to {selectedStore?.name}</h2>
            <form onSubmit={handleCreateArea}>
              <div className="form-row">
                <div className="form-group">
                  <label>Area Code</label>
                  <input
                    type="text"
                    value={areaForm.code}
                    onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value.toUpperCase() })}
                    placeholder="A1"
                    required
                    maxLength={10}
                  />
                </div>
                <div className="form-group">
                  <label>Area Name</label>
                  <input
                    type="text"
                    value={areaForm.name}
                    onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                    placeholder="Aisle 1"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={areaForm.description}
                  onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                  placeholder="Front section near entrance"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAreaModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .stores-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 900px) {
          .stores-layout {
            grid-template-columns: 1fr;
          }
        }
        tr.selected {
          background-color: #e3f2fd !important;
        }
        tr:hover {
          background-color: #f5f5f5;
        }
      `}</style>
    </div>
  );
}
