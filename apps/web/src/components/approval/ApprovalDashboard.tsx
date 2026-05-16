import React, { useEffect, useState } from 'react';

export type JobStatus = "queued" | "running" | "waiting_for_approval" | "completed" | "failed";

export interface AtlasJob {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  pendingApprovalContext?: any;
  updatedAt: string;
}

export const ApprovalDashboard: React.FC = () => {
  const [pendingJobs, setPendingJobs] = useState<AtlasJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/jobs/pending-approvals');
      const data = await res.json();
      setPendingJobs(data.jobs);
    } catch (err) {
      console.error("Failed to fetch pending approvals", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading approvals...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Human-in-the-Loop Approvals</h1>
      
      {pendingJobs.length === 0 ? (
        <div className="bg-gray-100 p-8 text-center rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No tasks currently require your approval.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingJobs.map(job => (
            <div key={job.id} className="bg-white p-4 rounded-lg shadow border border-yellow-200 flex justify-between items-center">
              <div>
                <span className="text-xs font-mono text-gray-400">{job.id}</span>
                <h3 className="font-semibold text-lg">{job.type.split(':')[1] || job.type}</h3>
                <p className="text-sm text-gray-600">
                  Step: <span className="font-medium text-yellow-700">{job.currentStep}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Waiting since</p>
                  <p className="text-sm">{new Date(job.updatedAt).toLocaleTimeString()}</p>
                </div>
                <button 
                  onClick={() => window.location.hash = `#/approve/${job.id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Review & Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
