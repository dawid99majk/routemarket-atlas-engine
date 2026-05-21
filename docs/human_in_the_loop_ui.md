# Human-in-the-Loop UI Architecture

To support the "Human-in-the-Loop" pattern, the frontend should implement a state-aware job management interface.

## 1. ApprovalDashboard
**Role**: Central hub for all tasks requiring human intervention.
- **API Call**: `GET /jobs/pending-approvals`
- **Functionality**: 
  - Displays a list of jobs with status `waiting_for_approval`.
  - Shows `type`, `projectSlug` (extracted from job type), and `currentStep`.
  - Provides a "Review" button that navigates to the specific approval view based on `currentStep`.

## 2. ApprovalView_Plan (POI Verification)
**Role**: Verification and correction of extracted Points of Interest.
- **Context**: Receives `pendingApprovalContext` containing the `poi.geojson` data.
- **Interface**:
  - **Map View**: Visualizes POIs on a map.
  - **Table View**: Editable list of POI names, coordinates, and descriptions.
  - **Actions**:
    - "Delete" POI.
    - "Edit" POI details.
    - "Add" new POI.
  - **Submission**: Calls `POST /jobs/:id/approve` with the updated GeoJSON in `approvalData`.

## 3. ApprovalView_Media (Final Verification)
**Role**: Final check of generated assets before publication.
- **Context**: Receives `pendingApprovalContext` containing the `media/manifest.json`.
- **Interface**:
  - **Asset Preview**: Gallery showing generated images, 3D maps, and the GPX route.
  - **Manifest Editor**: Allows manual overrides for license info or captions.
  - **Submission**: Calls `POST /jobs/:id/approve` with the validated manifest.

## Technical Implementation Notes (Safe Resuming)
- **Polling vs Webhooks**: Use SWR or React Query with a polling interval of 2-5s to check job status after `resume`.
- **Optimistic UI**: When clicking "Approve", transition the local state to `running` immediately to show progress bars.
- **Memory Safety**: The Node.js backend avoids memory leaks by:
  - Not keeping active promises/references for paused jobs.
  - Storing only serializable state in the `JobManager` Map.
  - Re-instantiating the workflow service logic upon `resume`.
