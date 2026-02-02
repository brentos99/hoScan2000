import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Stocktake, Scan, ScansSummary, CreateAreaInput } from '../api';

export default function StocktakeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stocktake, setStocktake] = useState<Stocktake | null>(null);
  const [summary, setSummary] = useState<ScansSummary | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaForm, setAreaForm] = useState<CreateAreaInput>({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const [stocktakeRes, summaryRes, scansRes] = await Promise.all([
        api.getStocktake(id),
        api.getScansSummary(id),
        api.getScans(id, { limit: 50 }),
      ]);
      setStocktake(stocktakeRes.stocktake);
      setSummary(summaryRes);
      setScans(scansRes.scans);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStart = async () => {
    if (!id) return;
    await api.startStocktake(id);
    loadData();
  };

  const handlePause = async () => {
    if (!id) return;
    await api.pauseStocktake(id);
    loadData();
  };

  const handleComplete = async () => {
    if (!id || !confirm('Complete this stocktake? This cannot be undone.')) return;
    await api.completeStocktake(id);
    loadData();
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this stocktake?')) return;
    await api.deleteStocktake(id);
    navigate('/stocktakes');
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await api.createArea(id, areaForm);
      setShowAreaModal(false);
      setAreaForm({ name: '', code: '' });
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add area');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!id || !confirm('Delete this area?')) return;
    try {
      await api.deleteArea(id, areaId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading || !stocktake) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{stocktake.name}</h1>
          <p className="text-muted">
            {stocktake.store?.name} ({stocktake.store?.code})
          </p>
        </div>
        <div className="flex gap-2">
          {stocktake.status === 'DRAFT' && (
            <>
              <button className="btn btn-primary" onClick={handleStart}>
                Start Stocktake
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </>
          )}
          {stocktake.status === 'ACTIVE' && (
            <>
              <button className="btn btn-secondary" onClick={handlePause}>
                Pause
              </button>
              <button className="btn btn-primary" onClick={handleComplete}>
                Complete
              </button>
            </>
          )}
          {stocktake.status === 'PAUSED' && (
            <>
              <button className="btn btn-primary" onClick={handleStart}>
                Resume
              </button>
              <button className="btn btn-secondary" onClick={handleComplete}>
                Complete
              </button>
            </>
          )}
          {stocktake.status === 'COMPLETED' && (
            <a href={api.exportCsv(id!)} className="btn btn-primary" download>
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Status</div>
          <div>
            <span className={`badge badge-${stocktake.status.toLowerCase()}`}>
              {stocktake.status}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Total Scans</div>
          <div className="value">{summary?.totalScans.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Unique Barcodes</div>
          <div className="value">{summary?.uniqueBarcodes.toLocaleString() || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Invalid Scans</div>
          <div className="value">{summary?.invalidScans || 0}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Areas</h2>
          {stocktake.status !== 'COMPLETED' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAreaModal(true)}>
              + Add Area
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
              <th>Scans</th>
              <th>Claimed By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stocktake.areas?.map((area) => (
              <tr key={area.id}>
                <td><strong>{area.code}</strong></td>
                <td>{area.name}</td>
                <td>
                  <span className={`badge badge-${area.status.toLowerCase()}`}>
                    {area.status.replace('_', ' ')}
                  </span>
                </td>
                <td>{area._count?.scans || 0}</td>
                <td className="text-muted">
                  {area.claimedBy?.device.name || '-'}
                </td>
                <td>
                  {stocktake.status === 'DRAFT' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteArea(area.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {stocktake.areas?.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">No areas defined</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Connected Devices</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Status</th>
              <th>Scans</th>
            </tr>
          </thead>
          <tbody>
            {stocktake.sessions?.map((session) => (
              <tr key={session.id}>
                <td>{session.device.name}</td>
                <td>
                  <span className={`badge badge-${session.status.toLowerCase()}`}>
                    {session.status}
                  </span>
                </td>
                <td>{session.scansCount}</td>
              </tr>
            ))}
            {stocktake.sessions?.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted">No devices connected</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Recent Scans</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Qty</th>
              <th>Area</th>
              <th>Device</th>
              <th>Valid</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.id}>
                <td><code>{scan.barcode}</code></td>
                <td>{scan.quantity}</td>
                <td>{scan.area.code}</td>
                <td>{scan.device.name}</td>
                <td>{scan.isValid ? '✓' : '✗'}</td>
                <td className="text-sm text-muted">
                  {new Date(scan.scannedAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {scans.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">No scans yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAreaModal && (
        <div className="modal-overlay" onClick={() => setShowAreaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Area</h2>
            <form onSubmit={handleAddArea}>
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
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAreaModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
