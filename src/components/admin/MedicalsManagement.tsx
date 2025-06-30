import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSortableTable } from "@/hooks/useSortableTable";
import {
  MoreHorizontal,
  Plus, // Changed from UserPlus to Plus
  Search,
  Edit,
  Trash,
  ArrowUpDown, // Added ArrowUpDown
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

// Update the Medical type to match the database schema
type Medical = {
  id: string;
  name: string;
  address: string | null;
  area: string | null;
  created_at: string | null;
  user_id: string;
  user_name?: string; // Added for displaying the user who added the medical
};

type Profile = {
  id: string;
  role: 'admin' | 'mr';
  name: string | null; // Changed from full_name to name
};

export function MedicalsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [medicals, setMedicals] = useState<Medical[]>([]);
  const [isAddMedicalDialogOpen, setIsAddMedicalDialogOpen] = useState(false);
  const [newMedical, setNewMedical] = useState({
    name: "",
    address: "",
    area: "",
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMedical, setEditingMedical] = useState<Medical | null>(null);
  const [isViewMedicalDialogOpen, setIsViewMedicalDialogOpen] = useState(false);
  const [viewingMedical, setViewingMedical] = useState<Medical | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<Profile['role'] | null>(null); // State to store user role

  const columns = useMemo(() => {
    const baseColumns = [
      { key: 'name', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'area', label: 'Area' },
    ];

    if (userRole === 'admin') {
      return [
        ...baseColumns,
        { key: 'user_name', label: 'Added By' },
      ];
    }
    return baseColumns;
  }, [userRole]) as { key: keyof Medical, label: string }[];

  const { sortedData, sortColumn, sortDirection, handleSort } = useSortableTable<Medical>({ data: medicals, defaultSortColumn: 'name' });


  useEffect(() => {
    fetchMedicals();
  }, []);

  const fetchMedicals = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        toast.error("You must be logged in to view medicals");
        return;
      }

      // Check user role from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .returns<Profile>();

      if (profileError) throw profileError;
      setUserRole(profileData?.role || null); // Set the user role

      // Fetch medicals based on user role
      let medicalsData: Medical[] = [];
      if (profileData?.role === 'admin') {
        // Fetch all medicals
        const { data: medicalsRes, error: medicalsError } = await supabase
          .from("medicals")
          .select("*")
          .returns<Medical[]>();

        if (medicalsError) {
          console.error("Supabase error fetching medicals for admin:", medicalsError);
          throw medicalsError;
        }

        // Fetch all profiles to get user names
        const { data: profilesRes, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name") // Select 'name' instead of 'full_name'
          .returns<Profile[]>();

        if (profilesError) {
          console.error("Supabase error fetching profiles:", profilesError);
          throw profilesError;
        }

        // Create a map of user_id to name
        const userMap = new Map(profilesRes.map(profile => [profile.id, profile.name]));

        // Merge user_name into medicals data
        medicalsData = medicalsRes.map(medical => ({
          ...medical,
          user_name: userMap.get(medical.user_id) || 'N/A'
        }));

      } else {
        const { data, error } = await supabase
          .from("medicals")
          .select("*")
          .eq('user_id', user.id)
          .returns<Medical[]>();

        if (error) {
          console.error("Supabase error fetching medicals for MR:", error);
          throw error;
        }
        medicalsData = data;
      }

      setMedicals(medicalsData || []);
    } catch (error) {
      console.error("Caught error in fetchMedicals:", error);
      toast.error("Failed to load medicals");
    } finally {
      setIsLoading(false);
    }
  };

  const sortedAndFilteredMedicals = useMemo(() => {
    return sortedData.filter(
      (medical) =>
        medical.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (medical.address && medical.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (medical.area && medical.area.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [sortedData, searchTerm]);


  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("medicals")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setMedicals(medicals.filter((medical) => medical.id !== id));
      toast.success("Medical deleted successfully");
    } catch (error: unknown) {
      console.error("Error deleting medical:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete medical";
      toast.error(errorMessage);
    }
  };

  const handleEditMedical = async () => {
    if (!editingMedical) return;

    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!editingMedical.name || !editingMedical.address || !editingMedical.area) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Update the medical in the database
      const { data, error } = await supabase
        .from("medicals")
        .update({
          name: editingMedical.name,
          address: editingMedical.address,
          area: editingMedical.area,
        })
        .eq("id", editingMedical.id)
        .select()
        .returns<Medical[]>();

      if (error) throw error;

      if (data && data[0]) {
        setMedicals(medicals.map(med => med.id === data[0].id ? data[0] : med));
        toast.success("Medical updated successfully");
        setIsEditDialogOpen(false);
        setEditingMedical(null);
      }
    } catch (error: unknown) {
      console.error("Error updating medical:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update medical";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMedical = async () => {
    try {
      setIsSubmitting(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        toast.error("You must be logged in to add a medical");
        return;
      }

      // Validate required fields
      if (!newMedical.name || !newMedical.address || !newMedical.area) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Add the medical to the database with user_id
      const { data, error } = await supabase
        .from("medicals")
        .insert({
          name: newMedical.name,
          address: newMedical.address,
          area: newMedical.area,
          user_id: user.id,
        })
        .select()
        .returns<Medical[]>();

      if (error) throw error;

      if (data && data[0]) {
        setMedicals([...medicals, data[0]]);
        toast.success("Medical added successfully");
        setIsAddMedicalDialogOpen(false);
        setNewMedical({
          name: "",
          address: "",
          area: "",
        });
      }
    } catch (error: unknown) {
      console.error("Error adding medical:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add medical";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Medicals Management</h2>
        <Button onClick={() => setIsAddMedicalDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Medical
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search medicals by name, address, or area..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse">Loading medicals...</div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column.key)}
                      className="flex items-center"
                    >
                      {column.label}
                      <ArrowUpDown className="ml-1 h-4 w-4" />
                    </Button>
                  </TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredMedicals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (userRole === 'admin' ? 2 : 1)} className="h-24 text-center">
                    No medicals found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredMedicals.map((medical) => (
                  <TableRow key={medical.id}>
                    <TableCell className="font-medium">
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => {
                          setViewingMedical(medical);
                          setIsViewMedicalDialogOpen(true);
                        }}
                      >
                        {medical.name}
                      </Button>
                    </TableCell>
                    <TableCell>{medical.address}</TableCell>
                    <TableCell>{medical.area}</TableCell>
                    {userRole === 'admin' && (
                      <TableCell>{medical.user_name}</TableCell>
                    )}
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
                            setEditingMedical(medical);
                            setIsEditDialogOpen(true);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(medical.id)}
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

      <Dialog open={isAddMedicalDialogOpen} onOpenChange={setIsAddMedicalDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add New Medical</DialogTitle>
            <DialogDescription>
              Add a new medical to the system. Fill in all the required information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name*</Label>
              <Input
                id="name"
                value={newMedical.name}
                onChange={(e) => setNewMedical({ ...newMedical, name: e.target.value })}
                placeholder="Medical Center ABC"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address*</Label>
              <Input
                id="address"
                value={newMedical.address}
                onChange={(e) => setNewMedical({ ...newMedical, address: e.target.value })}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="area">Area*</Label>
              <Input
                id="area"
                value={newMedical.area}
                onChange={(e) => setNewMedical({ ...newMedical, area: e.target.value })}
                placeholder="Downtown"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddMedicalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMedical} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Medical"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Edit Medical</DialogTitle>
            <DialogDescription>
              Edit the information for this medical.
            </DialogDescription>
          </DialogHeader>
          {editingMedical && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name*</Label>
                <Input
                  id="edit-name"
                  value={editingMedical.name}
                  onChange={(e) => setEditingMedical({ ...editingMedical, name: e.target.value })}
                  placeholder="Medical Center ABC"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-address">Address*</Label>
                <Input
                  id="edit-address"
                  value={editingMedical.address}
                  onChange={(e) => setEditingMedical({ ...editingMedical, address: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-area">Area*</Label>
                <Input
                  id="edit-area"
                  value={editingMedical.area}
                  onChange={(e) => setEditingMedical({ ...editingMedical, area: e.target.value })}
                  placeholder="Downtown"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditMedical} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewMedicalDialogOpen} onOpenChange={setIsViewMedicalDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Medical Details</DialogTitle>
            <DialogDescription>
              Viewing information for {viewingMedical?.name}. Details are read-only.
            </DialogDescription>
          </DialogHeader>
          {viewingMedical && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <p className="text-sm p-2 border rounded bg-muted">{viewingMedical.name}</p>
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <p className="text-sm p-2 border rounded bg-muted">{viewingMedical.address}</p>
              </div>
              <div className="grid gap-2">
                <Label>Area</Label>
                <p className="text-sm p-2 border rounded bg-muted">{viewingMedical.area}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewMedicalDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
