import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Filter,
} from 'lucide-react';
import { JobApplication, ApplicationStatus, APPLICATION_STATUS_COLORS } from '../../types/applications';
import { downloadApplicationsCsv } from '../../utils/csvExport';

interface ApplicationsTabProps {
  applications: JobApplication[];
  jobTrackerEnabled: boolean;
  onSaveApplications: (applications: JobApplication[]) => void;
  onToggleJobTracker: (enabled: boolean) => void;
}

const ALL_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Interviewing',
  'Offer',
  'Bookmarked',
  'Rejected',
];

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({
  applications,
  jobTrackerEnabled,
  onSaveApplications,
  onToggleJobTracker,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Manual Add Form State
  const [newCompany, setNewCompany] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('Applied');
  const [newNotes, setNewNotes] = useState('');

  // Confirmation modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = applications.length;
    const applied = applications.filter((a) => a.status === 'Applied').length;
    const interviewing = applications.filter((a) => a.status === 'Interviewing').length;
    const offers = applications.filter((a) => a.status === 'Offer').length;
    const rejected = applications.filter((a) => a.status === 'Rejected').length;
    const bookmarked = applications.filter((a) => a.status === 'Bookmarked').length;
    const responseRate = total > 0 ? Math.round(((interviewing + offers) / total) * 100) : 0;
    return { total, applied, interviewing, offers, rejected, bookmarked, responseRate };
  }, [applications]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => {
        const matchesSearch =
          !searchQuery.trim() ||
          app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (app.location && app.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (app.notes && app.notes.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.appliedDate || 0).getTime() - new Date(a.appliedDate || 0).getTime());
  }, [applications, searchQuery, statusFilter]);

  const handleStatusChange = (id: string, newStat: ApplicationStatus) => {
    const updated = applications.map((app) =>
      app.id === id ? { ...app, status: newStat, updatedAt: new Date().toISOString() } : app
    );
    onSaveApplications(updated);
  };

  const handleDelete = (id: string) => {
    const updated = applications.filter((app) => app.id !== id);
    onSaveApplications(updated);
    setDeleteConfirmId(null);
  };

  const handleClearAll = () => {
    onSaveApplications([]);
    setClearAllConfirm(false);
  };

  const handleSaveNotes = (id: string) => {
    const updated = applications.map((app) =>
      app.id === id ? { ...app, notes: tempNotes.trim(), updatedAt: new Date().toISOString() } : app
    );
    onSaveApplications(updated);
    setEditingNotesId(null);
  };

  const handleCreateManualApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newTitle.trim()) return;

    const newApp: JobApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company: newCompany.trim(),
      title: newTitle.trim(),
      url: newUrl.trim() || window.location.href,
      appliedDate: new Date().toISOString(),
      status: newStatus,
      location: newLocation.trim() || undefined,
      salary: newSalary.trim() || undefined,
      notes: newNotes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSaveApplications([newApp, ...applications]);
    setIsAddModalOpen(false);
    // Reset form
    setNewCompany('');
    setNewTitle('');
    setNewUrl('');
    setNewLocation('');
    setNewSalary('');
    setNewStatus('Applied');
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Privacy & Master Toggle */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Job Application Tracker</h2>
            <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
              100% Local Storage
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track and manage jobs you apply to with 1 click from the QuickFiller drawer. Zero server sync or external tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">Drawer Tracker:</span>
          <button
            onClick={() => onToggleJobTracker(!jobTrackerEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden ${
              jobTrackerEnabled ? 'bg-sky-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                jobTrackerEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-slate-800">
            {jobTrackerEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Total Tracked</span>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{metrics.total}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-xs bg-sky-50/20">
          <span className="text-[11px] font-medium text-sky-600">Applied</span>
          <p className="text-xl font-bold text-sky-700 mt-0.5">{metrics.applied}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-xs bg-purple-50/20">
          <span className="text-[11px] font-medium text-purple-600">Interviewing</span>
          <p className="text-xl font-bold text-purple-700 mt-0.5">{metrics.interviewing}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-medium text-emerald-600">Offers</span>
          <p className="text-xl font-bold text-emerald-700 mt-0.5">{metrics.offers}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-slate-500">Interview Rate</span>
          <p className="text-xl font-bold text-slate-700 mt-0.5">{metrics.responseRate}%</p>
        </div>
      </div>

      {/* Action Bar: Search, Status Filter & Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company, role, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Application
          </button>
          <button
            onClick={() => downloadApplicationsCsv(applications)}
            disabled={applications.length === 0}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download applications as CSV for Excel, Google Sheets, or Notion"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Status:
        </span>
        {['All', ...ALL_STATUSES].map((st) => {
          const isActive = statusFilter === st;
          const count =
            st === 'All'
              ? applications.length
              : applications.filter((a) => a.status === st).length;
          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-full font-medium transition text-[11px] whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st} <span className="opacity-70 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Applications Table / Card List */}
      {filteredApplications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-100 text-sky-600 mx-auto flex items-center justify-center mb-3">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            {applications.length === 0
              ? 'No Job Applications Tracked Yet'
              : 'No Applications Match Your Filters'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
            {applications.length === 0
              ? 'Whenever you visit an ATS job post (Greenhouse, Lever, LinkedIn, Workday, etc.), open the QuickFiller drawer and click "+ Track Job" to log it here automatically.'
              : 'Try clearing your search query or switching your status filter.'}
          </p>
          {applications.length === 0 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Application Manually
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 tracking-wider">
                  <th className="py-3 px-3.5 sm:px-4">Company & Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date Applied</th>
                  <th className="py-3 px-3">Notes</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredApplications.map((app) => {
                  const statusStyle =
                    APPLICATION_STATUS_COLORS[app.status] || APPLICATION_STATUS_COLORS.Applied;
                  const isEditingNotes = editingNotesId === app.id;

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/60 transition group">
                      {/* Company & Role */}
                      <td className="py-3 px-3.5 sm:px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{app.company}</span>
                            {app.url && (
                              <a
                                href={app.url}
                                target="_blank"
                                rel="noreferrer"
                                title="Open original job posting"
                                className="text-slate-400 hover:text-sky-600 transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <span className="text-slate-600 text-[11px]">{app.title}</span>
                          {(app.location || app.salary) && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {[app.location, app.salary].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={app.status}
                          onChange={(e) =>
                            handleStatusChange(app.id, e.target.value as ApplicationStatus)
                          }
                          className={`text-[11px] font-semibold px-2 py-1 rounded-full border transition cursor-pointer ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} focus:outline-hidden focus:ring-1 focus:ring-sky-500`}
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Date Applied */}
                      <td className="py-3 px-3 whitespace-nowrap text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            {app.appliedDate
                              ? new Date(app.appliedDate).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Notes with inline editor */}
                      <td className="py-3 px-3 max-w-[200px] sm:max-w-[280px]">
                        {isEditingNotes ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Recruiter, referral, next steps..."
                              autoFocus
                              className="w-full text-xs px-2 py-1 border border-sky-400 rounded focus:outline-hidden"
                            />
                            <button
                              onClick={() => handleSaveNotes(app.id)}
                              className="text-[10px] bg-sky-600 text-white px-2 py-1 rounded font-semibold hover:bg-sky-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="text-[10px] text-slate-500 hover:text-slate-700 px-1 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotesId(app.id);
                              setTempNotes(app.notes || '');
                            }}
                            className="group/note flex items-center gap-1 cursor-pointer text-slate-500 hover:text-slate-800 text-[11px]"
                            title="Click to edit notes"
                          >
                            <span className="truncate max-w-[220px]">
                              {app.notes ? app.notes : <em className="text-slate-400">Add note...</em>}
                            </span>
                            <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover/note:opacity-100 transition" />
                          </div>
                        )}
                      </td>

                      {/* Delete Action */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setDeleteConfirmId(app.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition"
                          title="Delete application"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Purge/Clear */}
          <div className="bg-slate-50/70 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Showing {filteredApplications.length} of {applications.length} applications
            </span>
            {applications.length > 0 && (
              <button
                onClick={() => setClearAllConfirm(true)}
                className="text-red-500 hover:text-red-700 transition font-medium"
              >
                Clear all data
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Application Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-sm">Add Job Application</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualApp} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stripe"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Job Posting URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden bg-white"
                  >
                    {ALL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Remote / NYC"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Salary</label>
                  <input
                    type="text"
                    placeholder="e.g. $140k"
                    value={newSalary}
                    onChange={(e) => setNewSalary(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Recruiter contact, referral, follow-up date..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs px-3.5 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg shadow-xs transition"
                >
                  Save Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-bold text-sm">Delete Application?</h4>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove this application from your tracker? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-xs transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {clearAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-bold text-sm">Clear All Tracked Applications?</h4>
            </div>
            <p className="text-xs text-slate-600">
              This will permanently delete all {applications.length} tracked applications from your local storage.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setClearAllConfirm(false)}
                className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-xs transition"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
