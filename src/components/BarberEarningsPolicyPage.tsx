import React from 'react';
import { ShieldCheck, IndianRupee, Clock, ArrowRight, Building2, CheckCircle2, AlertCircle, FileText, Lock } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface BarberEarningsPolicyPageProps {
  onNavigateHome?: () => void;
  onNavigateBarberDashboard?: () => void;
}

export const BarberEarningsPolicyPage: React.FC<BarberEarningsPolicyPageProps> = ({
  onNavigateHome,
  onNavigateBarberDashboard,
}) => {
  const { tr, formatINR } = useLanguage();

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-neutral-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#4A0E17]/10 text-[#4A0E17] text-xs font-semibold tracking-wider uppercase border border-[#4A0E17]/20">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            Official Platform Financial Policy
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-neutral-900 tracking-tight">
            Barber Earnings & Withdrawal Policy
          </h1>
          <p className="text-neutral-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Transparent, reconciled earnings management and secure bank payout policies for authorized salon partners on BarberLo (Barber-low).
          </p>
          <div className="text-xs text-neutral-500 font-mono">
            Effective Date: November 2026 · Platform Version: 2.4.0
          </div>
        </div>

        {/* Regulatory Disclosure Banner */}
        <div className="bg-[#4A0E17] text-[#FAF7F2] p-6 rounded-2xl shadow-xl border border-[#D4AF37]/30 space-y-3">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-serif font-semibold text-[#D4AF37]">
              Notice Regarding Financial Architecture & Stored-Value Instruments
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
            The <strong>MY EARNINGS</strong> section in the BarberLo dashboard functions strictly as an <strong>accounting ledger and withdrawal management interface</strong>. It is <strong>NOT</strong> an independently operated stored-value wallet, prepaid payment instrument (PPI), or deposit account. BarberLo does not hold customer funds as pooled float or offer unregulated banking services. Available figures represent verified, reconciled accounts payable for grooming services successfully delivered to clients under our platform partner agreement.
          </p>
        </div>

        {/* 1. Minimum Withdrawal Rule */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-neutral-200 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center text-[#4A0E17] font-bold">
              ₹
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-neutral-900">
                1. Minimum Withdrawal Threshold: Strictly ₹100
              </h3>
              <p className="text-xs text-neutral-500">Rigorous dual-layer validation enforced on frontend and backend</p>
            </div>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">
            To prevent micro-transaction fragmentation and ensure banking compliance, barbers can request a withdrawal once their eligible available earnings reach a minimum of <strong>₹100</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Permitted Examples (Available: ₹450)
              </div>
              <ul className="list-disc list-inside space-y-1 text-emerald-800">
                <li>Withdrawal request for <strong>₹100</strong> (Minimum allowed)</li>
                <li>Withdrawal request for <strong>₹250</strong> (Partial withdrawal)</li>
                <li>Withdrawal request for <strong>₹450</strong> (Full eligible balance)</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600" /> Prohibited Requests (Rejected)
              </div>
              <ul className="list-disc list-inside space-y-1 text-rose-800">
                <li>Requests below <strong>₹100</strong> (e.g., ₹50 or ₹99) are strictly rejected</li>
                <li>Requests exceeding available balance (e.g., ₹500 when available is ₹450)</li>
                <li>Duplicate or concurrent withdrawal submissions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 2. Earnings Calculation & Release Milestones */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-neutral-200 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-[#4A0E17]/10 flex items-center justify-center text-[#4A0E17]">
              <IndianRupee className="w-5 h-5 text-[#4A0E17]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-neutral-900">
                2. Transparent Earnings Calculation
              </h3>
              <p className="text-xs text-neutral-500">Service price entitlement and platform fee reconciliation</p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
            <p>
              When a customer books an appointment on BarberLo:
            </p>
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 font-mono text-xs sm:text-sm space-y-1.5 text-neutral-800">
              <div><strong>Customer Total Payment</strong> = Barber Service Price + Platform Convenience Fee</div>
              <div><strong>Barber Earnings</strong> = Barber Service Price - Contractually Applicable Deductions</div>
            </div>
            <p>
              The platform convenience fee (e.g., ₹10) is collected on behalf of BarberLo for payment processing, platform maintenance, and automated SMS/OTP reminders. The full salon service fee belongs to the barber.
            </p>
            <h4 className="font-bold text-neutral-900 pt-2">Milestones Required for Earnings Eligibility:</h4>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li><strong>Verified Online Payment:</strong> Customer payment must be successfully captured via our authorized Razorpay gateway.</li>
              <li><strong>Service Completion:</strong> The grooming service must be physically rendered at the partner salon.</li>
              <li><strong>Cryptographic OTP Verification:</strong> The client presents a unique 6-digit one-time password (OTP) upon visit completion, which the barber verifies on their salon terminal to authoritatively release earnings from pending escrow into available funds.</li>
            </ol>
          </div>
        </div>

        {/* 3. Payout Timelines & Bank Transfers */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-neutral-200 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center text-[#4A0E17]">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-neutral-900">
                3. Payout Timelines & Bank Settlement
              </h3>
              <p className="text-xs text-neutral-500">Processing lifecycle from request to bank credit</p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
            <p>
              Once a withdrawal request is submitted:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li><strong>Reservation:</strong> The requested amount is immediately reserved from available earnings to prevent double-spending or conflicting requests.</li>
              <li><strong>Review (T+1):</strong> The platform finance team verifies appointment completion audits and bank beneficiary details.</li>
              <li><strong>Disbursement (T+1 to T+3 business days):</strong> Payouts are transferred directly to the barber's registered bank account via NEFT, RTGS, IMPS, or RazorpayX direct routing.</li>
              <li><strong>UTR Reference:</strong> A genuine Unique Transaction Reference (UTR) is issued upon successful bank credit and recorded in your permanent ledger.</li>
              <li><strong>Rejection / Failure Protection:</strong> In the rare event a payout is rejected or encounters a banking transmission failure, the reserved amount is automatically and idempotently returned to your available balance.</li>
            </ul>
          </div>
        </div>

        {/* 4. Bank Account & Beneficiary Security */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-neutral-200 space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-[#4A0E17]/10 flex items-center justify-center text-[#4A0E17]">
              <Building2 className="w-5 h-5 text-[#4A0E17]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-neutral-900">
                4. Bank Account Security & Data Privacy
              </h3>
              <p className="text-xs text-neutral-500">Encryption, account masking, and zero public exposure</p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
            <p>
              BarberLo implements enterprise-grade security controls for partner bank account data:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li>Full account numbers are encrypted at rest using AES-256-GCM.</li>
              <li>Account numbers are strictly masked on all screens and API responses (e.g. <code>•••• •••• •••• 1234</code>).</li>
              <li>IFSC validation ensures transfers route only to authorized Reserve Bank of India (RBI) scheduled financial institutions.</li>
              <li>Partner banking credentials are never exposed publicly, never shared with clients, and accessible solely to authorized financial controllers for disbursement reconciliation.</li>
            </ul>
          </div>
        </div>

        {/* 5. Contact & Support */}
        <div className="bg-neutral-100 rounded-2xl p-6 border border-neutral-200 text-xs sm:text-sm text-neutral-700 space-y-2">
          <div className="font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4A0E17]" /> Partner Support & Settlement Assistance
          </div>
          <p>
            For questions regarding payout schedules, UTR verification, or banking updates, contact our dedicated salon partner desk:
          </p>
          <div className="font-mono text-xs pt-1 space-y-1 text-neutral-800">
            <div><strong>Telephone / WhatsApp Support:</strong> +91 73555 42644</div>
            <div><strong>Email:</strong> nexwaveservices@gmail.com</div>
            <div><strong>Operating Hours:</strong> Monday – Saturday, 09:00 – 19:00 IST</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {onNavigateBarberDashboard && (
            <button
              onClick={onNavigateBarberDashboard}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#4A0E17] text-[#FAF7F2] hover:bg-[#380A12] font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              Go to My Earnings Dashboard
              <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
            </button>
          )}
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-neutral-700 hover:bg-neutral-50 font-semibold text-sm transition-all border border-neutral-200"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
