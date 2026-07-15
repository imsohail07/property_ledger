import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useUnits } from "../hooks/useUnits";
import { useProperties } from "../hooks/useProperties";
import { Header } from "../components/Header";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Dialog } from "../components/ui/Dialog";
import { 
  MapPin, 
  Trash, 
  Edit, 
  UserPlus, 
  ArrowLeft, 
  Home, 
  ShoppingBag,
  Loader2,
  Paperclip,
  Image as ImageIcon
} from "lucide-react";

export const PropertyDetails: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateProperty, deleteProperty } = useProperties();
  const { units, loading: unitsLoading, addTenantToUnit } = useUnits(propertyId || "");

  const [property, setProperty] = useState<any>(null);
  const [propLoading, setPropLoading] = useState(true);
  
  // Dialog Open States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isTenantOpen, setIsTenantOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Edit Property Form State
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Tenant/Rentmate Form State
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [startDate, setStartDate] = useState(""); // YYYY-MM
  const [endDate, setEndDate] = useState("");     // YYYY-MM
  const [isContinuing, setIsContinuing] = useState("true");
  const [monthlyRent, setMonthlyRent] = useState<number | "">("");
  const [maintenance, setMaintenance] = useState<number | "">("");
  const [advanceAmount, setAdvanceAmount] = useState<number | "">("");
  const [securityDeposit, setSecurityDeposit] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  
  // File upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<{ [key: string]: File }>({});
  const [isUploading, setIsUploading] = useState(false);

  const fetchProperty = async () => {
    if (!user || !propertyId) return;
    setPropLoading(true);
    try {
      const docRef = doc(db, `users/${user.uid}/properties/${propertyId}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setProperty(data);
        setEditName(data.name);
        setEditLocation(data.location);
        setEditAddress(data.address);
      } else {
        navigate("/");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPropLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [user, propertyId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    try {
      await updateProperty(propertyId, {
        name: editName,
        location: editLocation,
        address: editAddress
      });
      setIsEditOpen(false);
      await fetchProperty();
    } catch (e) {
      alert("Failed to update property.");
    }
  };

  const handleDelete = async () => {
    if (!propertyId) return;
    try {
      await deleteProperty(propertyId);
      navigate("/");
    } catch (e) {
      alert("Failed to delete property.");
    }
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !selectedUnitId) return;
    setIsUploading(true);

    try {
      let photoURL = "";
      const documentURLs: { [key: string]: string } = {};

      // 1. Upload Tenant Photo if available
      if (photoFile && user) {
        const photoRef = ref(storage, `${user.uid}/tenantPhotos/${selectedUnitId}_${photoFile.name}`);
        const snap = await uploadBytes(photoRef, photoFile);
        photoURL = await getDownloadURL(snap.ref);
      }

      // 2. Upload Tenant Documents if available
      if (user) {
        for (const [docName, file] of Object.entries(docFiles)) {
          const docRef = ref(storage, `${user.uid}/tenantDocuments/${selectedUnitId}_${docName}_${file.name}`);
          const snap = await uploadBytes(docRef, file);
          documentURLs[docName] = await getDownloadURL(snap.ref);
        }
      }

      const tenantInput: any = {
        name: tenantName,
        phone: tenantPhone,
        startDate: startDate,
        isContinuing: isContinuing === "true",
        rent: Number(monthlyRent),
        maintenance: Number(maintenance),
        advance: Number(advanceAmount),
        documentURLs
      };

      if (tenantEmail) tenantInput.email = tenantEmail;
      if (isContinuing !== "true" && endDate) tenantInput.endDate = endDate;
      if (securityDeposit) tenantInput.deposit = Number(securityDeposit);
      if (photoURL) tenantInput.photoURL = photoURL;
      if (notes) tenantInput.notes = notes;

      await addTenantToUnit(selectedUnitId, tenantInput);
      setIsTenantOpen(false);
      
      // Reset Rentmate inputs
      setTenantName("");
      setTenantPhone("");
      setTenantEmail("");
      setStartDate("");
      setEndDate("");
      setIsContinuing("true");
      setMonthlyRent("");
      setMaintenance("");
      setAdvanceAmount("");
      setSecurityDeposit("");
      setNotes("");
      setPhotoFile(null);
      setDocFiles({});
    } catch (e: any) {
      alert("Failed to add tenant: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "agreement" | "aadhaar" | "pan") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (type === "photo") {
        setPhotoFile(file);
      } else {
        setDocFiles((prev) => ({ ...prev, [type]: file }));
      }
    }
  };

  const openAddTenantModal = (unitId: string) => {
    setSelectedUnitId(unitId);
    // Set default startDate to current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setStartDate(currentMonth);
    setIsTenantOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate("/")}
          className="flex items-center space-x-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>

        {propLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading property details...</p>
          </div>
        ) : (
          <>
            {/* Property Summary Section */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row">
              {/* Photo */}
              <div className="h-48 md:h-auto md:w-80 bg-slate-200 shrink-0">
                <img 
                  src={property.coverPhoto} 
                  alt={property.name} 
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Data & Actions */}
              <div className="p-6 flex-grow flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-3xl font-extrabold tracking-tight">{property.name}</h2>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-full uppercase text-muted-foreground border border-border">
                      {property.type === "house" ? "Houses" : "Shops"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4.5 w-4.5 text-primary shrink-0" />
                    <span>{property.location}</span>
                  </div>
                  <p className="text-sm text-slate-500 max-w-xl">{property.address}</p>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditOpen(true)}
                    className="flex items-center space-x-1.5 rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Property</span>
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => setIsDeleteOpen(true)}
                    className="flex items-center space-x-1.5 rounded-xl"
                  >
                    <Trash className="h-4 w-4" />
                    <span>Delete Property</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Units Grid */}
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">Rental Units</h3>
                <p className="text-sm text-muted-foreground">
                  Select a house or shop to open its tenant payment ledger.
                </p>
              </div>

              {unitsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Loading units...</p>
                </div>
              ) : units.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No units defined under this property.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {units.map((unit) => {
                    const isOccupied = unit.occupancyStatus === "occupied";
                    return (
                      <Card 
                        key={unit.id}
                        className={`border rounded-xl transition-all duration-200 flex flex-col justify-between ${
                          isOccupied 
                            ? "border-border bg-card shadow-sm" 
                            : "border-emerald-100 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm"
                        }`}
                      >
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center space-x-2">
                              <div className={`p-2 rounded-lg ${
                                isOccupied ? "bg-slate-100 dark:bg-slate-900" : "bg-emerald-100 dark:bg-emerald-950 text-emerald-600"
                              }`}>
                                {unit.type === "house" ? <Home className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                              </div>
                              <div>
                                <CardTitle className="text-base font-bold">
                                  {unit.type === "house" ? `House ${unit.unitNumber}` : `Shop ${unit.unitNumber}`}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  Floor {unit.floor} • {unit.area} Sq.Ft.
                                </CardDescription>
                              </div>
                            </div>
                            
                            {/* Status tag */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isOccupied 
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" 
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                            }`}>
                              {unit.occupancyStatus}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 pt-2 pb-4 flex-grow flex flex-col justify-between space-y-4">
                          {/* Unit Occupancy Section */}
                          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-border text-xs min-h-[50px] flex items-center">
                            {isOccupied && unit.tenant ? (
                              <div className="space-y-1">
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                  Tenant: {unit.tenant.name}
                                </p>
                                <p className="text-muted-foreground">
                                  Rent: ₹{unit.tenant.rent.toLocaleString()} • Started {unit.tenant.startDate}
                                </p>
                              </div>
                            ) : (
                              <p className="text-muted-foreground font-medium">Vacant. Ready for new tenant.</p>
                            )}
                          </div>

                          {/* Footer Action Buttons */}
                          <div>
                            {isOccupied ? (
                              <Button
                                onClick={() => navigate(`/property/${propertyId}/unit/${unit.id}`)}
                                className="w-full text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/95"
                              >
                                View Ledger
                              </Button>
                            ) : (
                              <Button
                                variant="success"
                                onClick={() => openAddTenantModal(unit.id)}
                                className="w-full text-xs font-semibold rounded-lg flex items-center justify-center space-x-1"
                              >
                                <UserPlus className="h-4 w-4" />
                                <span>Add Rentmate</span>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* --- EDIT PROPERTY MODAL --- */}
      <Dialog 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        title="Edit Property Metadata"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Property Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Location"
            value={editLocation}
            onChange={(e) => setEditLocation(e.target.value)}
            required
          />
          <Input
            label="Complete Address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            required
          />
          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Dialog 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        title="Confirm Property Deletion"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-normal">
            Are you sure you want to delete <span className="font-bold text-foreground">{property?.name}</span>? 
            This action is permanent and will delete all rental units, tenant information, documents, and historical monthly ledgers from Firestore.
          </p>
          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Dialog>

      {/* --- ADD TENANT/RENTMATE DIALOG --- */}
      <Dialog 
        isOpen={isTenantOpen} 
        onClose={() => setIsTenantOpen(false)} 
        title={`Add Rentmate to Unit ${selectedUnitId}`}
        className="max-w-2xl"
      >
        <form onSubmit={handleAddTenant} className="space-y-5">
          
          {/* Tenant Profile Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tenant Full Name"
              placeholder="e.g. John Doe"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              placeholder="e.g. +1 555 123 4567"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email Address (Optional)"
              placeholder="e.g. john@example.com"
              type="email"
              value={tenantEmail}
              onChange={(e) => setTenantEmail(e.target.value)}
            />
            <Select
              label="Agreement Type"
              value={isContinuing}
              onChange={(e) => setIsContinuing(e.target.value)}
              options={[
                { value: "true", label: "Continuing (Month-to-Month)" },
                { value: "false", label: "Fixed-Term Contract" }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            {isContinuing === "false" && (
              <Input
                label="End Date"
                type="month"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required={isContinuing === "false"}
              />
            )}
          </div>

          {/* Pricing Section */}
          <h4 className="text-xs font-bold border-b border-border pb-1 text-muted-foreground uppercase tracking-wider">
            Financial Terms
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              label="Monthly Rent (₹)"
              type="number"
              min={0}
              value={monthlyRent}
              onChange={(e) => {
                const val = e.target.value;
                setMonthlyRent(val === "" ? "" : parseInt(val) || 0);
              }}
              required
            />
            <Input
              label="Maintenance (₹)"
              type="number"
              min={0}
              value={maintenance}
              onChange={(e) => {
                const val = e.target.value;
                setMaintenance(val === "" ? "" : parseInt(val) || 0);
              }}
              required
            />
            <Input
              label="Advance Amount (₹)"
              type="number"
              min={0}
              value={advanceAmount}
              onChange={(e) => {
                const val = e.target.value;
                setAdvanceAmount(val === "" ? "" : parseInt(val) || 0);
              }}
              required
            />
            <Input
              label="Deposit (Optional) (₹)"
              type="number"
              min={0}
              value={securityDeposit}
              onChange={(e) => {
                const val = e.target.value;
                setSecurityDeposit(val === "" ? "" : parseInt(val) || 0);
              }}
            />
          </div>

          {/* Tenant Notes */}
          <div className="w-full space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all min-h-[60px]"
              placeholder="e.g. Any special terms, references, family size..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* File Attachments */}
          <h4 className="text-xs font-bold border-b border-border pb-1 text-muted-foreground uppercase tracking-wider">
            Attachments & Profile Photo (Free Tier Cloud Storage)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                <ImageIcon className="h-4 w-4" />
                <span>Tenant Photo</span>
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => handleFileChange(e, "photo")}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                <Paperclip className="h-4 w-4" />
                <span>Lease Agreement Document</span>
              </label>
              <input 
                type="file" 
                accept="application/pdf,image/*"
                onChange={(e) => handleFileChange(e, "agreement")}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                <Paperclip className="h-4 w-4" />
                <span>Aadhaar Document</span>
              </label>
              <input 
                type="file" 
                accept="application/pdf,image/*"
                onChange={(e) => handleFileChange(e, "aadhaar")}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                <Paperclip className="h-4 w-4" />
                <span>PAN Document</span>
              </label>
              <input 
                type="file" 
                accept="application/pdf,image/*"
                onChange={(e) => handleFileChange(e, "pan")}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsTenantOpen(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isUploading}>
              Create Rentmate
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
