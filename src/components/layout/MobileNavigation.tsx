import { 
  CalendarIcon, 
  FileIcon, 
  HomeIcon, 
  PlusIcon, 
  SearchIcon, 
  SettingsIcon, 
  UserIcon, 
  UsersIcon, 
  ChartBarIcon,
  Pill,
  MapIcon
} from "lucide-react";
import { NavLink, NavigateFunction } from "react-router-dom";
import { useUser } from "@/context/UserContext"; // Import useUser
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";

interface MobileNavigationProps {
  className?: string;
  userRole: string;
  navigate: NavigateFunction;
}

export function MobileNavigation({ className, userRole, navigate }: MobileNavigationProps) {
  const { user } = useUser(); // Get user from context
  const isInactiveMr = user?.role === 'mr' && user?.status === 'inactive';
  // Remove useNavigate() call here

  // Admin navigation items
  const adminNavItems = [
    {
      title: "Dashboard",
      href: "/admin/dashboard",
      icon: HomeIcon,
    },
    {
      title: "Users",
      href: "/admin/users",
      icon: UsersIcon,
    },
    {
      title: "Doctors",
      href: "/admin/doctors",
      icon: UserIcon,
    },
    {
      title: "Medicines",
      href: "/admin/medicines",
      icon: Pill,
    },
    {
      title: "Reports",
      href: "/admin/reports",
      icon: FileIcon,
    },
  ];

  // Base MR navigation items
  const mrNavItems = [
    {
      title: "Dashboard",
      href: "/mr/dashboard",
      icon: HomeIcon,
    },
    // Log Visit will be handled as a dropdown
    {
      title: "Doctors",
      href: "/mr/doctors",
      icon: UserIcon,
    },
    {
      title: "Visits",
      href: "/mr/visits",
      icon: CalendarIcon,
    },
    {
      title: "Area",
      href: "/mr/area",
      icon: MapIcon,
    },
    {
      title: "Reports",
      href: "/mr/reports", // The href here is not strictly necessary for the dropdown trigger but good to have
      icon: FileIcon,
    },
  ];

  // Filter out "Log Visit" if MR is inactive - this filtering is no longer needed here
  // as Log Visit is now a dropdown handled separately.
  // if (isInactiveMr) {
  //   mrNavItems = mrNavItems.filter(item => item.href !== "/mr/visits/new");
  // }

  // Choose which navigation items to show based on user role
  const navItems = userRole === "admin" ? adminNavItems : mrNavItems;

  return (
    <nav className={`fixed bottom-0 w-full flex items-center justify-around border-t bg-background px-2 py-2 ${className}`}>
      {navItems.map((item) => {
        // Handle the Reports dropdown separately
        if (item.title === "Reports" && userRole === "admin") { // Only show dropdown for admin reports
          return (
            <DropdownMenu key={item.href}>
              <DropdownMenuTrigger asChild>
                <div className="mobile-nav-link flex flex-col items-center cursor-pointer">
                  <FileIcon className="h-5 w-5" />
                  <span className="text-xs">Reports</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center">
                <DropdownMenuItem key="/admin/reports?type=mr-medical" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/admin/reports?type=mr-medical"); }}>
                  <div>MR Medical Report</div>
                </DropdownMenuItem>
                <DropdownMenuItem key="/admin/reports?type=doctors" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/admin/reports?type=doctors"); }}>
                  <div>Doctors Report</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        // Handle MR Reports dropdown
        if (item.title === "Reports" && userRole === "mr") {
          return (
            <DropdownMenu key={item.href}>
              <DropdownMenuTrigger asChild>
                <div className="mobile-nav-link flex flex-col items-center cursor-pointer">
                  <FileIcon className="h-5 w-5" />
                  <span className="text-xs">Reports</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center">
                <DropdownMenuItem key="/mr/reports" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/mr/reports"); }}>
                  <div>Doctors Report</div>
                </DropdownMenuItem>
                <DropdownMenuItem key="/mr/medical-reports" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/mr/medical-reports"); }}>
                   <div>Medical Report</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        // Handle MR Log Visit dropdown
        if (item.title === "Dashboard" && userRole === "mr" && !isInactiveMr) { // Add Log Visit dropdown after Dashboard for active MR
           return (
            <React.Fragment key={`${item.href}-container`}>
             <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `mobile-nav-link ${isActive ? "active" : ""} flex flex-col items-center`
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.title}</span>
              </NavLink>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="mobile-nav-link flex flex-col items-center cursor-pointer">
                    <PlusIcon className="h-5 w-5" />
                    <span className="text-xs">Log Visit</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center">
                  <DropdownMenuItem key="/mr/visits/new" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/mr/visits/new"); }}>
                    <div>Doctors Visit</div>
                  </DropdownMenuItem>
                  <DropdownMenuItem key="/mr/medical-visits/new" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/mr/medical-visits/new"); }}>
                    <div>Medical Visit</div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </React.Fragment>
           );
        }

        return (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `mobile-nav-link ${isActive ? "active" : ""} flex flex-col items-center`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.title}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
