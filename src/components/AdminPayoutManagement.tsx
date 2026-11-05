import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  X,
  CreditCard,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { useLanguage, formatISTDateString } from '../lib/i18n';
import {
  apiGetAdminPayoutsManagement,
  apiUpdateAdminPayoutStatus,
} from '../lib/api';

export const AdminPayoutManagement: React.FC = () => {
  const { tr, formatINR } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [metrics, setMetrics] = useState<any>({
    totalPendingReviewAmount: 0,
    totalPendingReviewCount: 0,
    totalApprovedAmount: 0,
    totalApprovedCount: 0,
    totalDisbursedAmount: 0,
    totalDisbursedCount: 0,
    totalRejectedCount: 0,
    totalRejectedAmount: 0,
    totalRequestsCount: 0,
  });

  const [requests, setRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [activeModal, setActiveModal] = useState<'reject' | 'pay' | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Reject form
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Pay form
  const [utrReference, setUtrReference] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const fetchPayoutData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await apiGetAdminPayoutsManagement();
      if (data.metrics) setMetrics(data.metrics);
      if (Array.isArray(data.requests)) setRequests(data.requests);
      if (Array.isArray(data.recentAuditLogs)) setAuditLogs(data.recentAuditLogs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load payout management records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayoutData();
  }, [fetchPayoutData]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus =
        statusFilter === 'all' ? true : r.status === statusFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        r.id.toLowerCase().includes(term) ||
        r.barberName?.toLowerCase().includes(term) ||
        r.shopName?.toLowerCase().includes(term) ||
        r.bankName?.toLowerCase().includes(term) ||
        r.utrReference?.toLowerCase().includes(term) ||
        r.ifsc?.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, searchTerm]);

  // Handle Status Update (Under Review / Approved)
  const handleDirectStatusUpdate = async (
    id: string,
    newStatus: 'under_review' | 'approved' | 'processing'
  ) => {
    try {
      setLoading(true);
      await apiUpdateAdminPayoutStatus(id, { status: newStatus });
      setSuccessToast(`Withdrawal #${id} status updated to ${newStatus.replace('_', ' ').toUpperCase()}.`);
      fetchPayoutData();
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update withdrawal status.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Rejection
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !rejectionReason.trim()) return;

    try {
      setIsSubmittingReject(true);
      await apiUpdateAdminPayoutStatus(selectedRequest.id, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
      });
      setSuccessToast(`Withdrawal #${selectedRequest.id} rejected. Reserved ₹${selectedRequest.requestedAmount} released back to barber.`);
      setActiveModal(null);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchPayoutData();
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject withdrawal request.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Submit Payout Disbursement (Mark as Paid with UTR)
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !utrReference.trim()) return;

    try {
      setIsSubmittingPay(true);
      await apiUpdateAdminPayoutStatus(selectedRequest.id, {
        status: 'paid',
        utrReference: utrReference.trim(),
        notes: payoutNotes.trim(),
      });
      setSuccessToast(`Payout #${selectedRequest.id} marked as PAID with UTR ${utrReference.trim()}.`);
      setActiveModal(null);
      setSelectedRequest(null);
      setUtrReference('');
      setPayoutNotes('');
      fetchPayoutData();
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to mark payout as paid.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!requests.length) return;
    const headers = [
      'Request ID',
      'Barber Name',
      'Shop Name',
      'Requested Amount (INR)',
      'Bank Name',
      'Account Holder',
      'Masked Account Number',
      'IFSC',
      'Status',
      'UTR Reference',
      'Rejection Reason',
      'Created Date',
      'Processed Date',
    ];

    const rows = requests.map((r) => [
      `"${r.id}"`,
      `"${r.barberName || ''}"`,
      `"${r.shopName || ''}"`,
      r.requestedAmount,
      `"${r.bankName || ''}"`,
      `"${r.accountHolderName || ''}"`,
      `"${r.maskedAccountNumber || ''}"`,
      `"${r.ifsc || ''}"`,
      `"${r.status}"`,
      `"${r.utrReference || ''}"`,
      `"${r.rejectionReason || ''}"`,
      `"${r.createdAt || ''}"`,
      `"${r.processedAt || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `barberloo_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast('')}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-sm flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#F1E194]/15">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Financial Administration</span>
          </div>
          <h2 className="font-display text-3xl font-bold text-[#FFF9E8]">
            Barber Payout & Withdrawal Management
          </h2>
          <p className="text-xs text-[#8A8178] mt-1 max-w-2xl leading-relaxed">
            Review partner withdrawal requests, approve banking disbursements, record genuine UTR references, and audit double-entry ledger releases.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportCsv}
            disabled={!requests.length}
            className="px-4 py-2.5 rounded-xl bg-[#241719] hover:bg-[#1C0509] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export Report (CSV)</span>
          </button>
          <button
            onClick={fetchPayoutData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#241719] text-[#FFF9E8]/70 hover:text-[#FFF9E8] border border-[#F1E194]/20 cursor-pointer shadow-md"
            title="Refresh Payouts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Primary Payout Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Review */}
        <div className="p-5 rounded-2xl bg-[#241719] border border-amber-500/30 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-amber-400">
              Pending Review
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#FFF9E8]">
            {formatINR(metrics.totalPendingReviewAmount)}
          </div>
          <p className="text-xs text-[#8A8178] mt-1">
            {metrics.totalPendingReviewCount} request(s) awaiting review
          </p>
        </div>

        {/* Approved / Processing */}
        <div className="p-5 rounded-2xl bg-[#241719] border border-blue-500/30 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-blue-400">
              Approved for Payout
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#FFF9E8]">
            {formatINR(metrics.totalApprovedAmount)}
          </div>
          <p className="text-xs text-[#8A8178] mt-1">
            {metrics.totalApprovedCount} request(s) ready for bank credit
          </p>
        </div>

        {/* Total Disbursed */}
        <div className="p-5 rounded-2xl bg-[#241719] border border-emerald-500/30 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
              Total Disbursed
            </span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-emerald-400">
            {formatINR(metrics.totalDisbursedAmount)}
          </div>
          <p className="text-xs text-[#8A8178] mt-1">
            {metrics.totalDisbursedCount} payout(s) settled with UTR
          </p>
        </div>

        {/* Total Rejected */}
        <div className="p-5 rounded-2xl bg-[#241719] border border-rose-500/30 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-rose-400">
              Rejected / Released
            </span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-rose-400">
            {formatINR(metrics.totalRejectedAmount)}
          </div>
          <p className="text-xs text-[#8A8178] mt-1">
            {metrics.totalRejectedCount} request(s) reversed to barber
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8178]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Barber, Shop, Request ID, Bank or UTR..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#241719] border border-[#F1E194]/20 text-[#FFF9E8] text-xs focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8A8178]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-[#241719] border border-[#F1E194]/20 text-[#FFF9E8] text-xs focus:outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            <option value="all">All Statuses ({requests.length})</option>
            <option value="requested">Requested (New)</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid (Disbursed)</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Payout Requests Management Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#F1E194]/20 bg-[#241719] shadow-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#1C0509] text-[#D4AF37] font-semibold border-b border-[#F1E194]/20">
            <tr>
              <th className="py-3.5 px-4">Request & Date</th>
              <th className="py-3.5 px-4">Barber & Shop</th>
              <th className="py-3.5 px-4">Requested (₹)</th>
              <th className="py-3.5 px-4">Bank Details</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Disbursement Ref / UTR</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1E194]/10 text-[#FFF9E8]/80 font-mono-num">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#8A8178]">
                  No withdrawal requests found matching your filters.
                </td>
              </tr>
            ) : (
              filteredRequests.map((r) => {
                let statusBadge = 'bg-amber-950 text-amber-300 border-amber-500/30';
                if (r.status === 'paid') statusBadge = 'bg-emerald-950 text-emerald-300 border-emerald-500/30';
                else if (r.status === 'rejected' || r.status === 'failed') statusBadge = 'bg-rose-950 text-rose-300 border-rose-500/30';
                else if (r.status === 'approved' || r.status === 'processing') statusBadge = 'bg-blue-950 text-blue-300 border-blue-500/30';

                return (
                  <tr key={r.id} className="hover:bg-[#111113]/40">
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-[#FFF9E8]">{r.id}</div>
                      <div className="text-[10px] text-[#8A8178]">
                        {r.createdAt ? formatISTDateString(r.createdAt) : '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#FFF9E8]">{r.barberName}</div>
                      <div className="text-[11px] text-[#8A8178]">{r.shopName}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-base text-[#D4AF37]">
                      {formatINR(r.requestedAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#FFF9E8]">{r.bankName}</div>
                      <div className="text-[11px] text-[#D4AF37] font-mono">{r.maskedAccountNumber}</div>
                      <div className="text-[10px] text-[#8A8178]">IFSC: {r.ifsc} · {r.accountHolderName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {r.utrReference ? (
                        <span className="text-emerald-400 font-bold block truncate max-w-xs">
                          UTR: {r.utrReference}
                        </span>
                      ) : r.rejectionReason ? (
                        <span className="text-rose-300 block truncate max-w-xs">
                          Reason: {r.rejectionReason}
                        </span>
                      ) : (
                        <span className="text-[#8A8178]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {r.status === 'requested' && (
                          <button
                            type="button"
                            onClick={() => handleDirectStatusUpdate(r.id, 'under_review')}
                            className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Review
                          </button>
                        )}
                        {(r.status === 'requested' || r.status === 'under_review') && (
                          <button
                            type="button"
                            onClick={() => handleDirectStatusUpdate(r.id, 'approved')}
                            className="px-2.5 py-1 rounded-lg bg-blue-950/70 hover:bg-blue-900 border border-blue-500/30 text-blue-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {(r.status === 'approved' || r.status === 'processing') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(r);
                              setUtrReference('');
                              setPayoutNotes('');
                              setActiveModal('pay');
                            }}
                            className="px-3 py-1 rounded-lg bg-[#D4AF37] hover:bg-[#C29D26] text-[#241719] text-[11px] font-bold uppercase tracking-wider cursor-pointer shadow"
                          >
                            Disburse
                          </button>
                        )}
                        {r.status !== 'paid' && r.status !== 'rejected' && r.status !== 'failed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(r);
                              setRejectionReason('');
                              setActiveModal('reject');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Financial Audit Trail */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="font-serif font-bold text-base text-[#FAF7F2]">
              Recent Financial & Payout Audit Trail
            </h3>
          </div>
          <span className="text-xs text-[#8A8178]">
            {auditLogs.length} audit entry(s)
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#F1E194]/20 bg-[#241719]">
          <table className="w-full text-left text-xs font-mono-num">
            <thead className="bg-[#1C0509] text-[#D4AF37] font-semibold border-b border-[#F1E194]/20">
              <tr>
                <th className="py-2.5 px-4">Timestamp (IST)</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1E194]/10 text-[#FFF9E8]/80 text-[11px]">
              {auditLogs.slice(0, 15).map((log) => (
                <tr key={log.id} className="hover:bg-[#111113]/40">
                  <td className="py-2.5 px-4 text-[#8A8178] whitespace-nowrap">
                    {log.createdAt ? formatISTDateString(log.createdAt) : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-[#D4AF37]">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-4">
                    {log.actorRole} ({log.actorUid.slice(0, 8)}...)
                  </td>
                  <td className="py-2.5 px-4 font-mono text-neutral-400">
                    {log.entityType} ({log.entityId.slice(0, 10)}...)
                  </td>
                  <td className="py-2.5 px-4 font-bold">
                    {log.amount > 0 ? formatINR(log.amount) : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-[#8A8178] truncate max-w-xs">
                    {log.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REJECT WITHDRAWAL MODAL */}
      {activeModal === 'reject' && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#241719] border border-rose-500/40 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="font-serif font-bold text-lg text-rose-300">
                  Reject Withdrawal Request
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[#8A8178] hover:text-[#FFF9E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Rejecting withdrawal request <strong>#{selectedRequest.id}</strong> (₹{selectedRequest.requestedAmount}) will automatically release the reserved funds back into the barber's available balance and notify them.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[#8A8178] block mb-1">
                  Mandatory Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Bank account name mismatch with KYC / Incorrect IFSC code"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-rose-500/30 text-[#FFF9E8] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-[#111113] text-[#8A8178] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReject || !rejectionReason.trim()}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReject ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSE / RECORD PAYOUT MODAL */}
      {activeModal === 'pay' && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#241719] border border-[#D4AF37]/40 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-4">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-serif font-bold text-lg text-[#D4AF37]">
                  Record Bank Payout Disbursement
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[#8A8178] hover:text-[#FFF9E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#111113] border border-[#F1E194]/15 space-y-1.5 text-xs font-mono-num">
              <div className="flex justify-between">
                <span className="text-[#8A8178]">Amount to Disburse:</span>
                <span className="text-[#D4AF37] font-bold text-base">{formatINR(selectedRequest.requestedAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8178]">Barber:</span>
                <span className="text-[#FFF9E8] font-sans">{selectedRequest.barberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8178]">Bank:</span>
                <span className="text-[#FFF9E8]">{selectedRequest.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8178]">Account & IFSC:</span>
                <span className="text-[#FFF9E8]">{selectedRequest.maskedAccountNumber} ({selectedRequest.ifsc})</span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[#8A8178] block mb-1">
                  Bank Transaction Reference / UTR Number *
                </label>
                <input
                  type="text"
                  required
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  placeholder="e.g. HDFC2026110412345678 or CMS009281726"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/25 text-[#FFF9E8] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="text-[11px] text-[#8A8178] mt-1">
                  * A genuine bank UTR or RazorpayX reference is strictly required.
                </p>
              </div>

              <div>
                <label className="text-[#8A8178] block mb-1">Payment Notes (Optional)</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Cleared via corporate netbanking"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-[#111113] text-[#8A8178] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay || !utrReference.trim()}
                  className="w-1/2 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29D26] text-[#241719] font-bold uppercase tracking-wider shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPay ? 'Recording...' : 'Mark Disbursed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
