import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "../hooks/useProperties";
import type { PropertyInput, UnitInput } from "../hooks/useProperties";
import { syncContinuingPayments } from "../services/paymentScheduler";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Dialog } from "../components/ui/Dialog";
import { Header } from "../components/Header";
import { 
  Building, 
  MapPin, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Calendar,
  History
} from "lucide-react";
import { useActivityLog } from "../hooks/useActivityLog";

// Default premium cover photo presets to prevent empty templates
const PHOTO_PRESETS = [
  { name: "Modern Apartment", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" },
  { name: "Classic Villa", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80" },
  { name: "Commercial Plaza", url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80" },
  { name: "Suburban Shop", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80" }
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { properties, loading, addProperty } = useProperties();
  const { logs, refresh: refreshLogs } = useActivityLog();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Property Form State
  const [propName, setPropName] = useState("");
  const [propLocation, setPropLocation] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propPhoto, setPropPhoto] = useState(PHOTO_PRESETS[0].url);
  const [propType, setPropType] = useState<"house" | "shop">("house");
  const [numUnits, setNumUnits] = useState<number | "">(1);
  const [unitConfigs, setUnitConfigs] = useState<UnitInput[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "house" | "shop">("all");
  const [filterOccupancy, setFilterOccupancy] = useState<"all" | "occupied" | "vacant">("all");

  // Sync payments for continuing tenants on load
  useEffect(() => {
    const runSync = async () => {
      if (user) {
        setIsSyncing(true);
        try {
          const generated = await syncContinuingPayments(user.uid);
          if (generated > 0) {
            console.log(`Synced continuing payments: Generated ${generated} records.`);
            refreshLogs();
          }
        } catch (e) {
          console.error("Failed to sync payments:", e);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    runSync();
  }, [user]);

  // Handle Dynamic Unit Configuration Rows
  useEffect(() => {
    const count = Math.max(1, typeof numUnits === "number" ? numUnits : 1);
    setUnitConfigs((prev) => {
      const configs = [...prev];
      if (configs.length < count) {
        // Add new configurations with smart defaults
        for (let i = configs.length; i < count; i++) {
          const unitNum = propType === "house" 
            ? `${100 + (i + 1)}` 
            : `S-${i + 1}`;
          configs.push({
            unitNumber: unitNum,
            type: propType,
            area: propType === "house" ? 1200 : 600,
            floor: Math.floor(i / 4) + 1, // Auto-increment floor every 4 units
            notes: ""
          });
        }
      } else if (configs.length > count) {
        // Truncate list
        configs.splice(count);
      }
      
      // Update types if property type changed
      return configs.map(c => ({ ...c, type: propType }));
    });
  }, [numUnits, propType]);

  const handleUnitConfigChange = (index: number, field: keyof UnitInput, value: any) => {
    setUnitConfigs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const propertyInput: PropertyInput = {
        name: propName,
        location: propLocation,
        address: propAddress,
        coverPhoto: propPhoto,
        type: propType,
        units: unitConfigs
      };

      await addProperty(propertyInput);
      setIsAddOpen(false);
      
      // Reset form fields
      setPropName("");
      setPropLocation("");
      setPropAddress("");
      setPropPhoto(PHOTO_PRESETS[0].url);
      setPropType("house");
      setNumUnits(1);
    } catch (err) {
      alert("Failed to create property. Please verify your fields.");
    }
  };

  // Filter properties client-side
  const filteredProperties = properties.filter((prop) => {
    // 1. Matches Search (property name, location, address)
    const matchesSearch = 
      prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prop.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prop.address.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Matches Property Type
    const matchesType = filterType === "all" || prop.type === filterType;

    // 3. Matches Occupancy Filter
    let matchesOccupancy = true;
    if (filterOccupancy === "occupied") {
      matchesOccupancy = prop.occupiedUnitsCount > 0;
    } else if (filterOccupancy === "vacant") {
      matchesOccupancy = prop.vacantUnitsCount > 0;
    }

    return matchesSearch && matchesType && matchesOccupancy;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Sync Indicator */}
        {isSyncing && (
          <div className="bg-primary/10 border border-primary/20 text-primary text-xs px-3 py-1.5 rounded-lg flex items-center space-x-2 animate-pulse w-fit">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Checking and syncing payment schedules...</span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Landlord Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Manage your properties, tenants, and monthly payment ledgers.
            </p>
          </div>
          <Button 
            onClick={() => setIsAddOpen(true)}
            className="flex items-center space-x-2 shadow rounded-xl font-bold bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
            <span>Add Property</span>
          </Button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Input
              placeholder="Search properties by name, town..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
            <Search className="absolute left-3.5 bottom-3.5 h-4.5 w-4.5 text-muted-foreground" />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase">Filters:</span>
            </div>
            
            {/* Property Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-background border border-border text-xs rounded-xl h-8 px-3 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Types</option>
              <option value="house">Houses Only</option>
              <option value="shop">Shops Only</option>
            </select>

            {/* Occupancy Status Filter */}
            <select
              value={filterOccupancy}
              onChange={(e) => setFilterOccupancy(e.target.value as any)}
              className="bg-background border border-border text-xs rounded-xl h-8 px-3 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Occupancy</option>
              <option value="occupied">Has Occupied Units</option>
              <option value="vacant">Has Vacant Units</option>
            </select>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Properties Grid (Left 3 columns) */}
          <div className="lg:col-span-3 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading properties...</p>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
                <Building className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-bold text-lg">No properties found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {searchQuery 
                      ? "Try adjusting your search query or reset filters." 
                      : "Create a property to generate units, add tenants, and track payments."}
                  </p>
                </div>
                {!searchQuery && (
                  <Button onClick={() => setIsAddOpen(true)}>Add Your First Property</Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredProperties.map((prop) => (
                  <Card 
                    key={prop.id}
                    className="overflow-hidden hover:shadow-md cursor-pointer group flex flex-col h-full border border-border rounded-xl"
                    onClick={() => navigate(`/property/${prop.id}`)}
                  >
                    {/* Cover Photo */}
                    <div className="relative h-44 w-full bg-slate-200 overflow-hidden">
                      <img 
                        src={prop.coverPhoto} 
                        alt={prop.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <span className="absolute top-3 right-3 text-[10px] font-bold tracking-wider uppercase bg-slate-900/80 text-white px-2 py-1 rounded-md backdrop-blur-sm">
                        {prop.type === "house" ? "Houses" : "Shops"}
                      </span>
                    </div>

                    <CardHeader className="p-4 pb-2 space-y-1">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {prop.name}
                      </CardTitle>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{prop.location}</span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 flex-grow">
                      {/* Unit counts bar */}
                      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Occupied</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{prop.occupiedUnitsCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Vacant</p>
                          <p className="text-sm font-bold text-success">{prop.vacantUnitsCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Total Units</p>
                          <p className="text-sm font-bold">{prop.totalUnits}</p>
                        </div>
                      </div>
                    </CardContent>

                    {/* Card Footer */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Updated {new Date(prop.lastUpdated?.seconds * 1000 || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <span className="font-semibold text-primary group-hover:underline">View details →</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log (Right Column) */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="h-full max-h-[600px] overflow-hidden flex flex-col border border-border rounded-xl">
              <CardHeader className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center space-x-1.5 text-primary">
                  <History className="h-4.5 w-4.5" />
                  <CardTitle className="text-sm font-bold">Landlord Activity Log</CardTitle>
                </div>
                <CardDescription className="text-xs">Recent management audits</CardDescription>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto flex-grow divide-y divide-border space-y-3 pt-3">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No activities logged yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="text-xs pt-3 first:pt-0 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-primary">
                          {log.action.replace("_", " ")}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {log.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-normal">{log.details}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </main>

      {/* --- ADD PROPERTY DIALOG --- */}
      <Dialog 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        title="Add New Rental Property"
        className="max-w-2xl"
      >
        <form onSubmit={handleCreateProperty} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Property Name"
              placeholder="e.g. Skyline Towers, Royal Plaza"
              required
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
            />
            <Input
              label="Town / Location"
              placeholder="e.g. Manhattan, New York"
              required
              value={propLocation}
              onChange={(e) => setPropLocation(e.target.value)}
            />
          </div>

          <Input
            label="Complete Address"
            placeholder="e.g. Apt 4B, 123 Broadway St, New York, NY 10001"
            required
            value={propAddress}
            onChange={(e) => setPropAddress(e.target.value)}
          />

          {/* Preset Photo Selector */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Property Cover Preset
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PHOTO_PRESETS.map((preset) => (
                <div 
                  key={preset.name}
                  onClick={() => setPropPhoto(preset.url)}
                  className={`cursor-pointer border-2 rounded-lg overflow-hidden h-16 relative transition-all ${
                    propPhoto === preset.url ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                  }`}
                >
                  <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1">
                    <span className="text-[8px] font-bold text-white text-center">{preset.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Property Type"
              value={propType}
              onChange={(e) => setPropType(e.target.value as "house" | "shop")}
              options={[
                { value: "house", label: "Residential (House)" },
                { value: "shop", label: "Commercial (Shop)" }
              ]}
            />
            <Input
              label={`Number of ${propType === "house" ? "Houses" : "Shops"}`}
              type="number"
              min={1}
              max={20}
              required
              value={numUnits}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setNumUnits("");
                } else {
                  setNumUnits(parseInt(val) || 1);
                }
              }}
            />
          </div>

          {/* DYNAMIC UNIT INPUTS GRID */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold border-b border-border pb-1">
              Configure {propType === "house" ? "House" : "Shop"} Units
            </h4>
            <div className="max-h-56 overflow-y-auto space-y-3 pr-2">
              {unitConfigs.map((unit, index) => (
                <div key={index} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-border">
                  <Input
                    label="Unit #"
                    value={unit.unitNumber}
                    onChange={(e) => handleUnitConfigChange(index, "unitNumber", e.target.value)}
                    required
                  />
                  {propType === "house" ? (
                    <Select
                      label="BHK"
                      value={(unit as any).bhk || "2 BHK"}
                      onChange={(e) => handleUnitConfigChange(index, "bhk", e.target.value)}
                      options={[
                        { value: "2 BHK", label: "2 BHK" },
                        { value: "3 BHK", label: "3 BHK" }
                      ]}
                    />
                  ) : (
                    <div className="text-center text-xs text-muted-foreground self-center pb-2 font-medium">
                      Commercial Shop
                    </div>
                  )}
                  <Input
                    label="Area (Sq.Ft)"
                    type="number"
                    value={unit.area}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleUnitConfigChange(index, "area", val === "" ? "" : parseInt(val) || 0);
                    }}
                    required
                  />
                  <Input
                    label="Floor"
                    type="number"
                    value={unit.floor}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleUnitConfigChange(index, "floor", val === "" ? "" : parseInt(val) || 1);
                    }}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Property
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
