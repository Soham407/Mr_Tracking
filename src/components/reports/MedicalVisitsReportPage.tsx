import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; // For potential reset button
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // For Date Picker
import { Calendar } from "@/components/ui/calendar"; // For Date Picker
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // For Filters
import { Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area"; // Added for scrollable popover content
import { Separator } from "@/components/ui/separator"; // Added for popover title separator
import { cn } from "@/lib/utils";
import { format, parseISO, isBefore, isAfter, startOfDay, endOfDay } from "date-fns"; // Import more date-fns functions
import { Calendar as CalendarIcon, ChevronsUpDown, Trash } from "lucide-react"; // Import ChevronsUpDown and Trash
import { useAuth } from '@/hooks/useAuth';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"; // Import pagination components
import { useSortableTable } from '@/hooks/useSortableTable'; // Import useSortableTable
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; // Import dialog components
import { Label } from "@/components/ui/label"; // Import label component
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ReportPageProps {
  userRole: 'admin' | 'mr';
}

interface SupabaseError {
  message: string;
  code?: string;
}

// Define the structure for Report data (after processing)
interface MedicineOrderSummary {
  medicineName: string;
  quantity: number;
}

interface ReportEntry {
  id: string; // Visit ID
  visit_date: string;
  notes: string | null;
  status: string;
  mrId: string;
  medicalId: string; // Add medicalId
  medicalName?: string; // Add medicalName
  medicines: MedicineOrderSummary[]; // Array of medicines and quantities for this visit
  uniqueRowId: string; // Unique key for table rows (Visit ID is sufficient now)
  mrName?: string; // Add mrName
}

// Type for the data structure returned directly by the Supabase query for medical_visits
type MedicalVisitData = {
  id: string;
  visit_date: string;
  notes: string | null;
  status: string;
  mr_id: string;
  medical_area_id: string; // Include medical_area_id
  profiles: { name: string | null } | null; // Include profiles with name, allow name to be null
};

// Type for the data structure returned directly by the Supabase query for medical_visit_orders
type MedicalVisitOrderData = {
    id: string;
    medical_visit_id: string;
    medicine_id: string;
    quantity: number;
    medicines: { name: string } | null;
};

// Type for the data structure returned directly by the Supabase query for medicals
type MedicalData = {
    id: string;
    name: string;
};


// Types for filter options
interface FilterOption {
  value: string;
  label: string;
}

const MedicalVisitsReportPage: React.FC<ReportPageProps> = ({ userRole }) => {
  const { user } = useAuth(); // Get the current user
  // General state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalReports, setTotalReports] = useState(0); // State to hold total count of *filtered* data before pagination

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page

  // Search state (for MR view)
  const [searchTerm, setSearchTerm] = useState('');

  // Filter state (for Admin view)
  const [mrOptions, setMrOptions] = useState<FilterOption[]>([]);
  const [selectedMr, setSelectedMr] = useState<string>('all'); // 'all' or MR ID
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // State to hold the full processed data (before client-side filtering)
  const [processedData, setProcessedData] = useState<ReportEntry[]>([]);

  // Page navigation dialog state
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  // Fetch initial data and filter options based on role
  useEffect(() => {
    setProcessedData([]); // Clear data on role change
    setError(null);
    setCurrentPage(1); // Reset to first page

    // Reset sorting state when data or filters change significantly
    // The useSortableTable hook manages its own internal sorting state,
    // so we don't need to reset it here.

    if (userRole === 'mr') {
      setSearchTerm('');
      // Reset admin filters if switching to MR
      setSelectedMr('all');
      setStartDate(undefined);
      setEndDate(undefined);
    } else if (userRole === 'admin') {
      setSearchTerm(''); // Reset MR search if switching to Admin
      // Reset admin filters
      setSelectedMr('all');
      setStartDate(undefined);
      setEndDate(undefined);
      fetchFilterOptions(); // Fetch MR options for admin
    } else {
      setLoading(false); // No role, stop loading
    }
  }, [userRole]);

  const resetAdminFilters = () => {
      setSelectedMr('all');
      setStartDate(undefined);
      setEndDate(undefined);
      // Reset sorting state when filters are reset
      // The useSortableTable hook manages its own internal sorting state,
      // so we don't need to reset it here.
  }

  // Page navigation function
  const handlePageNavigation = () => {
    const totalPages = Math.ceil(totalReports / itemsPerPage);
    const pageNumber = parseInt(pageInputValue);
    
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      setIsPageDialogOpen(false);
      setPageInputValue('');
    }
  };

  const openPageDialog = () => {
    setPageInputValue('');
    setIsPageDialogOpen(true);
  };

  // Fetch MR filter options (only for admin)
  const fetchFilterOptions = async () => {
    // No need to set loading here, fetchReports handles it
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'mr');

      if (error) throw error;

      setMrOptions(data?.map(mr => ({ value: mr.id, label: mr.name })) || []);

    } catch (err: unknown) {
      const error = err as SupabaseError;
      console.error("Error fetching MR filter options:", error);
      // Don't set main error state, maybe a specific filter error state?
      setMrOptions([]);
    }
  };

  const fetchReports = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      let userId = null;
      if (userRole === 'mr') { // Fetch user ID only if role is MR
        const { data: { user: authUser } } = await supabase.auth.getUser();
        userId = authUser?.id;
        if (!userId) throw new Error('MR user not found');
      }

      // Fetch medical visits
      let visitsQuery = supabase
        .from('medical_visits')
        .select(`
          id,
          visit_date,
          notes,
          status,
          mr_id,
          medical_area_id,
          profiles ( name ) // Join profiles table and select name
        `);

      // Apply server-side MR filter
      if (userRole === 'mr' && userId) {
        visitsQuery = visitsQuery.eq('mr_id', userId);
      } else if (userRole === 'admin' && selectedMr !== 'all') {
        visitsQuery = visitsQuery.eq('mr_id', selectedMr);
      }

       // Apply server-side date filters if needed (can improve performance)
      // Example:
      // if (startDate) visitsQuery = visitsQuery.gte('visit_date', startDate.toISOString());
      // if (endDate) visitsQuery = visitsQuery.lte('visit_date', endDate.toISOString());


      const { data: visitsData, error: visitsError } = await visitsQuery
        .order('visit_date', { ascending: false });

      if (visitsError) throw visitsError;

      // Fetch medical visit orders with medicine names
      const { data: ordersData, error: ordersError } = await supabase
        .from('medical_visit_orders')
        .select(`
            id,
            medical_visit_id,
            medicine_id,
            quantity,
            medicines (
                name
            )
        `);

      if (ordersError) throw ordersError;

      // Fetch medical facilities
      const { data: medicalsData, error: medicalsError } = await supabase
        .from('medicals')
        .select(`
            id,
            name
        `);

      if (medicalsError) throw medicalsError;

      const medicalsMap = new Map(medicalsData?.map(medical => [medical.id, medical.name]));


      // Process the data into ReportEntry format (one entry per visit)
      const processedResult: ReportEntry[] = [];

      (visitsData as any[] || []).forEach(visit => { // Use any[] for initial data
          const relatedOrders = (ordersData as MedicalVisitOrderData[] || []).filter(order => order.medical_visit_id === visit.id);
          const medicalName = medicalsMap.get(visit.medical_area_id) || 'N/A'; // Client-side join
          const mrName = visit.profiles?.name || 'N/A'; // Extract MR Name

          const medicineSummary: MedicineOrderSummary[] = relatedOrders.map(order => ({
              medicineName: order.medicines?.name || 'N/A',
              quantity: order.quantity,
          }));

          processedResult.push({
              uniqueRowId: visit.id, // Visit ID is unique per visit
              id: visit.id,
              visit_date: visit.visit_date,
              notes: visit.notes,
              status: visit.status,
              mrId: visit.mr_id,
              medicalId: visit.medical_area_id,
              medicalName: medicalName,
              medicines: medicineSummary, // Add the array of medicines
              mrName: mrName,
          });
      });


      setProcessedData(processedResult);

    } catch (err: unknown) {
      console.error('Error fetching reports:', err);
      const error = err as SupabaseError;
      setError(error.message || 'Failed to fetch reports. Please try again.');
      setProcessedData([]); // Clear data on error
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [userRole, selectedMr]); // Add dependencies that fetchReports uses

  // Re-fetch reports when filters change (not pagination)
  useEffect(() => {
    // Avoid fetching if role hasn't been determined yet or during initial load triggered by role change
    if (userRole) {
        fetchReports(true); // Show loading for filter changes
    }
  }, [fetchReports, userRole, selectedMr, startDate, endDate, searchTerm]); // Only trigger on filter changes, not pagination

  // Apply client-side filtering to the *full* processed data
  const filteredData = useMemo(() => {
    let currentData = processedData; // Use the full processed data

    // Apply client-side filters
    if (userRole === 'admin') {
        currentData = currentData.filter(entry => {
            // Date Range Filter (client-side)
            try {
                const entryDate = parseISO(entry.visit_date);
                const isAfterStartDate = startDate ? !isBefore(entryDate, startOfDay(startDate)) : true;
                const isBeforeEndDate = endDate ? !isAfter(entryDate, endOfDay(endDate)) : true;
                return isAfterStartDate && isBeforeEndDate;
            } catch (e) {
                console.error("Error parsing or comparing date for client-side filtering:", entry.visit_date, e);
                return false;
            }
        });
    } else if (userRole === 'mr' && searchTerm) {
         // MR View: Simple text search
         const lowerCaseSearchTerm = searchTerm.toLowerCase();
         currentData = currentData.filter(entry =>
             entry.visit_date.toLowerCase().includes(lowerCaseSearchTerm) ||
             entry.status.toLowerCase().includes(lowerCaseSearchTerm) ||
             entry.medicalName?.toLowerCase().includes(lowerCaseSearchTerm) || // Include medical name in search
             entry.medicines.some(medicine => medicine.medicineName.toLowerCase().includes(lowerCaseSearchTerm)) // Search within medicine names
         );
    }

    // Update the total count based on the filtered data (before sorting and pagination)
    setTotalReports(currentData.length);

    return currentData; // Return the filtered data
  }, [processedData, userRole, searchTerm, startDate, endDate]); // Removed currentPage and itemsPerPage from dependencies

  // Use the useSortableTable hook at the top level with the filtered data
  const { sortedData, sortColumn, sortDirection, handleSort } = useSortableTable({
      data: filteredData, // Pass the filtered data to the hook
      defaultSortColumn: 'visit_date', // Optional: set a default sort column
      defaultSortDirection: 'desc', // Optional: set a default sort direction
  });

  // Apply client-side pagination to the sorted data
  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage]); // Dependencies are sortedData, currentPage, itemsPerPage


  // --- Render Functions ---

  const renderAdminFilters = () => (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MR Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">MR</label>
          <Select value={selectedMr} onValueChange={setSelectedMr}>
            <SelectTrigger>
              <SelectValue placeholder="Select MR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All MRs</SelectItem>
              {mrOptions.map((mr) => (
                <SelectItem key={mr.value} value={mr.value}>
                  {mr.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Start Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "End Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={resetAdminFilters}>
          Reset Filters
        </Button>
      </div>
    </div>
  );

  const renderMrSearch = () => (
     <div className="mb-4">
        <Input
          type="search"
          placeholder="Search reports (Medicine, Date, Status, Medical)..." // Updated placeholder
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
  );

  const renderReportTable = () => {
    // Helper function to render sort icon
    const renderSortIcon = (column: keyof ReportEntry) => {
        // Always return ChevronsUpDown for sortable columns
        return <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />;
    };

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {userRole === 'admin' && (
                <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('mrName' as keyof ReportEntry)}
                >
                    <div className="flex items-center justify-between">
                        MR Name {renderSortIcon('mrName' as keyof ReportEntry)}
                    </div>
                </TableHead>
            )}
            <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('visit_date' as keyof ReportEntry)}
            >
                <div className="flex items-center justify-between">
                    Visit Date {renderSortIcon('visit_date' as keyof ReportEntry)}
                </div>
            </TableHead>
            <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('medicalName' as keyof ReportEntry)}
            >
                <div className="flex items-center justify-between">
                    Medical Name {renderSortIcon('medicalName' as keyof ReportEntry)}
                </div>
            </TableHead>
            <TableHead>Medicines</TableHead> {/* Not sortable */}
            <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('status' as keyof ReportEntry)}
            >
                <div className="flex items-center justify-between">
                    Status {renderSortIcon('status' as keyof ReportEntry)}
                </div>
            </TableHead>
            {userRole === 'admin' && <TableHead>Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length > 0 ? (
            paginatedData.map((entry) => (
              <TableRow key={entry.uniqueRowId}>
                {userRole === 'admin' && <TableCell>{entry.mrName}</TableCell>}
                <TableCell>{format(parseISO(entry.visit_date), "MMM d, yyyy")}</TableCell>
                <TableCell>{entry.medicalName}</TableCell>
                <TableCell>
                  {entry.medicines.length > 1 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-auto py-1 px-2">
                          {entry.medicines.length} Medicines <ChevronsUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0">
                        <div className="p-2">
                          <h4 className="font-semibold text-sm">Medicines</h4>
                        </div>
                        <Separator />
                        <ScrollArea className="max-h-48 w-full p-2">
                          <ul className="space-y-1">
                            {entry.medicines.map((medicine, index) => (
                              <li key={index} className="text-sm flex justify-between items-center">
                                <span>{medicine.medicineName}</span>
                                <span className="font-bold">({medicine.quantity})</span>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  ) : entry.medicines.length === 1 ? (
                    <p className="text-sm">{entry.medicines[0].medicineName} ({entry.medicines[0].quantity})</p>
                  ) : (
                    <p className="text-sm">No medicines ordered</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={entry.status.toLowerCase() === 'approved' ? 'default' : 'secondary'}>
                    {entry.status}
                  </Badge>
                </TableCell>
                {userRole === 'admin' && (
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" aria-label="Delete">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Visit Report</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this visit report? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              aria-label="Delete"
                              onClick={async () => {
                                try {
                                  // Delete medical_visit_orders first
                                  const { error: orderError } = await supabase
                                    .from("medical_visit_orders")
                                    .delete()
                                    .eq("medical_visit_id", entry.id);
                                  if (orderError) throw orderError;
                                  // Delete medical_visit
                                  const { error: visitError } = await supabase
                                    .from("medical_visits")
                                    .delete()
                                    .eq("id", entry.id);
                                  if (visitError) throw visitError;
                                  toast.success("Medical visit deleted successfully");
                                  // Refresh data
                                  fetchReports();
                                } catch (err) {
                                  toast.error("Failed to delete medical visit");
                                }
                              }}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={userRole === 'admin' ? 5 : 4} className="text-center">
                {searchTerm ? 'No reports match your search.' : 'No reports found.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };

 const renderPagination = () => {
    const totalPages = Math.ceil(totalReports / itemsPerPage);
    if (totalPages <= 1) return null; // Don't render pagination if only one page

    return (
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
                    
                    {/* Custom pagination logic to show only 3 consecutive pages + last page */}
                    {(() => {
                        const pages = [];
                        
                        if (totalPages <= 5) {
                            // If 5 or fewer pages, show all pages
                            for (let i = 1; i <= totalPages; i++) {
                                pages.push(
                                    <PaginationItem key={i}>
                                        <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setCurrentPage(i);
                                            }}
                                            isActive={currentPage === i}
                                        >
                                            {i}
                                        </PaginationLink>
                                    </PaginationItem>
                                );
                            }
                        } else {
                            // Show 3 consecutive pages around current page + last page
                            let startPage = Math.max(1, currentPage - 1);
                            let endPage = Math.min(totalPages, currentPage + 1);
                            
                            // Adjust if we're near the beginning
                            if (currentPage <= 2) {
                                startPage = 1;
                                endPage = 3;
                            }
                            
                            // Adjust if we're near the end
                            if (currentPage >= totalPages - 1) {
                                startPage = totalPages - 2;
                                endPage = totalPages;
                            }
                            
                            // Add first page if not included
                            if (startPage > 1) {
                                pages.push(
                                    <PaginationItem key={1}>
                                        <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setCurrentPage(1);
                                            }}
                                            isActive={currentPage === 1}
                                        >
                                            1
                                        </PaginationLink>
                                    </PaginationItem>
                                );
                                
                                // Add ellipsis if there's a gap
                                if (startPage > 2) {
                                    pages.push(
                                        <PaginationItem key="ellipsis1">
                                            <button
                                                onClick={openPageDialog}
                                                className="px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors cursor-pointer"
                                                title="Go to specific page"
                                            >
                                                ...
                                            </button>
                                        </PaginationItem>
                                    );
                                }
                            }
                            
                            // Add the 3 consecutive pages
                            for (let i = startPage; i <= endPage; i++) {
                                pages.push(
                                    <PaginationItem key={i}>
                                        <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setCurrentPage(i);
                                            }}
                                            isActive={currentPage === i}
                                        >
                                            {i}
                                        </PaginationLink>
                                    </PaginationItem>
                                );
                            }
                            
                            // Add ellipsis and last page if not included
                            if (endPage < totalPages) {
                                if (endPage < totalPages - 1) {
                                    pages.push(
                                        <PaginationItem key="ellipsis2">
                                            <button
                                                onClick={openPageDialog}
                                                className="px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors cursor-pointer"
                                                title="Go to specific page"
                                            >
                                                ...
                                            </button>
                                        </PaginationItem>
                                    );
                                }
                                
                                pages.push(
                                    <PaginationItem key={totalPages}>
                                        <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setCurrentPage(totalPages);
                                            }}
                                            isActive={currentPage === totalPages}
                                        >
                                            {totalPages}
                                        </PaginationLink>
                                    </PaginationItem>
                                );
                            }
                        }
                        
                        return pages;
                    })()}
                    
                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                            }}
                            aria-disabled={currentPage >= totalPages}
                            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
 };


  // --- Main Component Return ---
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">
        {userRole === 'admin' ? 'Admin Medical Visit Reports' : 'My Medical Visit Reports'}
      </h1>

      {/* Render Filters/Search based on role */}
      {userRole === 'admin' ? renderAdminFilters() : renderMrSearch()}

      {/* Loading and Error States */}
      {loading && <p>Loading reports...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {/* Table */}
      {!loading && !error && renderReportTable()}

      {/* Pagination */}
      {!loading && !error && paginatedData.length > 0 && renderPagination()}

      {/* Page Navigation Dialog */}
      <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Go to Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pageNumber">Page Number</Label>
              <Input
                id="pageNumber"
                type="number"
                min="1"
                max={Math.ceil(totalReports / itemsPerPage)}
                value={pageInputValue}
                onChange={(e) => setPageInputValue(e.target.value)}
                placeholder={`1 - ${Math.ceil(totalReports / itemsPerPage)}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePageNavigation();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Enter a page number between 1 and {Math.ceil(totalReports / itemsPerPage)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePageNavigation}>
              Go to Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MedicalVisitsReportPage;
