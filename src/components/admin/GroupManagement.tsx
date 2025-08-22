import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Group, User, GroupWithMembers } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  PlusIcon, 
  Trash2, 
  Users, 
  UserPlus, 
  UserMinus,
  Edit
} from "lucide-react";

export function GroupManagement() {
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembers | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchGroupsAndUsers();
  }, []);

  const fetchGroupsAndUsers = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all groups with their members
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select(`
          *,
          group_members (
            user_id,
            profiles (
              id,
              name,
              email,
              role
            )
          )
        `);

      if (groupsError) throw groupsError;

      // Transform the data to match our interface
      const transformedGroups: GroupWithMembers[] = (groupsData || []).map((group: any) => ({
        ...group,
        members: group.group_members?.map((member: any) => member.profiles).filter(Boolean) || [],
        memberCount: group.group_members?.length || 0
      }));

      setGroups(transformedGroups);

      // Fetch all MR users for member selection
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "mr")
        .eq("status", "active");

      if (usersError) throw usersError;
      setUsers(usersData || []);

    } catch (error) {
      console.error("Error fetching groups and users:", error);
      toast.error("Failed to load groups and users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: newGroupName.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add selected members to the group
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map(userId => ({
          group_id: groupData.id,
          user_id: userId
        }));

        const { error: membersError } = await supabase
          .from("group_members")
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      toast.success("Group created successfully");
      setIsCreateDialogOpen(false);
      setNewGroupName("");
      setSelectedMembers([]);
      fetchGroupsAndUsers();

    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", selectedGroup.id);

      if (error) throw error;

      toast.success("Group deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedGroup(null);
      fetchGroupsAndUsers();

    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManageMembers = async () => {
    if (!selectedGroup) return;

    try {
      setIsSubmitting(true);
      
      // Remove all current members
      const { error: deleteError } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", selectedGroup.id);

      if (deleteError) throw deleteError;

      // Add new selected members
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map(userId => ({
          group_id: selectedGroup.id,
          user_id: userId
        }));

        const { error: insertError } = await supabase
          .from("group_members")
          .insert(memberInserts);

        if (insertError) throw insertError;
      }

      toast.success("Group members updated successfully");
      setIsManageMembersDialogOpen(false);
      setSelectedGroup(null);
      setSelectedMembers([]);
      fetchGroupsAndUsers();

    } catch (error) {
      console.error("Error updating group members:", error);
      toast.error("Failed to update group members");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openManageMembersDialog = (group: GroupWithMembers) => {
    setSelectedGroup(group);
    setSelectedMembers(group.members.map(member => member.id));
    setIsManageMembersDialogOpen(true);
  };

  const openDeleteDialog = (group: GroupWithMembers) => {
    setSelectedGroup(group);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <p>Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-tight">Group Management</h3>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" /> Create Group
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No groups found. Create your first group to get started.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Users className="mr-1 h-3 w-3" />
                        {group.memberCount} members
                      </Badge>
                      {group.members.slice(0, 3).map((member) => (
                        <Badge key={member.id} variant="outline">
                          {member.name}
                        </Badge>
                      ))}
                      {group.members.length > 3 && (
                        <Badge variant="outline">
                          +{group.members.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(group.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openManageMembersDialog(group)}
                        title="Manage Members"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteDialog(group)}
                        title="Delete Group"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new group and assign Medical Representatives to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="members">Select Members</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !selectedMembers.includes(value)) {
                    setSelectedMembers([...selectedMembers, value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select MRs to add to group" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(user => !selectedMembers.includes(user.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMembers.map((memberId) => {
                    const user = users.find(u => u.id === memberId);
                    return (
                      <Badge key={memberId} variant="secondary">
                        {user?.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => setSelectedMembers(selectedMembers.filter(id => id !== memberId))}
                        >
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={isManageMembersDialogOpen} onOpenChange={setIsManageMembersDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Group Members</DialogTitle>
            <DialogDescription>
              Update the members of "{selectedGroup?.name}" group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="members">Select Members</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !selectedMembers.includes(value)) {
                    setSelectedMembers([...selectedMembers, value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select MRs to add to group" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(user => !selectedMembers.includes(user.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMembers.map((memberId) => {
                    const user = users.find(u => u.id === memberId);
                    return (
                      <Badge key={memberId} variant="secondary">
                        {user?.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => setSelectedMembers(selectedMembers.filter(id => id !== memberId))}
                        >
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageMembersDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManageMembers} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Members"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group{' '}
              <span className="font-semibold">"{selectedGroup?.name}"</span>{' '}
              and remove all member associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedGroup(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Yes, delete group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
