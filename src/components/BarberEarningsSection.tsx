import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
  X,
  CreditCard,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage, formatISTDateString } from '../lib/i18n';
import {
  apiGetBarberEarnings,
  apiSaveBarberBankAccount,
  apiSubmitBarberWithdrawal,
} from '../lib/api';

interface BarberEarningsSectionProps {
  currentUserProfile?: any;
  onNavigatePolicy?: () => void;
}

export const BarberEarningsSection: React.FC<BarberEarningsSectionProps> = ({
  currentUserProfile,
  onNavigatePolicy,
}) => {
  const { tr, formatINR } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Summary state
  const [availableEarnings, setAvailableEarnings] = useState(0);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [totalRefundAdjustments, setTotalRefundAdjustments] = useState(0);
  const [activeReservedAmount, setActiveReservedAmount] = useState(0);
  const [withdrawalRequestsCount, setWithdrawalRequestsCount] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [beneficiary, setBeneficiary] = useState<any | null>(null);

  // Modals state
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState<string>('100');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  // Bank details form
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankError, setBankError] = useState('');

  const fetchEarningsData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await apiGetBarberEarnings();
      setAvailableEarnings(data.availableEarnings ?? 0);
      setPendingEarnings(data.pendingEarnings ?? 0);
      setTotalEarned(data.totalEarned ?? 0);
      setTotalWithdrawn(data.totalWithdrawn ?? 0);
      setTotalRefundAdjustments(data.totalRefundAdjustments ?? 0);
      setActiveReservedAmount(data.activeReservedAmount ?? 0);
      setWithdrawalRequestsCount(data.withdrawalRequestsCount ?? 0);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      setWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
      setBeneficiary(data.beneficiary || null);

      if (data.beneficiary) {
        setHolderName(data.beneficiary.accountHolderName || '');
        setBankName(data.beneficiary.bankName || '');
        setIfsc(data.beneficiary.ifsc || '');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load earnings ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarningsData();
  }, [fetchEarningsData]);

  // Handle Withdrawal Submission
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');

    const num = Number(withdrawAmount);
    if (isNaN(num) || num < 100) {
      setWithdrawError('Minimum withdrawal amount is strictly ₹100.');
      return;
    }
    if (num > availableEarnings) {
      setWithdrawError(`Cannot withdraw ₹${num}. Available eligible balance is ₹${availableEarnings}.`);
      return;
    }
    if (!beneficiary) {
      setWithdrawError('Please add and verify your bank account details first.');
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      const res = await apiSubmitBarberWithdrawal({
        amount: Math.floor(num),
        notes: withdrawNotes.trim(),
      });
      setSuccessToast(`Withdrawal request for ₹${num} submitted successfully (#${res.withdrawal?.id || 'Ref'}).`);
      setWithdrawModalOpen(false);
      setWithdrawNotes('');
      fetchEarningsData();
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      setWithdrawError(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Handle Bank Account Save
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError('');

    if (!holderName.trim() || holderName.trim().length < 3) {
      setBankError('Please enter a valid Account Holder Name (minimum 3 characters).');
      return;
    }
    if (!bankName.trim()) {
      setBankError('Please enter a valid Bank Name.');
      return;
    }
    const cleanAccount = accountNumber.replace(/\s+/g, '');
    if (!/^\d{9,18}$/.test(cleanAccount)) {
      setBankError('Account Number must be between 9 and 18 numeric digits.');
      return;
    }
    if (cleanAccount !== confirmAccountNumber.replace(/\s+/g, '')) {
      setBankError('Account numbers do not match.');
      return;
    }
    const cleanIfsc = ifsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setBankError('Invalid IFSC code format (e.g. HDFC0000001, SBIN0001234).');
      return;
    }

    try {
      setIsSavingBank(true);
      const res = await apiSaveBarberBankAccount({
        accountHolderName: holderName.trim(),
        bankName: bankName.trim(),
        accountNumber: cleanAccount,
        confirmAccountNumber: confirmAccountNumber.replace(/\s+/g, ''),
        ifsc: cleanIfsc,
      });
      setBeneficiary(res.beneficiary);
      setBankModalOpen(false);
      setAccountNumber('');
      setConfirmAccountNumber('');
      setSuccessToast('Bank account details saved and verified successfully.');
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      setBankError(err.message || 'Failed to save bank details.');
    } finally {
      setIsSavingBank(false);
    }
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

      {/* Architecture & Regulatory Notice Banner */}
      <div className="p-5 rounded-2xl bg-[#4A0E17]/60 border border-[#D4AF37]/30 text-xs text-[#FAF7F2] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
          <div>
            <div className="font-serif font-bold text-[#D4AF37] text-sm">
              BarberLo Accounting Ledger & Withdrawal Management Interface
            </div>
            <p className="text-[#FAF7F2]/80 mt-0.5 leading-relaxed">
              This dashboard displays verified, reconciled accounts payable for grooming appointments completed with OTP verification. It is not an unregulated stored-value wallet. Minimum withdrawal is strictly ₹100.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onNavigatePolicy && (
            <button
              onClick={onNavigatePolicy}
              className="px-3.5 py-1.5 rounded-xl bg-[#241719] hover:bg-[#111113] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Earnings Policy</span>
            </button>
          )}
          <button
            onClick={fetchEarningsData}
            disabled={loading}
            className="p-1.5 rounded-xl bg-[#241719] text-[#FFF9E8]/70 hover:text-[#FFF9E8] border border-[#F1E194]/20 cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 6 Key Responsive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Available Earnings */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#2E0B12] to-[#1C0509] border-2 border-[#D4AF37] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#D4AF37]">
              Available Earnings
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-bold font-mono-num text-[#FAF7F2] tracking-tight">
            {formatINR(availableEarnings)}
          </div>
          <p className="text-xs text-[#FAF7F2]/70 mt-2">
            Eligible for immediate withdrawal (Min ₹100)
          </p>
          <div className="mt-4 pt-3 border-t border-[#D4AF37]/20 flex items-center justify-between">
            <button
              onClick={() => {
                setWithdrawError('');
                setWithdrawModalOpen(true);
              }}
              disabled={availableEarnings < 100}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                availableEarnings >= 100
                  ? 'bg-[#D4AF37] hover:bg-[#C29D26] text-[#241719]'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{availableEarnings >= 100 ? 'Request Withdrawal' : 'Min ₹100 Required'}</span>
            </button>
          </div>
        </div>

        {/* 2. Pending Earnings */}
        <div className="p-6 rounded-2xl bg-[#241719] border border-[#F1E194]/20 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#8A8178]">
              Pending Earnings
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F1E194]/10 flex items-center justify-center text-[#F1E194]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono-num text-[#FFF9E8]">
            {formatINR(pendingEarnings)}
          </div>
          <p className="text-xs text-[#8A8178] mt-2">
            Awaiting client service completion & OTP verification
          </p>
        </div>

        {/* 3. Total Earned */}
        <div className="p-6 rounded-2xl bg-[#241719] border border-[#F1E194]/20 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#8A8178]">
              Total Earned
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/60 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono-num text-emerald-400">
            {formatINR(totalEarned)}
          </div>
          <p className="text-xs text-[#8A8178] mt-2">
            Lifetime verified appointment earnings credits
          </p>
        </div>

        {/* 4. Total Withdrawn */}
        <div className="p-6 rounded-2xl bg-[#241719] border border-[#F1E194]/20 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#8A8178]">
              Total Withdrawn
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F1E194]/10 flex items-center justify-center text-[#F1E194]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono-num text-[#FFF9E8]">
            {formatINR(totalWithdrawn)}
          </div>
          <p className="text-xs text-[#8A8178] mt-2">
            Disbursed to your registered bank account
          </p>
        </div>

        {/* 5. Total Refund Adjustments */}
        <div className="p-6 rounded-2xl bg-[#241719] border border-[#F1E194]/20 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#8A8178]">
              Total Refund Adjustments
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-950/60 flex items-center justify-center text-rose-300">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono-num text-rose-300">
            {formatINR(totalRefundAdjustments)}
          </div>
          <p className="text-xs text-[#8A8178] mt-2">
            Cancelled visits & client refund debits
          </p>
        </div>

        {/* 6. Active Withdrawal Requests */}
        <div className="p-6 rounded-2xl bg-[#241719] border border-[#F1E194]/20 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#8A8178]">
              Active Requests
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F1E194]/10 flex items-center justify-center text-[#F1E194]">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono-num text-[#F1E194]">
            {withdrawalRequestsCount}
          </div>
          <p className="text-xs text-[#8A8178] mt-2">
            Reserved for review: {formatINR(activeReservedAmount)}
          </p>
        </div>
      </div>

      {/* Bank Account Details Card */}
      <div className="p-6 rounded-2xl bg-[#241719] border border-[#F1E194]/25 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-serif font-bold text-lg text-[#FAF7F2]">
              Registered Payout Bank Account
            </h3>
            {beneficiary?.isVerified && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified
              </span>
            )}
          </div>
          {beneficiary ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div>
                <span className="text-[#8A8178] block">Bank Name</span>
                <span className="font-semibold text-[#FFF9E8] text-sm">{beneficiary.bankName}</span>
              </div>
              <div>
                <span className="text-[#8A8178] block">Account Holder</span>
                <span className="font-semibold text-[#FFF9E8] text-sm">{beneficiary.accountHolderName}</span>
              </div>
              <div>
                <span className="text-[#8A8178] block">Account Number & IFSC</span>
                <span className="font-mono text-[#D4AF37] font-semibold text-sm">
                  {beneficiary.maskedAccountNumber} · {beneficiary.ifsc}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#8A8178]">
              No payout bank account configured. Add your account details to request withdrawals.
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setBankError('');
            setBankModalOpen(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-[#4A0E17] hover:bg-[#380A12] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          <Building2 className="w-4 h-4" />
          <span>{beneficiary ? 'Update Bank Account' : 'Add Bank Account'}</span>
        </button>
      </div>

      {/* Withdrawal Requests Table */}
      {withdrawals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-[#FAF7F2]">
              Withdrawal Requests History
            </h3>
            <span className="text-xs text-[#8A8178]">
              {withdrawals.length} request(s)
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#F1E194]/20 bg-[#241719]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C0509] text-[#D4AF37] font-semibold border-b border-[#F1E194]/20">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Destination Bank</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">UTR / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1E194]/10 text-[#FFF9E8]/80 font-mono-num">
                {withdrawals.map((w: any) => {
                  let statusBadge = 'bg-amber-950 text-amber-300 border-amber-500/30';
                  if (w.status === 'paid') statusBadge = 'bg-emerald-950 text-emerald-300 border-emerald-500/30';
                  else if (w.status === 'rejected' || w.status === 'failed') statusBadge = 'bg-rose-950 text-rose-300 border-rose-500/30';
                  else if (w.status === 'approved' || w.status === 'processing') statusBadge = 'bg-blue-950 text-blue-300 border-blue-500/30';

                  return (
                    <tr key={w.id} className="hover:bg-[#111113]/40">
                      <td className="py-3 px-4 font-mono font-medium text-[#FFF9E8]">{w.id}</td>
                      <td className="py-3 px-4 text-[#8A8178]">
                        {w.createdAt ? formatISTDateString(w.createdAt) : '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#D4AF37]">{formatINR(w.requestedAmount)}</td>
                      <td className="py-3 px-4">
                        {w.bankName} ({w.maskedAccountNumber})
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                          {w.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#FFF9E8]">
                        {w.utrReference ? (
                          <span className="text-emerald-400 font-bold">UTR: {w.utrReference}</span>
                        ) : w.rejectionReason ? (
                          <span className="text-rose-300">Reason: {w.rejectionReason}</span>
                        ) : (
                          <span className="text-[#8A8178]">In Review (T+1 to T+3)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction History Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF7F2]">
              Professional Earnings Ledger History
            </h3>
            <p className="text-xs text-[#8A8178]">
              Immutable audit records for appointments, fees, adjustments, and withdrawals
            </p>
          </div>
          <span className="text-xs text-[#8A8178]">
            {transactions.length} record(s)
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#241719] border border-[#F1E194]/20 text-center space-y-2">
            <FileText className="w-8 h-8 text-[#8A8178] mx-auto" />
            <p className="text-sm font-semibold text-[#FFF9E8]">No Ledger Transactions Yet</p>
            <p className="text-xs text-[#8A8178] max-w-sm mx-auto">
              Earnings transactions are generated automatically when client appointments are verified and completed with OTP.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#F1E194]/20 bg-[#241719]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C0509] text-[#D4AF37] font-semibold border-b border-[#F1E194]/20">
                <tr>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Appointment ID</th>
                  <th className="py-3 px-4">Date & Time (IST)</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Transaction Type</th>
                  <th className="py-3 px-4">Amount (₹)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1E194]/10 text-[#FFF9E8]/80 font-mono-num">
                {transactions.map((tx: any) => {
                  const isCredit = tx.entryType === 'CREDIT';
                  return (
                    <tr key={tx.transactionId} className="hover:bg-[#111113]/40">
                      <td className="py-3 px-4 font-mono font-medium text-[#FFF9E8]">{tx.transactionId}</td>
                      <td className="py-3 px-4 font-mono text-[#D4AF37]">{tx.appointmentId}</td>
                      <td className="py-3 px-4 text-[#8A8178] whitespace-nowrap">
                        {tx.transactionDate ? formatISTDateString(tx.transactionDate) : '—'}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[#FFF9E8]">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-[#111113] border border-[#F1E194]/20 text-[10px] font-semibold text-[#F1E194]">
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold whitespace-nowrap">
                        <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                          {isCredit ? '+' : '-'}{formatINR(tx.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-900 border border-neutral-700 text-neutral-300">
                          {tx.currentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#8A8178] truncate max-w-xs">
                        {tx.paymentReference}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WITHDRAWAL REQUEST MODAL */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#241719] border border-[#D4AF37]/40 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-6 shadow-2xl relative text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-4">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-serif font-bold text-lg text-[#D4AF37]">
                  Request Payout Withdrawal
                </h3>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="text-[#8A8178] hover:text-[#FFF9E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {withdrawError && (
              <div className="p-3 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-5">
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-[#8A8178]">Available Eligible Balance</span>
                  <span className="font-bold text-[#D4AF37] font-mono-num">{formatINR(availableEarnings)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37] font-bold text-base">₹</span>
                  <input
                    type="number"
                    min="100"
                    max={availableEarnings}
                    step="1"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount (min ₹100)"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-[#111113] border border-[#F1E194]/25 text-[#FFF9E8] font-mono-num font-bold text-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <p className="text-[11px] text-[#8A8178] mt-1">
                  * Minimum withdrawal rule: strictly ₹100.
                </p>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {[100, 250, 500, availableEarnings].map((val, idx) => {
                    if (val > availableEarnings && idx !== 0) return null;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWithdrawAmount(String(Math.min(val, availableEarnings)))}
                        className="px-3 py-1 rounded-lg bg-[#111113] hover:bg-[#1C0509] border border-[#F1E194]/20 text-xs font-semibold text-[#D4AF37] cursor-pointer"
                      >
                        {idx === 3 ? 'Max All' : `₹${val}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Destination Bank Account Preview */}
              <div className="p-4 rounded-xl bg-[#111113] border border-[#F1E194]/15 space-y-2 text-xs">
                <span className="text-[#8A8178] uppercase tracking-wider block font-semibold text-[10px]">
                  Disbursement Destination
                </span>
                {beneficiary ? (
                  <div className="space-y-1 font-mono-num">
                    <div className="font-bold text-[#FFF9E8]">{beneficiary.bankName}</div>
                    <div className="text-[#D4AF37]">{beneficiary.maskedAccountNumber}</div>
                    <div className="text-[#8A8178] text-[11px]">IFSC: {beneficiary.ifsc} · {beneficiary.accountHolderName}</div>
                  </div>
                ) : (
                  <p className="text-rose-400">
                    No bank account configured! Please add bank details first.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-[#8A8178] block mb-1">Notes / Internal Reference (Optional)</label>
                <input
                  type="text"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="e.g., Weekly salon payout"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="text-[11px] text-[#8A8178] leading-relaxed">
                By submitting this request, ₹{withdrawAmount || 0} will be reserved from your available balance. Payouts are reviewed and disbursed directly to your bank account within T+1 to T+3 business days.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-[#111113] hover:bg-[#1a1a1d] text-[#8A8178] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw || availableEarnings < 100 || !beneficiary}
                  className="w-1/2 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29D26] text-[#241719] text-xs font-bold uppercase tracking-wider shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingWithdraw ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BANK ACCOUNT MODAL */}
      {bankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#241719] border border-[#D4AF37]/40 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-6 shadow-2xl relative text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-serif font-bold text-lg text-[#D4AF37]">
                  {beneficiary ? 'Update Bank Account Details' : 'Register Payout Bank Account'}
                </h3>
              </div>
              <button
                onClick={() => setBankModalOpen(false)}
                className="text-[#8A8178] hover:text-[#FFF9E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bankError && (
              <div className="p-3 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{bankError}</span>
              </div>
            )}

            <form onSubmit={handleBankSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[#8A8178] block mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  required
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="As per bank passbook"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[#8A8178] block mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, State Bank of India"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[#8A8178] block mb-1">Account Number (9 – 18 digits) *</label>
                <input
                  type="password"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[#8A8178] block mb-1">Confirm Account Number *</label>
                <input
                  type="text"
                  required
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  placeholder="Re-enter account number"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[#8A8178] block mb-1">IFSC Code (11 alphanumeric characters) *</label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0000001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] font-mono uppercase focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-[#F1E194]/15 text-[11px] text-[#8A8178] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Your bank details are encrypted using AES-256-GCM. Account numbers are masked and never exposed publicly.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-[#111113] hover:bg-[#1a1a1d] text-[#8A8178] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="w-1/2 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29D26] text-[#241719] font-bold uppercase tracking-wider shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSavingBank ? 'Saving...' : 'Save & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
