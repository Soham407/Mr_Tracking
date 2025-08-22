import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Doctor } from "@/types";
import AnimatedList from "@/components/ui/animated-list";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Area = () => {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch unique areas and doctors on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Get the current user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("You must be logged in to view areas");
        }

        // Fetch doctors added by the current user
        const { data: doctorsData, error: doctorsError } = await supabase
          .from("doctors")
          .select("*")
          .eq("added_by", user.id);

        if (doctorsError) throw doctorsError;

        // Extract unique areas from doctors data
        const uniqueAreas = Array.from(new Set(doctorsData?.map(doctor => doctor.area).filter(area => area && area.trim() !== '') || []));
        setAreas(uniqueAreas);
        setDoctors(doctorsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load areas and doctors");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter doctors based on selected area
  const filteredDoctors = selectedArea
    ? doctors.filter(doctor => doctor.area === selectedArea)
    : [];

  const handleAreaSelect = (area: string) => {
    setSelectedArea(area);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Area Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Section - Area Selection (3 columns on md+) */}
        <div className="col-span-12 md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Select Area</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading areas...</div>
              ) : areas.length > 0 ? (
                <AnimatedList
                  items={areas}
                  onItemSelect={handleAreaSelect}
                  className="w-full"
                  itemClassName="transition-colors duration-200"
                />
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No areas found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Section - Doctors List (9 columns on md+) */}
        <div className="col-span-12 md:col-span-9 overflow-y-auto max-h-[calc(100vh-100px)]">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedArea ? `Doctors in ${selectedArea}` : 'Select an area to view doctors'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading...</div>
              ) : selectedArea ? (
                filteredDoctors.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Specialization</TableHead>
                        <TableHead>Hospital</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDoctors.map((doctor) => (
                        <TableRow key={doctor.id}>
                          <TableCell className="font-medium">
                            <Button
                              variant="link"
                              className="p-0 h-auto"
                              onClick={() => navigate(`/mr/visits/new?doctorId=${doctor.id}`)}
                            >
                              {doctor.name}
                            </Button>
                          </TableCell>
                          <TableCell>{doctor.specialization}</TableCell>
                          <TableCell>{doctor.hospital}</TableCell>
                          <TableCell>{doctor.email || doctor.phone || '-'}</TableCell>
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
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No doctors found in this area.
                  </div>
                )
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Please select an area to view doctors.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Area; 