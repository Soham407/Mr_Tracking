import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { UserIcon, CalendarIcon, FileIcon, UsersIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";

interface VisitOrder {
  quantity: number;
}

interface Visit {
  id: string;
  mr_id: string;
  visit_orders: VisitOrder[];
}

interface MRPerformance {
  name: string;
  visits: number;
  orderValue: number;
}

interface SupabaseError {
  message: string;
  code?: string;
}

interface VisitTrendItem {
  month: string;
  visits: number;
  orders: number;
}

// Add new type for medical visit orders
interface MedicalVisitOrder {
  quantity: number;
  medicines: {
    name: string;
  } | null;
}

interface PendingApproval {
  id: string;
  name: string;
  type: 'Visit' | 'User' | 'Doctor' | 'MedicalVisit';
  date?: string;
  doctorName?: string;
  email?: string;
  detailedData?: Tables<'visits'> | Tables<'profiles'> | Tables<'doctors'> | (Tables<'medical_visits'> & { 
    medicalName?: string;
    medical_visit_orders: MedicalVisitOrder[];
  }) | null;
}

interface PendingReport {
  id: string;
  date: string;
  status: string;
}

interface PendingVisit {
  id: string;
  date: string;
  doctorName: string;
}

interface MonthlyData {
  [key: string]: {
    visits: number;
    orders: number;
  };
}

interface VisitData {
  date: string;
}

interface OrderData {
  date: string;
}

interface PendingVisitData {
  id: string;
  date: string;
  mr_id: string;
  doctors: {
    name: string;
  };
}

interface MRProfile {
  id: string;
  name: string;
}

// --- Loading skeletons ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({ totalMRs: 0, mrIncrease: 0, totalDoctors: 0, doctorIncrease: 0, totalVisits: 0, visitIncrease: 0, totalMedicals: 0, medicalIncrease: 0 });
  const [visitTrend, setVisitTrend] = useState<VisitTrendItem[]>([]);
  const [topMRs, setTopMRs] = useState<MRPerformance[]>([]);
  const [allTopMRsDataCache, setAllTopMRsDataCache] = useState<MRPerformance[] | null>(null);
  const [weeklyTopMRsDataCache, setWeeklyTopMRsDataCache] = useState<MRPerformance[] | null>(null);
  const [dailyTopMRsDataCache, setDailyTopMRsDataCache] = useState<MRPerformance[] | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true); // Global loading for initial dashboard load
  const [error, setError] = useState<string | null>(null); // Global error
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [filter, setFilter] = useState<'weekly' | 'daily' | 'all'>('all');
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'doctors' | 'visits' | 'medical'>('all');
  // --- Split loading states ---
  const [coreLoading, setCoreLoading] = useState(true); // For stats & visitTrend
  const [pendingLoading, setPendingLoading] = useState(true); // For pending approvals
  const [topMRsLoading, setTopMRsLoading] = useState(true); // For topMRs

  // Helper function to fetch and process MR performance data for a given date range
  const fetchAndProcessMRPerformance = async (startDate: Date | null, endDate: Date | null) => {
    const { data: mrsData, error: mrsDataError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'mr');
    if (mrsDataError) throw mrsDataError;

    let query = supabase
      .from('visits')
      .select('id, mr_id')
      .eq('status', 'approved');

    if (startDate) {
      query = query.gte('date', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('date', endDate.toISOString());
    }

    const { data: approvedVisitsData, error: approvedVisitsError } = await query;
    if (approvedVisitsError) throw approvedVisitsError;

    const visitIds = approvedVisitsData?.map(v => v.id) || [];
    let allVisitOrdersData: ({ visit_id: string; quantity: number; })[] = [];
    if (visitIds.length > 0) {
      const { data: ordersDataForVisits, error: ordersErrorForVisits } = await supabase
        .from('visit_orders')
        .select('visit_id, quantity')
        .in('visit_id', visitIds);
      if (ordersErrorForVisits) throw ordersErrorForVisits;
      allVisitOrdersData = ordersDataForVisits || [];
    }

    const visitOrdersMap = new Map<string, VisitOrder[]>();
    allVisitOrdersData.forEach(order => {
      if (!visitOrdersMap.has(order.visit_id)) {
        visitOrdersMap.set(order.visit_id, []);
      }
      visitOrdersMap.get(order.visit_id)!.push({ quantity: order.quantity });
    });

    const fullApprovedVisits: Visit[] = approvedVisitsData?.map(v => ({
      id: v.id,
      mr_id: v.mr_id,
      visit_orders: visitOrdersMap.get(v.id) || []
    })) || [];

    const mrPerformance: MRPerformance[] = mrsData?.map(mr => {
      const mrSpecificVisits: Visit[] = fullApprovedVisits.filter(visit => visit.mr_id === mr.id);
      
      const totalOrderValue = mrSpecificVisits.reduce((sum, visit) => {
        const visitValue = visit.visit_orders.reduce((orderSum, orderItem) =>
          orderSum + orderItem.quantity, 0);
        return sum + visitValue;
      }, 0);

      return {
        name: mr.name,
        visits: mrSpecificVisits.length,
        orderValue: totalOrderValue
      };
    }) || [];

    mrPerformance.sort((a, b) => b.visits - a.visits);
    return mrPerformance.filter(mr => mr.visits > 0);
  };

  // --- Refactored: Only fetch stats & visitTrend in core ---
  async function fetchCoreDashboardData() {
    setCoreLoading(true);
    setError(null);
    try {
      // Fetch stats in parallel
      const [{ count: totalMRs, error: mrsError },
             { count: totalDoctors, error: doctorsError },
             { count: totalVisits, error: visitsError },
             { count: totalMedicals, error: medicalsError }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mr'),
        supabase.from('doctors').select('*', { count: 'exact', head: true }),
        supabase.from('visits').select('*', { count: 'exact', head: true }),
        supabase.from('medicals').select('*', { count: 'exact', head: true }),
      ]);
      if (mrsError) {
        console.error('MRs count error:', mrsError);
        throw new Error(`Failed to fetch MRs count: ${mrsError.message}`);
      }
      if (doctorsError) {
        console.error('Doctors count error:', doctorsError);
        throw new Error(`Failed to fetch doctors count: ${doctorsError.message}`);
      }
      if (visitsError) {
        console.error('Visits count error:', visitsError);
        throw new Error(`Failed to fetch visits count: ${visitsError.message}`);
      }
      if (medicalsError) {
        console.error('Medicals count error:', medicalsError);
        throw new Error(`Failed to fetch medicals count: ${medicalsError.message}`);
      }
      setStats({
        totalMRs: totalMRs || 0,
        mrIncrease: 0,
        totalDoctors: totalDoctors || 0,
        doctorIncrease: 0,
        totalVisits: totalVisits || 0,
        visitIncrease: 0,
        totalMedicals: totalMedicals || 0,
        medicalIncrease: 0,
      });
      // --- Visit trend: Only one query, reuse for both visits & orders ---
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoISO = sixMonthsAgo.toISOString();
      const { data: allVisits, error: allVisitsError } = await supabase
        .from('visits')
        .select('date')
        .gte('date', sixMonthsAgoISO);
      if (allVisitsError) {
        console.error('Visit trend error:', allVisitsError);
        throw new Error(`Failed to fetch visit trend data: ${allVisitsError.message}`);
      }
      // Process for both visits & orders (assuming each row is a visit and an order)
      const monthlyData: MonthlyData = {};
      (allVisits as VisitData[])?.forEach(visit => {
        const month = new Date(visit.date).toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!monthlyData[month]) monthlyData[month] = { visits: 0, orders: 0 };
        monthlyData[month].visits++;
        monthlyData[month].orders++; // If you have a separate orders table, adjust here
      });
      const visitTrendArray: VisitTrendItem[] = Object.keys(monthlyData).map(month => ({
        month,
        visits: monthlyData[month].visits,
        orders: monthlyData[month].orders
      }));
      visitTrendArray.sort((a, b) => {
        const [aMonth, aYear] = a.month.split(' ');
        const [bMonth, bYear] = b.month.split(' ');
        const monthMap: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const aDate = new Date(parseInt(aYear), monthMap[aMonth as keyof typeof monthMap], 1);
        const bDate = new Date(parseInt(bYear), monthMap[bMonth as keyof typeof monthMap], 1);
        return aDate.getTime() - bDate.getTime();
      });
      setVisitTrend(visitTrendArray);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to fetch dashboard data: ${errorMessage}`);
    } finally {
      setCoreLoading(false);
    }
  }
  // --- Lazy: Fetch pending approvals summary only ---
  async function fetchPendingApprovals() {
    setPendingLoading(true);
    try {
      const [{ data: pendingVisitsData, error: pendingVisitsError },
             { data: pendingUsersData, error: pendingUsersError },
             { data: pendingDoctorsData, error: pendingDoctorsError },
             { data: pendingMedicalVisitsData, error: pendingMedicalVisitsError }] = await Promise.all([
        supabase.from('visits').select(`id, date, mr_id, doctors(name)`).eq('status', 'pending'),
        supabase.from('profiles').select('id, name, email').eq('role', 'mr').eq('status', 'pending'),
        supabase.from('doctors').select('id, name').eq('is_verified', false),
        supabase.from('medical_visits').select('id, visit_date, mr_id').eq('status', 'pending'),
      ]);
      
      if (pendingVisitsError) {
        console.error('Pending visits error:', pendingVisitsError);
        throw new Error(`Failed to fetch pending visits: ${pendingVisitsError.message}`);
      }
      if (pendingUsersError) {
        console.error('Pending users error:', pendingUsersError);
        throw new Error(`Failed to fetch pending users: ${pendingUsersError.message}`);
      }
      if (pendingDoctorsError) {
        console.error('Pending doctors error:', pendingDoctorsError);
        throw new Error(`Failed to fetch pending doctors: ${pendingDoctorsError.message}`);
      }
      if (pendingMedicalVisitsError) {
        console.error('Pending medical visits error:', pendingMedicalVisitsError);
        throw new Error(`Failed to fetch pending medical visits: ${pendingMedicalVisitsError.message}`);
      }
      
      // Get all unique MR IDs from pending visits and medical visits
      const allMrIds = new Set([
        ...(pendingVisitsData as unknown as PendingVisitData[])?.map(visit => visit.mr_id) || [],
        ...(pendingMedicalVisitsData as Tables<'medical_visits'>[])?.map(visit => visit.mr_id) || []
      ]);
      
      let mrMap = new Map<string, string>();
      if (allMrIds.size > 0) {
        const { data: mrData, error: mrError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(allMrIds));
        if (mrError) {
          console.error('MR data error:', mrError);
          throw new Error(`Failed to fetch MR data: ${mrError.message}`);
        }
        mrMap = new Map((mrData as unknown as MRProfile[])?.map(mr => [mr.id, mr.name]) || []);
      }
      
      // Format pending approvals (NO detailedData)
      const formattedPendingVisits: PendingApproval[] = (pendingVisitsData as unknown as PendingVisitData[])?.map(visit => ({
        id: visit.id,
        name: mrMap.get(visit.mr_id) || 'Unknown MR',
        type: 'Visit',
        date: new Date(visit.date).toLocaleDateString(),
        doctorName: visit.doctors?.name
      })) || [];
      
      const formattedPendingUsers: PendingApproval[] = (pendingUsersData as unknown as Tables<'profiles'>[])?.map(user => ({
        id: user.id,
        name: user.name || 'Unknown User',
        type: 'User',
        email: user.email || 'N/A'
      })) || [];
      
      const formattedPendingDoctors: PendingApproval[] = (pendingDoctorsData as unknown as Tables<'doctors'>[])?.map(doctor => ({
        id: doctor.id,
        name: doctor.name,
        type: 'Doctor',
      })) || [];
      
      const formattedPendingMedicalVisits: PendingApproval[] = (pendingMedicalVisitsData as Tables<'medical_visits'>[])?.map(visit => ({
        id: visit.id,
        name: mrMap.get(visit.mr_id) || 'Unknown MR',
        type: 'MedicalVisit',
        date: new Date(visit.visit_date).toLocaleDateString(),
        doctorName: 'No doctors assigned',
      })) || [];
      
      const allPendingApprovals: PendingApproval[] = [...formattedPendingVisits, ...formattedPendingUsers, ...formattedPendingDoctors, ...formattedPendingMedicalVisits];
      setPendingApprovals(allPendingApprovals); // NO details yet
    } catch (error: unknown) {
      console.error('FetchPendingApprovals error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to fetch pending approvals: ${errorMessage}`);
    } finally {
      setPendingLoading(false);
    }
  }
  // --- Lazy: Fetch topMRs for all filters ---
  const fetchTopMRs = useCallback(async () => {
    setTopMRsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weeklyStartDate = new Date(today);
      weeklyStartDate.setDate(today.getDate() - 7);
      const allTopMRs = await fetchAndProcessMRPerformance(null, null);
      const weeklyTopMRs = await fetchAndProcessMRPerformance(weeklyStartDate, today);
      const dailyTopMRs = await fetchAndProcessMRPerformance(today, today);
      setAllTopMRsDataCache(allTopMRs);
      setWeeklyTopMRsDataCache(weeklyTopMRs);
      setDailyTopMRsDataCache(dailyTopMRs);
      setTopMRs(allTopMRs);
    } catch (error) {
      setError(`Failed to fetch top MRs: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTopMRsLoading(false);
    }
  }, []);

  // --- On mount: Fetch critical, then lazy ---
  useEffect(() => {
    fetchCoreDashboardData();
    setTimeout(() => {
      fetchPendingApprovals();
      fetchTopMRs();
    }, 0); // Defer to next tick for perceived speed
  }, [fetchTopMRs]);

  useEffect(() => {
    // Update topMRs from cache when filter changes
    switch (filter) {
      case 'all':
        setTopMRs(allTopMRsDataCache || []);
        break;
      case 'weekly':
        setTopMRs(weeklyTopMRsDataCache || []);
        break;
      case 'daily':
        setTopMRs(dailyTopMRsDataCache || []);
        break;
      default:
        setTopMRs(allTopMRsDataCache || []);
    }
  }, [filter, allTopMRsDataCache, weeklyTopMRsDataCache, dailyTopMRsDataCache]);

  const handleApprove = async (id: string, type: 'Report' | 'Visit' | 'User' | 'Doctor' | 'MedicalVisit') => { // Added 'Doctor'
    setLoading(true);
    setError(null);
    try {
      if (type === 'Report') {
        const { error } = await supabase
          .from('reports')
          .update({ status: 'approved' })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'Visit') {
        const { error } = await supabase
          .from('visits')
          .update({ status: 'approved' })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'User') {
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'active' })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'Doctor') { // Added Doctor approval logic
        const { error } = await supabase
          .from('doctors')
          .update({ is_verified: true })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'MedicalVisit') {
        // Assuming 'medical_visits' table and 'status' column
        const { error } = await supabase
          .from('medical_visits')
          .update({ status: 'approved' })
          .eq('id', id);
        if (error) throw error;
      }
      fetchCoreDashboardData(); // Refresh data
    } catch (error: unknown) { // Changed any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      console.error(`Error approving ${type}:`, error);
      setLoading(false); // Stop loading on error
    }
  };

  const handleReject = async (id: string, type: 'Report' | 'Visit' | 'User' | 'Doctor' | 'MedicalVisit') => { // Added 'Doctor'
    setLoading(true);
    setError(null);
    try {
      if (type === 'Report') {
        const { error } = await supabase
          .from('reports')
          .update({ status: 'rejected' })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'Visit') {
        const { error } = await supabase
          .from('visits')
          .update({ status: 'rejected' })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'User') {
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'inactive' })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'Doctor') { // Added Doctor rejection logic
        const { error } = await supabase
          .from('doctors')
          .delete() // Assuming rejection means deleting the unverified doctor entry
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'MedicalVisit') {
        // Assuming 'medical_visits' table and 'status' column
        const { error } = await supabase
          .from('medical_visits')
          .update({ status: 'rejected' })
          .eq('id', id);
        if (error) throw error;
      }
      fetchCoreDashboardData(); // Refresh data
    } catch (error: unknown) { // Changed any to unknown
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      console.error(`Error rejecting ${type}:`, error);
      setLoading(false); // Stop loading on error
    }
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setSelectedApproval(null);
  };

  // --- Only fetch detailedData when View is clicked ---
  const handleViewDetails = async (item: PendingApproval) => {
    setIsPopupOpen(true);
    setSelectedApproval({ ...item, detailedData: null }); // Show popup immediately
    let detailedData: Tables<'visits'> | Tables<'profiles'> | Tables<'doctors'> | (Tables<'medical_visits'> & { 
      medicalName?: string;
      medical_visit_orders: MedicalVisitOrder[];
    }) | null = null;
    try {
      if (item.type === 'Visit') {
        const { data, error } = await supabase
          .from('visits')
          .select(`*, doctors(name), profiles(name), visit_orders(quantity, medicines(name))`)
          .eq('id', item.id)
          .single();
        if (error) throw error;
        detailedData = data;
      } else if (item.type === 'User') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', item.id)
          .single();
        if (error) throw error;
        detailedData = data;
      } else if (item.type === 'Doctor') {
        const { data, error } = await supabase
          .from('doctors')
          .select('*')
          .eq('id', item.id)
          .single();
        if (error) throw error;
        detailedData = data;
      } else if (item.type === 'MedicalVisit') {
        const { data: medicalVisitData, error: medicalVisitError } = await supabase
          .from('medical_visits')
          .select(`
            *,
            medical_visit_orders(quantity, medicines(name))
          `)
          .eq('id', item.id)
          .single();
        if (medicalVisitError) throw medicalVisitError;
        
        detailedData = { ...medicalVisitData, medicalName: 'N/A' } as Tables<'medical_visits'> & { 
          medicalName?: string;
          medical_visit_orders: MedicalVisitOrder[];
        };
      }
      setSelectedApproval({ ...item, detailedData });
    } catch (error) {
      setError(`Failed to fetch details: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Add new function to handle selection
  const handleSelectAll = () => {
    const filteredItems = pendingApprovals.filter(item => {
      if (selectionFilter === 'all') return true;
      if (selectionFilter === 'doctors') return item.type === 'Doctor';
      if (selectionFilter === 'visits') return item.type === 'Visit';
      if (selectionFilter === 'medical') return item.type === 'MedicalVisit';
      return false;
    });
    
    const newSelectedItems = new Set(selectedItems);
    filteredItems.forEach(item => newSelectedItems.add(item.id));
    setSelectedItems(newSelectedItems);
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleItemSelect = (id: string) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(id)) {
      newSelectedItems.delete(id);
    } else {
      newSelectedItems.add(id);
    }
    setSelectedItems(newSelectedItems);
  };

  const handleBulkApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const id of selectedItems) {
        const item = pendingApprovals.find(approval => approval.id === id);
        if (item) {
          await handleApprove(id, item.type);
        }
      }
      setSelectedItems(new Set());
      setIsSelectionModalOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const id of selectedItems) {
        const item = pendingApprovals.find(approval => approval.id === id);
        if (item) {
          await handleReject(id, item.type);
        }
      }
      setSelectedItems(new Set());
      setIsSelectionModalOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (coreLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <div className="text-center text-red-500">Error loading dashboard data: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome to MR Tracking Management</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer" onClick={() => navigate('/admin/users')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total MRs</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMRs}</div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer" onClick={() => navigate('/admin/doctors')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Doctors</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDoctors}</div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer" onClick={() => navigate('/admin/reports')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer" onClick={() => navigate('/admin/medicals')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Medicals</CardTitle>
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMedicals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Visits/Orders Chart */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Visit Trends</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {coreLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="visits" name="Visits" fill="#0EA5E9" barSize={isMobile ? 40 : 60} />
                <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#0891B2" barSize={isMobile ? 40 : 60} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Top MRs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base sm:text-lg">Top Performing MRs</CardTitle>
            <ToggleGroup type="single" value={filter} onValueChange={(value: 'weekly' | 'daily' | 'all') => setFilter(value)} size="sm" className="flex-wrap sm:flex-nowrap">
              <ToggleGroupItem value="all" className="text-xs sm:text-sm">All</ToggleGroupItem>
              <ToggleGroupItem value="weekly" className="text-xs sm:text-sm">Weekly</ToggleGroupItem>
              <ToggleGroupItem value="daily" className="text-xs sm:text-sm">Daily</ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            {topMRsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="max-h-[200px] sm:max-h-[250px] overflow-y-scroll no-scrollbar">
                <div className="space-y-3 sm:space-y-4">
                  {topMRs.length > 0 ? (
                    topMRs.map((mr, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                              {mr.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]">{mr.name}</p>
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm font-medium"><p className="text-xs text-muted-foreground">{mr.visits} visits</p></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4 text-xs sm:text-sm">No top performing MRs found.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base sm:text-lg">Pending Approvals</CardTitle>
            <Button 
              variant="outline" 
              onClick={() => setIsSelectionModalOpen(true)}
              disabled={pendingApprovals.length === 0}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Select Approvals
            </Button>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-3 sm:space-y-4 max-h-[200px] sm:max-h-[250px] overflow-y-auto scrollbar-hide">
                {pendingApprovals.map((item, index) => (
                  <div key={index} className="flex items-center justify-between flex-wrap sm:flex-nowrap gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
                      {item.type === 'Visit' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate"><span className="bg-green-200 text-black px-1 rounded">{item.type}</span> • {item.date} • {item.doctorName}</p>
                      )}
                      {item.type === 'User' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.type} • {item.email}</p>
                      )}
                      {item.type === 'MedicalVisit' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate"><span className="bg-blue-200 text-black px-1 rounded">{item.type}</span> • {item.date}</p>
                      )}
                      {item.type === 'Doctor' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.type}</p>
                      )}
                    </div>
                    <div className="flex gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} className="text-xs h-7 sm:h-8">View</Button>
                      <Button variant="outline" size="sm" onClick={() => handleReject(item.id, item.type)} className="text-xs h-7 sm:h-8">Reject</Button>
                      <Button size="sm" onClick={() => handleApprove(item.id, item.type)} className="text-xs h-7 sm:h-8">Approve</Button>
                    </div>
                  </div>
                ))}
                {pendingApprovals.length === 0 && !pendingLoading && (
                  <p className="text-center text-muted-foreground py-4 text-xs sm:text-sm">No pending approvals</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selection Modal */}
      <Dialog open={isSelectionModalOpen} onOpenChange={setIsSelectionModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Select Approvals</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Select multiple approvals to approve or reject them in bulk.
            </DialogDescription>
          </DialogHeader>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant={selectionFilter === 'all' ? 'default' : 'outline'} 
              onClick={() => setSelectionFilter('all')}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              All
            </Button>
            <Button 
              variant={selectionFilter === 'doctors' ? 'default' : 'outline'} 
              onClick={() => setSelectionFilter('doctors')}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Doctors
            </Button>
            <Button 
              variant={selectionFilter === 'visits' ? 'default' : 'outline'} 
              onClick={() => setSelectionFilter('visits')}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Visits
            </Button>
            <Button 
              variant={selectionFilter === 'medical' ? 'default' : 'outline'} 
              onClick={() => setSelectionFilter('medical')}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Medical
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={handleSelectAll} className="text-xs sm:text-sm h-8 sm:h-9">Select All</Button>
            <Button variant="outline" onClick={handleDeselectAll} className="text-xs sm:text-sm h-8 sm:h-9">Deselect All</Button>
          </div>

          {/* Selection List */}
          <div className="max-h-[40vh] sm:max-h-[50vh] overflow-y-auto">
            <div className="space-y-2 sm:space-y-3">
              {pendingApprovals
                .filter(item => {
                  if (selectionFilter === 'all') return true;
                  if (selectionFilter === 'doctors') return item.type === 'Doctor';
                  if (selectionFilter === 'visits') return item.type === 'Visit';
                  if (selectionFilter === 'medical') return item.type === 'MedicalVisit';
                  return false;
                })
                .map((item, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-4 p-2 border rounded flex-wrap sm:flex-nowrap">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => handleItemSelect(item.id)}
                      className="h-4 w-4 sm:h-5 sm:w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
                      {item.type === 'Visit' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate"><span className="bg-green-200 text-black px-1 rounded">{item.type}</span> • {item.date} • {item.doctorName}</p>
                      )}
                      {item.type === 'User' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.type} • {item.email}</p>
                      )}
                      {item.type === 'MedicalVisit' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate"><span className="bg-blue-200 text-black px-1 rounded">{item.type}</span> • {item.date}</p>
                      )}
                      {item.type === 'Doctor' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.type}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} className="text-xs h-7 sm:h-8">View Details</Button>
                  </div>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
            <Button variant="outline" onClick={() => setIsSelectionModalOpen(false)} className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkReject}
              disabled={selectedItems.size === 0}
              className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
            >
              Reject Selected ({selectedItems.size})
            </Button>
            <Button 
              onClick={handleBulkApprove}
              disabled={selectedItems.size === 0}
              className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
            >
              Approve Selected ({selectedItems.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Details Popup */}
      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{selectedApproval?.type} Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Information about the pending {selectedApproval?.type.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedApproval?.type === 'Visit' && selectedApproval.detailedData && (
              <div className="space-y-3">
                <div className="flex flex-wrap sm:flex-nowrap justify-between gap-2">
                  <p className="text-xs sm:text-sm"><strong>MR Name:</strong> {(selectedApproval.detailedData as Tables<'visits'> & { profiles: { name: string } | null })?.profiles?.name || 'N/A'}</p>
                  <p className="text-xs sm:text-sm"><strong>Date:</strong> {new Date((selectedApproval.detailedData as Tables<'visits'>).date).toLocaleDateString()}</p>
                </div>
                <p className="text-xs sm:text-sm"><strong>Doctor Name:</strong> {(selectedApproval.detailedData as Tables<'visits'> & { doctors: { name: string } | null })?.doctors?.name || 'N/A'}</p>
                {(selectedApproval.detailedData as Tables<'visits'> & { visit_orders: { quantity: number; medicines: { name: string } | null }[] })?.visit_orders && (selectedApproval.detailedData as Tables<'visits'> & { visit_orders: { quantity: number; medicines: { name: string } | null }[] }).visit_orders.length > 0 && (
                  <div className="overflow-x-auto">
                    <h4 className="text-sm sm:text-base font-semibold mt-4">Visit Orders:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Medicine</TableHead>
                          <TableHead className="text-xs sm:text-sm">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedApproval.detailedData as Tables<'visits'> & { visit_orders: { quantity: number; medicines: { name: string } | null }[] }).visit_orders.map((order, orderIndex) => (
                          <TableRow key={orderIndex}>
                            <TableCell className="text-xs sm:text-sm">{order.medicines?.name || 'N/A'}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{order.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="text-xs sm:text-sm mt-4"><strong>Notes:</strong> {(selectedApproval.detailedData as Tables<'visits'>).notes || 'N/A'}</p>
              </div>
            )}
            {selectedApproval?.type === 'User' && selectedApproval.detailedData && (
              <div>
                <p><strong>User Name:</strong> {(selectedApproval.detailedData as Tables<'profiles'>).name}</p>
                <p><strong>Email:</strong> {(selectedApproval.detailedData as Tables<'profiles'>).email}</p>
                <p><strong>Role:</strong> {(selectedApproval.detailedData as Tables<'profiles'>).role}</p>
                <p><strong>Status:</strong> {(selectedApproval.detailedData as Tables<'profiles'>).status}</p>
                <p><strong>Region:</strong> {(selectedApproval.detailedData as Tables<'profiles'>).region || 'N/A'}</p>
              </div>
            )}
            {selectedApproval?.type === 'Doctor' && selectedApproval.detailedData && (
              <div>
                <p><strong>Doctor Name:</strong> {(selectedApproval.detailedData as Tables<'doctors'>).name}</p>
                <p><strong>Specialization:</strong> {(selectedApproval.detailedData as Tables<'doctors'>).specialization}</p>
                <p><strong>Hospital:</strong> {(selectedApproval.detailedData as Tables<'doctors'>).hospital}</p>
                <p><strong>Address:</strong> {(selectedApproval.detailedData as Tables<'doctors'>).address}</p>
                <p><strong>Phone:</strong> {(selectedApproval.detailedData as Tables<'doctors'>).phone || 'N/A'}</p>
                <p><strong>Email:</strong> {(selectedApproval.detailedData as Tables<'doctors'>).email || 'N/A'}</p>
              </div>
            )}
             {selectedApproval?.type === 'MedicalVisit' && selectedApproval.detailedData && (
              <div>
                <div className="flex justify-between">
                  <p><strong>MR Name:</strong> {selectedApproval.name}</p>
                  <p><strong>Date:</strong> {new Date((selectedApproval.detailedData as Tables<'medical_visits'>).visit_date).toLocaleDateString()}</p>
                </div>
                <p><strong>Medical Name:</strong> {(selectedApproval.detailedData as Tables<'medical_visits'> & { medicalName?: string })?.medicalName || 'N/A'}</p>
                 {(selectedApproval.detailedData as Tables<'medical_visits'> & { medical_visit_orders: MedicalVisitOrder[] })?.medical_visit_orders && (selectedApproval.detailedData as Tables<'medical_visits'> & { medical_visit_orders: MedicalVisitOrder[] }).medical_visit_orders.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mt-4">Medical Visit Orders:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicine</TableHead>
                          <TableHead>Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedApproval.detailedData as Tables<'medical_visits'> & { medical_visit_orders: MedicalVisitOrder[] }).medical_visit_orders.map((order: MedicalVisitOrder, orderIndex: number) => (
                          <TableRow key={orderIndex}>
                            <TableCell>{order.medicines?.name || 'N/A'}</TableCell>
                            <TableCell>{order.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="mt-4"><strong>Notes:</strong> {(selectedApproval.detailedData as Tables<'medical_visits'>).notes || 'N/A'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" onClick={handleClosePopup} className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components for AdminDashboard
function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-9 w-9 rounded-full flex items-center justify-center overflow-hidden">
      {children}
    </div>
  );
}

function AvatarFallback({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      {children}
    </div>
  );
}
