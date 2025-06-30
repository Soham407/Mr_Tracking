import { useState, useEffect, useMemo } from "react";
// import { useNavigate } from "react-router-dom"; // Removed useNavigate as it's no longer needed for row click
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Added
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, Search, UserPlus, Eye, ArrowUpDown } from "lucide-react"; // Added UserPlus, Eye, and ArrowUpDown
import { Doctor } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSortableTable } from "@/hooks/useSortableTable"; // Import the hook
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"; // Import pagination components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { AreaReminderDialog } from "@/components/doctors/AreaReminderDialog";
import { useUser } from "@/context/UserContext";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Add predefined areas list
const predefinedAreas = [
  "Hadapsar",
  "Dhanori",
  "Nagar Road",
  "Satara Road",
  "Uralikanchan",
  "Kondwa",
  "Rasta Peth",
  "Kothrud",
  "Karve Nagar",
  "Warje",
  "Sinhgad Road",
  "Deccan",
  "Uttam Nagar",
  "Aundh Baner",
  "Kolhapur",
  "Sangali",
  "Miraj",
  "Bhogawati",
  "Shahupuri",
  "Rajarampuri",
  "Balinga",
  "Apatenagar",
  "Kawala naka",
  "Rankala dudhali",
  "Shivaji peth",
  "Mangalwar Peth",
  "Kalevadi",
  "Ravet",
  "Dange Chowk",
  "Bhumkar Chowk",
  "Nigdi",
  "Talegaon Dabhade",
  "Bhosari",
  "Margao",
  "Canacona",
  "Vasco",
  "Panjim",
  "Ponda",
  "Mapusa"
];

