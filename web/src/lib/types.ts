export type Role = "owner" | "admin" | "member";
export type ProjectStatus = "active" | "archived";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type InvitationStatus = "pending" | "accepted" | "expired";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: Role;
  profiles?: Pick<Profile, "display_name" | "email">;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  project_id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  token: string;
  expires_at: string;
}

export interface ProjectSlackChannel {
  id: string;
  project_id: string;
  slack_channel_id: string;
  notify_due_date: boolean;
}
