
// Import our supabase types
import { Tables } from "@/integrations/supabase/types";

// Re-export for use in our application
export type User = Tables<'profiles'>;
export type Doctor = Tables<'doctors'>;
export type Medicine = Tables<'medicines'>;
export type Medical = Tables<'medicals'>;
export type Visit = Tables<'visits'> & {
  doctorName?: string;
  hospital?: string;
  orders?: VisitOrder[];
};
export type VisitOrder = Tables<'visit_orders'> & {
  medicine: { name: string } | null;
};
export type ReportType = Tables<'reports'>; // Export ReportType
export type Report = ReportType & {
  mrName?: string;
  doctorName?: string;
  medicineName?: string;
};

export interface Order {
  medicineId: string;
  medicineName: string;
  quantity: number;
}

// Define additional types that aren't directly from the database
export interface UserWithAuth extends User {
  auth?: {
    email?: string;
    password?: string;
  }
}

export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;

export interface GroupWithMembers extends Group {
  members: User[];
  memberCount: number;
}
