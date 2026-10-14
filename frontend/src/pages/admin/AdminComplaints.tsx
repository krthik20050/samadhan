import { useText } from '../../hooks/useText';
import React, { useState, useEffect } from 'react';
import { complaintsService } from '../../lib/api';
import type { ComplaintData, ComplaintStatus } from '../../types';
import { COMPLAINT_CATEGORIES } from '../../lib/constants';
import { Badge } from '../../components/common/Badge';
import { ReferenceNumber } from '../../components/common/ReferenceNumber';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import {
  Search,
  Filter,
  Eye,
  UserCheck,
} from 'lucide-react';

export const AdminComplaints: React.FC = () => {
  const tx = useText();
  const [complaints, setComplaints] = useState<ComplaintData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintData | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('in_progress');
  const [officerNote, setOfficerNote] = useState('');

  const loadComplaints = async () => {
    const list = await complaintsService.getAll();
    setComplaints(list);
  };

  useEffect(() => {
    let ignore = false;
    complaintsService.getAll().then((list) => {
      if (!ignore) setComplaints(list);
    });
    // Live sync: Telegram/web submissions land in the same tables; poll so
    // they appear here without a manual refresh.
    const timer = setInterval(() => {
      complaintsService
        .getAll()
        .then((list) => {
          if (!ignore) setComplaints(list);
        })
        .catch(() => {
          /* transient — next tick retries */
        });
    }, 15000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  const handleUpdateStatus = async () => {
    if (!selectedComplaint) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const updated = await complaintsService.updateStatus(
        selectedComplaint.referenceNumber,
        newStatus,
        officerNote
      );
      if (updated) {
        setSelectedComplaint(updated);
        await loadComplaints();
        setOfficerNote('');
      }
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Could not record the action. Try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filtered = complaints.filter((c) => {
    const matchesSearch =
      c.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.route.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.route.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-['Plus_Jakarta_Sans']">
          {tx("Depot Grievance Management")}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {tx("Review, assign, and update investigation records. All passenger identities remain anonymized.")}</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-5 bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] flex flex-col lg:flex-row items-center gap-3">
        <div className="w-full lg:flex-1">
          <Input
            placeholder={tx("Search by reference #, route, or keyword...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-[var(--text-muted)]" />}
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto bg-[var(--surface-primary)] border border-[var(--border-standard)] rounded-[8px] py-2 px-3 text-sm h-[48px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]"
            >
              <option value="all">{tx("All Statuses")}</option>
              <option value="submitted">{tx("Submitted")}</option>
              <option value="assigned">{tx("Assigned")}</option>
              <option value="in_progress">{tx("In Progress")}</option>
              <option value="sla_breached">{tx("SLA Breached")}</option>
              <option value="escalated">{tx("Escalated")}</option>
              <option value="resolved">{tx("Resolved")}</option>
            </select>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto bg-[var(--surface-primary)] border border-[var(--border-standard)] rounded-[8px] py-2 px-3 text-sm h-[48px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]"
          >
            <option value="all">{tx("All Categories")}</option>
            {COMPLAINT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {tx(cat.labelEn)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-standard)] text-[11px] font-mono font-bold uppercase text-[var(--text-muted)] bg-[var(--bg-primary)]">
                <th className="py-2.5 px-3.5">{tx("Reference")}</th>
                <th className="py-2.5 px-3.5">{tx("Route")}</th>
                <th className="py-2.5 px-3.5">{tx("Category")}</th>
                <th className="py-2.5 px-3.5">{tx("Depot")}</th>
                <th className="py-2.5 px-3.5">{tx("Status")}</th>
                <th className="py-2.5 px-3.5">{tx("Contact (Anonymized)")}</th>
                <th className="py-2.5 px-3.5 text-right">{tx("Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-secondary)]">
                    {tx("No grievances matching filters.")}</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-3 px-3.5 font-mono font-medium text-[var(--text-primary)]">
                      <ReferenceNumber value={item.referenceNumber} size="sm" showCopy={false} />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-[var(--text-primary)]">
                        {item.route.origin} → {item.route.destination}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">{item.busNumber}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-[4px] bg-[var(--bg-primary)] border border-[var(--border-standard)] text-[var(--text-primary)]">
                        {tx(item.category.replace(/_/g, ' '))}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[var(--text-secondary)]">
                      {item.assignedDepot?.name || tx('Pending routing')}
                    </td>
                    <td className="py-3 px-3.5">
                      <Badge variant="status" status={item.status} />
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {item.passengerContact?.anonymizedTarget || tx('Confidential')}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedComplaint(item)}
                        icon={<Eye className="w-3.5 h-3.5 text-[var(--brand)]" />}
                      >
                        {tx("Inspect")}</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Details and Officer Status Update */}
      <Modal
        isOpen={!!selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        title={selectedComplaint ? `Grievance ${selectedComplaint.referenceNumber}` : ''}
        maxWidth="lg"
      >
        {selectedComplaint && (
          <div className="space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-standard)]">
              <div className="flex items-center gap-2">
                <Badge variant="status" status={selectedComplaint.status} />
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {tx("SLA:")}{selectedComplaint.slaTargetHours} {tx("Hours Target")}</span>
              </div>
              <time className="text-[11px] font-mono text-[var(--text-muted)]">
                {tx("Logged:")}{selectedComplaint.createdAt.substring(0, 16).replace('T', ' ')}
              </time>
            </div>

            {/* Journey Details */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-[10px] bg-[var(--bg-primary)] border border-[var(--border-standard)] text-sm">
              <div>
                <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">{tx("Route:")}</span>
                <p className="font-bold text-[var(--text-primary)] mt-0.5">
                  {selectedComplaint.route.origin} → {selectedComplaint.route.destination}
                </p>
                {selectedComplaint.route.via && (
                  <p className="text-[12px] text-[var(--text-secondary)]">{tx("Via:")}{selectedComplaint.route.via}</p>
                )}
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">{tx("Assigned Depot:")}</span>
                <p className="font-bold text-[var(--text-primary)] mt-0.5">
                  {selectedComplaint.assignedDepot?.name || 'Unassigned'}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {tx("Officer:")}{selectedComplaint.assignedDepot?.officerInCharge}
                </p>
              </div>
            </div>

            {/* Grievance Statement */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">
                {tx("Complainant Statement:")}</span>
              <p className="p-3.5 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)] text-[var(--text-primary)] text-[13px] leading-relaxed">
                {selectedComplaint.description}
              </p>
            </div>

            {/* Officer Status Action Form */}
            <div className="p-4 rounded-[10px] bg-[var(--surface-secondary)] border border-[var(--border-standard)] space-y-3">
              <h4 className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[var(--brand)]" />
                <span>{tx("Depot Officer Action & Status Progression")}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[var(--text-primary)] font-medium">
                    {tx("Update Status To")}</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                    className="bg-[var(--surface-primary)] border border-[var(--border-standard)] rounded-[8px] py-2 px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]"
                  >
                    <option value="in_progress">{tx("In Progress (Investigation)")}</option>
                    <option value="resolved">{tx("Resolved (Corrective Action Taken)")}</option>
                    <option value="escalated">{tx("Escalate to DTO")}</option>
                    <option value="rejected">{tx("Close / Inapplicable")}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[var(--text-primary)] font-medium">
                    {tx("Depot Action Log Note")}</label>
                  <input
                    type="text"
                    value={officerNote}
                    onChange={(e) => setOfficerNote(e.target.value)}
                    placeholder={tx("e.g. Cleaned bay 2, crew counseled")}
                    className="bg-[var(--surface-primary)] border border-[var(--border-standard)] rounded-[8px] py-2 px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              {statusError && (
                <p className="text-[12px] text-[var(--semantic-error)]">{statusError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleUpdateStatus}
                  isLoading={isUpdatingStatus}
                >
                  {tx("Record Action & Notify Passenger")}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
