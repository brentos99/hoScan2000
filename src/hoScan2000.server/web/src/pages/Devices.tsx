import { useEffect, useState } from 'react';
import { api, Device } from '../api';

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDevices().then((res) => {
      setDevices(res.devices);
      setLoading(false);
    });
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="page-header">Devices</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Devices</div>
          <div className="value">{devices.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active (Last Hour)</div>
          <div className="value">
            {devices.filter((d) => {
              if (!d.lastSeenAt) return false;
              const diff = Date.now() - new Date(d.lastSeenAt).getTime();
              return diff < 3600000;
            }).length}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Registered Devices</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Platform</th>
              <th>Last Seen</th>
              <th>Sessions</th>
              <th>Total Scans</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>
                  <strong>{device.name}</strong>
                  <div className="text-sm text-muted">{device.deviceIdentifier.slice(0, 20)}...</div>
                </td>
                <td>
                  <span className="badge badge-active">{device.platform}</span>
                </td>
                <td>{formatDate(device.lastSeenAt)}</td>
                <td>{device._count.sessions}</td>
                <td>{device._count.scans.toLocaleString()}</td>
                <td className="text-sm text-muted">
                  {new Date(device.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">No devices registered</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
