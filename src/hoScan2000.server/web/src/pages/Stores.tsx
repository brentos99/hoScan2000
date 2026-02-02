import { useEffect, useState } from 'react';
import { api, Store } from '../api';

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '' });
  const [saving, setSaving] = useState(false);

  const loadStores = () => {
    api.getStores().then((res) => {
      setStores(res.stores);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadStores();
  }, []);

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
      loadStores();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Stores</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Store
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Address</th>
              <th>Timezone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id}>
                <td><strong>{store.code}</strong></td>
                <td>{store.name}</td>
                <td className="text-muted">{store.address || '-'}</td>
                <td className="text-muted text-sm">{store.timezone}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(store.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted">No stores yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
