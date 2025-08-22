import { supabase } from "@/integrations/supabase/client";
import { Medical } from "@/types";

// Helper function to get group member IDs for the current user
export async function getCurrentUserGroupMemberIds(): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get the groups the current user belongs to
    const { data: userGroups, error: userGroupsError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (userGroupsError || !userGroups || userGroups.length === 0) {
      return [user.id]; // If no groups, return only the current user
    }

    // Get all members from those groups
    const groupIds = userGroups.map(g => g.group_id);
    const { data: groupMembers, error: groupMembersError } = await supabase
      .from("group_members")
      .select("user_id")
      .in("group_id", groupIds);

    if (groupMembersError || !groupMembers) {
      return [user.id]; // Fallback to current user only
    }

    // Return unique user IDs including the current user
    const memberIds = [...new Set([...groupMembers.map(m => m.user_id), user.id])];
    return memberIds;

  } catch (error) {
    console.error("Error getting group member IDs:", error);
    // Fallback to current user only
    const { data: { user } } = await supabase.auth.getUser();
    return user ? [user.id] : [];
  }
}

// Helper function to check if current user is admin
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile) return false;
    return profile.role === "admin";

  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Helper function to get doctors with group-based filtering
export async function getDoctorsWithGroupFilter() {
  try {
    const isAdmin = await isCurrentUserAdmin();
    
    if (isAdmin) {
      // Admin sees all doctors
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialization, hospital, address, area, city, is_verified, added_by, created_at, email, phone");
      
      if (error) throw error;
      return data || [];
    } else {
      // MR sees doctors from their group members
      const groupMemberIds = await getCurrentUserGroupMemberIds();
      
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialization, hospital, address, area, city, is_verified, added_by, created_at, email, phone")
        .in("added_by", groupMemberIds);
      
      if (error) throw error;
      return data || [];
    }
  } catch (error) {
    console.error("Error fetching doctors with group filter:", error);
    throw error;
  }
}

// Helper function to get medicals with group-based filtering
export async function getMedicalsWithGroupFilter(): Promise<Medical[]> {
  try {
    const isAdmin = await isCurrentUserAdmin();
    
    if (isAdmin) {
      // Admin sees all medicals
      const { data, error } = await supabase
        .from("medicals")
        .select("id, name, address, area, created_at, user_id");
      
      if (error) throw error;
      return data || [];
    } else {
      // MR sees medicals from their group members
      const groupMemberIds = await getCurrentUserGroupMemberIds();
      
      const { data, error } = await supabase
        .from("medicals")
        .select("id, name, address, area, created_at, user_id")
        .in("user_id", groupMemberIds);
      
      if (error) throw error;
      return data || [];
    }
  } catch (error) {
    console.error("Error fetching medicals with group filter:", error);
    throw error;
  }
}
