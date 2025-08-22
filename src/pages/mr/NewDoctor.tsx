import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  "Mapusa",
  "Jule solapur",
  "Railway lines", 
  "Kumbhar ves",
  "Sakhar peth",
  "Kumbhari ",
  "Tilak chowk", 
  "Bus stand",
  "Pune naka",
  "Sainath nagar",
  "Balives",
  "Kanna chowk",
  "Saat rasta",
  "Employment chowk",
  "Damani nagar",
  "Vijapur road", 
];

const NewDoctor = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const [formData, setFormData] = useState({
    name: "",
    specialization: "",
    hospital: "",
    area: "",
    address: "",
    email: "",
    phone: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    if (!user?.id) {
      toast.error("User not authenticated");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('doctors')
        .insert([{
          name: formData.name,
          specialization: formData.specialization,
          hospital: formData.hospital,
          area: formData.area,
          address: formData.address,
          email: formData.email || null,
          phone: formData.phone || null,
          added_by: user.id,
          is_verified: false
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Doctor added successfully");
      navigate("/mr/doctors");
    } catch (error) {
      console.error('Error adding doctor:', error);
      toast.error("Failed to add doctor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)}>Back to Doctors</Button>
        <Card>
          <CardHeader>
            <CardTitle>Add New Doctor</CardTitle>
            <CardDescription>Enter the details of the new doctor. They will be submitted for verification.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Doctor's Name</Label>
                <Input 
                  id="name" 
                  placeholder="Dr. John Smith" 
                  required 
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input 
                  id="specialization" 
                  placeholder="Cardiology" 
                  required 
                  value={formData.specialization}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hospital">Hospital/Clinic</Label>
                <Input 
                  id="hospital" 
                  placeholder="General Hospital" 
                  required 
                  value={formData.hospital}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="area">Area</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {formData.area || "Select area..."}
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
                                setFormData(prev => ({ ...prev, area: area }));
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.area === area ? "opacity-100" : "opacity-0"
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
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  placeholder="Enter full address" 
                  required 
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  placeholder="doctor@example.com" 
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  placeholder="555-123-4567" 
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Submitting..." : "Submit Doctor for Verification"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default NewDoctor;
