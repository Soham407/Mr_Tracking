import React, { useState, useMemo, useEffect } from 'react';
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
import { useAuth } from '@/hooks/useAuth'; // Add this import
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"; // Import pagination components
import { useLocation } from 'react-router-dom'; // Import useLocation
import { PostgrestResponse, PostgrestError } from '@supabase/supabase-js'; // Import Supabase types
import { useSortableTable } from '@/hooks/useSortableTable'; // Import useSortableTable
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; // Import dialog components
import { Label } from "@/components/ui/label"; // Import label component
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ReportPageProps {
  userRole: 'admin' | 'mr';
}

type NestedQueryError = {
  code: string;
  message: string;
};

interface SupabaseError {
  message: string;
  code?: string;
}

// Define the structure for Report data
interface MedicineOrderSummary {
  medicineName: string;
  quantity: number;
}

interface ReportEntry {
  id: string; // Visit ID
  mrId: string;
  mrName?: string;
  doctorId: string;
  doctor: string;
  date: string;
  status: string;
  medicines: MedicineOrderSummary[]; // Array of medicines and quantities for this visit
  uniqueRowId: string; // Unique key for table rows (Visit ID is sufficient now)
}

// Types for filter options
interface FilterOption {
  value: string;
  label: string;
}

// Define precise types for Supabase query responses
interface SupabaseProfile {
  id: string;
  name: string;
}

interface SupabaseDoctor {
  id: string;
  name: string;
}

interface SupabaseMedicine {
  id: string;
  name: string;
}

// Type for the structure returned by the fetchFilterOptions query
type FilterOptionsVisitData = {
  doctors?: SupabaseDoctor | NestedQueryError | PostgrestError | null;
  visit_orders?: {
    medicines?: SupabaseMedicine | NestedQueryError | PostgrestError | null;
  }[] | null;
};

// Type for the structure returned by the fetchReports query
type ReportVisitData = {
  id: string;
  date: string;
  status: string;
  mr_id: string;
  doctors?: SupabaseDoctor | NestedQueryError | PostgrestError | null;
  visit_orders?: ( // visit_orders is an array of objects
    { // Each object in the array can be the successful structure
      id: string;
      quantity: number;
      medicines?: SupabaseMedicine | NestedQueryError | PostgrestError | null;
    } | NestedQueryError | PostgrestError
  )[] | null; // visit_orders array can be null
};

// Type guard to check if an object is a NestedQueryError (updated for new definition)
const isNestedQueryError = (obj: any): obj is NestedQueryError =>
  obj && typeof obj === 'object' && 'error' in obj && obj.error === true;


