import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, Search } from "lucide-react";
import { Visit } from "@/types";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function VisitsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isViewVisitDialogOpen, setIsViewVisitDialogOpen] = useState(false);
  const [viewingVisit, setViewingVisit] = useState<Visit | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [pageInputValue, setPageInputValue] = useState("");

  useEffect(() => {
    const fetchVisits = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const mrId = user?.id;

      if (!mrId) {
        setError("User not logged in.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("visits")
        .select(`
          *,
          doctors (name, hospital),
          visit_orders (id, quantity, medicine: medicines (name))
        `)
        .eq("mr_id", mrId)
        .order("date", { ascending: false });

      if (error) {
        setError(error.message);
        toast.error("Failed to load visits.");
      } else {
        // Map the fetched data to the Visit type, including doctorName, hospital, and orders
        const formattedVisits = data.map(visit => ({
          ...visit,
          doctorName: visit.doctors?.name || "N/A",
          hospital: visit.doctors?.hospital || "N/A",
          orders: visit.visit_orders.map(order => ({
            id: order.id,
            quantity: order.quantity,
            medicine_name: order.medicine?.name || "N/A" // Extract medicine name
          })) || []
        }));
        setVisits(formattedVisits as Visit[]);
      }
      setIsLoading(false);
    };

    fetchVisits();
  }, []);

  // Filter visits based on search term
  const filteredVisits = visits.filter(
    (visit) =>
      visit.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.hospital?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.orders?.some(order => order.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const paginatedVisits = filteredVisits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageNavigation = () => {
    const pageNumber = parseInt(pageInputValue);
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      setIsPageDialogOpen(false);
      setPageInputValue("");
    }
  };

  const openPageDialog = () => {
    setPageInputValue("");
    setIsPageDialogOpen(true);
  };

  // Reset current page if itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, searchTerm]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Visit Log</h2>
          <Button onClick={() => navigate("/mr/visits/new")} disabled>
            <PlusIcon className="mr-2 h-4 w-4" /> Log New Visit
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search visits by doctor name or hospital..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled
            />
          </div>
        </div>
        <div className="rounded-md border p-4 text-center">
          Loading visits...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Visit Log</h2>
          <Button onClick={() => navigate("/mr/visits/new")} disabled>
            <PlusIcon className="mr-2 h-4 w-4" /> Log New Visit
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search visits by doctor name or hospital..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled
            />
          </div>
        </div>
        <div className="rounded-md border p-4 text-center text-destructive">
          Error loading visits: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Visit Log</h2>
        <Button onClick={() => navigate("/mr/visits/new")}>
          <PlusIcon className="mr-2 h-4 w-4" /> Log New Visit
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search visits by doctor name or hospital..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead className="hidden md:table-cell">Hospital</TableHead>
              <TableHead className="hidden lg:table-cell">Orders</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedVisits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No visits found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedVisits.map((visit) => (
                <TableRow
                  key={visit.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setViewingVisit(visit);
                    setIsViewVisitDialogOpen(true);
                    console.log("Viewing Visit Orders:", visit.orders);
                  }}
                >
                  <TableCell>
                    {format(new Date(visit.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{visit.doctorName}</TableCell>
                  <TableCell className="hidden md:table-cell">{visit.hospital}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {visit.orders?.length || 0} items
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      visit.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : visit.status === "pending"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-orange-100 text-orange-800"
                    }`}>
                      {visit.status === "approved"
                        ? "Approved"
                        : visit.status === "pending"
                        ? "Pending"
                        : "Changes Requested"}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls (matching Report Page) */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row justify-between items-center mt-4 w-full">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <label className="text-sm font-medium">Items per page:</label>
            <Select value={String(itemsPerPage)} onValueChange={value => setItemsPerPage(Number(value))}>
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
                  onClick={e => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                  isActive={currentPage > 1}
                />
              </PaginationItem>
              {/* Custom pagination logic: 3 consecutive pages + ellipsis + first/last */}
              {(() => {
                const pages = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          onClick={e => { e.preventDefault(); setCurrentPage(i); }}
                          isActive={currentPage === i}
                        >
                          {i}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                } else {
                  let startPage = Math.max(1, currentPage - 1);
                  let endPage = Math.min(totalPages, currentPage + 1);
                  if (currentPage <= 2) {
                    startPage = 1;
                    endPage = 3;
                  }
                  if (currentPage >= totalPages - 1) {
                    startPage = totalPages - 2;
                    endPage = totalPages;
                  }
                  if (startPage > 1) {
                    pages.push(
                      <PaginationItem key={1}>
                        <PaginationLink
                          href="#"
                          onClick={e => { e.preventDefault(); setCurrentPage(1); }}
                          isActive={currentPage === 1}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                    );
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
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          onClick={e => { e.preventDefault(); setCurrentPage(i); }}
                          isActive={currentPage === i}
                        >
                          {i}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
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
                          onClick={e => { e.preventDefault(); setCurrentPage(totalPages); }}
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
                  onClick={e => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                  isActive={currentPage < totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* View Visit Dialog */}
      <Dialog open={isViewVisitDialogOpen} onOpenChange={setIsViewVisitDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
            <DialogDescription>
              Viewing details for the visit on {viewingVisit?.date ? format(new Date(viewingVisit.date), "MMM d, yyyy") : "N/A"}.
            </DialogDescription>
          </DialogHeader>
          {viewingVisit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{format(new Date(viewingVisit.date), "MMM d, yyyy")}</p>
                </div>
                <div className="grid gap-2">
                  <Label>Doctor</Label>
                  <p className="text-sm p-2 border rounded bg-muted">{viewingVisit.doctorName}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Hospital / Clinic</Label>
                <p className="text-sm p-2 border rounded bg-muted">{viewingVisit.hospital}</p>
              </div>

              <div className="grid gap-2">
                <Label>Orders ({viewingVisit.orders?.length || 0})</Label>
                {viewingVisit.orders && viewingVisit.orders.length > 0 ? (
                  <ul className="list-disc list-inside text-sm p-2 border rounded bg-muted">
                    {viewingVisit.orders.map((order, index) => (
                      <li key={order.id || index}>{order.medicine_name} ({order.quantity})</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm p-2 border rounded bg-muted">- No orders -</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <p className="text-sm p-2 border rounded bg-muted">{viewingVisit.notes || "-"}</p>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <p className={`text-sm p-2 border rounded ${
                      viewingVisit.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : viewingVisit.status === "pending"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-orange-100 text-orange-800"
                    }`}>
                  {viewingVisit.status === "approved"
                    ? "Approved"
                    : viewingVisit.status === "pending"
                    ? "Pending"
                    : "Changes Requested"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewVisitDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                max={totalPages}
                value={pageInputValue}
                onChange={e => setPageInputValue(e.target.value)}
                placeholder={`1 - ${totalPages}`}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handlePageNavigation();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Enter a page number between 1 and {totalPages}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePageNavigation}>Go</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
