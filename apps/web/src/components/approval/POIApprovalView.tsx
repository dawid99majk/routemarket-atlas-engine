import React, { useState } from 'react';

interface POI {
  type: string;
  properties: {
    name: string;
    description: string;
    category?: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

interface POIApprovalProps {
  jobId: string;
  initialData: {
    type: string;
    features: POI[];
  };
  onComplete: () => void;
}

export const POIApprovalView: React.FC<POIApprovalProps> = ({ jobId, initialData, onComplete }) => {
  const [data, setData] = useState(initialData);
  const [submitting, setSubmitting] = useState(false);

  const updatePOI = (index: number, field: string, value: any) => {
    const newFeatures = [...data.features];
    const poi = { ...newFeatures[index] };
    
    if (field === 'name' || field === 'description') {
      poi.properties = { ...poi.properties, [field]: value };
    }
    
    newFeatures[index] = poi;
    setData({ ...data, features: newFeatures });
  };

  const removePOI = (index: number) => {
    const newFeatures = data.features.filter((_, i) => i !== index);
    setData({ ...data, features: newFeatures });
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalData: {
            type: 'poi_verification',
            data: data
          }
        })
      });
      
      if (res.ok) {
        onComplete();
      } else {
        alert("Failed to approve job");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting approval");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">POI Verification</h2>
          <p className="text-sm text-gray-500">Review and correct the points of interest extracted by AI.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onComplete()}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button 
            disabled={submitting}
            onClick={handleApprove}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Resuming...' : 'Approve & Continue'}
          </button>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {data.features.map((poi, idx) => (
          <div key={idx} className="p-4 border border-gray-200 rounded-lg group relative">
            <button 
              onClick={() => removePOI(idx)}
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Remove
            </button>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Name</label>
                <input 
                  type="text" 
                  value={poi.properties.name}
                  onChange={(e) => updatePOI(idx, 'name', e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div className="col-span-8">
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Description</label>
                <textarea 
                  rows={2}
                  value={poi.properties.description}
                  onChange={(e) => updatePOI(idx, 'description', e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Coords: {poi.geometry.coordinates[1].toFixed(5)}, {poi.geometry.coordinates[0].toFixed(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
