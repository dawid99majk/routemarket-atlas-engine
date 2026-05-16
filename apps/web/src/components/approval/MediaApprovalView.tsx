import React, { useState } from 'react';

interface MediaAsset {
  path: string;
  type: 'image' | 'video' | 'map';
  label: string;
  license?: string;
}

interface MediaApprovalProps {
  jobId: string;
  manifest: {
    assets: MediaAsset[];
    gpxFile: string;
  };
  onComplete: () => void;
}

export const MediaApprovalView: React.FC<MediaApprovalProps> = ({ jobId, manifest, onComplete }) => {
  const [assets, setAssets] = useState(manifest.assets);
  const [submitting, setSubmitting] = useState(false);

  const updateLicense = (index: number, license: string) => {
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], license };
    setAssets(newAssets);
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalData: {
            type: 'final_verification',
            manifest: { ...manifest, assets }
          }
        })
      });
      
      if (res.ok) {
        onComplete();
      } else {
        alert("Failed to approve final media pack");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting final approval");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 rounded-xl shadow-inner border border-slate-200">
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Final Media & GPX Review</h2>
          <p className="text-sm text-slate-500 font-medium">Last check before publishing to RouteMarket.</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={submitting}
            onClick={handleApprove}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            {submitting ? 'Publishing...' : 'READY FOR PUBLISH'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-full bg-white p-4 rounded-lg border border-indigo-100 mb-2">
          <h3 className="text-sm font-bold text-indigo-400 uppercase mb-2">Primary Route Data</h3>
          <div className="flex items-center gap-4 text-indigo-900">
            <div className="p-3 bg-indigo-50 rounded-full">🗺️</div>
            <div>
              <p className="font-mono text-sm">{manifest.gpxFile}</p>
              <p className="text-xs text-indigo-400">Verified GPX track included</p>
            </div>
          </div>
        </div>

        {assets.map((asset, idx) => (
          <div key={idx} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 group">
            <div className="aspect-video bg-slate-200 flex items-center justify-center text-4xl group-hover:bg-slate-300 transition-colors">
              {asset.type === 'image' ? '🖼️' : asset.type === 'video' ? '🎬' : '🗺️'}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">{asset.type}</span>
                <p className="text-xs font-mono text-slate-400 truncate w-32">{asset.path}</p>
              </div>
              <h4 className="font-bold text-slate-700 mb-4">{asset.label}</h4>
              
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">License Info</label>
              <select 
                value={asset.license || 'cc-by-4.0'}
                onChange={(e) => updateLicense(idx, e.target.value)}
                className="w-full text-sm border-slate-200 rounded bg-slate-50 p-2"
              >
                <option value="cc-by-4.0">CC BY 4.0</option>
                <option value="cc-by-sa-4.0">CC BY-SA 4.0</option>
                <option value="proprietary">Atlas Proprietary</option>
                <option value="public-domain">Public Domain</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