export function DoctorsList() {
  const { user } = useUser();
  const userRole = user?.role || 'mr';
  const [searchTerm, setSearchTerm] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // const navigate = useNavigate(); // Removed navigate initialization
  const [isAddDoctorDialogOpen, setIsAddDoctorDialogOpen] = useState(false);
  const [isViewDoctorDialogOpen, setIsViewDoctorDialogOpen] = useState(false); // State for view dialog
  const [viewingDoctor, setViewingDoctor] = useState<Doctor | null>(null); // State for doctor being viewed
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    name: "",
    specialty: "",
    hospital: "",
    city: "",
    address: "",
    area: "",
    phone: "",
  });

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page
  const [totalDoctors, setTotalDoctors] = useState(0); // State to hold total count of filtered data

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to view doctors");
      }
      // Fetch only doctors added by the current user
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("added_by", user.id);
      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast.error("Failed to load doctors");
    } finally {
      setIsLoading(false);
    }
  };

  // Added handleAddDoctor function (adapted from Admin version)
  const handleAddDoctor = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!newDoctor.name || !newDoctor.specialty || !newDoctor.hospital || !newDoctor.address || !newDoctor.area) {
        toast.error("Please fill in all required fields (Name, Specialty, Hospital, Address, Area)");
        setIsSubmitting(false);
        return;
      }

      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to add a doctor");
      }

      // Create full address
      const fullAddress = newDoctor.city
        ? `${newDoctor.address}, ${newDoctor.city}`
        : newDoctor.address;

      // Add the doctor to the database
      const { data, error } = await supabase
        .from("doctors")
        .insert({
          name: newDoctor.name,
          specialization: newDoctor.specialty,
          hospital: newDoctor.hospital,
          address: fullAddress,
          area: newDoctor.area,
          phone: newDoctor.phone || null,
          added_by: user.id,
          is_verified: false // MRs add doctors as unverified
        })
        .select();

      if (error) throw error;

      if (data && data[0]) {
        // Add the new doctor to the state
        setDoctors([...doctors, data[0]]);

        toast.success("Doctor added successfully. Pending verification.");
        setIsAddDoctorDialogOpen(false);

        // Reset form
        setNewDoctor({
          name: "",
          specialty: "",
          hospital: "",
          city: "",
          address: "",
          area: "",
          phone: "",
        });
      } else {
         throw new Error("Failed to add doctor or retrieve added data.");
      }
    } catch (error: unknown) {
      console.error("Error adding doctor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add doctor";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter doctors based on search term
  const filteredDoctors = useMemo(() => {
    const filtered = doctors.filter(
      (doctor) =>
        doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setTotalDoctors(filtered.length); // Update total count
    return filtered;
  }, [doctors, searchTerm]);

  // Use the sortable table hook with the filtered data
  const { sortedData, sortColumn, sortDirection, handleSort } = useSortableTable({
    data: filteredDoctors,
    defaultSortColumn: "name", // Default sort by name
    defaultSortDirection: "asc", // Default sort direction
  });

  // Apply client-side pagination to the sorted data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage]);

  const handleEditDoctor = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setIsEditDialogOpen(true);
  };

  const handleUpdateDoctor = async () => {
    if (!editingDoctor) return;

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("doctors")
        .update({
          name: editingDoctor.name,
          specialization: editingDoctor.specialization,
          hospital: editingDoctor.hospital,
          address: editingDoctor.address,
          area: editingDoctor.area,
          phone: editingDoctor.phone || null,
        })
        .eq("id", editingDoctor.id);

      if (error) throw error;

      setDoctors(doctors.map(doc => 
        doc.id === editingDoctor.id ? editingDoctor : doc
      ));

      toast.success("Doctor updated successfully");
      setIsEditDialogOpen(false);
      setEditingDoctor(null);
    } catch (error) {
      console.error("Error updating doctor:", error);
      toast.error("Failed to update doctor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Doctors</h2>
        {/* Updated Button to open dialog */}
        <Button onClick={() => setIsAddDoctorDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Doctor
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search doctors by name, specialization, or hospital..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse">Loading doctors...</div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  Name
                  <ArrowUpDown className={`ml-2 h-4 w-4 inline ${sortColumn === 'name' ? '' : 'text-muted-foreground opacity-50'} ${sortColumn === 'name' && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("specialization")}
                >
                  Specialization
                   <ArrowUpDown className={`ml-2 h-4 w-4 inline ${sortColumn === 'specialization' ? '' : 'text-muted-foreground opacity-50'} ${sortColumn === 'specialization' && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </TableHead>
                <TableHead
                  className="hidden md:table-cell cursor-pointer"
                  onClick={() => handleSort("hospital")}
                >
                  Hospital
                   <ArrowUpDown className={`ml-2 h-4 w-4 inline ${sortColumn === 'hospital' ? '' : 'text-muted-foreground opacity-50'} ${sortColumn === 'hospital' && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </TableHead>
                <TableHead
                  className="hidden md:table-cell cursor-pointer"
                  onClick={() => handleSort("address")}
                >
                  Address
                   <ArrowUpDown className={`ml-2 h-4 w-4 inline ${sortColumn === 'address' ? '' : 'text-muted-foreground opacity-50'} ${sortColumn === 'address' && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </TableHead>
                <TableHead
                  className="hidden md:table-cell cursor-pointer"
                  onClick={() => handleSort("area")}
                >
                  Area
                   <ArrowUpDown className={`ml-2 h-4 w-4 inline ${sortColumn === 'area' ? '' : 'text-muted-foreground opacity-50'} ${sortColumn === 'area' && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </TableHead>
                <TableHead
                   className="cursor-pointer"
                   onClick={() => handleSort("is_verified")}
                >
                  Status
                   <ArrowUpDown className={`ml-2 h-4 w-4 inline ${sortColumn === 'is_verified' ? '' : 'text-muted-foreground opacity-50'} ${sortColumn === 'is_verified' && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No doctors found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((doctor) => (
                  <TableRow
                    key={doctor.id}
                    // Removed row onClick navigation
                  >
                    <TableCell className="font-medium">
                      {/* Make name clickable to open view modal */}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => {
                          setViewingDoctor(doctor);
                          setIsViewDoctorDialogOpen(true);
                        }}
                      >
                        {doctor.name}
                      </Button>
                    </TableCell>
                    <TableCell>{doctor.specialization}</TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.hospital}</TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.address || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.area || "-"}</TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        doctor.is_verified
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {doctor.is_verified ? "Verified" : "Pending"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && paginatedData.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center mt-4 w-full">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <label className="text-sm font-medium">Items per page:</label>
            <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px]">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Pagination>
            <PaginationContent className="flex-wrap justify-center">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  aria-disabled={currentPage <= 1}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4 py-2 text-sm">Page {currentPage} of {Math.ceil(totalDoctors / itemsPerPage)}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < Math.ceil(totalDoctors / itemsPerPage)) setCurrentPage(currentPage + 1);
                  }}
                  aria-disabled={currentPage >= Math.ceil(totalDoctors / itemsPerPage)}
                  className={currentPage >= Math.ceil(totalDoctors / itemsPerPage) ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Add Doctor Dialog (Copied and adapted from Admin version) */}
      <Dialog open={isAddDoctorDialogOpen} onOpenChange={setIsAddDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
            <DialogDescription>
              Fill in the details of the new doctor. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name*</Label>
                <Input
                  id="name"
                  value={newDoctor.name}
                  onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                  placeholder="Dr. John Doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialty">Specialty*</Label>
                <Input
                  id="specialty"
                  value={newDoctor.specialty}
                  onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })}
                  placeholder="Cardiology"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hospital">Hospital / Clinic*</Label>
              <Input
                id="hospital"
                value={newDoctor.hospital}
                onChange={(e) => setNewDoctor({ ...newDoctor, hospital: e.target.value })}
                placeholder="City Hospital"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="address">Address*</Label>
                <Input
                  id="address"
                  value={newDoctor.address}
                  onChange={(e) => setNewDoctor({ ...newDoctor, address: e.target.value })}
                  placeholder="123 Medical Ave"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="area">Area*</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {newDoctor.area || "Select area..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search area..." />
                      <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty>No area found.</CommandEmpty>
                        <CommandGroup>
                          {predefinedAreas.map((area) => (
                            <CommandItem
                              value={area}
                              key={area}
                              onSelect={() => {
                                setNewDoctor({ ...newDoctor, area: area });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newDoctor.area === area ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {area}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={newDoctor.city}
                  onChange={(e) => setNewDoctor({ ...newDoctor, city: e.target.value })}
                  placeholder="Health City"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newDoctor.phone}
                  onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })}
                  placeholder="555-123-4567"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDoctorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDoctor} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Doctor Dialog */}
      <Dialog open={isViewDoctorDialogOpen} onOpenChange={setIsViewDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Doctor Details</DialogTitle>
            <DialogDescription>
              Viewing information for {viewingDoctor?.name}. Details are read-only.
            </DialogDescription>
          </DialogHeader>
          {viewingDoctor && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-left w-full"
                    onClick={() => {
                      setIsViewDoctorDialogOpen(false);
                      setEditingDoctor(viewingDoctor);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <span className="text-sm p-2 border rounded bg-muted w-full block">{viewingDoctor.name}</span>
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label>Specialty</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.specialization}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Hospital / Clinic</Label>
                <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.hospital}</p>
              </div>

              <div className="grid gap-2">
                  <Label>Address</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Area</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.area || "-"}</p>
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.phone || "-"}</p>
                </div>
              </div>
               <div className="grid gap-2">
                  <Label>Status</Label>
                  <p className={`text-sm p-2 border rounded ${viewingDoctor.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {viewingDoctor.is_verified ? "Verified" : "Pending Verification"}
                  </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDoctorDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Doctor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription>
              Update the doctor's information. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          {editingDoctor && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Full Name*</Label>
                  <Input
                    id="edit-name"
                    value={editingDoctor.name}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-specialty">Specialty*</Label>
                  <Input
                    id="edit-specialty"
                    value={editingDoctor.specialization}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, specialization: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-hospital">Hospital / Clinic*</Label>
                <Input
                  id="edit-hospital"
                  value={editingDoctor.hospital}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, hospital: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address*</Label>
                  <Input
                    id="edit-address"
                    value={editingDoctor.address}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, address: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-area">Area*</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {editingDoctor.area || "Select area..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search area..." />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>No area found.</CommandEmpty>
                          <CommandGroup>
                            {predefinedAreas.map((area) => (
                              <CommandItem
                                value={area}
                                key={area}
                                onSelect={() => {
                                  setEditingDoctor({ ...editingDoctor, area: area });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    editingDoctor.area === area ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {area}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingDoctor.phone || ""}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDoctor} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userRole === 'mr' && <AreaReminderDialog onEditDoctor={handleEditDoctor} />}
    </div>
  );
}
