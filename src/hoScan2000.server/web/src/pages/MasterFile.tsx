import { useEffect, useState } from 'react';
import { api, Store, MasterItem } from '../api';

export default function MasterFile() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [masterInfo, setMasterInfo] = useState<{ version: string; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [csvText, setCsvText] = useState('');

  useEffect(() => {
    api.getStores().then((res) => {
      setStores(res.stores);
      if (res.stores.length > 0) {
        setSelectedStore(res.stores[0].id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedStore) {
      api.getMasterInfo(selectedStore).then(setMasterInfo).catch(() => setMasterInfo(null));
    }
  }, [selectedStore]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string): MasterItem[] => {
    const lines = text.trim().split('\n');
    const items: MasterItem[] = [];

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('barcode') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols[0]) {
        items.push({
          barcode: cols[0],
          sku: cols[1] || cols[0],
          description: cols[2] || undefined,
          category: cols[3] || undefined,
        });
      }
    }

    return items;
  };

  const handleUpload = async () => {
    if (!selectedStore || !csvText) return;

    const items = parseCsv(csvText);
    if (items.length === 0) {
      alert('No valid items found in CSV');
      return;
    }

    if (!confirm(`Upload ${items.length} barcodes to the master file?`)) return;

    setUploading(true);
    try {
      await api.uploadMaster(selectedStore, items);
      alert(`Successfully uploaded ${items.length} barcodes`);
      setCsvText('');
      // Refresh master info
      const info = await api.getMasterInfo(selectedStore);
      setMasterInfo(info);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="page-header">Master File</h1>

      <div className="card">
        <h2>Select Store</h2>
        <div className="form-group">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            style={{ maxWidth: 300 }}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {masterInfo && (
          <div className="mt-4">
            <p><strong>Current Version:</strong> {masterInfo.version}</p>
            <p><strong>Barcode Count:</strong> {masterInfo.count.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Upload Master File</h2>
        <p className="text-muted mb-4">
          Upload a CSV file with barcode data. Expected format: barcode, sku, description, category
        </p>

        <div className="form-group">
          <label>Select CSV File</label>
          <input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
        </div>

        <div className="form-group">
          <label>Or paste CSV data directly</label>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="barcode,sku,description,category&#10;9300675024235,SKU001,Product A,Category 1&#10;9300675024242,SKU002,Product B,Category 1"
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        {csvText && (
          <div className="mt-4">
            <p className="text-sm text-muted">
              Preview: {parseCsv(csvText).length} items found
            </p>
          </div>
        )}

        <button
          className="btn btn-primary mt-4"
          onClick={handleUpload}
          disabled={!csvText || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Master File'}
        </button>
      </div>

      <div className="card">
        <h2>CSV Format</h2>
        <p className="text-muted">Your CSV file should have the following columns:</p>
        <table className="table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>barcode</code></td>
              <td>Yes</td>
              <td>The barcode value (EAN-13, UPC, etc.)</td>
            </tr>
            <tr>
              <td><code>sku</code></td>
              <td>Yes</td>
              <td>Product SKU or internal code</td>
            </tr>
            <tr>
              <td><code>description</code></td>
              <td>No</td>
              <td>Product description</td>
            </tr>
            <tr>
              <td><code>category</code></td>
              <td>No</td>
              <td>Product category</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
