import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { usePayments } from "../hooks/usePayments";
import type { Payment } from "../hooks/usePayments";
import { useUnits } from "../hooks/useUnits";
import { generateLedgerPDF } from "../services/pdfGenerator";
import { Header } from "../components/Header";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Dialog } from "../components/ui/Dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/Table";
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Phone, 
  Mail, 
  Calendar, 
  UserMinus,
  Lock,
  Paperclip,
  Loader2,
  Plus
} from "lucide-react";

export const TenantLedger: React.FC = () => {
  const { propertyId, unitId } = useParams<{ propertyId: string; unitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { payments, loading: paymentsLoading, updatePayment, refresh: refreshPayments } = usePayments(propertyId || "", unitId || "");
  const { vacateUnitFromTenant } = useUnits(propertyId || "");

  const [property, setProperty] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Edit Payment Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [editMaint, setEditMaint] = useState<number | "">(0);
  const [editNego, setEditNego] = useState<number | "">(0);
  const [editLate, setEditLate] = useState<number | "">(0);
  const [editReceived, setEditReceived] = useState<number | "">(0);
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState<"Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Other">("Cash");
  const [editRemarks, setEditRemarks] = useState("");
  const [editFinalized, setEditFinalized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Month Dialog State
  const [isAddMonthOpen, setIsAddMonthOpen] = useState(false);
  const [addMonth, setAddMonth] = useState("");
  const [addRent, setAddRent] = useState<number | "">("");
  const [addMaint, setAddMaint] = useState<number | "">("");
  const [isAddingMonth, setIsAddingMonth] = useState(false);

  // Vacate Dialog State
  const [isVacateOpen, setIsVacateOpen] = useState(false);
  const [isVacating, setIsVacating] = useState(false);

  const fetchMetadata = async () => {
    if (!user || !propertyId || !unitId) return;
    setLoadingMetadata(true);
    try {
      const propRef = doc(db, `users/${user.uid}/properties/${propertyId}`);
      const unitRef = doc(db, `users/${user.uid}/properties/${propertyId}/units/${unitId}`);
      
      const [propSnap, unitSnap] = await Promise.all([getDoc(propRef), getDoc(unitRef)]);
      
      if (propSnap.exists()) setProperty(propSnap.data());
      if (unitSnap.exists()) {
        const uData = unitSnap.data();
        if (uData.occupancyStatus === "vacant" || !uData.tenant) {
          // If vacant, go back to property details
          navigate(`/property/${propertyId}`);
          return;
        }
        setUnit(uData);
      } else {
        navigate(`/property/${propertyId}`);
      }
    } catch (e) {
      console.error("Error fetching metadata:", e);
    } finally {
      setLoadingMetadata(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [user, propertyId, unitId]);

  const handleEditPaymentClick = (payment: Payment) => {
    if (payment.isFinalized) return; // Prevent clicking locked records
    setSelectedPayment(payment);
    setEditMaint(payment.maintenance);
    setEditNego(payment.negotiationDiscount);
    setEditLate(payment.lateFee);
    setEditReceived(payment.amountReceived);
    setEditDate(payment.paymentDate || new Date().toISOString().substring(0, 10));
    setEditMethod(payment.paymentMethod || "Cash");
    setEditRemarks(payment.remarks || "");
    setEditFinalized(payment.isFinalized);
    setIsEditOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setIsSubmitting(true);
    try {
      await updatePayment(selectedPayment.id, {
        expectedRent: selectedPayment.expectedRent, // Lock original expected rent
        maintenance: Number(editMaint),
        negotiationDiscount: Number(editNego),
        lateFee: Number(editLate),
        amountReceived: Number(editReceived),
        paymentDate: Number(editReceived) > 0 ? editDate : null,
        paymentMethod: Number(editReceived) > 0 ? editMethod : null,
        remarks: editRemarks || null,
        isFinalized: editFinalized
      });
      setIsEditOpen(false);
    } catch (e) {
      alert("Failed to update payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddMonth = () => {
    setAddMonth(new Date().toISOString().substring(0, 7));
    setAddRent(unit?.tenant?.rent || "");
    setAddMaint(unit?.tenant?.maintenance || "");
    setIsAddMonthOpen(true);
  };

  const handleAddMonthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMonth) {
      alert("Please select a month.");
      return;
    }
    if (!user || !propertyId || !unitId || !unit?.tenant) return;
    setIsAddingMonth(true);
    try {
      const paymentDocRef = doc(db, `users/${user.uid}/properties/${propertyId}/units/${unitId}/payments/${addMonth}`);
      const paymentSnap = await getDoc(paymentDocRef);
      if (paymentSnap.exists()) {
        alert(`A billing record for ${addMonth} already exists!`);
        setIsAddingMonth(false);
        return;
      }

      const rentVal = Number(addRent) || 0;
      const maintVal = Number(addMaint) || 0;

      const currentMonthStr = new Date().toISOString().substring(0, 7);
      const computedStatus = addMonth < currentMonthStr ? "overdue" : "pending";

      const newPayment = {
        id: addMonth,
        month: addMonth,
        expectedRent: rentVal,
        maintenance: maintVal,
        negotiationDiscount: 0,
        lateFee: 0,
        finalRent: rentVal + maintVal,
        amountReceived: 0,
        paymentDate: null,
        paymentMethod: null,
        remarks: "Manually added billing cycle",
        status: computedStatus,
        isFinalized: false
      };

      await setDoc(paymentDocRef, newPayment);

      await addDoc(collection(db, `users/${user.uid}/activityLog`), {
        action: "payment_added",
        details: `Manually added billing month ${addMonth} for tenant ${unit.tenant.name} (Unit ${unit.unitNumber}): Rent ₹${rentVal}, Maint ₹${maintVal}.`,
        timestamp: serverTimestamp()
      });

      alert(`Successfully added billing cycle.`);
      setIsAddMonthOpen(false);
      await refreshPayments();
    } catch (err: any) {
      alert("Failed to add billing month: " + err.message);
    } finally {
      setIsAddingMonth(false);
    }
  };

  const handleVacate = async () => {
    if (!unitId) return;
    setIsVacating(true);
    try {
      await vacateUnitFromTenant(unitId);
      setIsVacateOpen(false);
      navigate(`/property/${propertyId}`);
    } catch (e) {
      alert("Failed to vacate unit.");
    } finally {
      setIsVacating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!property || !unit || !unit.tenant) return;
    
    // Structure metadata for PDF
    const propMeta = {
      name: property.name,
      location: property.location,
      address: property.address,
      type: property.type
    };

    const unitMeta = {
      unitNumber: unit.unitNumber,
      type: unit.type,
      area: unit.area,
      floor: unit.floor
    };

    const tenantMeta = {
      name: unit.tenant.name,
      phone: unit.tenant.phone,
      email: unit.tenant.email,
      startDate: unit.tenant.startDate,
      endDate: unit.tenant.endDate,
      isContinuing: unit.tenant.isContinuing,
      rent: unit.tenant.rent,
      maintenance: unit.tenant.maintenance,
      advance: unit.tenant.advance,
      deposit: unit.tenant.deposit
    };

    generateLedgerPDF(propMeta, unitMeta, tenantMeta, payments);
  };

  // Calculations for financial summary blocks
  const expectedTotal = payments.reduce((sum, p) => sum + p.finalRent, 0);
  const paidTotal = payments.reduce((sum, p) => sum + p.amountReceived, 0);
  const outstandingBalance = expectedTotal - paidTotal;

  // Format month string (e.g. 2026-07 to July 2026)
  const formatMonthName = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split("-").map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch (e) {
      return monthStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Action */}
        <button 
          onClick={() => navigate(`/property/${propertyId}`)}
          className="flex items-center space-x-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Property Units</span>
        </button>

        {loadingMetadata ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading ledger...</p>
          </div>
        ) : (
          <>
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-3xl font-extrabold tracking-tight">Ledger / {unit?.tenant?.name}</h2>
                  <span className="text-xs font-bold bg-slate-100 dark:bg-slate-900 border border-border px-2.5 py-1 rounded-full text-slate-600">
                    Unit {unit?.unitNumber}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage rent cards, negotiations, and download professional reports.
                </p>
              </div>
              
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <Button 
                  onClick={handleDownloadPDF}
                  className="flex items-center justify-center space-x-2 rounded-xl flex-grow md:flex-grow-0"
                >
                  <Download className="h-4.5 w-4.5" />
                  <span>Download Ledger</span>
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setIsVacateOpen(true)}
                  className="flex items-center justify-center space-x-1.5 rounded-xl flex-grow md:flex-grow-0"
                >
                  <UserMinus className="h-4.5 w-4.5" />
                  <span>Vacate Unit</span>
                </Button>
              </div>
            </div>

            {/* Tenant Metadata Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Tenant Info Card */}
              <Card className="lg:col-span-2 border border-border rounded-xl shadow-sm">
                <CardHeader className="border-b border-border pb-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center space-x-4">
                    {/* Tenant Photo / Avatar */}
                    {unit?.tenant?.photoURL ? (
                      <img 
                        src={unit.tenant.photoURL} 
                        alt={unit.tenant.name}
                        className="h-14 w-14 rounded-full object-cover border border-primary/20"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20">
                        {unit?.tenant?.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{unit?.tenant?.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Start Date: {unit?.tenant?.startDate} • {unit?.tenant?.isContinuing ? "Continuing Agreement" : `Expires ${unit?.tenant?.endDate}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact Information</h4>
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="h-4 w-4 text-primary shrink-0" />
                      <span>{unit?.tenant?.phone}</span>
                    </div>
                    {unit?.tenant?.email && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="h-4 w-4 text-primary shrink-0" />
                        <span>{unit?.tenant?.email}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <span>Agreed rent payment cycle: Monthly</span>
                    </div>
                  </div>

                  {/* Pricing Terms */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Financial Terms</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg">
                        <p className="text-muted-foreground font-medium">Monthly Rent</p>
                        <p className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-200">
                          ₹{unit?.tenant?.rent.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg">
                        <p className="text-muted-foreground font-medium">Maintenance</p>
                        <p className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-200">
                          ₹{unit?.tenant?.maintenance.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg">
                        <p className="text-muted-foreground font-medium">Advance Paid</p>
                        <p className="text-sm font-bold mt-1 text-emerald-600">
                          ₹{unit?.tenant?.advance.toLocaleString()}
                        </p>
                      </div>
                      {unit?.tenant?.deposit > 0 && (
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg">
                          <p className="text-muted-foreground font-medium">Security Deposit</p>
                          <p className="text-sm font-bold mt-1 text-emerald-600">
                            ₹{unit?.tenant?.deposit.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stored Documents Card */}
              <Card className="lg:col-span-1 border border-border rounded-xl shadow-sm flex flex-col justify-between">
                <CardHeader className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center space-x-1.5 text-primary">
                    <Paperclip className="h-4.5 w-4.5" />
                    <CardTitle className="text-sm font-bold">Tenant Documents</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-grow space-y-3 pt-3 text-xs">
                  {/* List Documents */}
                  {unit?.tenant?.documentURLs && Object.keys(unit.tenant.documentURLs).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(unit.tenant.documentURLs).map(([docName, url]) => (
                        <a 
                          key={docName}
                          href={url as string}
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-between p-2.5 border border-border hover:border-primary/40 bg-card rounded-lg transition-colors group"
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-primary group-hover:scale-105 transition-transform" />
                            <span className="font-semibold uppercase tracking-wider text-[10px]">
                              {docName} Agreement
                            </span>
                          </div>
                          <span className="text-[10px] text-primary group-hover:underline">Download →</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-6">No attachments uploaded for this tenant.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Financial Aggregate Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border border-border rounded-xl shadow-sm bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Expected Rent</p>
                <p className="text-2xl font-extrabold mt-1 text-slate-800 dark:text-slate-100">
                  ₹{expectedTotal.toLocaleString()}
                </p>
              </Card>
              <Card className="border border-border rounded-xl shadow-sm bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Received Payments</p>
                <p className="text-2xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-500">
                  ₹{paidTotal.toLocaleString()}
                </p>
              </Card>
              <Card className="border border-border rounded-xl shadow-sm bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Balance</p>
                <p className={`text-2xl font-extrabold mt-1 ${outstandingBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  ₹{outstandingBalance.toLocaleString()}
                </p>
              </Card>
            </div>

            {/* Payment Ledger Table */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <h3 className="text-xl font-bold tracking-tight">Ledger Timeline</h3>
                  <p className="text-xs text-muted-foreground font-medium">Click a row to edit and record payment</p>
                </div>
                <Button 
                  onClick={handleOpenAddMonth}
                  size="sm"
                  variant="outline"
                  className="flex items-center space-x-1.5 rounded-xl text-xs py-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Billing Month</span>
                </Button>
              </div>
              
              {paymentsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Loading ledger records...</p>
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No monthly cycles generated.</p>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block shadow-sm rounded-xl overflow-hidden border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Billing Month</TableHead>
                          <TableHead>Expected Rent</TableHead>
                          <TableHead>Discount / Nego</TableHead>
                          <TableHead>Maint. Fee</TableHead>
                          <TableHead>Late Fee</TableHead>
                          <TableHead>Final Rent</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Date Paid</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => {
                          const statusColors = {
                            paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200/50",
                            partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200/50",
                            pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-200/50",
                            overdue: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 border border-rose-200/50",
                          };

                          return (
                            <TableRow 
                              key={p.id}
                              className={`cursor-pointer transition-colors ${
                                p.isFinalized 
                                  ? "bg-slate-50/50 dark:bg-slate-900/20 opacity-80 cursor-not-allowed" 
                                  : "hover:bg-slate-100/50 dark:hover:bg-slate-900/40"
                              }`}
                              onClick={() => handleEditPaymentClick(p)}
                            >
                              <TableCell className="font-bold text-left">{formatMonthName(p.month)}</TableCell>
                              <TableCell>₹{p.expectedRent.toLocaleString()}</TableCell>
                              <TableCell className={p.negotiationDiscount > 0 ? "text-destructive" : ""}>
                                {p.negotiationDiscount > 0 ? `-₹{p.negotiationDiscount.toLocaleString()}` : "₹0"}
                              </TableCell>
                              <TableCell>₹{p.maintenance.toLocaleString()}</TableCell>
                              <TableCell className={p.lateFee > 0 ? "text-destructive font-semibold" : ""}>
                                {p.lateFee > 0 ? `+₹{p.lateFee.toLocaleString()}` : "₹0"}
                              </TableCell>
                              <TableCell className="font-extrabold text-slate-800 dark:text-slate-200">
                                ₹{p.finalRent.toLocaleString()}
                              </TableCell>
                              <TableCell className="font-extrabold text-emerald-600">
                                ₹{p.amountReceived.toLocaleString()}
                              </TableCell>
                              <TableCell>{p.paymentDate || "-"}</TableCell>
                              <TableCell>{p.paymentMethod || "-"}</TableCell>
                              <TableCell>
                                <div className="flex justify-center items-center">
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1 ${
                                    statusColors[p.status]
                                  }`}>
                                    {p.isFinalized && <Lock className="h-2.5 w-2.5 mr-0.5 shrink-0" />}
                                    <span>{p.status}</span>
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card List View */}
                  <div className="block md:hidden space-y-3.5">
                    {payments.map((p) => {
                      const statusColors = {
                        paid: "bg-emerald-100 text-emerald-800 border border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300",
                        partial: "bg-blue-100 text-blue-800 border border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-300",
                        pending: "bg-amber-100 text-amber-800 border border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300",
                        overdue: "bg-rose-100 text-rose-800 border border-rose-200/50 dark:bg-rose-950/40 dark:text-rose-300",
                      };

                      return (
                        <div 
                          key={p.id}
                          className={`p-4 bg-card border border-border rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                            p.isFinalized ? "opacity-75 bg-slate-50/30" : "hover:border-primary/30"
                          }`}
                          onClick={() => handleEditPaymentClick(p)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                                {formatMonthName(p.month)}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {p.paymentDate ? `Paid via ${p.paymentMethod} on ${p.paymentDate}` : "Payment pending"}
                              </p>
                            </div>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border flex items-center space-x-1 ${
                              statusColors[p.status]
                            }`}>
                              {p.isFinalized && <Lock className="h-2.5 w-2.5 mr-0.5 shrink-0" />}
                              <span>{p.status}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[10px] text-muted-foreground mt-2">
                            <div>
                              <p className="font-medium text-slate-500">Rent Due</p>
                              <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">₹{p.expectedRent.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="font-medium text-slate-500">Total Due</p>
                              <p className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">₹{p.finalRent.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="font-medium text-slate-500">Paid Amount</p>
                              <p className="font-extrabold text-emerald-600 mt-0.5">₹{p.amountReceived.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* --- ADD BILLING MONTH MODAL --- */}
      <Dialog 
        isOpen={isAddMonthOpen} 
        onClose={() => setIsAddMonthOpen(false)} 
        title="Add Past/Missing Billing Month"
        className="max-w-md"
      >
        <form onSubmit={handleAddMonthSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground leading-normal">
            Select the billing month and adjust the rent rate if needed. This is useful for manually backfilling records that you forgot to entry.
          </p>
          
          <div className="space-y-3">
            <Input
              label="Billing Month"
              type="month"
              value={addMonth}
              onChange={(e) => setAddMonth(e.target.value)}
              required
            />
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Monthly Rent (₹)"
                type="number"
                min={0}
                value={addRent}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddRent(val === "" ? "" : parseInt(val) || 0);
                }}
                required
              />
              <Input
                label="Maintenance (₹)"
                type="number"
                min={0}
                value={addMaint}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddMaint(val === "" ? "" : parseInt(val) || 0);
                }}
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsAddMonthOpen(false)} disabled={isAddingMonth}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isAddingMonth}>
              Create Billing Month
            </Button>
          </div>
        </form>
      </Dialog>

      {/* --- CONFIRM VACATE MODAL --- */}
      <Dialog 
        isOpen={isVacateOpen} 
        onClose={() => setIsVacateOpen(false)} 
        title="Vacate Rental Unit"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-normal">
            Are you sure you want to remove <span className="font-bold text-foreground">{unit?.tenant?.name}</span> from Unit {unit?.unitNumber}? 
            The unit will be marked as **Vacant**. The existing ledger history and files remain archived inside this unit's subcollections.
          </p>
          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsVacateOpen(false)} disabled={isVacating}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleVacate} isLoading={isVacating}>
              Vacate Unit
            </Button>
          </div>
        </div>
      </Dialog>

      {/* --- EDIT / RECORD PAYMENT MODAL --- */}
      <Dialog 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        title={selectedPayment ? `Record Rent for ${formatMonthName(selectedPayment.month)}` : "Record Rent"}
        className="max-w-xl"
      >
        {selectedPayment && (
          <form onSubmit={handleSavePayment} className="space-y-5">
            {/* Financial Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900 border border-border p-3 rounded-lg">
              <div>
                <p className="text-muted-foreground font-semibold uppercase">Expected Rent</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  ₹{selectedPayment.expectedRent.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">(Original value, locked)</p>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold uppercase">Final Rent Due</p>
                <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                  ₹{(selectedPayment.expectedRent + Number(editMaint) + Number(editLate) - Number(editNego)).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">(Calculated: Rent + Maint + Late - Nego)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Maintenance Fee (₹)"
                type="number"
                min={0}
                value={editMaint}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditMaint(val === "" ? "" : parseInt(val) || 0);
                }}
                required
              />
              <Input
                label="Negotiation Discount (₹)"
                type="number"
                min={0}
                value={editNego}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditNego(val === "" ? "" : parseInt(val) || 0);
                }}
                required
              />
              <Input
                label="Late Fee Charge (₹)"
                type="number"
                min={0}
                value={editLate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditLate(val === "" ? "" : parseInt(val) || 0);
                }}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Amount Paid (₹)"
                type="number"
                min={0}
                value={editReceived}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditReceived(val === "" ? "" : parseInt(val) || 0);
                }}
                required
              />
              <Input
                label="Payment Date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required={Number(editReceived) > 0}
                disabled={Number(editReceived) === 0}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Payment Method"
                value={editMethod}
                onChange={(e) => setEditMethod(e.target.value as any)}
                options={[
                  { value: "Cash", label: "Cash" },
                  { value: "UPI", label: "UPI (Google Pay, PhonePe...)" },
                  { value: "Bank Transfer", label: "Bank Transfer" },
                  { value: "Cheque", label: "Cheque" },
                  { value: "Other", label: "Other" }
                ]}
                disabled={editReceived === 0}
              />
              <Input
                label="Transaction ID / Remarks"
                placeholder="e.g. Bank Ref #, Cash Handed over"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
              />
            </div>

            {/* Lock Checkbox */}
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-950/40 p-3 rounded-lg flex items-start space-x-3.5">
              <input 
                type="checkbox" 
                id="finalize"
                checked={editFinalized}
                onChange={(e) => setEditFinalized(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary focus:ring-ring border-border rounded"
              />
              <div className="text-xs leading-normal">
                <label htmlFor="finalize" className="font-bold text-amber-800 dark:text-amber-400 cursor-pointer">
                  Finalize and Lock Payment Record
                </label>
                <p className="text-muted-foreground mt-0.5">
                  Finalizing will permanently lock this record. You will not be able to edit these numbers again.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Payment
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};
