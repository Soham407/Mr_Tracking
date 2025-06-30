import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Doctor } from "@/types";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface AreaReminderDialogProps {
  onEditDoctor: (doctor: Doctor) => void;
}

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

export function AreaReminderDialog({ onEditDoctor }: AreaReminderDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [doctorsWithoutArea, setDoctorsWithoutArea] = useState<Doctor[]>([]);
  const [isEditAreaDialogOpen, setIsEditAreaDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkDoctorsWithoutArea = async () => {
      try {
        // Get the current user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if reminder was dismissed recently
        const lastDismissed = localStorage.getItem('areaReminderDismissed');
        if (lastDismissed) {
          const lastDismissedDate = new Date(lastDismissed);
          const now = new Date();
          // If less than 24 hours have passed since last dismissal, don't show the reminder
          if (now.getTime() - lastDismissedDate.getTime() < 24 * 60 * 60 * 1000) {
            return;
          }
        }

        // Fetch doctors without area
        const { data: doctors, error } = await supabase
          .from("doctors")
          .select("*")
          .eq("added_by", user.id)
          .or('area.is.null,area.eq.""');

        if (error) throw error;

        if (doctors && doctors.length > 0) {
          setDoctorsWithoutArea(doctors);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Error checking doctors without area:", error);
      }
    };

    checkDoctorsWithoutArea();
  }, []);

  // Add effect to handle edit dialog state
  useEffect(() => {
    if (editingDoctor) {
      setIsEditAreaDialogOpen(true);
    }
  }, [editingDoctor]);

  const handleUpdateAreas = () => {
    setIsOpen(false);
    navigate("/mr/doctors");
    // Open edit dialog for the first doctor
    if (doctorsWithoutArea.length > 0) {
      onEditDoctor(doctorsWithoutArea[0]);
    }
  };

  const handleRemindLater = () => {
    // Store the current timestamp in localStorage
    localStorage.setItem('areaReminderDismissed', new Date().toISOString());
    setIsOpen(false);
  };

  const handleUpdateArea = async () => {
    if (!editingDoctor) return;

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("doctors")
        .update({
          area: editingDoctor.area
        })
        .eq("id", editingDoctor.id);

      if (error) throw error;

      // Update the local state
      setDoctorsWithoutArea(doctorsWithoutArea.filter(doc => doc.id !== editingDoctor.id));
      
      toast.success("Area updated successfully");
      setIsEditAreaDialogOpen(false);
      setEditingDoctor(null);

      // If no more doctors without area, close the main dialog
      if (doctorsWithoutArea.length === 1) {
        setIsOpen(false);
      } else {
        // Reopen the main dialog if there are more doctors
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error updating area:", error);
      toast.error("Failed to update area");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Doctor Areas</DialogTitle>
            <DialogDescription>
              You have {doctorsWithoutArea.length} doctors without area information. 
              Please update their areas to better track your visits.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[200px] overflow-y-auto">
            <ul className="space-y-2">
              {doctorsWithoutArea.map((doctor) => (
                <li 
                  key={doctor.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    console.log("Doctor clicked:", doctor);
                    setEditingDoctor(doctor);
                    setIsEditAreaDialogOpen(true);
                    setIsOpen(false); // Close the main dialog when opening edit dialog
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doctor.name}</p>
                    <p className="text-sm text-gray-500 truncate">{doctor.hospital}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRemindLater}
              className="w-full sm:w-auto"
            >
              Remind me later
            </Button>
            <Button
              onClick={handleUpdateAreas}
              className="w-full sm:w-auto"
            >
              Update Areas Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Area Dialog */}
      <Dialog open={isEditAreaDialogOpen} onOpenChange={setIsEditAreaDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Area</DialogTitle>
            <DialogDescription>
              Add area information for Dr. {editingDoctor?.name}
            </DialogDescription>
          </DialogHeader>
          {editingDoctor && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Doctor's Name</Label>
                <p className="text-sm p-2 border rounded bg-muted">{editingDoctor.name}</p>
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <p className="text-sm p-2 border rounded bg-muted">{editingDoctor.address}</p>
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAreaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateArea} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
