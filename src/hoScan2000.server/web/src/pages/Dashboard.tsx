import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Stocktake, Store } from '../api';

export default function Dashboard() {
  const [stores, setStores] = useState<Store[]>([]);
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStores(), api.getStocktakes()])
      .then(([storesRes, stocktakesRes]) => {
        setStores(storesRes.stores);
        setStocktakes(stocktakesRes.stocktakes);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeStocktakes = stocktakes.filter((s) => s.status === 'ACTIVE');
  const totalScans = stocktakes.reduce((sum, s) => sum + (s._count?.scans || 0), 0);
  const totalDevices = stocktakes.reduce((sum, s) => sum + (s._count?.sessions || 0), 0);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="page-header">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Stores</div>
          <div className="value">{stores.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active Stocktakes</div>
          <div className="value">{activeStocktakes.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Scans</div>
          <div className="value">{totalScans.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Connected Devices</div>
          <div className="value">{totalDevices}</div>
        </div>
      </div>

      <div className="card">
        <h2>Active Stocktakes</h2>
        {activeStocktakes.length === 0 ? (
          <p className="text-muted">No active stocktakes</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Store</th>
                <th>Areas</th>
                <th>Scans</th>
                <th>Devices</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeStocktakes.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.store?.name}</td>
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
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Recent Stocktakes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Store</th>
              <th>Status</th>
              <th>Scans</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stocktakes.slice(0, 10).map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.store?.name}</td>
                <td>
                  <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                </td>
                <td>{s._count?.scans || 0}</td>
                <td>
                  <Link to={`/stocktakes/${s.id}`} className="btn btn-secondary btn-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