const ReportPage: React.FC<ReportPageProps> = ({ userRole }) => {
  const { user } = useAuth(); // Get the current user
  const location = useLocation(); // Get the current location
  const queryParams = new URLSearchParams(location.search);
  const reportType = queryParams.get('type'); // Get the report type from query params

  // General state
  const [reportData, setReportData] = useState<ReportEntry[]>([]); // This will now hold the paginated and filtered data
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalReports, setTotalReports] = useState(0); // State to hold total count of filtered data

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page

  // Search state (for MR view)
  const [searchTerm, setSearchTerm] = useState('');

  // Filter state (for Admin view)
  const [mrOptions, setMrOptions] = useState<FilterOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<FilterOption[]>([]);
  const [medicineOptions, setMedicineOptions] = useState<FilterOption[]>([]);
  const [selectedMr, setSelectedMr] = useState<string>('all'); // 'all' or MR ID
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all'); // 'all' or Doctor ID
  const [selectedMedicine, setSelectedMedicine] = useState<string>('all'); // 'all' or Medicine ID
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // State to hold the full processed data before client-side filtering and sorting
  const [processedData, setProcessedData] = useState<ReportEntry[]>([]);

  // Page navigation dialog state
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  // Fetch initial data and filter options
  useEffect(() => {
    // Reset common state on role change or report type change
    setReportData([]);
    setProcessedData([]); // Reset processed data as well
    setError(null);
    setLoading(true); // Start loading immediately
    setCurrentPage(1); // Reset to first page on role change or report type change
    // Reset sorting state when data or filters change significantly
    // The useSortableTable hook manages its own internal sorting state,
    // so we don't need to reset it here.
    // setSortColumn(null);
    // setSortDirection(null);


    // Reset Admin-specific state just in case
    resetAdminFilters();
    // Reset MR-specific state just in case
    setSearchTerm('');

    if (userRole === 'mr') {
      fetchReports(); // Fetch for MR
    } else if (userRole === 'admin') {
      // Fetch filter options *then* fetch reports
      fetchFilterOptions().then(() => fetchReports());
    } else {
        setLoading(false); // No role, stop loading
    }
  }, [userRole, reportType]); // Add reportType dependency

  // Fetch filter options and reports whenever relevant states change
  useEffect(() => {
      // Fetch filter options only for admin role
      if (userRole === 'admin') {
          fetchFilterOptions(selectedMr); // Pass selectedMr to fetchFilterOptions
      }
      // Re-fetch reports when filters change (not pagination)
      fetchReports();

  }, [selectedMr, selectedDoctor, selectedMedicine, startDate, endDate, searchTerm, userRole, reportType]); // Removed currentPage and itemsPerPage to prevent loading on pagination


  const resetAdminFilters = () => {
      setSelectedMr('all');
      setSelectedDoctor('all');
      setSelectedMedicine('all');
      setStartDate(undefined);
      setEndDate(undefined);
      // Reset sorting state when filters are reset
      // The useSortableTable hook manages its own internal sorting state,
      // so we don't need to reset it here.
      // setSortColumn(null);
      // setSortDirection(null);
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

  const fetchFilterOptions = async (mrId: string = 'all') => {
    setLoading(true);

    try {
      // Fetch all MRs
      const { data: mrData, error: mrError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'mr');

      if (mrError || !Array.isArray(mrData)) {
        throw new Error("Failed to fetch MR options");
      }

      setMrOptions(mrData.map(mr => ({ value: mr.id, label: mr.name })));

      // === Admin flow: Fetch all doctors and medicines ===
      if (userRole === 'admin' && mrId === 'all') {
        const [{ data: doctors, error: docErr }, { data: medicines, error: medErr }] = await Promise.all([
          supabase.from('doctors').select('id, name'),
          supabase.from('medicines').select('id, name'),
        ]);

        if (docErr || !Array.isArray(doctors)) throw new Error("Failed to fetch doctors");
        if (medErr || !Array.isArray(medicines)) throw new Error("Failed to fetch medicines");

        setDoctorOptions(doctors.map(doc => ({ value: doc.id, label: doc.name })));
        setMedicineOptions(medicines.map(med => ({ value: med.id, label: med.name })));
        return;
      }

      // === Specific MR selected: Fetch doctors + medicines from visits ===
      const { data: visits, error: visitError } = await supabase
        .from('visits')
        .select(`
          doctors (
            id,
            name
          ),
          visit_orders (
            medicines (
              id,
              name
            )
          )
        `)
        .eq('mr_id', mrId);

    if (visitError || !Array.isArray(visits)) {
      throw new Error('Visit fetch failed');
    }

    const doctorMap = new Map<string, FilterOption>();
    const medicineMap = new Map<string, FilterOption>();

    for (const visit of visits as unknown as FilterOptionsVisitData[]) { // Cast to unknown then to the new type
      const doc = visit.doctors;
      if (doc && !isNestedQueryError(doc) && (doc as SupabaseDoctor)?.id && (doc as SupabaseDoctor)?.name) { // Use isNestedQueryError and optional chaining with cast
        doctorMap.set((doc as SupabaseDoctor).id, { value: (doc as SupabaseDoctor).id, label: (doc as SupabaseDoctor).name });
      }

      visit.visit_orders?.forEach(order => {
        // Check if the order object itself is a query error
        if (isNestedQueryError(order)) { // Use isNestedQueryError
            console.warn('Skipping order due to nested query error:', order);
            return; // Skip this order
        }
        // Cast order to the expected structure before accessing properties
        const typedOrder = order as { id: string; quantity: number; medicines?: SupabaseMedicine | NestedQueryError | PostgrestError | null; };
        const med = typedOrder?.medicines; // Use optional chaining
        if (med && !isNestedQueryError(med) && (med as SupabaseMedicine)?.id && (med as SupabaseMedicine)?.name) { // Use isNestedQueryError and optional chaining with cast
          medicineMap.set((med as SupabaseMedicine).id, { value: (med as SupabaseMedicine).id, label: (med as SupabaseMedicine).name });
        } else if (isNestedQueryError(med)) { // Use isNestedQueryError
           console.warn('Skipping medicine order due to nested query error:', med);
        }
      });
    }

      setDoctorOptions(Array.from(doctorMap.values()));
      setMedicineOptions(Array.from(medicineMap.values()));

    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error fetching filter options:", error.message);
      setError(error.message || 'Failed to load filter options.');
      setMrOptions([]);
      setDoctorOptions([]);
      setMedicineOptions([]);
    } finally {
      // Leave loading = true; let fetchReports clear it
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      // First get the current user if not admin
      let userId = null;
      if (userRole !== 'admin') {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
        if (!userId) throw new Error('User not found');
      }

      // Build the main query with left joins
      let query = supabase
        .from('visits')
        .select(`
          id,
          date,
          status,
          mr_id,
          doctors!left (
            id,
            name
          ),
          visit_orders!left (
            id,
            quantity,
            medicines!left (
              id,
              name
            )
          )
        `); // Removed count: 'exact' here as we'll count processed data

      // Apply MR filter based on user role and selection
      if (userRole === 'mr' && userId) {
        // MR view: filter by the logged-in MR's ID
        query = query.eq('mr_id', userId);
      } else if (userRole === 'admin' && selectedMr !== 'all') {
        // Admin view: filter by the selected MR's ID
        query = query.eq('mr_id', selectedMr);
      }

      // Execute query (fetch relevant data based on server-side filters)
      // Cast to any[] first to handle potential top-level errors or unexpected structures
      const { data: visitsData, error: visitsError } = await query.order('date', { ascending: false });

      if (visitsError) throw visitsError;

      console.log('Visits data fetched (before processing):', visitsData?.length);

      // Get unique MR IDs from the visits
      // Safely map over visitsData, assuming mr_id exists if the base query succeeded
      const mrIds = [...new Set((visitsData as any[] || []).map(visit => (visit as any).mr_id).filter(Boolean) || [])];


      // Fetch MR profiles in a separate query
      const { data: mrProfiles, error: mrProfilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', mrIds);

      if (mrProfilesError) throw mrProfilesError;

      // Create a map of MR IDs to names
      const mrMap = new Map(mrProfiles?.map(profile => [profile.id, profile.name]) || []);

      // Process the data into ReportEntry format (one entry per visit)
      const processedResult: ReportEntry[] = [];

      // Iterate over the fetched data, casting each element to any first
      (visitsData as any as ReportVisitData[] || []).forEach((visit) => {
          // Check if the visit object itself is a query error (shouldn't happen with ReportVisitData type, but keep for safety)
          if (isNestedQueryError(visit)) { // Use isNestedQueryError
              console.warn('Skipping visit due to unexpected query error structure:', visit);
              return; // Skip this visit
          }

          // Safely access properties after confirming it's not a query error
          // visit.visit_orders is now typed as an array that can contain order objects or NestedQueryError
          const orders = visit.visit_orders || [];
          const mrName = mrMap.get(visit.mr_id) || 'N/A';

          // Check if doctors relation is an error or null
          // Cast visit.doctors to the expected union type before checking
          const typedDoctors = visit.doctors as SupabaseDoctor | NestedQueryError | PostgrestError | null;
          const doctorName = (typedDoctors && !isNestedQueryError(typedDoctors)) ? (typedDoctors as SupabaseDoctor).name : 'N/A'; // Use isNestedQueryError and cast
          const doctorId = (typedDoctors && !isNestedQueryError(typedDoctors)) ? (typedDoctors as SupabaseDoctor).id : ''; // Use isNestedQueryError and cast


          const medicineSummary: MedicineOrderSummary[] = [];
          orders.forEach(order => {
              // Check if the order object itself is a query error
              if (isNestedQueryError(order)) { // Use isNestedQueryError
                  console.warn('Skipping order due to nested query error:', order);
                  return; // Skip this order
              }

              // Cast order to the expected structure before accessing properties
              const typedOrder = order as { id: string; quantity: number; medicines?: SupabaseMedicine | NestedQueryError | PostgrestError | null; };

              // Check if medicines relation in order is an error or null
              const med = typedOrder?.medicines; // Use optional chaining
              // Cast med to the expected union type before checking
              const typedMed = med as SupabaseMedicine | NestedQueryError | PostgrestError | null;

              if (typedMed && !isNestedQueryError(typedMed) && (typedMed as SupabaseMedicine).name) { // Use isNestedQueryError and cast
                  medicineSummary.push({
                      medicineName: (typedMed as SupabaseMedicine).name,
                      quantity: typedOrder.quantity, // quantity should be directly on visit_orders row
                  });
              } else if (isNestedQueryError(typedMed)) { // Use isNestedQueryError
                   console.warn('Skipping medicine order due to nested query error:', typedMed);
              }
          });


          processedResult.push({
              uniqueRowId: visit.id, // Visit ID is unique per visit
              id: visit.id,
              mrId: visit.mr_id,
              mrName: mrName,
              doctorId: doctorId,
              doctor: doctorName,
              date: visit.date,
              status: visit.status,
              medicines: medicineSummary, // Add the array of medicines
          });
      });

      console.log('Processed data length (after flatMap):', processedResult.length);
      setProcessedData(processedResult); // Store the full processed data

    } catch (err) {
      console.error('Error fetching reports:', err);
      // Log the full error object for more details
      console.error(err);
      setError('Failed to fetch reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Apply client-side filtering to the *full* processed data
  const filteredData = useMemo(() => {
    let currentData = processedData; // Use the full processed data

    // Apply client-side filtering for Doctor, Medicine, and Date Range in Admin view
    if (userRole === 'admin') {
        currentData = currentData.filter(entry => {
            // MR Filter is now handled server-side, no need for client-side MR filter here

            // Doctor Filter (client-side)
            if (selectedDoctor !== 'all' && entry.doctorId !== selectedDoctor) {
                 return false;
            }
            // Medicine Filter (client-side)
            if (selectedMedicine !== 'all') {
                const hasMedicine = entry.medicines.some(medicine => medicine.medicineName === medicineOptions.find(opt => opt.value === selectedMedicine)?.label);
                if (!hasMedicine) {
                    return false;
                }
            }

            // Date Range Filter (client-side)
             try {
                const entryDate = parseISO(entry.date);
                if (startDate && isBefore(entryDate, startOfDay(startDate))) {
                    return false;
                }
                if (endDate && isAfter(entryDate, endOfDay(endDate))) {
                    return false;
                }
            } catch (e) {
                console.error("Error parsing or comparing date for client-side filtering:", entry.date, e);
                return false;
            }

            return true; // Passes all active filters
        });
    } else if (userRole === 'mr' && searchTerm) {
         // MR View: Simple text search (client-side on the full data)
         const lowerCaseSearchTerm = searchTerm.toLowerCase();
         currentData = currentData.filter(entry =>
             entry.doctor.toLowerCase().includes(lowerCaseSearchTerm) ||
             entry.date.toLowerCase().includes(lowerCaseSearchTerm) || // Simple date string search for MR
             entry.status.toLowerCase().includes(lowerCaseSearchTerm) ||
             entry.medicines.some(medicine => medicine.medicineName.toLowerCase().includes(lowerCaseSearchTerm)) // Search within medicine names
         );
    }

    // Update the total count based on the filtered data (before sorting and pagination)
    setTotalReports(currentData.length);

    return currentData; // Return the filtered data
  }, [userRole, processedData, searchTerm, selectedMr, selectedDoctor, selectedMedicine, startDate, endDate]); // Removed currentPage and itemsPerPage from dependencies

  // Use the useSortableTable hook at the top level with the filtered data
  const { sortedData, sortColumn, sortDirection, handleSort } = useSortableTable({
      data: filteredData, // Pass the filtered data to the hook
      defaultSortColumn: 'date', // Optional: set a default sort column
      defaultSortDirection: 'desc', // Optional: set a default sort direction
  });

  // Apply client-side pagination to the sorted data
  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage]); // Dependencies are sortedData, currentPage, itemsPerPage


  // Generic function to render the table, adaptable for both roles
  const renderReportTable = (isAdmin: boolean) => {
    let pageTitle = isAdmin ? 'Admin Visit Reports' : 'My Visit Reports';
    if (isAdmin && reportType === 'mr-medical') {
        pageTitle = 'Admin MR Medical Reports';
    } else if (isAdmin && reportType === 'doctors') {
        pageTitle = 'Admin Doctors Reports';
    }

    // Helper function to render sort icon
    const renderSortIcon = (column: keyof ReportEntry) => {
        // Always return ChevronsUpDown for sortable columns
        return <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />;
    };

    return (
      <>
        <h1 className="text-2xl font-bold mb-6">{pageTitle}</h1>

        {/* Filter Section */}
        {isAdmin ? (
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

            {/* Doctor Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Doctor</label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctorOptions.map((doc) => (
                    <SelectItem key={doc.value} value={doc.value}>
                      {doc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Medicine Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Medicine</label>
              {/* Ensure value is compared against selectedMedicine state (which will hold ID or 'all') */}
              <Select value={selectedMedicine} onValueChange={setSelectedMedicine}>
                <SelectTrigger>
                  {/* Display the selected medicine's name, or placeholder */}
                  <SelectValue placeholder="Select Medicine">
                    {selectedMedicine === 'all'
                      ? 'All Medicines'
                      : medicineOptions.find(opt => opt.value === selectedMedicine)?.label ?? 'Select Medicine'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Medicines</SelectItem>
                  {/* Set the *value* of the SelectItem to the medicine ID (med.value) */}
                  {medicineOptions.map((med) => (
                    <SelectItem key={med.value} value={med.value}>
                      {med.label} {/* Display the medicine name (med.label) */}
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
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Start Date"}
                    </Button>
                  </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
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
        ) : (
          <div className="mb-4">
            <Input
              type="search"
              placeholder="Search reports (Doctor, Medicine, Date, Status)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}

        {/* Loading and Error States */}
        {loading && <p>Loading reports...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}

        {/* Table */}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                    <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort('mrName' as keyof ReportEntry)} // Cast to keyof ReportEntry
                    >
                        <div className="flex items-center justify-between">
                            MR Name {renderSortIcon('mrName' as keyof ReportEntry)}
                        </div>
                    </TableHead>
                )}<TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('date' as keyof ReportEntry)} // Cast to keyof ReportEntry
                >
                    <div className="flex items-center justify-between">
                        Date {renderSortIcon('date' as keyof ReportEntry)}
                    </div>
                </TableHead><TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('doctor' as keyof ReportEntry)} // Cast to keyof ReportEntry
                >
                    <div className="flex items-center justify-between">
                        Doctor {renderSortIcon('doctor' as keyof ReportEntry)}
                    </div>
                </TableHead><TableHead>Medicines</TableHead> {/* Updated Header - Not sortable */}
                <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('status' as keyof ReportEntry)} // Cast to keyof ReportEntry
                >
                    <div className="flex items-center justify-between">
                        Status {renderSortIcon('status' as keyof ReportEntry)}
                    </div>
                </TableHead>
                {isAdmin && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((entry) => (
                  // Use the uniqueRowId generated during processing for the key
                  <TableRow key={entry.uniqueRowId}>{isAdmin && <TableCell>{entry.mrName}</TableCell>}<TableCell>{format(parseISO(entry.date), "MMM d, yyyy")}</TableCell><TableCell>{entry.doctor}</TableCell><TableCell>
                      {entry.medicines.length > 1 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-auto py-1 px-2">
                              {entry.medicines.length} Medicines <ChevronsUpDown className="ml-1 h-3 w-3" /> {/* Changed icon */}
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
                        // Display single medicine directly
                        <p className="text-sm">{entry.medicines[0].medicineName} ({entry.medicines[0].quantity})</p>
                      ) : (
                        // No medicines ordered
                        <p className="text-sm">No medicines ordered</p>
                      )}
                    </TableCell>{/* Updated Cell with Dropdown */}<TableCell>
                      <Badge variant={entry.status.toLowerCase() === 'approved' ? 'default' : 'secondary'}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
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
                                      // Delete visit_orders first
                                      const { error: orderError } = await supabase
                                        .from("visit_orders")
                                        .delete()
                                        .eq("visit_id", entry.id);
                                      if (orderError) throw orderError;
                                      // Delete visit
                                      const { error: visitError } = await supabase
                                        .from("visits")
                                        .delete()
                                        .eq("id", entry.id);
                                      if (visitError) throw visitError;
                                      toast.success("Visit deleted successfully");
                                      // Refresh data
                                      fetchReports();
                                    } catch (err) {
                                      toast.error("Failed to delete visit");
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
                <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center"> {/* Updated colspan */}
                    {searchTerm ? 'No reports match your search.' : 'No reports found.'}
                  </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </>
    );
  };

  return (
    <div className="container mx-auto py-8">
      {/* Render the appropriate table based on userRole */}
      {userRole === 'admin' && renderReportTable(true)}
      {userRole === 'mr' && renderReportTable(false)}

      {/* Pagination */}
      {!loading && !error && paginatedData.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center mt-4 w-full">
              <div className="flex items-center space-x-2 mb-4 md:mb-0">
                  <label className="text-sm font-medium">Items per page:</label>
                  <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-[80px]">
                          <SelectValue placeholder="10" />
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
                              isActive={currentPage > 1}
                          />
                      </PaginationItem>
                      
                      {/* Custom pagination logic to show only 3 consecutive pages + last page */}
                      {(() => {
                          const totalPages = Math.ceil(totalReports / itemsPerPage);
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
                                  if (currentPage < Math.ceil(totalReports / itemsPerPage)) setCurrentPage(currentPage + 1);
                              }}
                              isActive={currentPage < Math.ceil(totalReports / itemsPerPage)}
                          />
                      </PaginationItem>
                  </PaginationContent>
              </Pagination>
          </div>
      )}

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
};

export default ReportPage;
