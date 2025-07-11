import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSortableTable } from "@/hooks/useSortableTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MoreHorizontal,
  UserPlus,
  Search,
  Edit,
  Trash,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Doctor } from "@/types";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DoctorsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isAddDoctorDialogOpen, setIsAddDoctorDialogOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    name: "",
    specialty: "",
    hospital: "",
    city: "",
    address: "",
    email: "",
    phone: "",
    area: "",
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [isViewDoctorDialogOpen, setIsViewDoctorDialogOpen] = useState(false);
  const [viewingDoctor, setViewingDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<Record<string, string>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalDoctors, setTotalDoctors] = useState(0);

  const { sortedData, handleSort, sortColumn, sortDirection } = useSortableTable<Doctor>({ data: doctors });

  useEffect(() => {
    fetchDoctorsAndUsers();
  }, []);

  const fetchDoctorsAndUsers = async () => {
    try {
      setIsLoading(true);

      const { data: doctorsData, error: doctorsError } = await supabase
        .from("doctors")
        .select("*");

      if (doctorsError) throw doctorsError;

      setDoctors(doctorsData || []);

      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, name");

      if (usersError) throw usersError;

      const usersMap: Record<string, string> = {};
      usersData.forEach(user => {
        usersMap[user.id] = user.name;
      });
      setUsers(usersMap);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    const filtered = sortedData.filter(
      (doctor) =>
        doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.area.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setTotalDoctors(filtered.length);
    return filtered;
  }, [sortedData, searchTerm]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDoctors.slice(startIndex, endIndex);
  }, [filteredDoctors, currentPage, itemsPerPage]);

  const handleVerify = async (id: string) => {
    try {
      const { error } = await supabase
        .from("doctors")
        .update({ is_verified: true })
        .eq("id", id);

      if (error) throw error;

      setDoctors(
        doctors.map((doctor) =>
          doctor.id === id ? { ...doctor, is_verified: true } : doctor
        )
      );

      toast.success("Doctor verified successfully");
    } catch (error: unknown) {
      console.error("Error verifying doctor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to verify doctor";
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("doctors")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setDoctors(doctors.filter((doctor) => doctor.id !== id));
      toast.success("Doctor deleted successfully");
    } catch (error: unknown) {
      console.error("Error deleting doctor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete doctor";
      toast.error(errorMessage);
    }
  };

  const handleEditDoctor = async () => {
    if (!editingDoctor) return;

    try {
      setIsSubmitting(true);

      if (!editingDoctor.name || !editingDoctor.specialization || !editingDoctor.hospital || !editingDoctor.address || !editingDoctor.area) {
        toast.error("Please fill in all required fields");
        return;
      }

      const { data, error } = await supabase
        .from("doctors")
        .update({
          name: editingDoctor.name,
          specialization: editingDoctor.specialization,
          hospital: editingDoctor.hospital,
          address: editingDoctor.address,
          area: editingDoctor.area,
          email: editingDoctor.email || null,
          phone: editingDoctor.phone || null,
        })
        .eq("id", editingDoctor.id)
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setDoctors(doctors.map(doc => doc.id === data[0].id ? data[0] : doc));

        toast.success("Doctor updated successfully");
        setIsEditDialogOpen(false);
        setEditingDoctor(null);
      }

    } catch (error: unknown) {
      console.error("Error updating doctor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update doctor";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDoctor = async () => {
    try {
      setIsSubmitting(true);

      if (!newDoctor.name || !newDoctor.specialty || !newDoctor.hospital || !newDoctor.address || !newDoctor.area) {
        toast.error("Please fill in all required fields");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to add a doctor");
      }

      const fullAddress = newDoctor.city
        ? `${newDoctor.address}, ${newDoctor.city}`
        : newDoctor.address;

      const { data, error } = await supabase
        .from("doctors")
        .insert({
          name: newDoctor.name,
          specialization: newDoctor.specialty,
          hospital: newDoctor.hospital,
          address: fullAddress,
          email: newDoctor.email || null,
          phone: newDoctor.phone || null,
          added_by: user.id,
          is_verified: true,
          area: newDoctor.area
        })
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setDoctors([...doctors, data[0]]);

        toast.success("Doctor added successfully");
        setIsAddDoctorDialogOpen(false);

        setNewDoctor({
          name: "",
          specialty: "",
          hospital: "",
          city: "",
          address: "",
          email: "",
          phone: "",
          area: "",
        });
      }
    } catch (error: unknown) {
      console.error("Error adding doctor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add doctor";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Doctors Management</h2>
        <Button onClick={() => setIsAddDoctorDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Doctor
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search doctors by name, specialty, hospital, address, or area..."
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
                <TableHead className="cursor-pointer" onClick={() => handleSort('added_by')}>
                  <div className="flex items-center">
                    Added to
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center">
                    Name
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('specialization')}>
                   <div className="flex items-center">
                    Specialty
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer" onClick={() => handleSort('hospital')}>
                   <div className="flex items-center">
                    Hospital
                     <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer" onClick={() => handleSort('address')}>
                   <div className="flex items-center">
                    Address
                     <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer" onClick={() => handleSort('area')}>
                   <div className="flex items-center">
                    Area
                     <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('is_verified')}>
                   <div className="flex items-center">
                    Status
                     <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No doctors found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell>{users[doctor.added_by] || doctor.added_by}</TableCell>
                    <TableCell className="font-medium">
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
                    <TableCell className="hidden md:table-cell">{doctor.address}</TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.area}</TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        doctor.is_verified
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {doctor.is_verified ? "Verified" : "Pending"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => {
                            setEditingDoctor(doctor);
                            setIsEditDialogOpen(true);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!doctor.is_verified && (
                            <DropdownMenuItem onClick={() => handleVerify(doctor.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Verify
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(doctor.id)}
                            className="text-red-600"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

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

      <Dialog open={isAddDoctorDialogOpen} onOpenChange={setIsAddDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
            <DialogDescription>
              Add a new doctor to the system. Fill in all the required information.
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
                  placeholder="Dr. Soham B"
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
                placeholder="City General Hospital"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="area">Area*</Label>
              <Input
                id="area"
                value={newDoctor.area}
                onChange={(e) => setNewDoctor({ ...newDoctor, area: e.target.value })}
                placeholder="Enter area"
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
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={newDoctor.city}
                  onChange={(e) => setNewDoctor({ ...newDoctor, city: e.target.value })}
                  placeholder="Health City"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newDoctor.email}
                  onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                  placeholder="soham.abc@hospital.com"
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription>
              Edit the information for this doctor.
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
                    placeholder="Dr. Soham B"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-specialty">Specialty*</Label>
                  <Input
                    id="edit-specialty"
                    value={editingDoctor.specialization}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, specialization: e.target.value })}
                    placeholder="Cardiology"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-hospital">Hospital / Clinic*</Label>
                <Input
                  id="edit-hospital"
                  value={editingDoctor.hospital}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, hospital: e.target.value })}
                  placeholder="City General Hospital"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-address">Address*</Label>
                <Input
                  id="edit-address"
                  value={editingDoctor.address}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, address: e.target.value })}
                  placeholder="123 Medical Ave"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-area">Area*</Label>
                <Input
                  id="edit-area"
                  value={editingDoctor.area}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, area: e.target.value })}
                  placeholder="Enter area"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingDoctor.email || ""}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, email: e.target.value })}
                    placeholder="soham.abc@hospital.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingDoctor.phone || ""}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, phone: e.target.value })}
                    placeholder="555-123-4567"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditDoctor} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.name}</p>
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
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.area}</p>
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{viewingDoctor.phone || "-"}</p>
                </div>
              </div>
               <div className="grid gap-2">
                  <Label>Status</Label>
                  <p className={`text-sm p-2 border rounded ${viewingDoctor.is_verified ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
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
    </div>
  );
}
