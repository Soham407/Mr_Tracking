import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout"; // Import AppLayout

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProfileSettings from "./pages/ProfileSettings"; // Import the new page

// Admin Routes
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminDoctors from "./pages/admin/Doctors";
import AdminMedicines from "./pages/admin/Medicines";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminMedicals from "./pages/admin/Medicals";

// MR Routes
import MRDashboard from "./pages/mr/Dashboard";
import NewVisit from "./pages/mr/NewVisit";
import Doctors from "./pages/mr/Doctors";
// import NewDoctor from "./pages/mr/NewDoctor"; // Removed import for the old page
import Visits from "./pages/mr/Visits";
import Reports from "./pages/mr/Reports";
import ResetPassword from "./pages/ResetPassword"; // Import the new password reset page
import MedicalVisitsReportPage from "./components/reports/MedicalVisitsReportPage"; // Import the new component
import { MRMedicalsPage } from "./pages/mr/Medicals"; // Import the new MR Medicals page
import { NewMedicalVisit } from "./pages/mr/NewMedicalVisit"; // Import the new medical visit page
import Area from "./pages/mr/Area"; // Import the new Area page

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes wrapped by AppLayout */}
          <Route path="/profile-settings" element={<AppLayout><ProfileSettings /></AppLayout>} />
          
          {/* Admin Routes wrapped by AppLayout */}
          <Route path="/admin/dashboard" element={<AppLayout><AdminDashboard /></AppLayout>} />
          <Route path="/admin/users" element={<AppLayout><AdminUsers /></AppLayout>} />
          <Route path="/admin/doctors" element={<AppLayout><AdminDoctors /></AppLayout>} />
          <Route path="/admin/medicines" element={<AppLayout><AdminMedicines /></AppLayout>} />
          <Route path="/admin/reports" element={<AppLayout><AdminReports /></AppLayout>} />
          <Route path="/admin/settings" element={<AppLayout><AdminSettings /></AppLayout>} />
          <Route path="/admin/medicals" element={<AppLayout><AdminMedicals /></AppLayout>} />
          {/* Add route for Admin Medical Reports wrapped by AppLayout */}
          <Route path="/admin/medical-reports" element={<AppLayout><MedicalVisitsReportPage userRole="admin" /></AppLayout>} />

          {/* MR Routes wrapped by AppLayout */}
          <Route path="/mr/dashboard" element={<AppLayout><MRDashboard /></AppLayout>} />
          <Route path="/mr/visits/new" element={<AppLayout><NewVisit /></AppLayout>} />
          <Route path="/mr/doctors" element={<AppLayout><Doctors /></AppLayout>} />
          {/* <Route path="/mr/doctors/new" element={<AppLayout><NewDoctor /></AppLayout>} /> */} {/* Removed the old route */}
          <Route path="/mr/visits" element={<AppLayout><Visits /></AppLayout>} />
          <Route path="/mr/reports" element={<AppLayout><Reports /></AppLayout>} />
          <Route path="/mr/medicals" element={<AppLayout><MRMedicalsPage /></AppLayout>} /> {/* Add route for MR Medicals wrapped by AppLayout */}
          {/* Add route for MR Medical Reports wrapped by AppLayout */}
          <Route path="/mr/medical-reports" element={<AppLayout><MedicalVisitsReportPage userRole="mr" /></AppLayout>} />
          {/* Add route for New Medical Visit wrapped by AppLayout */}
          <Route path="/mr/medical-visits/new" element={<AppLayout><NewMedicalVisit /></AppLayout>} />
          <Route path="/mr/area" element={<AppLayout><Area /></AppLayout>} /> {/* Add the new Area route */}

          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
